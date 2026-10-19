import hashlib
import importlib.util
import json
import pathlib
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('merge_folder_series', pathlib.Path(__file__).with_name('merge_folder_series.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

SCHEMA = '''
PRAGMA foreign_keys=ON;
CREATE TABLE Library(Id INTEGER PRIMARY KEY, Name TEXT, FolderBasedOrganization INTEGER);
CREATE TABLE Series(Id INTEGER PRIMARY KEY, LibraryId INTEGER REFERENCES Library(Id) ON DELETE CASCADE, Name TEXT,
 FolderPath TEXT, Format INTEGER, Pages INTEGER);
CREATE TABLE SeriesMetadata(Id INTEGER PRIMARY KEY, SeriesId INTEGER REFERENCES Series(Id) ON DELETE CASCADE, Summary TEXT);
CREATE TABLE ExternalSeriesMetadata(Id INTEGER PRIMARY KEY, SeriesId INTEGER REFERENCES Series(Id) ON DELETE CASCADE);
CREATE TABLE Volume(Id INTEGER PRIMARY KEY, SeriesId INTEGER REFERENCES Series(Id) ON DELETE CASCADE, Name TEXT,
 LookupName TEXT, MinNumber REAL, Pages INTEGER);
CREATE TABLE Chapter(Id INTEGER PRIMARY KEY, VolumeId INTEGER REFERENCES Volume(Id) ON DELETE CASCADE, Title TEXT,
 IsSpecial INTEGER, Pages INTEGER);
CREATE TABLE MangaFile(Id INTEGER PRIMARY KEY, ChapterId INTEGER REFERENCES Chapter(Id) ON DELETE CASCADE,
 FilePath TEXT, Format INTEGER, Pages INTEGER);
CREATE TABLE AppUserProgresses(Id INTEGER PRIMARY KEY, ChapterId INTEGER REFERENCES Chapter(Id) ON DELETE CASCADE,
 VolumeId INTEGER, SeriesId INTEGER REFERENCES Series(Id) ON DELETE CASCADE, LibraryId INTEGER, PagesRead INTEGER);
CREATE TABLE AppUserReadingSessionActivityData(Id INTEGER PRIMARY KEY, ChapterId INTEGER REFERENCES Chapter(Id) ON DELETE CASCADE,
 VolumeId INTEGER REFERENCES Volume(Id) ON DELETE CASCADE, SeriesId INTEGER REFERENCES Series(Id) ON DELETE CASCADE,
 LibraryId INTEGER, PagesRead INTEGER);
CREATE TABLE AppUserBookmark(Id INTEGER PRIMARY KEY, ChapterId INTEGER, VolumeId INTEGER REFERENCES Volume(Id) ON DELETE CASCADE,
 SeriesId INTEGER REFERENCES Series(Id) ON DELETE CASCADE, Page INTEGER);
CREATE TABLE AppUserRating(Id INTEGER PRIMARY KEY, AppUserId INTEGER, SeriesId INTEGER REFERENCES Series(Id) ON DELETE CASCADE,
 Rating REAL, UNIQUE(AppUserId, SeriesId));
CREATE TABLE AppUserCollectionSeries(CollectionsId INTEGER, ItemsId INTEGER REFERENCES Series(Id) ON DELETE CASCADE,
 PRIMARY KEY(CollectionsId, ItemsId));
CREATE TABLE AppUserReadingHistory(Id INTEGER PRIMARY KEY, Data TEXT);
'''


def fixture(path):
    c = sqlite3.connect(path)
    c.executescript(SCHEMA)
    c.executemany('INSERT INTO Library VALUES(?,?,?)', [(1, 'Livros', 1), (2, 'Legado', 0)])
    c.executemany('INSERT INTO Series VALUES(?,?,?,?,?,?)', [
        (13, 1, 'Musashi', '/books/Musashi', 3, 10),   # EPUB series, lower id: survivor
        (39, 1, 'Musashi', '/books/Musashi', 4, 20),   # PDF series of the same folder
        (40, 1, 'Other', '/books/Other', 4, 5),
        (50, 2, 'Legacy', '/books/Legacy', 3, 1),      # not folder-organized: untouched
        (51, 2, 'Legacy', '/books/Legacy', 4, 1),
    ])
    c.executemany('INSERT INTO SeriesMetadata VALUES(?,?,?)', [(1, 13, 'a'), (2, 39, 'b'), (3, 40, 'c'), (4, 50, ''), (5, 51, '')])
    c.executemany('INSERT INTO ExternalSeriesMetadata VALUES(?,?)', [(1, 13), (2, 39)])
    c.executemany('INSERT INTO Volume VALUES(?,?,?,?,?,?)', [
        (130, 13, '100000', '100000', 100000, 10),
        (390, 39, '100000', '100000', 100000, 15),   # same lookup as 130: chapters move into 130
        (391, 39, '2', '2', 2, 5),                    # survivor has no volume 2: volume moves whole
        (400, 40, '100000', '100000', 100000, 5),
        (500, 50, '1', '1', 1, 1), (510, 51, '1', '1', 1, 1),
    ])
    c.executemany('INSERT INTO Chapter VALUES(?,?,?,?,?)', [
        (1300, 130, 'Livro', 1, 10), (3900, 390, 'Livro', 1, 15), (3910, 391, 'Parte 2', 0, 5),
        (4000, 400, 'Other', 1, 5), (5000, 500, 'L', 0, 1), (5100, 510, 'L', 0, 1),
    ])
    c.executemany('INSERT INTO MangaFile VALUES(?,?,?,?,?)', [
        (1, 1300, '/books/Musashi/Livro.epub', 3, 10), (2, 3900, '/books/Musashi/Livro.pdf', 4, 15),
        (3, 3910, '/books/Musashi/Livro - 2.pdf', 4, 5), (4, 4000, '/books/Other/Other.pdf', 4, 5),
        (5, 5000, '/books/Legacy/L.epub', 3, 1), (6, 5100, '/books/Legacy/L.pdf', 4, 1),
    ])
    c.executemany('INSERT INTO AppUserProgresses VALUES(?,?,?,?,?,?)', [(1, 3900, 390, 39, 1, 7), (2, 3910, 391, 39, 1, 3)])
    c.execute('INSERT INTO AppUserReadingSessionActivityData VALUES(1,3900,390,39,1,7)')
    c.execute('INSERT INTO AppUserBookmark VALUES(1,3900,390,39,4)')
    c.executemany('INSERT INTO AppUserRating VALUES(?,?,?,?)', [(1, 1, 13, 4.0), (2, 1, 39, 2.0), (3, 2, 39, 5.0)])
    c.executemany('INSERT INTO AppUserCollectionSeries VALUES(?,?)', [(1, 13), (1, 39), (2, 39)])
    c.execute('INSERT INTO AppUserReadingHistory VALUES(1,?)', (json.dumps(
        {'TotalPagesRead': 7, 'Activities': [{'ChapterId': 3900, 'VolumeId': 390, 'SeriesId': 39, 'LibraryId': 1, 'PagesRead': 7}]}),))
    c.commit()
    c.close()


class MergeFolderSeriesTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = pathlib.Path(tmp.name)
        self.source, self.out = self.root / 'source.db', self.root / 'out.db'
        fixture(self.source)

    def db(self):
        c = sqlite3.connect(self.out)
        self.addCleanup(c.close)
        return c

    def test_keeps_one_series_per_folder_with_every_file_and_chapter_id(self):
        report = module.merge(self.source, self.out)
        c = self.db()

        self.assertEqual([(13, 39)], [(g['survivor'], *g['merged']) for g in report['mergedGroups']])
        self.assertEqual({13, 40, 50, 51}, {r[0] for r in c.execute('SELECT Id FROM Series')})
        placements = dict(c.execute('''SELECT f.Id, c.Id || ':' || v.SeriesId FROM MangaFile f
            JOIN Chapter c ON c.Id=f.ChapterId JOIN Volume v ON v.Id=c.VolumeId'''))
        self.assertEqual({1: '1300:13', 2: '3900:13', 3: '3910:13', 4: '4000:40', 5: '5000:50', 6: '5100:51'}, placements)
        self.assertEqual(130, c.execute('SELECT VolumeId FROM Chapter WHERE Id=3900').fetchone()[0])
        self.assertEqual(13, c.execute('SELECT SeriesId FROM Volume WHERE Id=391').fetchone()[0])
        self.assertIsNone(c.execute('SELECT 1 FROM Volume WHERE Id=390').fetchone())

    def test_personal_rows_follow_their_chapters(self):
        module.merge(self.source, self.out)
        c = self.db()

        self.assertEqual([(1, 3900, 130, 13, 7), (2, 3910, 391, 13, 3)],
                         c.execute('SELECT Id, ChapterId, VolumeId, SeriesId, PagesRead FROM AppUserProgresses ORDER BY Id').fetchall())
        self.assertEqual((130, 13), c.execute('SELECT VolumeId, SeriesId FROM AppUserReadingSessionActivityData').fetchone())
        self.assertEqual((130, 13, 4), c.execute('SELECT VolumeId, SeriesId, Page FROM AppUserBookmark').fetchone())
        history = json.loads(c.execute('SELECT Data FROM AppUserReadingHistory').fetchone()[0])
        self.assertEqual({'ChapterId': 3900, 'VolumeId': 130, 'SeriesId': 13, 'LibraryId': 1, 'PagesRead': 7}, history['Activities'][0])

    def test_one_row_per_series_keeps_the_survivors_and_reports_the_dropped(self):
        report = module.merge(self.source, self.out)
        c = self.db()

        self.assertEqual([(1, 13, 4.0), (3, 13, 5.0)],
                         c.execute('SELECT Id, SeriesId, Rating FROM AppUserRating ORDER BY Id').fetchall())
        self.assertEqual([(1, 13), (2, 13)],
                         c.execute('SELECT CollectionsId, ItemsId FROM AppUserCollectionSeries ORDER BY CollectionsId').fetchall())
        self.assertEqual({'AppUserRating': 1, 'AppUserCollectionSeries': 1}, report['droppedDuplicates'])

    def test_never_writes_the_source_or_an_existing_destination(self):
        before = hashlib.sha256(self.source.read_bytes()).hexdigest()
        module.merge(self.source, self.out)
        self.assertEqual(before, hashlib.sha256(self.source.read_bytes()).hexdigest())
        with self.assertRaises(FileExistsError):
            module.merge(self.source, self.out)

    def test_refuses_unknown_references_to_a_merged_series(self):
        c = sqlite3.connect(self.source)
        c.execute('CREATE TABLE ScrobbleEvent(Id INTEGER PRIMARY KEY, SeriesId INTEGER)')
        c.execute('INSERT INTO ScrobbleEvent VALUES(1, 39)')
        c.commit()
        c.close()

        with self.assertRaisesRegex(ValueError, 'ScrobbleEvent'):
            module.merge(self.source, self.out)
        self.assertFalse(self.out.exists())


if __name__ == '__main__':
    unittest.main()
