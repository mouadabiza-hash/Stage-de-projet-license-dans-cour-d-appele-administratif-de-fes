namespace GestionCourrier.DTOs
{
    public class CourrierDto
    {
        public int Id { get; set; }
        public string Type { get; set; } = string.Empty; // "Administratif" ou "Judiciaire"
        public string Direction { get; set; } = "Entrant";
        public DateTime Date { get; set; }
        public string Sujet { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
        public string Destinataire { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string LienPdf { get; set; } = string.Empty;
        public bool EstTransmissible { get; set; }
        public int? ParentId { get; set; }
        public string? TribunalSource { get; set; }      
        public string? NumeroDossier { get; set; }       
        public string? ParentSujet { get; set; }         
        public int IdService { get; set; } = 1;
        public string? ServiceNom { get; set; }
    }
    public class CourrierJudiciaireRequest
{
    public string? IdBureauOrdre { get; set; }
    public DateTime Date { get; set; }
    public string TribunalSource { get; set; } = string.Empty;
    public string Sujet { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? EtatArchive { get; set; }
    public string? Emplacement { get; set; }
    public string? LienPdf { get; set; }
    public int IdService { get; set; }
    public bool EstTransmissible { get; set; }
    public string? NumeroDossier { get; set; }
    public int? NumeroDossierAnnee { get; set; }
    public int? NumeroDossierNombre { get; set; }
    public int? NumeroDossierSujet { get; set; }
    public string? Cabinet { get; set; }
    public string? NumeroPremiereInstance { get; set; }   // NEW
}
}
