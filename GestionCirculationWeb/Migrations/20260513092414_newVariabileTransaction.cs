using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestionCirculationWeb.Migrations
{
    /// <inheritdoc />
    public partial class newVariabileTransaction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AcceptedByUserId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AcceptedByUserName",
                table: "Transactions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AcceptedDate",
                table: "Transactions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentSujet",
                table: "Transactions",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AcceptedByUserId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "AcceptedByUserName",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "AcceptedDate",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "DocumentSujet",
                table: "Transactions");
        }
    }
}
