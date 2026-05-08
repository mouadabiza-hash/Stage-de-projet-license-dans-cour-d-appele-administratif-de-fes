using GestionCourrier.DTOs;
using GestionCourrier.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace GestionCourrier.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            var user = await _context.Utilisateurs
                .Include(u => u.Service)
                .FirstOrDefaultAsync(u => u.Login == dto.Login);

            if (user == null)
                return Unauthorized(new { message = "Login incorrect" });

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.Password))
                return Unauthorized(new { message = "Mot de passe incorrect" });

            var token = GenerateJwtToken(user);
            if (string.IsNullOrEmpty(token))
                return StatusCode(500, new { message = "Erreur lors de la génération du token" });

            return Ok(new AuthResponseDto
            {
                Token = token,
                Id = user.Id,
                Login = user.Login,
                NomComplet = user.NomComplet,
                IdService = user.IdService,
                NomService = user.Service?.NomService ?? string.Empty
            });
        }

        private string GenerateJwtToken(Utilisateur user)
        {
            // Récupération des valeurs de configuration
            var jwtKey = _configuration["Jwt:Key"];
            var jwtIssuer = _configuration["Jwt:Issuer"];
            var jwtAudience = _configuration["Jwt:Audience"];

            // Vérification explicite de nullité
            if (string.IsNullOrEmpty(jwtKey))
                throw new InvalidOperationException("La clé JWT (Jwt:Key) est manquante ou vide dans appsettings.json");
            if (string.IsNullOrEmpty(jwtIssuer))
                throw new InvalidOperationException("Jwt:Issuer est manquant");
            if (string.IsNullOrEmpty(jwtAudience))
                throw new InvalidOperationException("Jwt:Audience est manquant");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Login),
                new Claim("IdService", user.IdService.ToString()),
                new Claim("NomService", user.Service?.NomService ?? string.Empty)
            };

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: DateTime.Now.AddHours(8),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}