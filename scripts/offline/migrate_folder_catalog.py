"""Migrate a cold catalog into a NEW database using a validated folder reference.

Inputs and original files are read-only. Superseded rows are retained in an
unshared archive library. Keep API-key sync paused until clients handle the new
hierarchy, including the split of formerly multi-file chapters.
"""
import argparse
from collections import Counter, defaultdict
from contextlib import closing
import hashlib
import json
from pathlib import Path
import sqlite3

ARCHIVE_NAME = 'Arquivo de catalogo anterior (nao sincronizar)'
POLICY = ('EnableMetadata', 'AllowMetadataMatching', 'AllowScrobbling', 'ManageCollections', 'ManageReadingLists')
SERIES_FIELDS = ('Name','SortName','OriginalName','NormalizedName','NormalizedOriginalName',
                 'LocalizedName','NormalizedLocalizedName','FolderPath','LowestFolderPath','Format',
                 'Pages','WordCount','MinHoursToRead','MaxHoursToRead','AvgHoursToRead',
                 'NameLocked','SortNameLocked','LocalizedNameLocked','LastFolderScanned','LastFolderScannedUtc')
VOLUME_FIELDS = ('Name','LookupName','Number','MinNumber','MaxNumber','Pages','WordCount',
                 'MinHoursToRead','MaxHoursToRead','AvgHoursToRead')
CHAPTER_FIELDS = ('Title','TitleName','Range','Number','MinNumber','MaxNumber','SortOrder','SortOrderLocked',
                  'IsSpecial','Pages','WordCount','MinHoursToRead','MaxHoursToRead','AvgHoursToRead')
PERSONAL_SERIES_TABLES = ('AppUserWantToRead','AppUserOnDeckRemoval','AppUserRating')


def read_db(path):
    c = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)
    c.row_factory = sqlite3.Row
    return c


def rows(c, table):
    return {r['Id']: dict(r) for r in c.execute(f'SELECT * FROM "{table}"')}


def columns(c, table):
    return {r[1] for r in c.execute(f'PRAGMA table_info("{table}")')}


def tables(c):
    return {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def placements(c):
    return {r['Id']: dict(r) for r in c.execute('''
        SELECT f.*,c.VolumeId,v.SeriesId,s.LibraryId FROM MangaFile f
        JOIN Chapter c ON c.Id=f.ChapterId JOIN Volume v ON v.Id=c.VolumeId JOIN Series s ON s.Id=v.SeriesId''')}


def auxiliary(path):
    return any(p.casefold() in ('capas','.yacreaderlibrary') for p in path.replace('\\','/').split('/'))


def update(c, table, row_id, values):
    values = {k:v for k,v in values.items() if k in columns(c, table) and k != 'Id'}
    if values:
        c.execute(f'UPDATE "{table}" SET ' + ','.join(f'"{k}"=?' for k in values) + ' WHERE Id=?',
                  [*values.values(),row_id])


def insert(c, table, template, **overrides):
    values = {k:v for k,v in (template | overrides).items() if k in columns(c, table) and k != 'Id'}
    cursor = c.execute(f'INSERT INTO "{table}" (' + ','.join(f'"{k}"' for k in values) + ') VALUES (' +
                       ','.join('?' for _ in values) + ')',list(values.values()))
    return cursor.lastrowid


def assign(old_files, desired_files, level, paired_files, protected):
    scores = Counter()
    for new_file, old_file in paired_files.items():
        desired_id, old_id = desired_files[new_file][level], old_files[old_file][level]
        scores[desired_id, old_id] += 1 + 10000 * int(old_files[old_file]['ChapterId'] in protected)
    result, used = {}, set()
    for (new_id, old_id), _ in sorted(scores.items(), key=lambda p:(-p[1], p[0][1], p[0][0])):
        if new_id not in result and old_id not in used:
            result[new_id] = old_id
            used.add(old_id)
    return result


def migrate(source, reference, library_map, destination, path_recoveries=None):
    source, reference, destination = map(Path, (source,reference,destination))
    if destination.exists():
        raise FileExistsError('Destination already exists; refusing to overwrite.')
    if source.resolve() == reference.resolve():
        raise ValueError('A separate folder reference is required.')
    library_map = {int(k):int(v) for k,v in library_map.items()}
    if len(set(library_map.values())) != len(library_map):
        raise ValueError('Ambiguous library mapping.')
    with closing(read_db(source)) as old, closing(read_db(reference)) as ref:
        if 'FolderBasedOrganization' not in columns(old,'Library'):
            raise ValueError('Upgrade the schema on an isolated copy before migration.')
        if old.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or old.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Source integrity check failed.')
        old_files = {k:v for k,v in placements(old).items() if v['LibraryId'] in library_map}
        inverse = {v:k for k,v in library_map.items()}
        desired_files = {k:v for k,v in placements(ref).items() if v['LibraryId'] in inverse}
        if not desired_files:
            raise ValueError('Empty reference coverage.')
        path_recoveries = {int(k):v for k,v in (path_recoveries or {}).items()}
        for file_id, recovered_path in path_recoveries.items():
            original = old_files.get(file_id)
            candidates = [f for f in desired_files.values() if original and
                          inverse[f['LibraryId']]==original['LibraryId'] and f['FilePath']==recovered_path]
            if not original or len(candidates)!=1:
                raise ValueError('Invalid explicit path recovery.')
            candidate = candidates[0]
            if not original.get('KoreaderHash') or not original.get('Bytes') or any(
                original.get(k)!=candidate.get(k) for k in ('KoreaderHash','Bytes','Pages','Format')):
                raise ValueError('Path recovery fingerprint mismatch.')
            original['FilePath'] = recovered_path
        for old_id, ref_id in library_map.items():
            lib = ref.execute('SELECT * FROM Library WHERE Id=?',(ref_id,)).fetchone()
            if not lib or not lib['FolderBasedOrganization']:
                raise ValueError('Reference library is not organized by folders.')
        by_path = {}
        for f in old_files.values():
            key = f['LibraryId'],f['FilePath']
            if key in by_path: raise ValueError('Ambiguous source file identity.')
            by_path[key] = f['Id']
        desired_paths, pairs = set(), {}
        for f in desired_files.values():
            key = inverse[f['LibraryId']], f['FilePath']
            if key in desired_paths: raise ValueError('Ambiguous reference file identity.')
            desired_paths.add(key)
            if key in by_path:
                old_f = old_files[by_path[key]]
                if old_f['Format'] != f['Format'] or old_f['Pages'] != f['Pages']:
                    raise ValueError('File format/page-count changed; review before migration.')
                pairs[f['Id']] = old_f['Id']
        if any((f['LibraryId'],f['FilePath']) not in desired_paths and not auxiliary(f['FilePath']) for f in old_files.values()):
            raise ValueError('Reference coverage loses readable files.')
        protected = set()
        for table in tables(old):
            if table.startswith('AppUser') or table in ('ReadingListItem','ReadingListRemapRule','ScrobbleEvent','ScrobbleRuleHistory'):
                if 'ChapterId' in columns(old,table):
                    protected.update(r[0] for r in old.execute(f'SELECT ChapterId FROM "{table}" WHERE ChapterId IS NOT NULL'))
        if 'AppUserReadingHistory' in tables(old):
            for (data,) in old.execute('SELECT Data FROM AppUserReadingHistory'):
                protected.update(a.get('ChapterId') for a in json.loads(data or '{}').get('Activities',[]))
        old_groups = defaultdict(list)
        for f in old_files.values(): old_groups[f['ChapterId']].append(f)
        for chapter_id, files in old_groups.items():
            if len(files)>1 and any(f['Format'] != 0 for f in files) and chapter_id in protected:
                raise ValueError('Personal state on a multi-file chapter is ambiguous; migration refused.')
        maps = {level:assign(old_files,desired_files,level,pairs,protected) for level in ('SeriesId','VolumeId','ChapterId')}
        old_data = {t:rows(old,t) for t in ('Series','Volume','Chapter','Library')}
        ref_data = {t:rows(ref,t) for t in ('Series','Volume','Chapter')}
        affected_series = {f['SeriesId'] for f in old_files.values()}
        original_ids = {t:set(rows(old,t)) for t in ('Series','Volume','Chapter','MangaFile')}
        # Reserve the new output atomically; never open an unrelated existing file.
        with destination.open('xb'):
            pass
        with closing(sqlite3.connect(destination)) as output:
            output.row_factory = sqlite3.Row
            old.backup(output)
            output.execute('PRAGMA foreign_keys=ON')
            try:
                output.execute('BEGIN IMMEDIATE')
                archive = insert(output,'Library',old_data['Library'][next(iter(library_map))], Name=ARCHIVE_NAME,
                    FolderBasedOrganization=0,FolderWatching=0,IncludeInDashboard=0,IncludeInSearch=0,IncludeInRecommended=0,
                    **{k:0 for k in POLICY})
                if {'AppUserLibrary','AspNetUserRoles','AspNetRoles'}.issubset(tables(output)):
                    output.execute('''INSERT INTO AppUserLibrary(AppUsersId,LibrariesId)
                        SELECT DISTINCT ur.UserId,? FROM AspNetUserRoles ur JOIN AspNetRoles r ON r.Id=ur.RoleId
                        WHERE r.NormalizedName='ADMIN' ''',(archive,))
                for library in library_map:
                    update(output,'Library',library,dict(FolderBasedOrganization=1,FolderWatching=0,**{k:0 for k in POLICY}))
                for level, table, fields, parent in (
                    ('SeriesId','Series',SERIES_FIELDS,'LibraryId'),
                    ('VolumeId','Volume',VOLUME_FIELDS,'SeriesId'),
                    ('ChapterId','Chapter',CHAPTER_FIELDS,'VolumeId')):
                    for new_id in sorted({f[level] for f in desired_files.values()}):
                        template = ref_data[table][new_id]
                        parent_id = inverse[template[parent]] if parent=='LibraryId' else maps[parent][template[parent]]
                        if new_id not in maps[level]:
                            maps[level][new_id] = insert(output,table,template,**{parent:parent_id})
                            if table=='Series':
                                for mt in ('SeriesMetadata','ExternalSeriesMetadata'):
                                    if mt in tables(output):
                                        m = ref.execute(f'SELECT * FROM "{mt}" WHERE SeriesId=?',(new_id,)).fetchone()
                                        if m: insert(output,mt,dict(m),SeriesId=maps[level][new_id])
                        else:
                            update(output,table,maps[level][new_id],{k:template[k] for k in fields if k in template} | {parent:parent_id})
                for new_id, template in desired_files.items():
                    parent_id = maps['ChapterId'][template['ChapterId']]
                    if new_id in pairs:
                        values = {'ChapterId':parent_id}
                        if pairs[new_id] in path_recoveries:
                            values.update({k:template[k] for k in ('FilePath','FileName','Extension','FileLastWriteTimeUtc') if k in template})
                        update(output,'MangaFile',pairs[new_id],values)
                    else: insert(output,'MangaFile',template,ChapterId=parent_id)
                active = {k:set(v.values()) for k,v in maps.items()}
                archive_holders = {}

                def archived_series(original_series):
                    if original_series not in active['SeriesId']:
                        update(output,'Series',original_series,{'LibraryId':archive})
                        return original_series
                    if original_series not in archive_holders:
                        template = old_data['Series'][original_series]
                        holder = insert(output,'Series',template,LibraryId=archive,Name='Arquivo: '+(template.get('Name') or str(original_series)))
                        archive_holders[original_series] = holder
                        for mt in ('SeriesMetadata','ExternalSeriesMetadata'):
                            if mt in tables(output):
                                m = old.execute(f'SELECT * FROM "{mt}" WHERE SeriesId=?',(original_series,)).fetchone()
                                if m: insert(output,mt,dict(m),SeriesId=holder)
                    return archive_holders[original_series]

                for series_id,s in old_data['Series'].items():
                    if s['LibraryId'] in library_map and series_id not in active['SeriesId']:
                        archived_series(series_id)
                for volume_id,v in old_data['Volume'].items():
                    if v['SeriesId'] in affected_series and volume_id not in active['VolumeId']:
                        update(output,'Volume',volume_id,{'SeriesId':archived_series(v['SeriesId'])})
                archive_volumes = {}
                for chapter_id in set(old_data['Chapter']) - active['ChapterId']:
                    volume_id = old_data['Chapter'][chapter_id]['VolumeId']
                    original_series = old_data['Volume'][volume_id]['SeriesId']
                    if original_series not in affected_series: continue
                    if volume_id in active['VolumeId']:
                        if volume_id not in archive_volumes:
                            v = old_data['Volume'][volume_id]
                            archive_volumes[volume_id] = insert(output,'Volume',v,SeriesId=archived_series(v['SeriesId']))
                        update(output,'Chapter',chapter_id,{'VolumeId':archive_volumes[volume_id]})
                chapter_owners = {r['Id']:dict(r) for r in output.execute('''SELECT c.Id,c.VolumeId,v.SeriesId,s.LibraryId
                    FROM Chapter c JOIN Volume v ON v.Id=c.VolumeId JOIN Series s ON s.Id=v.SeriesId''')}
                for table in tables(output):
                    cols = columns(output,table)
                    if 'ChapterId' not in cols or table=='MangaFile': continue
                    for chapter_id, owner in chapter_owners.items():
                        values = {k:owner[k] for k in ('VolumeId','SeriesId','LibraryId') if k in cols}
                        if values:
                            output.execute(f'UPDATE "{table}" SET '+','.join(f'"{k}"=?' for k in values)+' WHERE ChapterId=?',
                                           [*values.values(),chapter_id])
                series_destinations = defaultdict(set)
                for new_file, old_file in pairs.items():
                    series_destinations[old_files[old_file]['SeriesId']].add(maps['SeriesId'][desired_files[new_file]['SeriesId']])
                for table in PERSONAL_SERIES_TABLES:
                    if table not in tables(output): continue
                    for (series_id,) in output.execute(f'SELECT DISTINCT SeriesId FROM "{table}"').fetchall():
                        targets = series_destinations.get(series_id,set())
                        if len(targets)>1: raise ValueError('Series-only personal state has ambiguous destinations.')
                        if targets: output.execute(f'UPDATE "{table}" SET SeriesId=? WHERE SeriesId=?',(next(iter(targets)),series_id))
                if 'AppUserReadingProfiles' in tables(output):
                    for row_id, value in output.execute('SELECT Id,SeriesIds FROM AppUserReadingProfiles').fetchall():
                        profile_ids = json.loads(value or '[]')
                        remapped = []
                        for series_id in profile_ids:
                            targets = series_destinations.get(series_id,{series_id})
                            if len(targets)>1: raise ValueError('Reading profile has ambiguous destinations.')
                            remapped.extend(targets)
                        update(output,'AppUserReadingProfiles',row_id,{'SeriesIds':json.dumps(sorted(set(remapped)))})
                if 'AppUserCollectionSeries' in tables(output):
                    for collection_id, series_id in output.execute('SELECT CollectionsId,ItemsId FROM AppUserCollectionSeries').fetchall():
                        for target in series_destinations.get(series_id,()):
                            output.execute('INSERT OR IGNORE INTO AppUserCollectionSeries VALUES(?,?)',(collection_id,target))
                if 'AppUserReadingHistory' in tables(output):
                    for row_id, data in output.execute('SELECT Id,Data FROM AppUserReadingHistory').fetchall():
                        history = json.loads(data or '{}')
                        for activity in history.get('Activities',[]):
                            owner = chapter_owners.get(activity.get('ChapterId'))
                            if owner: activity.update({k:owner[k] for k in ('SeriesId','VolumeId','LibraryId') if k in activity})
                        update(output,'AppUserReadingHistory',row_id,{'Data':json.dumps(history,ensure_ascii=False,separators=(',',':'))})
                output.execute('UPDATE Chapter SET Pages=(SELECT coalesce(sum(Pages),0) FROM MangaFile WHERE ChapterId=Chapter.Id)')
                output.execute('UPDATE Volume SET Pages=(SELECT coalesce(sum(Pages),0) FROM Chapter WHERE VolumeId=Volume.Id)')
                output.execute('UPDATE Series SET Pages=(SELECT coalesce(sum(Pages),0) FROM Volume WHERE SeriesId=Series.Id)')
                if output.execute('PRAGMA foreign_key_check').fetchall(): raise ValueError('Foreign-key check failed.')
                for table, ids in original_ids.items():
                    if not ids.issubset(rows(output,table)): raise ValueError('An original catalog ID was lost.')
                output.commit()
                if output.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise ValueError('Destination integrity check failed.')
                return dict(archiveLibraryId=archive,activeLibraries=list(library_map),
                    referenceFiles=len(desired_files),matchedFiles=len(pairs),newFiles=len(desired_files)-len(pairs),
                    activeSeries=len(active['SeriesId']),preservedIds={k:len(v) for k,v in original_ids.items()},
                    splitChapters=sum(len(fs)-1 for fs in old_groups.values() if len(fs)>1 and fs[0]['Format']!=0),
                    chapterOwners={str(k):v for k,v in chapter_owners.items()},apiKeyMaintenanceRequired=True)
            except BaseException:
                output.rollback()
                raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source','reference','mapping','destination','report'): parser.add_argument(name,type=Path)
    parser.add_argument('--path-recoveries',type=Path,help='Explicit reviewed ID/path map, checked against stored content fingerprints')
    args = parser.parse_args()
    paths = [args.source,args.reference,args.mapping,args.destination,args.report]
    if len({p.resolve() for p in paths}) != len(paths):
        raise ValueError('Input, database output and report paths must be distinct.')
    if args.report.exists(): raise FileExistsError('Report already exists.')
    mapping = {r['oldId']:r['newId'] for r in json.loads(args.mapping.read_text(encoding='utf-8-sig'))}
    hashes = {}
    for name,path in [('source',args.source),('reference',args.reference)]:
        with path.open('rb') as file: hashes[name]=hashlib.file_digest(file,'sha256').hexdigest()
    recoveries = json.loads(args.path_recoveries.read_text(encoding='utf-8')) if args.path_recoveries else {}
    report = migrate(args.source,args.reference,mapping,args.destination,recoveries)
    report['pathRecoveries'] = recoveries
    with args.report.open('x',encoding='utf-8') as file:
        file.write(json.dumps(report | {'inputSha256':hashes},indent=2))
    print(json.dumps({k:report[k] for k in ('referenceFiles','matchedFiles','newFiles','activeSeries','preservedIds','splitChapters')}))


if __name__=='__main__':main()
