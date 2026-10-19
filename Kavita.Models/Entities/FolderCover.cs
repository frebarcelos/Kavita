using System;

namespace Kavita.Models.Entities;

/// <summary>
/// A cover the user chose for a folder of a library's folder tree. Folders without one show their first series' cover.
/// </summary>
public class FolderCover
{
    public int Id { get; set; }
    public int LibraryId { get; set; }
    public Library Library { get; set; } = null!;
    /// <summary>
    /// Folder relative to the library root, as <c>FolderSeriesDto.Path</c>: '/' separated, empty for the root
    /// </summary>
    public required string Path { get; set; }
    /// <summary>
    /// File name inside the covers directory
    /// </summary>
    public required string CoverImage { get; set; }
    public DateTime LastModifiedUtc { get; set; }
}
