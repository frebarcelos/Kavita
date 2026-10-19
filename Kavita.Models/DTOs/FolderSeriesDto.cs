namespace Kavita.Models.DTOs;

/// <summary>
/// Where a series sits in its folder-organized library, so clients can browse the library as a folder tree
/// </summary>
/// <param name="SeriesId"></param>
/// <param name="Path">The series folder relative to the library root, '/' separated; empty for files at the root.
/// A library with several roots prefixes each root's folder name. Never an absolute server path.</param>
public sealed record FolderSeriesDto(int SeriesId, string Path);
