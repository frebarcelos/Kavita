using Kavita.API.Database;
using Kavita.API.Services;
using Kavita.API.Services.Metadata;
using Kavita.API.Services.ReadingLists;
using Kavita.API.Services.SignalR;
using Kavita.API.Store;
using Kavita.Models.DTOs;
using Kavita.Models.DTOs.Settings;
using Kavita.Models.Entities;
using Kavita.Models.Entities.Enums;
using Kavita.Server.Controllers;
using Kavita.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Kavita.Server.Tests;

public class FolderCoverUploadTests
{
    private const int LibraryId = 3;
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();
    private readonly IImageService _images = Substitute.For<IImageService>();

    private UploadController CreateController(FolderCover? existing = null)
    {
        _uow.SeriesRepository.GetFolderSeriesAsync(LibraryId, 1, Arg.Any<CancellationToken>())
            .Returns([new FolderSeriesDto(10, "Elric/EN"), new FolderSeriesDto(11, "Elric/PT-BR"), new FolderSeriesDto(12, "")]);
        _uow.LibraryRepository.GetFolderCoverAsync(LibraryId, Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(existing);
        _uow.SettingsRepository.GetSettingsDtoAsync().Returns(new ServerSettingDto());
        _uow.CommitAsync(Arg.Any<CancellationToken>()).Returns(true);
        _images.CreateThumbnailFromBase64(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<EncodeFormat>(),
            Arg.Any<int>(), Arg.Any<int>(), Arg.Any<string?>()).Returns(c => c.ArgAt<string>(1) + ".webp");
        var user = Substitute.For<IUserContext>();
        user.GetUserIdOrThrow().Returns(1);
        return new UploadController(_uow, _images, Substitute.For<ILogger<UploadController>>(),
            Substitute.For<ITaskScheduler>(), Substitute.For<IDirectoryService>(), Substitute.For<IEventHub>(),
            Substitute.For<IReadingListService>(), Substitute.For<ILocalizationService>(),
            Substitute.For<ICoverDbService>(), Substitute.For<IUrlValidationService>())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    RequestServices = new ServiceCollection().AddSingleton(user).BuildServiceProvider()
                }
            }
        };
    }

    [Theory]
    [InlineData("Elric")]
    [InlineData("Elric/PT-BR")]
    [InlineData("")]
    public async Task UploadFolderCover_SavesTheCoverOfAFolderOfTheTree(string path)
    {
        var result = await CreateController().UploadFolderCover(
            new UploadFolderCoverDto { LibraryId = LibraryId, Path = path, Url = "aW1hZ2U=" });

        Assert.IsType<OkResult>(result);
        var expected = ImageService.GetFolderCoverFormat(LibraryId, path);
        _images.Received(1).CreateThumbnailFromBase64("aW1hZ2U=", expected, Arg.Any<EncodeFormat>(),
            Arg.Any<int>(), Arg.Any<int>(), Arg.Any<string?>());
        _uow.LibraryRepository.Received(1).Add(Arg.Is<FolderCover>(c =>
            c.LibraryId == LibraryId && c.Path == path && c.CoverImage == expected + ".webp"));
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("Elr")]
    [InlineData("Elric/PT")]
    [InlineData("../outside")]
    public async Task UploadFolderCover_RefusesFoldersOutsideTheTree(string path)
    {
        var result = await CreateController().UploadFolderCover(
            new UploadFolderCoverDto { LibraryId = LibraryId, Path = path, Url = "aW1hZ2U=" });

        Assert.IsType<BadRequestObjectResult>(result);
        _images.DidNotReceiveWithAnyArgs().CreateThumbnailFromBase64(default!, default!, default);
        _uow.LibraryRepository.DidNotReceiveWithAnyArgs().Add(Arg.Any<FolderCover>());
    }

    [Fact]
    public async Task UploadFolderCover_ReplacesAnExistingCover()
    {
        var existing = new FolderCover { LibraryId = LibraryId, Path = "Elric", CoverImage = "old.webp" };

        await CreateController(existing).UploadFolderCover(
            new UploadFolderCoverDto { LibraryId = LibraryId, Path = "Elric", Url = "aW1hZ2U=" });

        Assert.Equal(ImageService.GetFolderCoverFormat(LibraryId, "Elric") + ".webp", existing.CoverImage);
        _uow.LibraryRepository.DidNotReceiveWithAnyArgs().Add(Arg.Any<FolderCover>());
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UploadFolderCover_WithoutAnImageGoesBackToTheSeriesCover()
    {
        var existing = new FolderCover { LibraryId = LibraryId, Path = "Elric", CoverImage = "old.webp" };

        var result = await CreateController(existing).UploadFolderCover(
            new UploadFolderCoverDto { LibraryId = LibraryId, Path = "Elric" });

        Assert.IsType<OkResult>(result);
        _uow.LibraryRepository.Received(1).Remove(existing);
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }
}
