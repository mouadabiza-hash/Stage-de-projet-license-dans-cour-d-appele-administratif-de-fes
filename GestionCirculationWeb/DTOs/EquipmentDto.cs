using System;

namespace GestionCourrier.DTOs
{
    public class EquipmentDto
    {
        public int Id { get; set; }
        public int Serial { get; set; }
        public int Type { get; set; }
        public string? TypeLabel { get; set; }
        public int Etat { get; set; }
        public string? EtatLabel { get; set; }
        public bool EstCharge { get; set; }
        public DateTime? DateDechargement { get; set; }
        public int IdService { get; set; }
        public string? ServiceNom { get; set; }
        public string? ServiceEtage { get; set; }
    }

    public class CreateEquipmentDto
    {
        public int Serial { get; set; }
        public int Type { get; set; }
        public int Etat { get; set; }
        public int IdService { get; set; }
    }

    public class UpdateEquipmentDto
    {
        public int Serial { get; set; }
        public int Type { get; set; }
        public int Etat { get; set; }
        public int IdService { get; set; }
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