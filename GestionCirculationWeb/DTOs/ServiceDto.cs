namespace GestionCourrier.DTOs
{
    public class ServiceDto
    {
        public int IdService { get; set; }
        public string NomService { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Etage { get; set; }
    }

    public class CreateServiceDto
    {
        public int IdService { get; set; }
        public string NomService { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Etage { get; set; }
    }

    public class UpdateServiceDto
    {
        public string? NomService { get; set; }
        public string? Description { get; set; }
        public string? Etage { get; set; }
    }
}