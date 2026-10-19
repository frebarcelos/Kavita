using System.Linq;
using System.Threading.Tasks;
using Kavita.Models.Builders;
using Kavita.Models.Entities.Enums;
using Kavita.Services.Builders;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Xunit.Abstractions;

namespace Kavita.Database.Tests.Repositories;

public class ChapterReaderFormatTests(ITestOutputHelper outputHelper) : AbstractDbTest(outputHelper)
{
    [Fact]
    public async Task GetChapterInfoDtoAsync_ReportsTheFormatOfTheChaptersOwnFile_InAMixedFolderSeries()
    {
        var (unitOfWork, context, _) = await CreateDatabase();
        var library = new LibraryBuilder("Books").Build();
        context.Library.Add(library);
        await context.SaveChangesAsync();
        var series = new SeriesBuilder("Technology")
            .WithFormat(MangaFormat.Pdf)
            .WithLibraryId(library.Id)
            .WithVolume(new VolumeBuilder("1")
                .WithChapter(new ChapterBuilder("1")
                    .WithFile(new MangaFileBuilder(Root + "Technology/Book.pdf", MangaFormat.Pdf).Build()).Build())
                .WithChapter(new ChapterBuilder("2")
                    .WithFile(new MangaFileBuilder(Root + "Technology/Book.epub", MangaFormat.Epub).Build()).Build())
                .WithChapter(new ChapterBuilder("3").Build())
                .Build())
            .Build();
        context.Series.Add(series);
        await context.SaveChangesAsync();
        var chapters = await context.Chapter.Include(c => c.Files).OrderBy(c => c.MinNumber).ToListAsync();

        var pdf = await unitOfWork.ChapterRepository.GetChapterInfoDtoAsync(chapters[0].Id);
        var epub = await unitOfWork.ChapterRepository.GetChapterInfoDtoAsync(chapters[1].Id);
        var noFile = await unitOfWork.ChapterRepository.GetChapterInfoDtoAsync(chapters[2].Id);

        Assert.Equal(MangaFormat.Pdf, pdf!.SeriesFormat);
        Assert.Equal(MangaFormat.Epub, epub!.SeriesFormat);
        Assert.Equal(MangaFormat.Pdf, noFile!.SeriesFormat);
    }
}
