namespace GestionCourrier.Models
{
    public class DocumentTransferData
    {
        public int DocumentId { get; set; }
        public string DocumentType { get; set; } = string.Empty;
        public int SourceServiceId { get; set; }
        public int DestinationServiceId { get; set; }
        public int DestinationUserId { get; set; }
        public string Message { get; set; } = string.Empty;
        public bool Approved { get; set; }
        public string? RejectReason { get; set; }
    }

    public class ApprovalResponse
    {
        public bool Approved { get; set; }
        public string? Reason { get; set; }
    }
}