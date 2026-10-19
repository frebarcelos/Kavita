import importlib.util
import json
import pathlib
import sqlite3
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('folder_migration', pathlib.Path(__file__).with_name('migrate_folder_catalog.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

SCHEMA = '''
CREATE TABLE Library(Id INTEGER PRIMARY KEY, Name TEXT, Type INTEGER, FolderBasedOrganization INTEGER,
 FolderWatching INTEGER, EnableMetadata INTEGER, AllowMetadataMatching INTEGER, AllowScrobbling INTEGER,
 ManageCollections INTEGER, ManageReadingLists INTEGER, IncludeInDashboard INTEGER, IncludeInSearch INTEGER, IncludeInRecommended INTEGER);
CREATE TABLE Series(Id INTEGER PRIMARY KEY, LibraryId INTEGER REFERENCES Library(Id), Name TEXT, FolderPath TEXT, Format INTEGER, Pages INTEGER);
CREATE TABLE Volume(Id INTEGER PRIMARY KEY, SeriesId INTEGER REFERENCES Series(Id), Name TEXT, LookupName TEXT, Pages INTEGER);
CREATE TABLE Chapter(Id INTEGER PRIMARY KEY, VolumeId INTEGER REFERENCES Volume(Id), Title TEXT, Pages INTEGER);
CREATE TABLE MangaFile(Id INTEGER PRIMARY KEY, ChapterId INTEGER REFERENCES Chapter(Id), FilePath TEXT, Format INTEGER, Pages INTEGER);
CREATE TABLE SeriesMetadata(Id INTEGER PRIMARY KEY,SeriesId INTEGER REFERENCES Series(Id),Summary TEXT);
CREATE TABLE AppUserProgresses(Id INTEGER PRIMARY KEY, ChapterId INTEGER, VolumeId INTEGER, SeriesId INTEGER, LibraryId INTEGER, PagesRead INTEGER, BookScrollId TEXT, LastModifiedUtc TEXT);
CREATE TABLE AppUserReadingSessionActivityData(Id INTEGER PRIMARY KEY, ChapterId INTEGER,VolumeId INTEGER,SeriesId INTEGER,LibraryId INTEGER,PagesRead INTEGER);
CREATE TABLE AppUserReadingHistory(Id INTEGER PRIMARY KEY,Data TEXT);
CREATE TABLE AppUserCollectionSeries(CollectionsId INTEGER,ItemsId INTEGER REFERENCES Series(Id),PRIMARY KEY(CollectionsId,ItemsId));
CREATE TABLE AppUserWantToRead(Id INTEGER PRIMARY KEY,SeriesId INTEGER);
CREATE TABLE AppUserBookmark(Id INTEGER PRIMARY KEY,ChapterId INTEGER,VolumeId INTEGER,SeriesId INTEGER,Page INTEGER);
'''


def fixture(path, reference=False):
    c = sqlite3.connect(path)
    c.executescript(SCHEMA)
    c.execute('INSERT INTO Library VALUES(1,?,0,?,1,1,1,1,1,1,1,1,1)', ('Manga', int(reference)))
    if reference:
        c.execute("INSERT INTO Series VALUES(40,1,'Work','/books/Work',4,30)")
        c.executemany('INSERT INTO Volume VALUES(?,40,?,?,?)', [(50,'1','1',10),(51,'2','2',20)])
        c.executemany('INSERT INTO Chapter VALUES(?,?,?,?)', [(60,50,'Part 1',10),(61,51,'Part 2',20)])
        c.executemany('INSERT INTO MangaFile VALUES(?,?,?,?,?)', [(70,60,'/books/Work/Part v01.pdf',4,10),(71,61,'/books/Work/Part v02.pdf',4,20)])
    else:
        c.executemany('INSERT INTO Series VALUES(?,1,?,?,4,?)', [(10,'Wrong one','/books/Work',10),(11,'Wrong two','/books/Work',20)])
        c.executemany('INSERT INTO Volume VALUES(?,?,?, ?,?)', [(20,10,'999','999',10),(21,11,'999','999',20)])
        c.executemany('INSERT INTO Chapter VALUES(?,?,?,?)', [(30,20,'Metadata title',10),(31,21,'Other title',20)])
        c.executemany('INSERT INTO MangaFile VALUES(?,?,?,?,?)', [(1,30,'/books/Work/Part v01.pdf',4,10),(2,31,'/books/Work/Part v02.pdf',4,20)])
        c.execute("INSERT INTO AppUserProgresses VALUES(1,31,21,11,1,7,'anchor','unchanged-time')")
        c.execute('INSERT INTO AppUserReadingSessionActivityData VALUES(1,31,21,11,1,7)')
        c.execute('INSERT INTO AppUserReadingHistory VALUES(1,?)', (json.dumps({'TotalPagesRead':7,'Activities':[{'ChapterId':31,'VolumeId':21,'SeriesId':11,'LibraryId':1,'PagesRead':7}]}),))
        c.execute('INSERT INTO AppUserCollectionSeries VALUES(1,11)')
    c.commit()
    c.close()


class FolderCatalogMigrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        self.old, self.ref, self.out = [self.root/n for n in ('old.db','ref.db','out.db')]
        fixture(self.old)
        fixture(self.ref, True)

    def run_migration(self):
        return module.migrate(self.old, self.ref, {1:1}, self.out)

    def db(self, path):
        connection = sqlite3.connect(path)
        self.addCleanup(connection.close)
        return connection

    def test_groups_by_folder_preserves_file_chapter_ids_and_personal_payload(self):
        original = self.old.read_bytes()
        self.run_migration()
        c=self.db(self.out)
        self.assertEqual(1,c.execute('SELECT count(*) FROM Series WHERE LibraryId=1').fetchone()[0])
        series_id=c.execute('SELECT Id FROM Series WHERE LibraryId=1').fetchone()[0]
        self.assertEqual('Work',c.execute('SELECT Name FROM Series WHERE LibraryId=1').fetchone()[0])
        self.assertEqual([(1,30),(2,31)],c.execute('SELECT Id,ChapterId FROM MangaFile ORDER BY Id').fetchall())
        self.assertEqual((7,'anchor','unchanged-time',series_id),c.execute('SELECT PagesRead,BookScrollId,LastModifiedUtc,SeriesId FROM AppUserProgresses').fetchone())
        history=json.loads(c.execute('SELECT Data FROM AppUserReadingHistory').fetchone()[0])
        self.assertEqual(7,history['TotalPagesRead'])
        self.assertEqual(series_id,history['Activities'][0]['SeriesId'])
        self.assertEqual((1,0,0),c.execute('SELECT FolderBasedOrganization,EnableMetadata,AllowMetadataMatching FROM Library WHERE Id=1').fetchone())
        self.assertEqual(2,c.execute('SELECT count(*) FROM Series WHERE Id IN (10,11)').fetchone()[0])
        self.assertEqual([],c.execute('PRAGMA foreign_key_check').fetchall())
        self.assertEqual(original,self.old.read_bytes())

    def test_refuses_to_overwrite_an_existing_destination(self):
        self.out.write_bytes(b'keep')
        with self.assertRaises((FileExistsError,ValueError)):
            self.run_migration()
        self.assertEqual(b'keep',self.out.read_bytes())

    def test_cli_refuses_report_path_equal_to_the_output_database(self):
        mapping=self.root/'mapping.json'
        mapping.write_text('[{"oldId":1,"newId":1}]',encoding='utf-8')
        command=[sys.executable,str(pathlib.Path(__file__).with_name('migrate_folder_catalog.py')),
                 str(self.old),str(self.ref),str(mapping),str(self.out),str(self.out)]
        result=subprocess.run(command,capture_output=True,text=True)
        self.assertNotEqual(0,result.returncode)
        self.assertFalse(self.out.exists())

    def test_refuses_reference_that_loses_a_readable_file(self):
        with self.db(self.ref) as c:c.execute('DELETE FROM MangaFile WHERE Id=71')
        with self.assertRaisesRegex(ValueError,'coverage'):
            self.run_migration()

    def test_splits_unread_multi_file_chapter_without_replacing_original_file_ids(self):
        with self.db(self.old) as c:
            for t in ['AppUserProgresses','AppUserReadingHistory','AppUserReadingSessionActivityData']:c.execute('DELETE FROM '+t)
            c.execute('UPDATE MangaFile SET ChapterId=30 WHERE Id=2')
        self.run_migration()
        with self.db(self.out) as c:
            self.assertEqual(2,c.execute('SELECT count(DISTINCT ChapterId) FROM MangaFile').fetchone()[0])
            self.assertEqual([(1,),(2,)],c.execute('SELECT Id FROM MangaFile ORDER BY Id').fetchall())
            self.assertEqual(2,c.execute('SELECT count(*) FROM Chapter WHERE Id IN (30,31)').fetchone()[0])

    def test_refuses_ambiguous_personal_progress_on_multi_file_chapter(self):
        with self.db(self.old) as c:
            c.execute('UPDATE MangaFile SET ChapterId=31')
        with self.assertRaisesRegex(ValueError,'ambiguous'):
            self.run_migration()

    def test_keeps_excluded_auxiliary_records_in_archive_without_deleting_them(self):
        with self.db(self.old) as c:
            c.execute("INSERT INTO Series VALUES(12,1,'Covers','/books/Work/capas',0,1)")
            c.execute("INSERT INTO Volume VALUES(22,12,'1','1',1)")
            c.execute("INSERT INTO Chapter VALUES(32,22,'Cover',1)")
            c.execute("INSERT INTO MangaFile VALUES(3,32,'/books/Work/capas/page.jpg',0,1)")
        self.run_migration()
        with self.db(self.out) as c:
            self.assertNotEqual(1,c.execute('SELECT LibraryId FROM Series WHERE Id=12').fetchone()[0])
            self.assertEqual(32,c.execute('SELECT ChapterId FROM MangaFile WHERE Id=3').fetchone()[0])
            self.assertEqual(1,c.execute('SELECT count(*) FROM Chapter WHERE Id=32').fetchone()[0])

    def test_reparents_bookmarks_and_keeps_their_page(self):
        with self.db(self.old) as c:c.execute('INSERT INTO AppUserBookmark VALUES(1,31,21,11,6)')
        self.run_migration()
        c=self.db(self.out)
        self.assertEqual((31,6),c.execute('SELECT ChapterId,Page FROM AppUserBookmark').fetchone())
        self.assertEqual(c.execute('SELECT SeriesId FROM Volume WHERE Id=21').fetchone()[0],
                         c.execute('SELECT SeriesId FROM AppUserBookmark').fetchone()[0])

    def test_adds_new_files_from_the_reference_without_losing_existing_ids(self):
        with self.db(self.ref) as c:
            c.execute("INSERT INTO Chapter VALUES(62,51,'New extra',5)")
            c.execute("INSERT INTO MangaFile VALUES(72,62,'/books/Work/Extra.pdf',4,5)")
        report=self.run_migration()
        self.assertEqual(1,report['newFiles'])
        self.assertEqual(3,self.db(self.out).execute('SELECT count(*) FROM MangaFile').fetchone()[0])

    def test_rolls_back_if_series_personal_state_has_multiple_destinations(self):
        with self.db(self.old) as c:
            c.execute('UPDATE Volume SET SeriesId=10')
            c.execute('INSERT INTO AppUserWantToRead VALUES(1,10)')
        with self.db(self.ref) as c:
            c.execute("INSERT INTO Series VALUES(41,1,'Other','/books/Other',4,20)")
            c.execute('UPDATE Volume SET SeriesId=41 WHERE Id=51')
        with self.assertRaisesRegex(ValueError,'ambiguous'):
            self.run_migration()
        c=self.db(self.out)
        self.assertEqual(0,c.execute('SELECT FolderBasedOrganization FROM Library WHERE Id=1').fetchone()[0])
        self.assertEqual(2,c.execute('SELECT count(*) FROM Series').fetchone()[0])

    def test_does_not_change_an_unselected_library(self):
        with self.db(self.old) as c:
            c.execute("INSERT INTO Library SELECT 2,'Other',Type,FolderBasedOrganization,FolderWatching,EnableMetadata,AllowMetadataMatching,AllowScrobbling,ManageCollections,ManageReadingLists,IncludeInDashboard,IncludeInSearch,IncludeInRecommended FROM Library WHERE Id=1")
            c.execute("INSERT INTO Series VALUES(15,2,'Keep title','/other',4,3)")
            c.execute("INSERT INTO Volume VALUES(25,15,'1','1',3)")
            c.execute("INSERT INTO Chapter VALUES(35,25,'Keep chapter',3)")
            c.execute("INSERT INTO MangaFile VALUES(5,35,'/other/Book.pdf',4,3)")
        self.run_migration()
        c=self.db(self.out)
        self.assertEqual((2,'Keep title'),c.execute('SELECT LibraryId,Name FROM Series WHERE Id=15').fetchone())
        self.assertEqual((35,'/other/Book.pdf'),c.execute('SELECT ChapterId,FilePath FROM MangaFile WHERE Id=5').fetchone())


    def test_explicit_stale_path_recovery_requires_matching_content_fingerprint(self):
        for path in (self.old,self.ref):
            with self.db(path) as c:
                c.execute('ALTER TABLE MangaFile ADD COLUMN KoreaderHash TEXT')
                c.execute('ALTER TABLE MangaFile ADD COLUMN Bytes INTEGER')
                c.execute("UPDATE MangaFile SET KoreaderHash='synthetic-hash',Bytes=123 WHERE Pages=20")
        with self.db(self.old) as c:c.execute("UPDATE MangaFile SET FilePath='/books/Work/Old name.pdf' WHERE Id=2")
        module.migrate(self.old,self.ref,{1:1},self.out,{2:'/books/Work/Part v02.pdf'})
        self.assertEqual((2,31,'/books/Work/Part v02.pdf'),self.db(self.out).execute('SELECT Id,ChapterId,FilePath FROM MangaFile WHERE Id=2').fetchone())

    def test_recovery_refuses_same_size_files_with_different_hashes(self):
        for path in (self.old,self.ref):
            with self.db(path) as c:
                c.execute('ALTER TABLE MangaFile ADD COLUMN KoreaderHash TEXT')
                c.execute('ALTER TABLE MangaFile ADD COLUMN Bytes INTEGER')
                c.execute("UPDATE MangaFile SET KoreaderHash=?,Bytes=123 WHERE Pages=20",(str(path),))
        with self.assertRaisesRegex(ValueError,'fingerprint'):
            module.migrate(self.old,self.ref,{1:1},self.out,{2:'/books/Work/Part v02.pdf'})


if __name__=='__main__':unittest.main()
