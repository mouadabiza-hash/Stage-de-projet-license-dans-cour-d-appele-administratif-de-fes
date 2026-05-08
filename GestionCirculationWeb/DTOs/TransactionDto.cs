namespace GestionCourrier.DTOs
{
    public class DemandeTransactionDto
    {
        public int DocumentId { get; set; }
        public string DocumentType { get; set; } = string.Empty;
        public int DestinationServiceId { get; set; }
        public int? DestinationUserId { get; set; }
        public bool DoitRevenir { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class ReponseTransactionDto
    {
        public bool Accepte { get; set; }
        public string Message { get; set; } = string.Empty;
    }


    public class TransactionListDto
    {
        public int Id { get; set; }
        public string DocumentSujet { get; set; } = string.Empty;
        public string SourceServiceNom { get; set; } = string.Empty;
        public string DestinationServiceNom { get; set; } = string.Empty;
        public string? DestinationUserName { get; set; }
        public bool DoitRevenir { get; set; }
        public DateTime DateEnvoi { get; set; }
        public DateTime? DateReponse { get; set; }
        public string Statut { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? MessageReponse { get; set; }
    }
}