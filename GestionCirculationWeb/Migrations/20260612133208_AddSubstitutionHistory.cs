using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestionCirculationWeb.Migrations
{
    /// <inheritdoc />
    public partial class AddSubstitutionHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Souscriptions");

            migrationBuilder.CreateTable(
                name: "SubstitutionHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    SubstituteUserId = table.Column<int>(type: "int", nullable: false),
                    DateAssigned = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DateRemoved = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubstitutionHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubstitutionHistories_Utilisateurs_SubstituteUserId",
                        column: x => x.SubstituteUserId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SubstitutionHistories_Utilisateurs_UserId",
                        column: x => x.UserId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SubstitutionHistories_SubstituteUserId",
                table: "SubstitutionHistories",
                column: "SubstituteUserId");

            migrationBuilder.CreateIndex(
                name: "IX_SubstitutionHistories_UserId",
                table: "SubstitutionHistories",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SubstitutionHistories");

            migrationBuilder.CreateTable(
                name: "Souscriptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UtilisateurId = table.Column<int>(type: "int", nullable: false),
                    DateChoisi = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DateSupprimer = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SubInformation = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Souscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Souscriptions_Utilisateurs_UtilisateurId",
                        column: x => x.UtilisateurId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Souscriptions_UtilisateurId",
                table: "Souscriptions",
                column: "UtilisateurId");
        }
    }
}
