using Kavita.Database;
using Kavita.Database.Tests;
using Kavita.Models.Builders;
using Kavita.Models.Entities.Enums;
using Kavita.Models.Entities.Progress;
using Kavita.Models.Entities.User;
using Kavita.Models.Metadata;
using Kavita.Services.Builders;
using Kavita.Services.Scanner;
using Kavita.Services.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Xunit.Abstractions;

namespace Kavita.Services.Tests;

public class FolderOrganizationScanTests(ITestOutputHelper output) : AbstractDbTest(output)
{
    [Fact]
    public async Task Scan_GroupsByPhysicalFolder_IgnoresMetadata_AndPreservesIdsAndProgress()
    {
        var (uow, context, _) = await CreateDatabase();
        var helper = new ScannerHelper(uow, output);
        const string first = "20th Century Boys/Alpha v01.cbz";
        const string second = "20th Century Boys/Beta v02.cbz";
        var files = new List<string> { first, second, "21st Century Boys/Gamma v01.cbz" };
        var metadata = files.ToDictionary(Path.GetFileName, f => new ComicInfo
        {
            Series = f, Title = "Embedded Title", Volume = "999", Summary = "Ignored metadata"
        });
        var library = await helper.GenerateScannerData("Folder Organization - Manga", files, metadata);
        library.FolderBasedOrganization = true;
        await uow.CommitAsync();
        var scanner = helper.CreateServices();

        await scanner.ScanLibrary(library.Id);

        var series = await context.Series.Where(s => s.LibraryId == library.Id).ToListAsync();
        Assert.Equal(new[] { "20th Century Boys", "21st Century Boys" }, series.Select(s => s.Name).Order());
        var before = await Placements(context, library.Id);
        Assert.Equal(3, before.Count);
        Assert.Equal(3, before.Values.Select(p => p.Chapter).Distinct().Count());
        var original = before.Single(p => p.Key.EndsWith(first)).Value;
        var progress = new AppUserProgress
        {
            AppUserId = await context.Users.Select(u => u.Id).SingleAsync(),
            LibraryId = library.Id, SeriesId = original.Series, VolumeId = original.Volume,
            ChapterId = original.Chapter, PagesRead = 1
        };
        context.AppUserProgresses.Add(progress);
        await context.SaveChangesAsync();

        // Touch a sibling by adding a file; old files must keep their complete identity.
        await helper.UpdateTestData("Folder Organization - Manga", [.. files, "20th Century Boys/Delta v03.cbz"], metadata);
        await scanner.ScanLibrary(library.Id);
        var after = await Placements(context, library.Id);
        Assert.Equal(4, after.Count);
        foreach (var (path, placement) in before) Assert.Equal(placement, after[path]);
        Assert.Equal(1, (await context.AppUserProgresses.SingleAsync()).PagesRead);
        Assert.Equal(2, await context.Series.CountAsync(s => s.LibraryId == library.Id));
    }

    [Fact]
    public async Task Scan_DoesNotMergeFoldersWhoseTitlesNormalizeToTheSameText()
    {
        var (uow, context, _) = await CreateDatabase();
        var helper = new ScannerHelper(uow, output);
        var library = await helper.GenerateScannerData("Folder Collision - Manga",
            ["A/B/First v01.cbz", "AB/Second v01.cbz"], new Dictionary<string, ComicInfo>());
        library.FolderBasedOrganization = true;
        await uow.CommitAsync();
        var scanner = helper.CreateServices();
        await scanner.ScanLibrary(library.Id);
        await scanner.ScanLibrary(library.Id, true);
        var series = await context.Series.Where(s => s.LibraryId == library.Id).ToListAsync();
        Assert.Equal(new[] { "A/B", "AB" }, series.Select(s => s.Name).Order());
        Assert.Equal(2, (await Placements(context, library.Id)).Count);
    }

    [Fact]
    public async Task Scan_EachContainerIsReadable_EvenWithIdenticalNumbersOrBaseNames_AndIncludesRootFiles()
    {
        var (uow, context, _) = await CreateDatabase();
        var helper = new ScannerHelper(uow, output);
        var library = await helper.GenerateScannerData("Folder Files - Manga",
            ["Root Book.pdf", "Collection/Alpha v01.cbz", "Collection/Beta v01.cbz", "Collection/Alpha v01.zip"],
            new Dictionary<string, ComicInfo>());
        library.FolderBasedOrganization = true;
        await uow.CommitAsync();
        var scanner = helper.CreateServices();
        await scanner.ScanLibrary(library.Id);
        var before = await Placements(context, library.Id);
        Assert.Equal(4, before.Count);
        Assert.Equal(4, before.Values.Select(p => p.Chapter).Distinct().Count());
        await scanner.ScanLibrary(library.Id, true);
        var after = await Placements(context, library.Id);
        foreach (var (path, placement) in before) Assert.Equal(placement, after[path]);
    }

    private sealed record Placement(int Series, int Volume, int Chapter);

    [Theory]
    [InlineData(LibraryType.Book)]
    [InlineData(LibraryType.LightNovel)]
    public async Task Scan_BooksInOneCategoryAreOneSeriesWithAChapterPerFileAndTheirReaderFormats(LibraryType type)
    {
        var (uow, context, _) = await CreateDatabase();
        var helper = new ScannerHelper(uow, output);
        var library = await helper.GenerateScannerData($"Folder Books {type} - Manga",
            ["Technology/First Book.pdf", "Technology/Second Book.pdf", "Technology/First Book.epub"],
            new Dictionary<string, ComicInfo>());
        library.Type = type;
        library.FolderBasedOrganization = true;
        await uow.CommitAsync();
        var scanner = helper.CreateServices();
        await scanner.ScanLibrary(library.Id);
        var before = await Placements(context, library.Id);
        Assert.Equal(3, before.Count);
        Assert.Equal(3, before.Values.Select(p => p.Chapter).Distinct().Count());
        var series = await context.Series.SingleAsync(s => s.LibraryId == library.Id);
        Assert.Equal("Technology", series.Name);
        Assert.Equal(MangaFormat.Pdf, series.Format);
        var fileFormats = await context.MangaFile.Where(f => f.Chapter.Volume.SeriesId == series.Id)
            .Select(f => f.Format).ToListAsync();
        Assert.Equal(new[] {MangaFormat.Epub, MangaFormat.Pdf, MangaFormat.Pdf}, fileFormats.Order());
        await scanner.ScanLibrary(library.Id, true);
        var after = await Placements(context, library.Id);
        foreach (var (path, placement) in before) Assert.Equal(placement, after[path]);
    }

    [Fact]
    public async Task Scan_OneFolderIsOneSeries_WithVolumesChaptersAndSpecialsFromFilenames()
    {
        var (uow, context, _) = await CreateDatabase();
        var helper = new ScannerHelper(uow, output);
        var library = await helper.GenerateScannerData("Folder Yac - Manga",
        [
            "Elric/Elric - 001.cbz", "Elric/Elric - 001.pdf", "Elric/Elric - 002.cbz", "Elric/Elric - 010.cbz",
            "Elric/Elric - c0005.cbz", "Elric/Zeta Extra.pdf", "Elric/Alpha Extra.epub"
        ], new Dictionary<string, ComicInfo>());
        library.FolderBasedOrganization = true;
        await uow.CommitAsync();
        var scanner = helper.CreateServices();

        await scanner.ScanLibrary(library.Id);

        var series = await context.Series.Include(s => s.Volumes).ThenInclude(v => v.Chapters)
            .SingleAsync(s => s.LibraryId == library.Id);
        Assert.Equal("Elric", series.Name);
        var numbered = series.Volumes.Where(v => v.MinNumber is > 0 and < Parser.SpecialVolumeNumber).ToList();
        Assert.Equal(new[] { 1f, 2f, 10f }, numbered.Select(v => v.MinNumber).Order());
        Assert.Equal(2, numbered.Single(v => v.MinNumber == 1f).Chapters.Count);
        var loose = series.Volumes.Single(v => v.MinNumber == Parser.LooseLeafVolumeNumber);
        Assert.Equal(5f, Assert.Single(loose.Chapters).MinNumber);
        var specials = series.Volumes.Single(v => v.MinNumber == Parser.SpecialVolumeNumber).Chapters;
        Assert.All(specials, c => Assert.True(c.IsSpecial));
        Assert.Equal(new[] { "Alpha Extra", "Zeta Extra" }, specials.OrderBy(c => c.SortOrder).Select(c => c.Title));

        var before = await Placements(context, library.Id);
        await scanner.ScanLibrary(library.Id, true);
        var after = await Placements(context, library.Id);
        Assert.Equal(7, after.Count);
        foreach (var (path, placement) in before) Assert.Equal(placement, after[path]);
    }

    [Fact]
    public async Task Scan_ReclassifiedFileKeepsItsChapter_AndPersonalReferencesFollowItsVolume()
    {
        var (uow, context, _) = await CreateDatabase();
        var helper = new ScannerHelper(uow, output);
        var library = await helper.GenerateScannerData("Folder Reclassify - Manga",
            ["Elric/Elric - 001.cbz", "Elric/Elric - 002.cbz"], new Dictionary<string, ComicInfo>());
        library.FolderBasedOrganization = true;
        await uow.CommitAsync();
        var scanner = helper.CreateServices();
        await scanner.ScanLibrary(library.Id);

        // Legacy classification: before the trailing-number rule this file was a special.
        var chapter = await context.Chapter.Include(c => c.Volume)
            .SingleAsync(c => c.Files.Any(f => f.FilePath.EndsWith("Elric - 001.cbz")));
        var legacy = new VolumeBuilder(Parser.SpecialVolume).WithSeriesId(chapter.Volume.SeriesId).Build();
        context.Volume.Add(legacy);
        await context.SaveChangesAsync();
        chapter.VolumeId = legacy.Id;
        chapter.IsSpecial = true;
        var userId = await context.Users.Select(u => u.Id).SingleAsync();
        context.AppUserProgresses.Add(new AppUserProgress
        {
            AppUserId = userId, LibraryId = library.Id, SeriesId = legacy.SeriesId, VolumeId = legacy.Id,
            ChapterId = chapter.Id, PagesRead = 3
        });
        context.AppUserBookmark.Add(new AppUserBookmark
        {
            AppUserId = userId, SeriesId = legacy.SeriesId, VolumeId = legacy.Id, ChapterId = chapter.Id,
            Page = 1, FileName = "bookmark.jpg"
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        await scanner.ScanLibrary(library.Id, true);

        context.ChangeTracker.Clear();
        var moved = await context.Chapter.Include(c => c.Volume).SingleAsync(c => c.Id == chapter.Id);
        Assert.Equal(1f, moved.Volume.MinNumber);
        Assert.False(moved.IsSpecial);
        Assert.False(await context.Volume.AnyAsync(v => v.Id == legacy.Id));
        var progress = await context.AppUserProgresses.SingleAsync();
        Assert.Equal((moved.VolumeId, 3), (progress.VolumeId, progress.PagesRead));
        Assert.Equal(moved.VolumeId, (await context.AppUserBookmark.SingleAsync()).VolumeId);
    }

    [Fact]
    public async Task Scan_LegacySeriesSplitByFormatInOneFolderAreLeftUntouched()
    {
        var (uow, context, _) = await CreateDatabase();
        var helper = new ScannerHelper(uow, output);
        var library = await helper.GenerateScannerData("Folder Legacy Split - Manga",
            ["Technology/Book.pdf", "Technology/Book.epub"], new Dictionary<string, ComicInfo>());
        library.FolderBasedOrganization = true;
        await uow.CommitAsync();
        var scanner = helper.CreateServices();
        await scanner.ScanLibrary(library.Id);

        // Legacy catalog: the EPUB had its own series in the same folder.
        var original = await context.Series.Include(s => s.Volumes).SingleAsync(s => s.LibraryId == library.Id);
        var epub = await context.Chapter.SingleAsync(c => c.Files.Any(f => f.Format == MangaFormat.Epub));
        var split = new SeriesBuilder(original.Name).Build();
        split.LibraryId = library.Id;
        split.FolderPath = original.FolderPath;
        split.LowestFolderPath = original.LowestFolderPath;
        split.Format = MangaFormat.Epub;
        split.Volumes = [new VolumeBuilder(Parser.SpecialVolume).Build()];
        context.Series.Add(split);
        original.Format = MangaFormat.Pdf;
        await context.SaveChangesAsync();
        epub.VolumeId = split.Volumes[0].Id;
        await context.SaveChangesAsync();
        context.AppUserProgresses.Add(new AppUserProgress
        {
            AppUserId = await context.Users.Select(u => u.Id).SingleAsync(), LibraryId = library.Id,
            SeriesId = split.Id, VolumeId = split.Volumes[0].Id, ChapterId = epub.Id, PagesRead = 2
        });
        await context.SaveChangesAsync();
        var before = await Placements(context, library.Id);

        await scanner.ScanLibrary(library.Id, true);

        context.ChangeTracker.Clear();
        Assert.Equal(new[] { original.Id, split.Id }.Order(),
            await context.Series.Where(s => s.LibraryId == library.Id).Select(s => s.Id).OrderBy(id => id).ToListAsync());
        var after = await Placements(context, library.Id);
        foreach (var (path, placement) in before) Assert.Equal(placement, after[path]);
        Assert.Equal(2, (await context.AppUserProgresses.SingleAsync()).PagesRead);
    }

    [Fact]
    public async Task Scan_ImagePagesInOneFolderFormOneReadableChapter()
    {
        var (uow, context, _) = await CreateDatabase();
        var helper = new ScannerHelper(uow, output);
        var library = await helper.GenerateScannerData("Folder Pages - Manga",
            ["Series/01.jpg", "Series/02.jpg"], new Dictionary<string, ComicInfo>());
        library.FolderBasedOrganization = true;
        await uow.CommitAsync();
        var scanner = helper.CreateServices();
        await scanner.ScanLibrary(library.Id);
        var files = await Placements(context, library.Id);
        Assert.Equal(2, files.Count);
        Assert.Single(files.Values.Select(p => p.Chapter).Distinct());
        await scanner.ScanLibrary(library.Id, true);
        var after = await Placements(context, library.Id);
        foreach (var (path, placement) in files) Assert.Equal(placement, after[path]);
    }

    [Fact]
    public async Task Scan_ValidFolderWhoseNameNormalizesToEmptyIsStillIndexed()
    {
        var (uow, context, _) = await CreateDatabase();
        var helper = new ScannerHelper(uow, output);
        var library = await helper.GenerateScannerData("Folder Symbols - Manga",
            ["---/Book.cbz", "---/Another Book.cbz"], new Dictionary<string, ComicInfo>());
        library.FolderBasedOrganization = true;
        await uow.CommitAsync();
        await helper.CreateServices().ScanLibrary(library.Id);
        Assert.Equal("---", (await context.Series.SingleAsync(s => s.LibraryId == library.Id)).Name);
        Assert.Equal(2, (await Placements(context, library.Id)).Count);
        var orders = await context.Chapter.Where(c => c.Volume.Series.LibraryId == library.Id)
            .Select(c => c.SortOrder).Distinct().ToListAsync();
        Assert.Equal(2, orders.Count);
    }

    private static async Task<Dictionary<string, Placement>> Placements(DataContext context, int libraryId) =>
        await context.MangaFile.Where(f => f.Chapter.Volume.Series.LibraryId == libraryId)
            .Select(f => new { f.FilePath, Placement = new Placement(f.Chapter.Volume.SeriesId, f.Chapter.VolumeId, f.ChapterId) })
            .ToDictionaryAsync(f => f.FilePath, f => f.Placement);
}
