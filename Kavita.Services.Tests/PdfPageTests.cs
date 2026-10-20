using System.IO.Abstractions;
using Kavita.API.Database;
using Kavita.API.Services;
using Kavita.Models.DTOs.Settings;
using Kavita.Models.Entities.Enums;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Kavita.Services.Tests;

/// <summary>
/// Fork (book mode on PDF): the image reader turns PDF pages rendered by the server. Rendering the whole document
/// first took 13 s for 125 pages and 8 minutes for 1336, so pages are rendered one at a time, when asked for.
/// </summary>
public class PdfPageTests : IDisposable
{
    private readonly IBookService _bookService;
    private readonly string _document = Path.GetFullPath(Path.Join(Directory.GetCurrentDirectory(),
        "../../../Test Data/BookService/Synthetic 8 pages.pdf"));
    private readonly string _output = Path.Join(Path.GetTempPath(), $"PdfPages_{Guid.NewGuid():N}");

    public PdfPageTests()
    {
        var unitOfWork = Substitute.For<IUnitOfWork>();
        unitOfWork.SettingsRepository.GetSettingsDtoAsync().Returns(new ServerSettingDto { PdfRenderResolution = PdfRenderResolution.Default });
        var directoryService = new DirectoryService(Substitute.For<ILogger<DirectoryService>>(), new FileSystem());
        _bookService = new BookService(Substitute.For<ILogger<BookService>>(), directoryService,
            new ImageService(Substitute.For<ILogger<ImageService>>(), directoryService), Substitute.For<IMediaErrorService>(), unitOfWork);
    }

    public void Dispose()
    {
        if (Directory.Exists(_output)) Directory.Delete(_output, true);
    }

    [Fact]
    public void Dimensions_AreThoseOfTheRenderedPages_ForEveryPage()
    {
        Assert.Equal(8, _bookService.GetNumberOfPages(_document));
        var full = Path.Join(_output, "full");
        _bookService.ExtractPdfImages(_document, full);
        var rendered = Directory.GetFiles(full, "Page-*.png")
            .OrderBy(f => int.Parse(Path.GetFileNameWithoutExtension(f)["Page-".Length..]))
            .Select(f => { using var image = NetVips.Image.NewFromFile(f); return (image.Width, image.Height); })
            .ToList();

        var dimensions = _bookService.GetPdfPageDimensions(_document);

        Assert.Equal(_bookService.GetNumberOfPages(_document), dimensions.Count);
        Assert.Equal(rendered, dimensions.Select(d => (d.Width, d.Height)).ToList());
        Assert.Equal(Enumerable.Range(0, dimensions.Count), dimensions.Select(d => d.PageNumber));
        Assert.All(dimensions, d => Assert.Equal(d.Width > d.Height, d.IsWide));
    }

    [Fact]
    public void OnePage_IsRenderedAlone_AndReused()
    {
        var path = _bookService.GetPdfPageImage(_document, 1, _output);

        Assert.NotNull(path);
        Assert.Equal(["Page-1.png"], Directory.GetFiles(_output).Select(Path.GetFileName));
        using (var image = NetVips.Image.NewFromFile(path))
        {
            var expected = _bookService.GetPdfPageDimensions(_document)[1];
            Assert.Equal((expected.Width, expected.Height), (image.Width, image.Height));
        }

        var written = File.GetLastWriteTimeUtc(path);
        Assert.Equal(path, _bookService.GetPdfPageImage(_document, 1, _output));
        Assert.Equal(written, File.GetLastWriteTimeUtc(path));
    }

    [Fact]
    public void PageOutsideTheDocument_IsNull()
    {
        Assert.Null(_bookService.GetPdfPageImage(_document, -1, _output));
        Assert.Null(_bookService.GetPdfPageImage(_document, _bookService.GetNumberOfPages(_document), _output));
    }

    [Fact]
    public async Task SamePageAskedTogether_IsWrittenOnce_AndComplete()
    {
        var paths = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => Task.Run(() => _bookService.GetPdfPageImage(_document, 0, _output))));

        Assert.All(paths, p => Assert.Equal(paths[0], p));
        Assert.Equal(["Page-0.png"], Directory.GetFiles(_output).Select(Path.GetFileName));
        using var image = NetVips.Image.NewFromFile(paths[0]);
        Assert.True(image.Width > 0 && image.Height > 0);
    }
}
