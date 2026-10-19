using System.Linq;
using System.Threading.Tasks;
using Kavita.Models.Builders;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Xunit.Abstractions;

namespace Kavita.Database.Tests;

public class BrowseByFolderMigrationTests(ITestOutputHelper output) : AbstractDbTest(output)
{
    [Fact]
    public async Task Upgrade_ExistingUsersOpenLibrariesByFolder()
    {
        var (_, context, _) = await CreateDatabase();
        context.Users.Add(new AppUserBuilder("leitora", "leitora@example.com").Build());
        await context.SaveChangesAsync();
        var migrations = context.Database.GetMigrations().ToList();
        var migration = migrations.SingleOrDefault(id => id.EndsWith("_BrowseLibrariesByFolder"));
        Assert.NotNull(migration);

        // Reproduce just this upgrade boundary on a user created before it.
        await context.Database.ExecuteSqlRawAsync("ALTER TABLE AppUserPreferences DROP COLUMN BrowseLibrariesByFolder;");
        await context.Database.ExecuteSqlRawAsync(
            "CREATE TABLE __EFMigrationsHistory (MigrationId TEXT NOT NULL PRIMARY KEY, ProductVersion TEXT NOT NULL);");
        foreach (var id in migrations.Where(id => id != migration))
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES ({id}, {"10.0.12"});");

        await context.Database.MigrateAsync();
        context.ChangeTracker.Clear();

        var preferences = await context.AppUserPreferences.ToListAsync();
        Assert.NotEmpty(preferences);
        Assert.All(preferences, p => Assert.True(p.BrowseLibrariesByFolder));
    }
}
