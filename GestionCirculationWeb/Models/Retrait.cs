using System;
using System.ComponentModel.DataAnnotations;

namespace GestionCourrier.Models
{
    public class Retrait
    {
        [Key]
        public int Id { get; set; }
        public DateTime DateDeRetrait { get; set; }
        public string MotifDeRetrait { get; set; } = string.Empty;
        public string EffectuePar { get; set; } = string.Empty;
        public DateTime? DateDeRetour { get; set; }  // nullable
        public string Notes { get; set; } = string.Empty;
        public int EntiteDJId { get; set; }
        public EntiteDJ? EntiteDJ { get; set; }
    }
}