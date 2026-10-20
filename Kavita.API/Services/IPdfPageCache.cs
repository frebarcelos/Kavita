using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Kavita.Models.DTOs.Reader;
using Kavita.Models.Entities;

namespace Kavita.API.Services;

/// <summary>
/// Fork (book mode on PDF): the pages of a PDF chapter as images, rendered one at a time when the image reader asks
/// for them, instead of rendering the whole document first. Null for a chapter that is not a single PDF file, so the
/// caller keeps its usual path.
/// </summary>
public interface IPdfPageCache
{
    /// <summary>The chapter is a single PDF file, served page by page when read as images</summary>
    bool Handles(Chapter? chapter);
    /// <summary>The size of every page, as the page images have it</summary>
    Task<IList<FileDimensionDto>?> GetDimensionsAsync(int chapterId, CancellationToken ct = default);
    /// <summary>The image of a page (from 0; past the end, the last page), rendered if needed</summary>
    Task<string?> GetPagePathAsync(int chapterId, int page, CancellationToken ct = default);
}
