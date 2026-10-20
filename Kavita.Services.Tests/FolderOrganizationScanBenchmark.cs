using System.Diagnostics;
using Kavita.Database.Tests;
using Kavita.Models;
using Kavita.Models.Builders;
using Kavita.Models.Entities;
using Kavita.Models.Entities.Enums;
using Kavita.Services.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Xunit.Abstractions;

namespace Kavita.Services.Tests;

/// <summary>
/// Fork (item 4.8): scan and folder-series times of a large synthetic folder library. Runs only when
/// KAVITA_BENCH_FOLDERS is set (folders of 10 files each), outside the normal suite. The files are created in the
/// system temp folder, not in Test Data. KAVITA_BENCH_OUT names a file the times are appended to.
/// </summary>
[Trait("Category", "Benchmark")]
public class FolderOrganizationScanBenchmark(ITestOutputHelper output) : AbstractDbTest(output)
{
    private const int FilesPerFolder = 10;

    [Fact]
    public async Task Scan_LargeFolderLibrary()
    {
        if (!int.TryParse(Environment.GetEnvironmentVariable("KAVITA_BENCH_FOLDERS"), out var folders)) return;

        var root = Path.Join(Path.GetTempPath(), $"kavita-bench-{Guid.NewGuid():N}");
        try
        {
            for (var f = 0; f < folders; f++)
            {
                // Letters only, so the name parser of a library without folder organization keeps them apart too
                var title = $"Serie {Letters(f)}";
                var folder = Path.Join(root, title);
                Directory.CreateDirectory(folder);
                for (var v = 1; v <= FilesPerFolder; v++)
                {
                    await File.WriteAllBytesAsync(Path.Join(folder, $"{title} v{v:D2}.cbz"), new byte[f * FilesPerFolder + v]);
                }
            }
            ScannerHelper.Backdate(root, TimeSpan.FromHours(1));

            var (uow, context, _) = await CreateDatabase(Path.Join(root, "..", Path.GetFileName(root) + ".db"));
            var library = new LibraryBuilder("Bench", LibraryType.Manga)
                .WithFolders([new FolderPath { Path = root }])
                .Build();
            library.FolderBasedOrganization = Environment.GetEnvironmentVariable("KAVITA_BENCH_CLASSIC") == null;
            var user = new AppUserBuilder("leitor", "leitor@kavita.local", Defaults.DefaultThemes[0])
                .WithLibrary(library)
                .Build();
            uow.UserRepository.Add(user);
            uow.LibraryRepository.Add(library);
            await uow.CommitAsync();
            var scanner = new ScannerHelper(uow, output).CreateServices(scopedUnitOfWork: NewUnitOfWork);

            var watch = Stopwatch.StartNew();
            await scanner.ScanLibrary(library.Id);
            Report("first scan", watch);

            watch.Restart();
            await scanner.ScanLibrary(library.Id);
            Report("scan without changes", watch);

            var changed = Path.Join(root, $"Serie {Letters(0)}");
            await File.WriteAllBytesAsync(Path.Join(changed, $"Serie {Letters(0)} v99.cbz"), new byte[folders * FilesPerFolder + 1]);
            Directory.SetLastWriteTime(changed, DateTime.Now);
            watch.Restart();
            await scanner.ScanLibrary(library.Id);
            Report("scan with one new file", watch);

            watch.Restart();
            var tree = await uow.SeriesRepository.GetFolderSeriesAsync(library.Id, user.Id);
            Report($"folder-series ({tree.Count} series)", watch);

            Assert.Equal(folders, await context.Series.CountAsync(s => s.LibraryId == library.Id));
            Assert.Equal(folders * FilesPerFolder + 1, await context.MangaFile.CountAsync());
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, true);
            Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
            File.Delete(Path.Join(root, "..", Path.GetFileName(root) + ".db"));
        }
    }

    private static string Letters(int n)
    {
        var letters = string.Empty;
        for (var i = 0; i < 4; i++, n /= 26) letters = (char) ('a' + n % 26) + letters;
        return letters;
    }

    private void Report(string step, Stopwatch watch)
    {
        var line = $"BENCH {step}: {watch.ElapsedMilliseconds} ms";
        output.WriteLine(line);
        // A passing test's output is not shown by the console logger
        var file = Environment.GetEnvironmentVariable("KAVITA_BENCH_OUT");
        if (!string.IsNullOrEmpty(file)) File.AppendAllLines(file, [line]);
    }
}
