using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kavita.Database.Migrations
{
    /// <inheritdoc />
    public partial class EpubTextOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "BookReaderHyphenate",
                table: "AppUserReadingProfiles",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "BookReaderIgnorePublisherStyles",
                table: "AppUserReadingProfiles",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "BookReaderJustify",
                table: "AppUserReadingProfiles",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "BookReaderParagraphSpacing",
                table: "AppUserReadingProfiles",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BookReaderTextIndent",
                table: "AppUserReadingProfiles",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BookReaderHyphenate",
                table: "AppUserReadingProfiles");

            migrationBuilder.DropColumn(
                name: "BookReaderIgnorePublisherStyles",
                table: "AppUserReadingProfiles");

            migrationBuilder.DropColumn(
                name: "BookReaderJustify",
                table: "AppUserReadingProfiles");

            migrationBuilder.DropColumn(
                name: "BookReaderParagraphSpacing",
                table: "AppUserReadingProfiles");

            migrationBuilder.DropColumn(
                name: "BookReaderTextIndent",
                table: "AppUserReadingProfiles");
        }
    }
}
