"""Merge series that share one physical folder into one series, writing a NEW database.

Folder-organized libraries used to keep one series per format inside a folder.
The scanner now keeps one series per folder and refuses to touch a folder that
still holds several. This tool merges them in a cold copy of the catalog:
chapter and file ids are preserved, personal rows follow their chapters, and the
input database is never modified. Run it only on a stopped server's copy.
"""
import argparse
from contextlib import closing
import json
from pathlib import Path
import sqlite3


# Rows describing the series itself: dropped with the merged series (the survivor keeps its own)
OWNED_TABLES = {'Volume', 'SeriesMetadata', 'ExternalSeriesMetadata'}
# Personal rows that follow the survivor. Others referencing a merged series make the tool refuse.
PERSONAL_TABLES = {'AppUserProgresses', 'AppUserReadingSessionActivityData', 'AppUserBookmark', 'AppUserRating',
                   'AppUserWantToRead', 'AppUserOnDeckRemoval', 'ReadingListItem', 'AppUserTableOfContent',
                   'AppUserAnnotation', 'AppUserCollectionSeries'}


def columns(c, table):
    return {r[1] for r in c.execute(f'PRAGMA table_info("{table}")')}


def series_references(c):
    """(table, column) pairs that hold a series id"""
    names = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    refs = [(t, 'SeriesId') for t in names if 'SeriesId' in columns(c, t)]
    if 'AppUserCollectionSeries' in names:
        refs.append(('AppUserCollectionSeries', 'ItemsId'))
    return refs


def duplicate_groups(c):
    groups = c.execute('''SELECT s.LibraryId, s.FolderPath, group_concat(s.Id) FROM Series s
        JOIN Library l ON l.Id=s.LibraryId
        WHERE l.FolderBasedOrganization=1 AND s.FolderPath IS NOT NULL
        GROUP BY s.LibraryId, s.FolderPath HAVING count(*) > 1 ORDER BY s.LibraryId, s.FolderPath''').fetchall()
    return [(library, folder, sorted(int(i) for i in ids.split(','))) for library, folder, ids in groups]


def check_references(c, merged):
    marks = ','.join('?' * len(merged))
    unknown = sorted({t for t, col in series_references(c)
                      if t not in OWNED_TABLES | PERSONAL_TABLES
                      and c.execute(f'SELECT 1 FROM "{t}" WHERE "{col}" IN ({marks}) LIMIT 1', merged).fetchone()})
    if unknown:
        raise ValueError('Unknown references to merged series: ' + ', '.join(unknown))


def merge_group(c, survivor, merged, dropped):
    moved_chapters, moved_volumes = [], []
    for series_id in merged:
        for volume_id, lookup in c.execute('SELECT Id, LookupName FROM Volume WHERE SeriesId=?', (series_id,)).fetchall():
            target = c.execute('SELECT Id FROM Volume WHERE SeriesId=? AND LookupName=?', (survivor, lookup)).fetchone()
            if target is None:
                c.execute('UPDATE Volume SET SeriesId=? WHERE Id=?', (survivor, volume_id))
                moved_volumes.append(volume_id)
                continue
            moved_chapters += [r[0] for r in c.execute('SELECT Id FROM Chapter WHERE VolumeId=?', (volume_id,))]
            c.execute('UPDATE Chapter SET VolumeId=? WHERE VolumeId=?', (target[0], volume_id))

    # Volume-scoped rows follow their chapter before the emptied volumes cascade them away
    marks = ','.join('?' * len(moved_chapters))
    for table in (t for t, _ in series_references(c) if t in PERSONAL_TABLES and {'ChapterId', 'VolumeId'} <= columns(c, t)):
        if moved_chapters:
            c.execute(f'''UPDATE "{table}" SET VolumeId=(SELECT VolumeId FROM Chapter WHERE Chapter.Id="{table}".ChapterId)
                WHERE ChapterId IN ({marks})''', moved_chapters)

    for table, column in series_references(c):
        if table not in PERSONAL_TABLES:
            continue
        for series_id in merged:
            c.execute(f'UPDATE OR IGNORE "{table}" SET "{column}"=? WHERE "{column}"=?', (survivor, series_id))
            removed = c.execute(f'DELETE FROM "{table}" WHERE "{column}"=?', (series_id,)).rowcount
            if removed:
                dropped[table] = dropped.get(table, 0) + removed

    rewrite_history(c, survivor, merged)
    c.execute(f'DELETE FROM Volume WHERE SeriesId IN ({",".join("?" * len(merged))})', merged)
    c.execute(f'DELETE FROM Series WHERE Id IN ({",".join("?" * len(merged))})', merged)
    c.execute('UPDATE Series SET Pages=(SELECT coalesce(sum(Pages),0) FROM Volume WHERE SeriesId=?) WHERE Id=?',
              (survivor, survivor))
    return moved_chapters, moved_volumes


def rewrite_history(c, survivor, merged):
    """Reading history stores activity ids in JSON; point them at the survivor and the chapters' volumes."""
    if 'AppUserReadingHistory' not in {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}:
        return
    volumes = dict(c.execute('SELECT Id, VolumeId FROM Chapter'))
    for row_id, data in c.execute('SELECT Id, Data FROM AppUserReadingHistory').fetchall():
        history = json.loads(data)
        changed = False
        for activity in history.get('Activities', []):
            if activity.get('SeriesId') in merged:
                activity['SeriesId'] = survivor
                if activity.get('ChapterId') in volumes:
                    activity['VolumeId'] = volumes[activity['ChapterId']]
                changed = True
        if changed:
            c.execute('UPDATE AppUserReadingHistory SET Data=? WHERE Id=?', (json.dumps(history), row_id))


def merge(source, destination):
    """Copy SOURCE into DESTINATION and merge its duplicate folder series there. Returns a report."""
    source, destination = Path(source), Path(destination)
    if destination.exists():
        raise FileExistsError('Destination already exists.')
    with closing(sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True)) as src:
        groups = duplicate_groups(src)
        check_references(src, [i for _, _, ids in groups for i in ids[1:]])
        files_before = dict(src.execute('SELECT Id, ChapterId FROM MangaFile'))
        with closing(sqlite3.connect(destination)) as out:
            src.backup(out)

    report = {'mergedGroups': [], 'droppedDuplicates': {}}
    with closing(sqlite3.connect(destination)) as out:
        out.execute('PRAGMA foreign_keys=ON')
        try:
            with out:
                for library, folder, (survivor, *merged) in groups:
                    chapters, volumes = merge_group(out, survivor, merged, report['droppedDuplicates'])
                    report['mergedGroups'].append({'libraryId': library, 'folder': folder, 'survivor': survivor,
                                                   'merged': merged, 'movedChapters': chapters, 'movedVolumes': volumes})
                if dict(out.execute('SELECT Id, ChapterId FROM MangaFile')) != files_before:
                    raise RuntimeError('A file lost or changed its chapter; nothing was written.')
                if out.execute('PRAGMA foreign_key_check').fetchone():
                    raise RuntimeError('Foreign key check failed; nothing was written.')
        except BaseException:
            out.close()
            destination.unlink()
            raise
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'destination', 'report'):
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    paths = [args.source, args.destination, args.report]
    if len({p.resolve() for p in paths}) != len(paths):
        raise ValueError('Input, database output and report paths must be distinct.')
    if args.report.exists():
        raise FileExistsError('Report already exists.')
    report = merge(args.source, args.destination)
    with args.report.open('x', encoding='utf-8') as file:
        file.write(json.dumps(report, indent=2))
    print(json.dumps({'mergedGroups': len(report['mergedGroups'])}))


if __name__ == '__main__':
    main()
