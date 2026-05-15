using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestionCirculationWeb.Migrations
{
    /// <inheritdoc />
    public partial class AddUserSubstitute : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SubstituteUserId",
                table: "Utilisateurs",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Utilisateurs_SubstituteUserId",
                table: "Utilisateurs",
                column: "SubstituteUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Utilisateurs_Utilisateurs_SubstituteUserId",
                table: "Utilisateurs",
                column: "SubstituteUserId",
                principalTable: "Utilisateurs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Utilisateurs_Utilisateurs_SubstituteUserId",
                table: "Utilisateurs");

            migrationBuilder.DropIndex(
                name: "IX_Utilisateurs_SubstituteUserId",
                table: "Utilisateurs");

            migrationBuilder.DropColumn(
                name: "SubstituteUserId",
                table: "Utilisateurs");
        }
    }
}
