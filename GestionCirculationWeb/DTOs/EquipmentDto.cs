using System;

namespace GestionCourrier.DTOs
{
    public class EquipmentDto
    {
        public int Id { get; set; }
        public string Serial { get; set; } = string.Empty;
        public int Type { get; set; }
        public string? TypeLabel { get; set; }
        public int Etat { get; set; }
        public string? EtatLabel { get; set; }
        public bool EstCharge { get; set; }
        public DateTime? DateDechargement { get; set; }
        public int IdService { get; set; }
        public string? ServiceNom { get; set; }
        public string? ServiceEtage { get; set; }
        public string? AdditionalInfo { get; set; }               // new
    }

    public class CreateEquipmentDto
    {
        public string Serial { get; set; } = string.Empty;
        public int Type { get; set; }
        public int Etat { get; set; }
        public int IdService { get; set; }
        public string? AdditionalInfo { get; set; }               // new
    }

    public class UpdateEquipmentDto
    {
        public string Serial { get; set; } = string.Empty;
        public int Type { get; set; }
        public int Etat { get; set; }
        public int IdService { get; set; }
        public string? AdditionalInfo { get; set; }               // new
    }

    public class EquipmentSearchDto
    {
        public int? Type { get; set; }
        public int? Etat { get; set; }
        public bool? EstCharge { get; set; }
    }

    public class DechargerDto
    {
        public DateTime? DateDechargement { get; set; }
    }
}