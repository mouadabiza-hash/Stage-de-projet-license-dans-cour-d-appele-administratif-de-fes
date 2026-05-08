using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestionCirculationWeb.Migrations
{
    /// <inheritdoc />
    public partial class liasonEntreEntiteEntiteDj : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EntiteAdministratifId",
                table: "EntitesDJs",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_EntitesDJs_EntiteAdministratifId",
                table: "EntitesDJs",
                column: "EntiteAdministratifId");

            migrationBuilder.AddForeignKey(
                name: "FK_EntitesDJs_Entites_EntiteAdministratifId",
                table: "EntitesDJs",
                column: "EntiteAdministratifId",
                principalTable: "Entites",
                principalColumn: "IdEntite");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EntitesDJs_Entites_EntiteAdministratifId",
                table: "EntitesDJs");

            migrationBuilder.DropIndex(
                name: "IX_EntitesDJs_EntiteAdministratifId",
                table: "EntitesDJs");

            migrationBuilder.DropColumn(
                name: "EntiteAdministratifId",
                table: "EntitesDJs");
        }
    }
}
