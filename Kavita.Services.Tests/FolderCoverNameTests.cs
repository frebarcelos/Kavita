using System.Text.RegularExpressions;

namespace Kavita.Services.Tests;

public class FolderCoverNameTests
{
    private static readonly string[] CleanupPatterns =
    [
        ImageService.ChapterCoverImageRegex, ImageService.SeriesCoverImageRegex, ImageService.CollectionTagCoverImageRegex,
        ImageService.ReadingListCoverImageRegex, ImageService.PersonCoverImageRegex
    ];

    [Theory]
    [InlineData(3, "")]
    [InlineData(3, "Elric/PT-BR")]
    [InlineData(12, "Livros/Tecnologia/Robert C. Martin - Clean Code")]
    [InlineData(1, "v1_c2 series3 tag4 readinglist5 person6")]
    public void GetFolderCoverFormat_IsNeverRemovedByTheCoverCleanup(int libraryId, string path)
    {
        var name = ImageService.GetFolderCoverFormat(libraryId, path);

        Assert.All(CleanupPatterns, pattern => Assert.DoesNotMatch(new Regex(pattern), name));
        Assert.DoesNotContain('/', name);
    }

    [Fact]
    public void GetFolderCoverFormat_IsStablePerFolderAndDistinctBetweenFolders()
    {
        Assert.Equal(ImageService.GetFolderCoverFormat(3, "Elric/PT-BR"), ImageService.GetFolderCoverFormat(3, "Elric/PT-BR"));
        Assert.NotEqual(ImageService.GetFolderCoverFormat(3, "Elric/PT-BR"), ImageService.GetFolderCoverFormat(3, "Elric/EN"));
        Assert.NotEqual(ImageService.GetFolderCoverFormat(3, "Elric"), ImageService.GetFolderCoverFormat(4, "Elric"));
    }
}
