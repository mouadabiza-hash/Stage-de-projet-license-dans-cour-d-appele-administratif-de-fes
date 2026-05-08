using System.ComponentModel.DataAnnotations;

namespace GestionCourrier.Models
{
    public class Utilisateur
    {
        [Key]
        public int Id { get; set; }
        public string NomComplet { get; set; } = string.Empty;
        public string Login { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Role { get; set; } = "Employe";

        public int IdService { get; set; }
        public Service? Service { get; set; }

        public void SeConnecter() { }
        public void SeDeconnecter() { }
        public void ConsulterDossier() { }
        public void RechercherDossier() { }
    }
}