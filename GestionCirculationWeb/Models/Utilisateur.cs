using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GestionCourrier.Models
{
    public static class AppRoles
    {
        public const string Admin = "Admin";
        public const string Directeur = "Directeur";
        public const string Greffier = "Greffier";
        public const string Enregistrement = "Enregistrement";
        public const string Archive = "Archive";
        public const string Employe = "Employe";
        public const string Procedures = "Procedures";
        public const string Consultant = "Consultant";
    }

    public class Utilisateur
    {
        [Key]
        public int Id { get; set; }
        public string NomComplet { get; set; } = string.Empty;
        public string Login { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Role { get; set; } = AppRoles.Employe;

        public int IdService { get; set; }
        public Service? Service { get; set; }

        // ----- NEW: substitute -----
        public int? SubstituteUserId { get; set; }

        [ForeignKey("SubstituteUserId")]
        public Utilisateur? SubstituteUser { get; set; }

        public void SeConnecter() { }
        public void SeDeconnecter() { }
        public void ConsulterDossier() { }
        public void RechercherDossier() { }
    }
}