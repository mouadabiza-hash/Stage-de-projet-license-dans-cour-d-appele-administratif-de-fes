using System.ComponentModel.DataAnnotations;

namespace GestionCourrier.DTOs
{
    public class LoginDto
    {
        [Required]
        public string Login { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

   public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public int Id { get; set; }
        public string Login { get; set; } = string.Empty;
        public string NomComplet { get; set; } = string.Empty;
        public int IdService { get; set; }
        public string NomService { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;

        // Substitute info
        public int? SubstituteUserId { get; set; }
        public string? SubstituteUserName { get; set; }
        public string? SubstituteServiceName { get; set; }
    }
}