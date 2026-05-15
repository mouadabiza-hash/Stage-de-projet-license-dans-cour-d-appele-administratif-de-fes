using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace GestionCourrier.Models
{
    public class EntiteDJ
    {
        [Key]
        public int Id { get; set; }
        public string EtatArchive { get; set; } = string.Empty;
        public string TribunalSource { get; set; } = string.Empty;
        public DateTime DateArchivage { get; set; }
        public string Emplacement { get; set; } = string.Empty;
        public string? IdBureauOrdre { get; set; }
        public int IdService { get; set; }
        public string Direction { get; set; } = "Entrant";
        // Destinataire is kept on the model for compat but won't be used in UI for judicial
        public string Destinataire { get; set; } = string.Empty;
        public int? ParentId { get; set; }
        public string Sujet { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string LienPdf { get; set; } = string.Empty;
        public bool EstArchive { get; set; } = false;
        public string? EtatWorkflow { get; set; }

        public int? EntiteAdministratifId { get; set; }
        public Entite? EntiteAdministratif { get; set; }
        public bool EstTransmissible { get; set; } = true;
        public string? Cabinet { get; set; }

        // ----- NEW FIELD -----
        public string? NumeroPremiereInstance { get; set; }   // رقم الابتدائي

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