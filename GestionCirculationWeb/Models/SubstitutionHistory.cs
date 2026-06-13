using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GestionCourrier.Models
{
    [Table("SubstitutionHistories")]
    public class SubstitutionHistory
    {
        [Key]
        public int Id { get; set; }

        public int UserId { get; set; }
        public int SubstituteUserId { get; set; }
        public DateTime DateAssigned { get; set; }
        public DateTime? DateRemoved { get; set; }

        [ForeignKey("UserId")]
        public Utilisateur? User { get; set; }

        [ForeignKey("SubstituteUserId")]
        public Utilisateur? SubstituteUser { get; set; }
    }
}