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

    var serviceIds = new HashSet<int> { user.IdService };
    var substituted = await _context.Utilisateurs
        .Where(u => u.SubstituteUserId == user.Id)
        .Select(u => u.IdService)
        .ToListAsync();
    foreach (var id in substituted) serviceIds.Add(id);

    var result = new List<object>();

    // Administrative
    var admins = await _context.Entites
        .Where(e => serviceIds.Contains(e.IdService) && !e.EstArchive && e.EstTransmissible)
        .ToListAsync();

    foreach (var e in admins)
    {
        bool hasTx = await _context.Transactions
            .AnyAsync(t => t.DocumentId == e.IdEntite && t.DocumentType == "Administratif" && t.Statut != "Annulé");
        result.Add(new
        {
            idEntite = e.IdEntite,
            e.Sujet,
            dateCreation = e.DateCreation,
            e.Source,
            e.Destinataire,
            type = "Administratif",
            e.IdService,
            e.IdBureauOrdre,
            e.Etat,
            e.Description,
            e.LienPdf,
            isSubstitute = e.IdService != user.IdService,
            numeroCourrier = string.IsNullOrWhiteSpace(e.IdBureauOrdre) ? e.NumeroDeCourrier : e.IdBureauOrdre,
            estTransmissible = e.EstTransmissible,
            hasTransaction = hasTx
        });
    }

    // Judicial
    var juds = await _context.EntitesDJs
        .Where(e => serviceIds.Contains(e.IdService) && !e.EstArchive && e.EstTransmissible)
        .Include(e => e.NumeroDossier)
        .ToListAsync();

    foreach (var e in juds)
    {
        bool hasTx = await _context.Transactions
            .AnyAsync(t => t.DocumentId == e.Id && t.DocumentType == "Judiciaire" && t.Statut != "Annulé");
        result.Add(new
        {
            idEntite = e.Id,
            e.Sujet,
            dateCreation = e.DateArchivage,
            source = e.TribunalSource,
            e.Destinataire,
            type = "Judiciaire",
            e.IdService,
            e.IdBureauOrdre,
            etat = e.EtatArchive,
            e.Description,
            e.LienPdf,
            isSubstitute = e.IdService != user.IdService,
            numeroCourrier = e.IdBureauOrdre,
            estTransmissible = e.EstTransmissible,
            hasTransaction = hasTx,
            numeroDossierJudiciaire = e.NumeroDossier != null
                ? $"{e.NumeroDossier.Annee}/{e.NumeroDossier.Nombre}/{e.NumeroDossier.NumeroSujet}"
                : null
        });
    }

    return Ok(result);
}

        [HttpGet("{id}")]
        public async Task<IActionResult> GetDocumentById(int id, [FromQuery] string type)
        {
            if (type == "Administratif")
            {
                var doc = await _context.Entites
                    .Include(e => e.Service)
                    .FirstOrDefaultAsync(e => e.IdEntite == id);
                if (doc == null) return NotFound();
                return Ok(doc);
            }
            else if (type == "Judiciaire")
            {
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