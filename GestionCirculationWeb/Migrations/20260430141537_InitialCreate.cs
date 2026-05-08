using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestionCirculationWeb.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Ids",
                columns: table => new
                {
                    IdBureauOrdre = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Annee = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ids", x => x.IdBureauOrdre);
                });

            migrationBuilder.CreateTable(
                name: "Services",
                columns: table => new
                {
                    IdService = table.Column<int>(type: "int", nullable: false),
                    NomService = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Etage = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Services", x => x.IdService);
                });

            migrationBuilder.CreateTable(
                name: "Entites",
                columns: table => new
                {
                    IdEntite = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdBureauOrdre = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DateCreation = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Etat = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LienPdf = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TypeDocument = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NumeroDeCourrier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TypeGenerale = table.Column<int>(type: "int", nullable: false),
                    EstArchive = table.Column<bool>(type: "bit", nullable: false),
                    Sujet = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Direction = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Destinataire = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ParentId = table.Column<int>(type: "int", nullable: true),
                    TypeRegistre = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TypeCorrespondance = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EstTransmissible = table.Column<bool>(type: "bit", nullable: false),
                    EtatWorkflow = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IdService = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Entites", x => x.IdEntite);
                    table.ForeignKey(
                        name: "FK_Entites_Services_IdService",
                        column: x => x.IdService,
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EntitesDJs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EtatArchive = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TribunalSource = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DateArchivage = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Emplacement = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IdBureauOrdre = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IdService = table.Column<int>(type: "int", nullable: false),
                    Direction = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Destinataire = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ParentId = table.Column<int>(type: "int", nullable: true),
                    Sujet = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LienPdf = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EstArchive = table.Column<bool>(type: "bit", nullable: false),
                    EtatWorkflow = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EstTransmissible = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EntitesDJs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EntitesDJs_Services_IdService",
                        column: x => x.IdService,
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Equipements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Serial = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    Etat = table.Column<int>(type: "int", nullable: false),
                    IdService = table.Column<int>(type: "int", nullable: false),
                    EstCharge = table.Column<bool>(type: "bit", nullable: false),
                    DateDechargement = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Equipements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Equipements_Services_IdService",
                        column: x => x.IdService,
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Registres",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TypeDeRegistre = table.Column<int>(type: "int", nullable: false),
                    DateCreation = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IdService = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Registres", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Registres_Services_IdService",
                        column: x => x.IdService,
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Utilisateurs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NomComplet = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Login = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Password = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IdService = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Utilisateurs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Utilisateurs_Services_IdService",
                        column: x => x.IdService,
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "NumerosDossierJuridique",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Annee = table.Column<int>(type: "int", nullable: false),
                    Nombre = table.Column<int>(type: "int", nullable: false),
                    NumeroSujet = table.Column<int>(type: "int", nullable: false),
                    EntiteDJId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NumerosDossierJuridique", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NumerosDossierJuridique_EntitesDJs_EntiteDJId",
                        column: x => x.EntiteDJId,
                        principalTable: "EntitesDJs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Retraits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DateDeRetrait = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MotifDeRetrait = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EffectuePar = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DateDeRetour = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EntiteDJId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Retraits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Retraits_EntitesDJs_EntiteDJId",
                        column: x => x.EntiteDJId,
                        principalTable: "EntitesDJs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Reponses",
                columns: table => new
                {
                    IdReponse = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DateReponse = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Resultat = table.Column<int>(type: "int", nullable: false),
                    RegistreId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reponses", x => x.IdReponse);
                    table.ForeignKey(
                        name: "FK_Reponses_Registres_RegistreId",
                        column: x => x.RegistreId,
                        principalTable: "Registres",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Transactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DocumentId = table.Column<int>(type: "int", nullable: false),
                    DocumentType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SourceServiceId = table.Column<int>(type: "int", nullable: false),
                    DestinationServiceId = table.Column<int>(type: "int", nullable: false),
                    DestinationUserId = table.Column<int>(type: "int", nullable: true),
                    DoitRevenir = table.Column<bool>(type: "bit", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Statut = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DateEnvoi = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DateReponse = table.Column<DateTime>(type: "datetime2", nullable: true),
                    MessageReponse = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Transactions_Services_DestinationServiceId",
                        column: x => x.DestinationServiceId,
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transactions_Services_SourceServiceId",
                        column: x => x.SourceServiceId,
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transactions_Utilisateurs_DestinationUserId",
                        column: x => x.DestinationUserId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Entites_IdService",
                table: "Entites",
                column: "IdService");

            migrationBuilder.CreateIndex(
                name: "IX_EntitesDJs_IdService",
                table: "EntitesDJs",
                column: "IdService");

            migrationBuilder.CreateIndex(
                name: "IX_Equipements_IdService",
                table: "Equipements",
                column: "IdService");

            migrationBuilder.CreateIndex(
                name: "IX_NumerosDossierJuridique_EntiteDJId",
                table: "NumerosDossierJuridique",
                column: "EntiteDJId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Registres_IdService",
                table: "Registres",
                column: "IdService");

            migrationBuilder.CreateIndex(
                name: "IX_Reponses_RegistreId",
                table: "Reponses",
                column: "RegistreId");

            migrationBuilder.CreateIndex(
                name: "IX_Retraits_EntiteDJId",
                table: "Retraits",
                column: "EntiteDJId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_DestinationServiceId",
                table: "Transactions",
                column: "DestinationServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_DestinationUserId",
                table: "Transactions",
                column: "DestinationUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_SourceServiceId",
                table: "Transactions",
                column: "SourceServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Utilisateurs_IdService",
                table: "Utilisateurs",
                column: "IdService");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Entites");

            migrationBuilder.DropTable(
                name: "Equipements");

            migrationBuilder.DropTable(
                name: "Ids");

            migrationBuilder.DropTable(
                name: "NumerosDossierJuridique");

            migrationBuilder.DropTable(
                name: "Reponses");

            migrationBuilder.DropTable(
                name: "Retraits");

            migrationBuilder.DropTable(
                name: "Transactions");

            migrationBuilder.DropTable(
                name: "Registres");

            migrationBuilder.DropTable(
                name: "EntitesDJs");

            migrationBuilder.DropTable(
                name: "Utilisateurs");

            migrationBuilder.DropTable(
                name: "Services");
        }
    }
}
