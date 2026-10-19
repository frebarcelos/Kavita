using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Xunit.Abstractions;

namespace Kavita.Database.Tests;

public class FolderOrganizationMigrationTests(ITestOutputHelper output) : AbstractDbTest(output)
{
    [Fact]
    public async Task Upgrade_ExistingLibrariesKeepTheirIdentityAndRemainInLegacyMode()
    {
        var (_, context, _) = await CreateDatabase();
        var before = await context.Library.OrderBy(l => l.Id).Select(l => new {l.Id, l.Name}).ToListAsync();
        var migrations = context.Database.GetMigrations().ToList();
        var folderMigration = migrations.SingleOrDefault(id => id.EndsWith("_FolderBasedOrganization"));
        Assert.NotNull(folderMigration);

        // Reproduce just this upgrade boundary, independently of older migrations.
        await context.Database.ExecuteSqlRawAsync("ALTER TABLE Library DROP COLUMN FolderBasedOrganization;");
        await context.Database.ExecuteSqlRawAsync(
            "CREATE TABLE __EFMigrationsHistory (MigrationId TEXT NOT NULL PRIMARY KEY, ProductVersion TEXT NOT NULL);");
        foreach (var id in migrations.Where(id => id != folderMigration))
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES ({id}, {"10.0.12"});");

        await context.Database.MigrateAsync();
        context.ChangeTracker.Clear();

        var after = await context.Library.OrderBy(l => l.Id).ToListAsync();
        Assert.Equal(before, after.Select(l => new {l.Id, l.Name}));
        Assert.All(after, library => Assert.False(library.FolderBasedOrganization));
    }
}
