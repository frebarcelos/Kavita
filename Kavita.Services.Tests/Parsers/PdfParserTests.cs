using System.IO.Abstractions.TestingHelpers;
using Kavita.Database.Tests;
using Kavita.Models.Entities.Enums;
using Kavita.Models.Metadata;
using Kavita.Services.Scanner;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Kavita.Services.Tests.Parsers;

public class PdfParserTests : AbstractFsTest
{
    private readonly PdfParser _parser;
    private readonly ILogger<DirectoryService> _dsLogger = Substitute.For<ILogger<DirectoryService>>();
    private static readonly string RootDirectory = Root + "Books/";

    public PdfParserTests()
    {
        var fileSystem = new MockFileSystem();
        fileSystem.AddDirectory(RootDirectory);
        fileSystem.AddDirectory(RootDirectory + "Birds of Prey (2002)");
        fileSystem.AddFile(RootDirectory + "A Dictionary of Japanese Food - Ingredients and Culture/A Dictionary of Japanese Food - Ingredients and Culture.pdf", new MockFileData(""));
        fileSystem.AddFile(Root + "Comics/DC Comics/Birds of Prey/Chapter 01/01.jpg", new MockFileData(""));
        var ds = new DirectoryService(_dsLogger, fileSystem);
        _parser = new PdfParser(ds);
    }

    #region Parse

    [Fact]
    public void LegacyMetadataMode_UnnumberedBooksKeepTheirFolderGrouping()
    {
        var category = RootDirectory + "Technology/";
        var first = _parser.Parse(category + "First Independent Book.pdf", category,
            RootDirectory, LibraryType.Book, true, new ComicInfo()).Info;
        var second = _parser.Parse(category + "Second Independent Book.pdf", category,
            RootDirectory, LibraryType.Book, true, new ComicInfo()).Info;

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal("Technology", first.Series);
        Assert.Equal(first.Series, second.Series);
        Assert.True(first.IsSpecial);
        Assert.True(second.IsSpecial);
    }

    [Theory]
    [InlineData(LibraryType.Manga)]
    [InlineData(LibraryType.Comic)]
    [InlineData(LibraryType.Book)]
    public void Parse_ExplicitPdfSeriesAndVolume_TakePrecedenceOverFilename(LibraryType libraryType)
    {
        var actual = _parser.Parse(RootDirectory + "Unrelated v001.pdf", RootDirectory,
            RootDirectory, libraryType, true, new ComicInfo
            {
                Series = "Explicit Series", Title = "Volume Title", Volume = "12"
            }).Info;

        Assert.NotNull(actual);
        Assert.Equal("Explicit Series", actual.Series);
        Assert.Equal("12", actual.Volumes);
        Assert.Equal("Volume Title", actual.Title);
    }

    /// <summary>
    /// Tests that if there is a Series Folder then Chapter folder, the code appropriately identifies the Series name and Chapter
    /// </summary>
    [Fact]
    public void Parse_Book_SeriesWithDirectoryName()
    {
        var actual = _parser.Parse(RootDirectory + "A Dictionary of Japanese Food - Ingredients and Culture/A Dictionary of Japanese Food - Ingredients and Culture.pdf",
            RootDirectory + "A Dictionary of Japanese Food - Ingredients and Culture/",
            RootDirectory, LibraryType.Book, true, null).Info;

        Assert.NotNull(actual);
        Assert.Equal("A Dictionary of Japanese Food - Ingredients and Culture", actual.Series);
        Assert.Equal(Parser.DefaultChapter, actual.Chapters);
        Assert.True(actual.IsSpecial);
    }

    #endregion

    #region IsApplicable
    /// <summary>
    /// Tests that this Parser can only be used on pdfs
    /// </summary>
    [Fact]
    public void IsApplicable_Fails_WhenNonMatchingLibraryType()
    {
        Assert.False(_parser.IsApplicable("something.cbz", LibraryType.Manga));
        Assert.False(_parser.IsApplicable("something.cbz", LibraryType.Image));
        Assert.False(_parser.IsApplicable("something.epub", LibraryType.Image));
        Assert.False(_parser.IsApplicable("something.png", LibraryType.Book));
    }

    /// <summary>
    /// Tests that this Parser can only be used on pdfs
    /// </summary>
    [Fact]
    public void IsApplicable_Success_WhenMatchingLibraryType()
    {
        Assert.True(_parser.IsApplicable("something.pdf", LibraryType.Book));
        Assert.True(_parser.IsApplicable("something.pdf", LibraryType.Manga));
    }
    #endregion
}
