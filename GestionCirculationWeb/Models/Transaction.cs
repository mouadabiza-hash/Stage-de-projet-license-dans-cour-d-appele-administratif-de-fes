using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GestionCourrier.Models
{
    public class Transaction
    {
        [Key]
        public int Id { get; set; }
        public int DocumentId { get; set; }
        public string DocumentType { get; set; } = string.Empty;
        public int SourceServiceId { get; set; }
        public int DestinationServiceId { get; set; }
        public int? DestinationUserId { get; set; }
        public bool DoitRevenir { get; set; }
        public string Message { get; set; } = string.Empty;
        public string Statut { get; set; } = "En attente";
        public DateTime DateEnvoi { get; set; }
        public DateTime? DateReponse { get; set; }
        public string? MessageReponse { get; set; }

        [ForeignKey("SourceServiceId")]
        public Service? SourceService { get; set; }
        [ForeignKey("DestinationServiceId")]
        public Service? DestinationService { get; set; }
        [ForeignKey("DestinationUserId")]
        public Utilisateur? DestinationUser { get; set; }
    }
}