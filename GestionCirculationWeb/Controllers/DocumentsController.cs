using GestionCourrier.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GestionCourrier.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class DocumentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        public DocumentsController(ApplicationDbContext context) => _context = context;

        private int GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return claim != null ? int.Parse(claim) : 0;
        }

        [HttpGet]
        public async Task<IActionResult> GetDocumentsForCurrentService()
        {
            var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
            if (user == null) return Unauthorized();

            // Return more fields if needed, but at least enough for the list.
            var admins = await _context.Entites
                .Where(e => e.IdService == user.IdService && !e.EstArchive && e.EstTransmissible)
                .Select(e => new
                {
                    e.IdEntite,
                    e.Sujet,
                    DateCreation = e.DateCreation,
                    e.Source,
                    e.Destinataire,
                    Type = "Administratif",
                    e.IdService,
                    e.IdBureauOrdre,
                    e.Etat,
                    e.Description,
                    e.LienPdf
                })
                .ToListAsync();

            var juds = await _context.EntitesDJs
                .Where(e => e.IdService == user.IdService && !e.EstArchive && e.EstTransmissible)
                .Select(e => new
                {
                    IdEntite = e.Id,
                    e.Sujet,
                    DateCreation = e.DateArchivage,
                    Source = e.TribunalSource,
                    e.Destinataire,
                    Type = "Judiciaire",
                    e.IdService,
                    e.IdBureauOrdre,
                    Etat = e.EtatArchive,
                    e.Description,
                    e.LienPdf
                })
                .ToListAsync();

            var result = admins.Cast<object>().Concat(juds.Cast<object>());
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetDocumentById(int id, [FromQuery] string type)
        {
            if (type == "Administratif")
            {
                // Return the full Entite entity with its Service
                var doc = await _context.Entites
                    .Include(e => e.Service)
                    .FirstOrDefaultAsync(e => e.IdEntite == id);
                if (doc == null) return NotFound();
                return Ok(doc);
            }
            else if (type == "Judiciaire")
            {
                // Return the full EntiteDJ entity with its Service, NumeroDossier and Retraits
                var doc = await _context.EntitesDJs
                    .Include(e => e.Service)
                    .Include(e => e.NumeroDossier)
                    .Include(e => e.Retraits)
                    .FirstOrDefaultAsync(e => e.Id == id);
                if (doc == null) return NotFound();
                return Ok(doc);
            }
            return BadRequest("Type invalide");
        }
    }
}