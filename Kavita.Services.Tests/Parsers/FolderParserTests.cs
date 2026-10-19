using System.IO.Abstractions.TestingHelpers;
using Kavita.API.Services;
using Kavita.Models.Entities.Enums;
using Kavita.Models.Metadata;
using Kavita.Services.Scanner;
using NSubstitute;

namespace Kavita.Services.Tests.Parsers;

public class FolderParserTests
{
    private static FolderParser CreateParser()
    {
        var directory = Substitute.For<IDirectoryService>();
        directory.FileSystem.Returns(new MockFileSystem());
        return new FolderParser(directory);
    }

    [Theory]
    [InlineData("pdf", LibraryType.Manga)]
    [InlineData("cbz", LibraryType.Comic)]
    [InlineData("cbr", LibraryType.ComicVine)]
    [InlineData("epub", LibraryType.Book)]
    public void Parse_FolderAndFilenameOverrideAllEmbeddedOrganization(string extension, LibraryType type)
    {
        var result = CreateParser().Parse($"/library/20th Century Boys/Unrelated v02.{extension}",
            "/library/20th Century Boys", "/library", type, true,
            new ComicInfo { Series = "Wrong Series", Title = "Wrong Title", Volume = "999", Number = "888" }).Info;

        Assert.NotNull(result);
        Assert.Equal("20th Century Boys", result.Series);
        Assert.Equal("Unrelated v02", result.Title);
        Assert.Equal("2", result.Volumes);
        Assert.Null(result.ComicInfo);
    }

    [Fact]
    public void Parse_DifferentFilenamesInOneFolderStillBelongToOneSeries()
    {
        var parser = CreateParser();
        var first = parser.Parse("/library/Collection/Alpha v01.pdf", "/library", "/library", LibraryType.Manga).Info;
        var second = parser.Parse("/library/Collection/Beta v02.pdf", "/library", "/library", LibraryType.Manga).Info;
        Assert.Equal("Collection", first?.Series);
        Assert.Equal(first?.Series, second?.Series);
    }

    [Theory]
    [InlineData("Editions/Português", "Editions/English")]
    [InlineData("A/B", "AB")]
    [InlineData("Akira/Colorido", "Akira/Preto e Branco")]
    public void Parse_PreservesParentHierarchyInDisplayedNames(string firstFolder, string secondFolder)
    {
        var parser = CreateParser();
        var first = parser.Parse($"/library/{firstFolder}/Book v01.cbz", "/library", "/library", LibraryType.Comic).Info;
        var second = parser.Parse($"/library/{secondFolder}/Book v01.cbz", "/library", "/library", LibraryType.Comic).Info;
        Assert.Equal(firstFolder, first?.Series);
        Assert.Equal(secondFolder, second?.Series);
    }

    [Fact]
    public void Parse_FilesDirectlyInLibraryRootUseThatFolder()
    {
        var actual = CreateParser().Parse("/library/Standalone.pdf", "/library", "/library", LibraryType.Book).Info;
        Assert.Equal("library", actual?.Series);
        Assert.Equal("Standalone", actual?.Title);
    }

    [Theory]
    [InlineData("Berserk v02.cbz", LibraryType.Manga, "2")]
    [InlineData("Elric - 001.cbz", LibraryType.Comic, "1")]
    [InlineData("Blueberry - 002.pdf", LibraryType.Comic, "2")]
    [InlineData("Barbarella - 010.cbz", LibraryType.Comic, "10")]
    [InlineData("Oku-sama ga Seitokaichou! - Referência 002.pdf", LibraryType.Manga, "2")]
    [InlineData("Guia - Parte 3.pdf", LibraryType.Book, "3")]
    public void Parse_VolumeMarkerOrTrailingNumberAfterDashIsAVolume(string filename, LibraryType type, string volume)
    {
        var actual = CreateParser().Parse($"/library/Series/{filename}", "/library", "/library", type).Info;

        Assert.NotNull(actual);
        Assert.Equal(volume, actual.Volumes);
        Assert.Equal(Parser.DefaultChapter, actual.Chapters);
        Assert.False(actual.IsSpecial);
    }

    [Theory]
    [InlineData("Berserk - c0383.cbz", LibraryType.Manga, "383")]
    [InlineData("Diário de uma Apotecária - c0079.pdf", LibraryType.Manga, "79")]
    [InlineData("Chained Soldier - c0139-c0175.cbz", LibraryType.Manga, "139-175")]
    [InlineData("Série - Cap. 5.pdf", LibraryType.Book, "5")]
    [InlineData("Série - Capítulo 12.cbz", LibraryType.Comic, "12")]
    [InlineData("Series - Chapter 7.5.cbz", LibraryType.Manga, "7.5")]
    public void Parse_ChapterMarkerIsALooseChapter(string filename, LibraryType type, string chapter)
    {
        var actual = CreateParser().Parse($"/library/Series/{filename}", "/library", "/library", type).Info;

        Assert.NotNull(actual);
        Assert.Equal(Parser.LooseLeafVolume, actual.Volumes);
        Assert.Equal(chapter, actual.Chapters);
        Assert.False(actual.IsSpecial);
    }

    [Theory]
    [InlineData("Exterminador 17.cbz", LibraryType.Comic)]
    [InlineData("Clic.cbz", LibraryType.Comic)]
    [InlineData("Robert C. Martin - Clean Code [EN].pdf", LibraryType.Book)]
    [InlineData("Ali Abdaal - Feel-Good Productivity [PT-BR].pdf", LibraryType.Book)]
    [InlineData("A Beleza (Jeremy Haun, John Rauch).cbz", LibraryType.Comic)]
    [InlineData("Ellen Lupton - Design Is Storytelling [EN].epub", LibraryType.Book)]
    [InlineData("Cicero - De Re Publica 2 [LA].pdf", LibraryType.Book)]
    public void Parse_NameWithoutVolumeOrChapterIsASpecial(string filename, LibraryType type)
    {
        var actual = CreateParser().Parse($"/library/Series/{filename}", "/library", "/library", type).Info;

        Assert.NotNull(actual);
        Assert.Equal(Parser.SpecialVolume, actual.Volumes);
        Assert.Equal(Parser.DefaultChapter, actual.Chapters);
        Assert.True(actual.IsSpecial);
    }

    [Fact]
    public void Parse_PathOutsideLibraryIsRejected()
    {
        var actual = CreateParser().Parse("/library-other/Book.pdf", "/library", "/library", LibraryType.Book);
        Assert.False(actual.Success);
    }
}
