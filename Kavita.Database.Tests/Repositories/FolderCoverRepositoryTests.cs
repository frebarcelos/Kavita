using System;
using System.Linq;
using System.Threading.Tasks;
using Kavita.Models.Builders;
using Kavita.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Xunit.Abstractions;

namespace Kavita.Database.Tests.Repositories;

public class FolderCoverRepositoryTests(ITestOutputHelper outputHelper) : AbstractDbTest(outputHelper)
{
    [Fact]
    public async Task FolderCovers_AreListedPerLibraryAndFoundByPath()
    {
        var (unitOfWork, context, _) = await CreateDatabase();
        var comics = new LibraryBuilder("Quadrinhos").Build();
        var books = new LibraryBuilder("Livros").Build();
        context.Library.AddRange(comics, books);
        await context.SaveChangesAsync();
        var time = new DateTime(2026, 10, 19, 12, 0, 0, DateTimeKind.Utc);
        unitOfWork.LibraryRepository.Add(new FolderCover { LibraryId = comics.Id, Path = "Elric", CoverImage = "a.webp", LastModifiedUtc = time });
        unitOfWork.LibraryRepository.Add(new FolderCover { LibraryId = comics.Id, Path = "", CoverImage = "b.webp", LastModifiedUtc = time });
        unitOfWork.LibraryRepository.Add(new FolderCover { LibraryId = books.Id, Path = "Elric", CoverImage = "c.webp", LastModifiedUtc = time });
        await unitOfWork.CommitAsync();

        var covers = await unitOfWork.LibraryRepository.GetFolderCoversAsync(comics.Id);

        Assert.Equal(new[] { "", "Elric" }, covers.Select(c => c.Path).Order());
        Assert.Equal("c.webp", (await unitOfWork.LibraryRepository.GetFolderCoverAsync(books.Id, "Elric"))!.CoverImage);
        Assert.Null(await unitOfWork.LibraryRepository.GetFolderCoverAsync(books.Id, "Elr"));
    }

    [Fact]
    public async Task FolderCovers_GoAwayWithTheirLibrary()
    {
        var (unitOfWork, context, _) = await CreateDatabase();
        var library = new LibraryBuilder("Quadrinhos").Build();
        context.Library.Add(library);
        await context.SaveChangesAsync();
        unitOfWork.LibraryRepository.Add(new FolderCover { LibraryId = library.Id, Path = "Elric", CoverImage = "a.webp" });
        await unitOfWork.CommitAsync();

        context.Library.Remove(library);
        await context.SaveChangesAsync();

        Assert.False(await context.FolderCover.AnyAsync());
    }
}
