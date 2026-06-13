using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GestionCourrier.Models
{
    public class Equipment
    {
        [Key]
        public int Id { get; set; }
        public string Serial { get; set; } = string.Empty;        // changed from int
        public int Type { get; set; }
        public int Etat { get; set; }
        public int IdService { get; set; }
        public bool EstCharge { get; set; }
        public DateTime? DateDechargement { get; set; }
        public string? AdditionalInfo { get; set; }               // new field

        [ForeignKey("IdService")]
        public Service? Service { get; set; }
    }
}