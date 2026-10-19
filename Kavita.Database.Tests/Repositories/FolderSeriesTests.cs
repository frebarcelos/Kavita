using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Kavita.Models.Builders;
using Kavita.Models.Entities;
using Kavita.Models.Entities.Enums;
using Kavita.Models.Entities.User;
using Xunit;
using Xunit.Abstractions;

namespace Kavita.Database.Tests.Repositories;

public class FolderSeriesTests(ITestOutputHelper outputHelper) : AbstractDbTest(outputHelper)
{
    private async Task<(Library Library, Series Mature, AppUser Teen, AppUser Adult)> Seed(DataContext context,
        params string[] roots)
    {
        var library = new LibraryBuilder("Quadrinhos")
            .WithFolders([.. roots.Select(r => new FolderPath { Path = r })])
            .Build();
        var other = new LibraryBuilder("Livros").WithFolderPath(new FolderPath { Path = Root + "Livros" }).Build();
        context.Library.AddRange(library, other);
        await context.SaveChangesAsync();

        Series Add(Library owner, string folder, AgeRating rating = AgeRating.Unknown)
        {
            var series = new SeriesBuilder(folder)
                .WithLibraryId(owner.Id)
                .WithMetadata(new SeriesMetadataBuilder().WithAgeRating(rating).Build())
                .Build();
            series.FolderPath = folder;
            context.Series.Add(series);
            return series;
        }

        var mature = Add(library, roots[0] + "/Elric/PT-BR/elric glenat", AgeRating.Mature);
        foreach (var folder in roots.Skip(1).Prepend(roots[0]))
        {
            Add(library, folder);
        }
        Add(library, roots[0] + "/Elric/EN");
        Add(library, roots[0] + "/Elric/PT-BR");
        Add(library, Root + "Elsewhere/Outside");
        Add(other, Root + "Livros/Tecnologia");

        var teen = new AppUserBuilder("eva", "eva@example.com").Build();
        teen.AgeRestriction = AgeRating.Teen;
        teen.AgeRestrictionIncludeUnknowns = true;
        var adult = new AppUserBuilder("amelia", "amelia@example.com").Build();
        context.Users.AddRange(teen, adult);
        teen.Libraries.Add(library);
        adult.Libraries.Add(library);
        await context.SaveChangesAsync();
        return (library, mature, teen, adult);
    }

    [Fact]
    public async Task GetFolderSeriesAsync_GivesEachSeriesItsFolderRelativeToTheLibraryRoot()
    {
        var (unitOfWork, context, _) = await CreateDatabase();
        var (library, mature, _, adult) = await Seed(context, Root + "Quadrinhos");

        var folders = await unitOfWork.SeriesRepository.GetFolderSeriesAsync(library.Id, adult.Id);

        Assert.Equal(new[] { "", "Elric/EN", "Elric/PT-BR", "Elric/PT-BR/elric glenat" },
            folders.Select(f => f.Path).Order());
        Assert.Equal("Elric/PT-BR/elric glenat", folders.Single(f => f.SeriesId == mature.Id).Path);
        Assert.DoesNotContain(folders, f => f.Path.StartsWith(Root) || f.Path.StartsWith('/'));
    }

    [Fact]
    public async Task GetFolderSeriesAsync_HidesSeriesAboveTheUsersAgeRestriction()
    {
        var (unitOfWork, context, _) = await CreateDatabase();
        var (library, mature, teen, _) = await Seed(context, Root + "Quadrinhos");

        var folders = await unitOfWork.SeriesRepository.GetFolderSeriesAsync(library.Id, teen.Id);

        Assert.DoesNotContain(folders, f => f.SeriesId == mature.Id);
        Assert.Equal(3, folders.Count);
    }

    [Fact]
    public async Task GetFolderSeriesAsync_PrefixesTheRootFolderNameWhenTheLibraryHasSeveralRoots()
    {
        var (unitOfWork, context, _) = await CreateDatabase();
        var (library, _, _, adult) = await Seed(context, Root + "PC/Quadrinhos", Root + "Externo/HQ");

        var folders = await unitOfWork.SeriesRepository.GetFolderSeriesAsync(library.Id, adult.Id);

        Assert.Equal(new[] { "HQ", "Quadrinhos", "Quadrinhos/Elric/EN", "Quadrinhos/Elric/PT-BR",
                "Quadrinhos/Elric/PT-BR/elric glenat" },
            folders.Select(f => f.Path).Order());
    }
}
