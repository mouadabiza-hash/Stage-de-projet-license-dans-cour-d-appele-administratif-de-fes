using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestionCirculationWeb.Migrations
{
    /// <inheritdoc />
    public partial class AddNumeroPremiereInstanceToEntiteDJ : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NumeroPremiereInstance",
                table: "EntitesDJs",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NumeroPremiereInstance",
                table: "EntitesDJs");
        }
    }
}
