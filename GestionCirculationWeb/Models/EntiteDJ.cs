using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace GestionCourrier.Models
{
    public class EntiteDJ
    {
        [Key]
        public int Id { get; set; }
        public string EtatArchive { get; set; }= string.Empty;
        public string TribunalSource { get; set; }= string.Empty;
        public DateTime DateArchivage { get; set; }
        public string Emplacement { get; set; }= string.Empty;

        public string? IdBureauOrdre { get; set; }

        public int IdService { get; set; }

        public string Direction { get; set; } = "Entrant";
        public string Destinataire { get; set; } = string.Empty;
        public int? ParentId { get; set; }
        public string Sujet { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string LienPdf { get; set; } = string.Empty;
        public bool EstArchive { get; set; } = false;
        public string? EtatWorkflow { get; set; } // stocke la valeur de DocumentState

        public int? EntiteAdministratifId { get; set; }  // FK vers Entite.IdEntite
        public Entite? EntiteAdministratif { get; set; }
        // Les dossiers judiciaires sont transmissibles par defaut; l'action de transmission sera ajoutee separement.
        public bool EstTransmissible { get; set; } = true;
        public Service? Service { get; set; }
        public NumeroDossierJuridique? NumeroDossier { get; set; }
        public ICollection<Retrait> Retraits { get; set; } = new List<Retrait>();

        public void CreerDossier() { }
        public void ModifierDossier() { }
        public void SupprimerDossier() { }
        public void ConsulterDossier() { }
        public void ChangerEtat() { }
        public void AffecterService() { }
    }
}
       