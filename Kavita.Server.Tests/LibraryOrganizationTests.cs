using AutoMapper;
using EasyCaching.Core;
using Kavita.API.Database;
using Kavita.API.Repositories;
using Kavita.API.Services;
using Kavita.API.Services.Scanner;
using Kavita.API.Services.SignalR;
using Kavita.API.Store;
using Kavita.Models.Builders;
using Kavita.Models.DTOs;
using Kavita.Models.Entities;
using Kavita.Models.Entities.Enums;
using Kavita.Server.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Kavita.Server.Tests;

public class LibraryOrganizationTests
{
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();

    private LibraryController CreateController(Library library, bool populated)
    {
        _uow.LibraryRepository.GetLibraryForIdAsync(library.Id, Arg.Any<LibraryIncludes>(), Arg.Any<CancellationToken>())
            .Returns(library);
        _uow.LibraryRepository.HasSeriesAsync(library.Id, Arg.Any<CancellationToken>()).Returns(populated);
        _uow.CommitAsync(Arg.Any<CancellationToken>()).Returns(true);
        var user = Substitute.For<IUserContext>();
        user.GetUserIdOrThrow().Returns(1);
        var caching = Substitute.For<IEasyCachingProviderFactory>();
        caching.GetCachingProvider(Arg.Any<string>()).Returns(Substitute.For<IEasyCachingProvider>());
        return new LibraryController(Substitute.For<IDirectoryService>(), Substitute.For<ILogger<LibraryController>>(),
            Substitute.For<IMapper>(), Substitute.For<ITaskScheduler>(), _uow, Substitute.For<IEventHub>(),
            Substitute.For<ILibraryWatcher>(), caching, Substitute.For<ILocalizationService>())
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

    private static UpdateLibraryDto Update(Library library, bool? mode) => new()
    {
        Id = library.Id, Name = library.Name, Folders = library.Folders.Select(f => f.Path),
        Type = library.Type, MetadataProvider = MetadataProvider.Mangabaka,
        FolderWatching = library.FolderWatching,
        FileGroupTypes = [FileTypeGroup.Archive], ExcludePatterns = [],
        FolderBasedOrganization = mode, EnableMetadata = true, AllowMetadataMatching = true
    };

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task Update_RejectsOrganizationSwitchOnPopulatedLibraryBeforeAnyMutation(bool oldMode, bool newMode)
    {
        var library = new LibraryBuilder("Existing").Build();
        library.FolderBasedOrganization = oldMode;
        var controller = CreateController(library, true);

        var result = await controller.UpdateLibrary(Update(library, newMode));

        var error = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("library-organization-migration-required", error.Value);
        Assert.Equal(oldMode, library.FolderBasedOrganization);
        await _uow.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_OmittedModePreservesExistingFolderOrganizationAndKeepsMetadataDisabled()
    {
        var library = new LibraryBuilder("Existing").Build();
        library.FolderBasedOrganization = true;
        var controller = CreateController(library, true);

        var result = await controller.UpdateLibrary(Update(library, null));

        Assert.IsType<OkObjectResult>(result);
        Assert.True(library.FolderBasedOrganization);
        Assert.False(library.EnableMetadata);
        Assert.False(library.AllowMetadataMatching);
    }

    [Fact]
    public async Task Update_EmptyLibraryCanChooseFolderOrganization()
    {
        var library = new LibraryBuilder("Empty").Build();
        var controller = CreateController(library, false);

        var result = await controller.UpdateLibrary(Update(library, true));

        Assert.IsType<OkObjectResult>(result);
        Assert.True(library.FolderBasedOrganization);
        Assert.False(library.EnableMetadata);
        Assert.False(library.AllowMetadataMatching);
    }
}
