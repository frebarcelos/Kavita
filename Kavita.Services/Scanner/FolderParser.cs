using System;
using System.Linq;
using System.Text.RegularExpressions;
using Kavita.API.Services;
using Kavita.Models.Entities.Enums;
using Kavita.Models.Metadata;
using Kavita.Models.Parser;

namespace Kavita.Services.Scanner;

/// <summary>Parses a file in a library whose physical folders define its organization.</summary>
public class FolderParser(IDirectoryService directoryService) : DefaultParser(directoryService)
{
    public override ParseInfoResult Parse(string filePath, string rootPath, string libraryRoot, LibraryType type,
        bool enableMetadata = true, ComicInfo? comicInfo = null)
    {
        var path = directoryService.FileSystem.Path;
        var fullPath = Parser.NormalizePath(path.GetFullPath(filePath));
        var root = Parser.NormalizePath(path.GetFullPath(libraryRoot)).TrimEnd('/');
        var folder = Parser.NormalizePath(path.GetDirectoryName(fullPath) ?? string.Empty).TrimEnd('/');
        if (folder != root && !folder.StartsWith(root + "/", StringComparison.Ordinal))
        {
            return ParseInfoResult.FailedParse();
        }

        var filename = path.GetFileName(fullPath);
        var title = path.GetFileNameWithoutExtension(filename);
        var (volume, chapter) = ClassifyByName(title, type);
        var info = new ParserInfo
        {
            Series = folder == root ? path.GetFileName(folder) : folder[(root.Length + 1)..],
            FolderKey = folder,
            Filename = filename,
            FullFilePath = fullPath,
            Title = title,
            Format = Parser.ParseFormat(filePath),
            Volumes = volume,
            Chapters = chapter,
            IsSpecial = volume == Parser.SpecialVolume
        };
        if (info.Format == MangaFormat.Image)
        {
            // Loose images are pages of the folder, rather than separate books.
            info.Volumes = "1";
            info.Chapters = "1";
            info.IsSpecial = false;
        }
        FinalizeNumbers(info);
        return ParseInfoResult.FromParserInfo(info);
    }

    public override bool IsApplicable(string filePath, LibraryType type) => true;

    /// <summary>
    /// The filename only places a file inside its folder's series: a volume marker or a number ending the last
    /// " - " segment is a volume, a chapter marker is a loose chapter, anything else is a special.
    /// </summary>
    private static (string Volume, string Chapter) ClassifyByName(string title, LibraryType type)
    {
        var volume = Parser.ParseVolume(title, type);
        if (!Parser.IsLooseLeafVolume(volume)) return (volume, Parser.DefaultChapter);

        var chapter = ChapterMarkerRegex.Match(title);
        if (chapter.Success) return (Parser.LooseLeafVolume, FormatRange(chapter.Groups["Chapter"].Value));

        var trailing = TrailingNumberRegex.Match(title);
        if (trailing.Success) return (Parser.RemoveLeadingZeroes(trailing.Groups["Volume"].Value), Parser.DefaultChapter);

        return (Parser.SpecialVolume, Parser.DefaultChapter);
    }

    private static string FormatRange(string value)
    {
        var bounds = value.Split('-')
            .Select(b => Parser.RemoveLeadingZeroes(b.Trim().TrimStart('c', 'C', 'h', 'H', '.').Trim()))
            .ToArray();
        return bounds.Length == 2 ? $"{bounds[0]}-{bounds[1]}" : bounds[0];
    }

    private static readonly Regex ChapterMarkerRegex = new(
        @"(?<![\p{L}\d])(?:cap[ií]tulo|chapter|cap|ch|c)\.?\s?(?<Chapter>\d+(?:\.\d+)?(?:\s?-\s?(?:ch|c)?\.?\s?\d+(?:\.\d+)?)?)(?![\p{L}\d])",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, Parser.RegexTimeout);

    private static readonly Regex TrailingNumberRegex = new(
        @"\s-\s(?:[^-]*\s)?#?(?<Volume>\d+(?:\.\d+)?)\s*$",
        RegexOptions.CultureInvariant, Parser.RegexTimeout);
}
