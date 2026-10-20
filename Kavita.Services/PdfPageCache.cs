using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Kavita.API.Database;
using Kavita.API.Services;
using Kavita.Models.DTOs.Reader;
using Kavita.Models.Entities;
using Kavita.Models.Entities.Enums;

namespace Kavita.Services;

/// <inheritdoc />
public class PdfPageCache(IUnitOfWork unitOfWork, IBookService bookService, ICacheService cacheService) : IPdfPageCache
{
    private const string DimensionsFile = "dimensions.json";

    public bool Handles(Chapter? chapter) =>
        chapter?.Files is {Count: 1} && chapter.Files.First().Format == MangaFormat.Pdf;

    public async Task<IList<FileDimensionDto>?> GetDimensionsAsync(int chapterId, CancellationToken ct = default)
    {
        var (file, folder) = await PdfOf(chapterId, ct);
        if (file == null) return null;

        // Measuring opens every page: done once per file version
        var stored = Path.Join(folder, DimensionsFile);
        if (File.Exists(stored))
        {
            try
            {
                var saved = JsonSerializer.Deserialize<List<FileDimensionDto>>(await File.ReadAllTextAsync(stored, ct));
                if (saved is {Count: > 0}) return saved;
            }
            catch (JsonException)
            {
                // Measured again below
            }
        }

        var dimensions = bookService.GetPdfPageDimensions(file.FilePath);
        Directory.CreateDirectory(folder);
        await File.WriteAllTextAsync(stored, JsonSerializer.Serialize(dimensions), ct);
        return dimensions;
    }

    public async Task<string?> GetPagePathAsync(int chapterId, int page, CancellationToken ct = default)
    {
        var (file, folder) = await PdfOf(chapterId, ct);
        if (file == null) return null;

        var last = Math.Max(0, (file.Pages > 0 ? file.Pages : bookService.GetNumberOfPages(file.FilePath)) - 1);
        return bookService.GetPdfPageImage(file.FilePath, Math.Clamp(page, 0, last), folder);
    }

    /// <summary>
    /// The PDF of a chapter made of one PDF file, and the folder of its pages. The folder is named after the file's
    /// size and write time, so a PDF changed on the PC does not reuse the pages of the previous one.
    /// </summary>
    private async Task<(MangaFile? File, string Folder)> PdfOf(int chapterId, CancellationToken ct)
    {
        var chapter = await unitOfWork.ChapterRepository.GetChapterAsync(chapterId, ct: ct);
        if (!Handles(chapter)) return (null, string.Empty);

        var file = chapter!.Files.First();
        var version = $"{file.Bytes}-{file.FileLastWriteTimeUtc?.Ticks ?? 0}";
        // Beside the chapter's cache folder, not in it: the full extraction flattens that folder and the PDF reader
        // clears it. The daily cleanup empties the whole cache, this folder included.
        var chapterFolder = Path.TrimEndingDirectorySeparator(cacheService.GetCachePath(chapterId));
        return (file, $"{chapterFolder}-pdf-pages-{version}");
    }
}
