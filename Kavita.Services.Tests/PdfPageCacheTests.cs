using System.IO.Abstractions;
using Kavita.API.Database;
using Kavita.API.Repositories;
using Kavita.API.Services;
using Kavita.Models.DTOs.Settings;
using Kavita.Models.Entities;
using Kavita.Models.Entities.Enums;
using Kavita.Services.Builders;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Kavita.Services.Tests;

/// <summary>Fork (book mode on PDF): PDF chapters served page by page to the image reader</summary>
public class PdfPageCacheTests : IDisposable
{
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ICacheService _cacheService = Substitute.For<ICacheService>();
    private readonly IPdfPageCache _pdfPages;
    private readonly string _document = Path.GetFullPath(Path.Join(Directory.GetCurrentDirectory(),
        "../../../Test Data/BookService/Synthetic 8 pages.pdf"));
    private readonly string _cache = Path.Join(Path.GetTempPath(), $"PdfPageCache_{Guid.NewGuid():N}");

    public PdfPageCacheTests()
    {
        _unitOfWork.SettingsRepository.GetSettingsDtoAsync().Returns(new ServerSettingDto { PdfRenderResolution = PdfRenderResolution.Default });
        var directoryService = new DirectoryService(Substitute.For<ILogger<DirectoryService>>(), new FileSystem());
        var bookService = new BookService(Substitute.For<ILogger<BookService>>(), directoryService,
            new ImageService(Substitute.For<ILogger<ImageService>>(), directoryService), Substitute.For<IMediaErrorService>(), _unitOfWork);
        // As CacheService returns it: the chapter's folder, with a trailing separator
        _cacheService.GetCachePath(Arg.Any<int>()).Returns(call => Path.Join(_cache, call.Arg<int>() + "/"));
        _pdfPages = new PdfPageCache(_unitOfWork, bookService, _cacheService);
    }

    public void Dispose()
    {
        if (Directory.Exists(_cache)) Directory.Delete(_cache, true);
    }

    private void ChapterWith(int chapterId, params MangaFile[] files)
    {
        _unitOfWork.ChapterRepository.GetChapterAsync(chapterId, Arg.Any<ChapterIncludes>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var chapter = new ChapterBuilder("1").Build();
                chapter.Id = chapterId;
                chapter.Files = files.ToList();
                return chapter;
            });
    }

    private MangaFile Pdf(long bytes = 100) => new() { FilePath = _document, Format = MangaFormat.Pdf, Bytes = bytes, Pages = 8 };

    [Fact]
    public async Task Dimensions_OfEveryPage_WithoutRenderingThem()
    {
        ChapterWith(5, Pdf());

        var dimensions = await _pdfPages.GetDimensionsAsync(5);

        Assert.NotNull(dimensions);
        Assert.Equal(8, dimensions.Count);
        Assert.Empty(Directory.Exists(_cache) ? Directory.GetFiles(_cache, "*.png", SearchOption.AllDirectories) : []);
    }

    [Fact]
    public async Task Page_IsRenderedWhenAsked_AloneAndOnce()
    {
        ChapterWith(5, Pdf());

        var path = await _pdfPages.GetPagePathAsync(5, 3);

        Assert.NotNull(path);
        Assert.True(File.Exists(path));
        Assert.Single(Directory.GetFiles(_cache, "*.png", SearchOption.AllDirectories));
        Assert.Equal(path, await _pdfPages.GetPagePathAsync(5, 3));
    }

    [Fact]
    public async Task PagePastTheEnd_IsTheLastPage()
    {
        ChapterWith(5, Pdf());

        Assert.Equal(await _pdfPages.GetPagePathAsync(5, 7), await _pdfPages.GetPagePathAsync(5, 50));
    }

    [Fact]
    public async Task AChangedFile_GetsNewPages()
    {
        ChapterWith(5, Pdf(bytes: 100));
        var before = await _pdfPages.GetPagePathAsync(5, 0);
        ChapterWith(5, Pdf(bytes: 200));

        var after = await _pdfPages.GetPagePathAsync(5, 0);

        Assert.NotEqual(Path.GetDirectoryName(before), Path.GetDirectoryName(after));
    }

    [Fact]
    public async Task ChaptersThatAreNotOnePdf_KeepTheUsualPath()
    {
        ChapterWith(6, new MangaFile { FilePath = "a.cbz", Format = MangaFormat.Archive });
        ChapterWith(7, Pdf(), Pdf());

        Assert.Null(await _pdfPages.GetDimensionsAsync(6));
        Assert.Null(await _pdfPages.GetPagePathAsync(6, 0));
        Assert.Null(await _pdfPages.GetPagePathAsync(7, 0));
        Assert.Null(await _pdfPages.GetPagePathAsync(99, 0));
    }

    [Fact]
    public async Task Pages_StayOutOfTheChapterCacheFolder()
    {
        // The chapter's folder is flattened and cleared by the full extraction and by the PDF reader
        ChapterWith(5, Pdf());

        var path = await _pdfPages.GetPagePathAsync(5, 0);

        var chapterFolder = Path.GetFullPath(Path.Join(_cache, "5"));
        Assert.False(Path.GetFullPath(path!).StartsWith(chapterFolder + Path.DirectorySeparatorChar), path);
    }
}
