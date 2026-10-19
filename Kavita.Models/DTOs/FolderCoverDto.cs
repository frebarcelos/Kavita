using System;

namespace Kavita.Models.DTOs;

/// <summary>
/// A folder with a cover chosen by the user. Clients add <paramref name="LastModifiedUtc"/> to the image url to refresh it.
/// </summary>
/// <param name="Path">Folder relative to the library root, as <see cref="FolderSeriesDto.Path"/></param>
/// <param name="LastModifiedUtc"></param>
public sealed record FolderCoverDto(string Path, DateTime LastModifiedUtc);

/// <summary>
/// Sets the cover of a folder from an image staged by upload-by-file/upload-by-url (<see cref="FileName"/>) or a base64
/// payload (<see cref="Url"/>). With neither, the folder goes back to its first series' cover.
/// </summary>
public sealed class UploadFolderCoverDto
{
    public required int LibraryId { get; init; }
    public required string Path { get; init; }
    public string? Url { get; init; }
    public string? FileName { get; init; }
}
