using Kavita.API.Database;
using Kavita.API.Services;
using Kavita.API.Services.Metadata;
using Kavita.API.Services.Plus;
using Kavita.API.Services.ReadingLists;
using Kavita.Models.Entities;
using Kavita.Server.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace Kavita.Server.Tests;

/// <summary>
/// Characterization: a folder cover whose file is gone answers 404 (BaseApiController.PhysicalFile checks the disk),
/// so the client falls back to the series cover instead of showing an error
/// </summary>
public class FolderCoverImageTests : IDisposable
{
    private const int LibraryId = 3;
    private readonly string _covers = Directory.CreateTempSubdirectory("kavita-covers-").FullName;

    public void Dispose() => Directory.Delete(_covers, recursive: true);

    private ImageController CreateController(FolderCover? cover)
    {
        var uow = Substitute.For<IUnitOfWork>();
        uow.LibraryRepository.GetFolderCoverAsync(LibraryId, Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(cover);
        var directories = Substitute.For<IDirectoryService>();
        directories.CoverImageDirectory.Returns(_covers);
        return new ImageController(uow, directories, Substitute.For<ILocalizationService>(),
            Substitute.For<IReadingListService>(), Substitute.For<ICoverDbService>(),
            Substitute.For<ICollectionTagService>(), Substitute.For<IExternalMetadataService>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
    }

    [Fact]
    public async Task GetFolderCoverImage_ServesTheChosenCover()
    {
        await File.WriteAllBytesAsync(Path.Join(_covers, "fldr3_x.webp"), [1]);

        var result = await CreateController(new FolderCover { Path = "Elric", CoverImage = "fldr3_x.webp" })
            .GetFolderCoverImage(LibraryId, "Elric");

        Assert.IsType<PhysicalFileResult>(result);
    }

    [Fact]
    public async Task GetFolderCoverImage_IsNotFoundWhenTheFileIsGone()
    {
        var result = await CreateController(new FolderCover { Path = "Elric", CoverImage = "fldr3_x.webp" })
            .GetFolderCoverImage(LibraryId, "Elric");

        Assert.IsType<NotFoundResult>(result);
    }
}
