using System.Collections.Generic;

namespace Kavita.Models.DTOs;

/// <summary>
/// Fork: a folder series with the files it holds, to recognize the folder when it is renamed or moved on disk
/// </summary>
public sealed record SeriesFolderFiles(int SeriesId, string FolderPath, IList<SeriesFolderFile> Files);

public sealed record SeriesFolderFile(string FilePath, long Bytes);
