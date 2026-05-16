using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestionCirculationWeb.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentLieToJudiciaire : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EstDocumentLie",
                table: "EntitesDJs",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ParentJudiciaireId",
                table: "EntitesDJs",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_EntitesDJs_ParentJudiciaireId",
                table: "EntitesDJs",
                column: "ParentJudiciaireId");

            migrationBuilder.AddForeignKey(
                name: "FK_EntitesDJs_EntitesDJs_ParentJudiciaireId",
                table: "EntitesDJs",
                column: "ParentJudiciaireId",
                principalTable: "EntitesDJs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EntitesDJs_EntitesDJs_ParentJudiciaireId",
                table: "EntitesDJs");

            migrationBuilder.DropIndex(
                name: "IX_EntitesDJs_ParentJudiciaireId",
                table: "EntitesDJs");

            migrationBuilder.DropColumn(
                name: "EstDocumentLie",
                table: "EntitesDJs");

            migrationBuilder.DropColumn(
                name: "ParentJudiciaireId",
                table: "EntitesDJs");
        }
    }
}
