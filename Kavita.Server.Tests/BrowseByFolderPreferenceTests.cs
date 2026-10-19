using AutoMapper;
using Kavita.API.Database;
using Kavita.API.Repositories;
using Kavita.API.Services;
using Kavita.API.Services.Plus;
using Kavita.API.Services.SignalR;
using Kavita.API.Store;
using Kavita.Models.Builders;
using Kavita.Models.DTOs;
using Kavita.Models.Entities.Enums.UserPreferences;
using Kavita.Models.Entities.User;
using Kavita.Server.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace Kavita.Server.Tests;

public class BrowseByFolderPreferenceTests
{
    private readonly IUnitOfWork _uow = Substitute.For<IUnitOfWork>();

    private UsersController CreateController(AppUser user)
    {
        _uow.UserRepository.GetUserByUsernameAsync(user.UserName!, Arg.Any<AppUserIncludes>(), Arg.Any<CancellationToken>())
            .Returns(user);
        _uow.LibraryRepository.GetLibrariesForUserIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns([]);
        _uow.CommitAsync(Arg.Any<CancellationToken>()).Returns(true);
        var context = Substitute.For<IUserContext>();
        context.GetUserIdOrThrow().Returns(user.Id);
        context.GetUsername().Returns(user.UserName);
        return new UsersController(_uow, Substitute.For<IMapper>(), Substitute.For<IEventHub>(),
            Substitute.For<ILocalizationService>(), Substitute.For<IScrobblingService>())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    RequestServices = new ServiceCollection().AddSingleton(context).BuildServiceProvider()
                }
            }
        };
    }

    private static UserPreferencesDto Preferences(bool? byFolder) => new()
    {
        BrowseLibrariesByFolder = byFolder,
        SocialPreferences = new AppUserSocialPreferences(),
        OpdsPreferences = new AppUserOpdsPreferences(),
        Locale = "pt_BR",
    };

    [Fact]
    public async Task UpdatePreferences_StoresTheChosenLibraryView()
    {
        var user = new AppUserBuilder("leitora", "leitora@example.com").Build();

        await CreateController(user).UpdatePreferences(Preferences(false));

        Assert.False(user.UserPreferences.BrowseLibrariesByFolder);
    }

    [Fact]
    public async Task UpdatePreferences_KeepsTheLibraryViewWhenAnOlderClientOmitsIt()
    {
        var user = new AppUserBuilder("leitora", "leitora@example.com").Build();
        user.UserPreferences.BrowseLibrariesByFolder = false;

        await CreateController(user).UpdatePreferences(Preferences(null));

        Assert.False(user.UserPreferences.BrowseLibrariesByFolder);
    }

    [Fact]
    public void NewUsersOpenLibrariesByFolder()
    {
        Assert.True(new AppUserBuilder("nova", "nova@example.com").Build().UserPreferences.BrowseLibrariesByFolder);
    }
}
