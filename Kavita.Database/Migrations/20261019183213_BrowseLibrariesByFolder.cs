using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kavita.Database.Migrations
{
    /// <inheritdoc />
    public partial class BrowseLibrariesByFolder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "BrowseLibrariesByFolder",
                table: "AppUserPreferences",
                type: "INTEGER",
                nullable: false,
                // Folder browsing is the fork's default, including for existing users
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BrowseLibrariesByFolder",
                table: "AppUserPreferences");
        }
    }
}
