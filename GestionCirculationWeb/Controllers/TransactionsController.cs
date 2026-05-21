using ClosedXML.Excel;
using GestionCourrier.DTOs;
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
    public class TransactionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        public TransactionsController(ApplicationDbContext context) => _context = context;

        private int GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return claim != null ? int.Parse(claim) : 0;
        }

        // ========== GET: api/transactions/outgoing ==========
// ========== GET: api/transactions/outgoing ==========
[HttpGet("outgoing")]
public async Task<IActionResult> GetOutgoing([FromQuery] int? year, [FromQuery] int? month)
{
    var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
    if (user == null) return Unauthorized();

    // ✅ REMOVED the `&& t.Statut == "Accepté"` condition
    var query = _context.Transactions
        .Where(t => t.SourceServiceId == user.IdService);

    if (year.HasValue)
        query = query.Where(t => t.DateEnvoi.Year == year.Value);
    if (month.HasValue)
        query = query.Where(t => t.DateEnvoi.Month == month.Value);

    var transactions = await query.OrderByDescending(t => t.DateEnvoi).ToListAsync();

    var result = new List<object>();
    foreach (var t in transactions)
    {
        string sujet = t.DocumentSujet;
        if (string.IsNullOrEmpty(sujet))
        {
            sujet = t.DocumentType == "Administratif"
                ? (await _context.Entites.FindAsync(t.DocumentId))?.Sujet ?? ""
                : (await _context.EntitesDJs.FindAsync(t.DocumentId))?.Sujet ?? "";
        }

        string? numeroCourrier = null;
        string? numeroDossier = null;
        if (t.DocumentType == "Administratif")
        {
            var doc = await _context.Entites.FindAsync(t.DocumentId);
            if (doc != null)
                numeroCourrier = !string.IsNullOrWhiteSpace(doc.IdBureauOrdre) ? doc.IdBureauOrdre : doc.NumeroDeCourrier;
        }
        else
        {
            var doc = await _context.EntitesDJs.Include(x => x.NumeroDossier).FirstOrDefaultAsync(x => x.Id == t.DocumentId);
            if (doc != null)
            {
                if (doc.NumeroDossier != null)
                    numeroDossier = $"{doc.NumeroDossier.Annee}/{doc.NumeroDossier.Nombre}/{doc.NumeroDossier.NumeroSujet}";
                if (!string.IsNullOrWhiteSpace(doc.IdBureauOrdre))
                    numeroCourrier = doc.IdBureauOrdre;
            }
        }

        var destService = await _context.Services.FindAsync(t.DestinationServiceId);
        result.Add(new
        {
            t.Id,
            t.DocumentId,
            t.DocumentType,
            documentSujet = sujet,
            destinationServiceId = t.DestinationServiceId,
            destinationServiceNom = destService?.NomService ?? "",
            t.DoitRevenir,
            t.DateEnvoi,
            t.DateReponse,
            t.Statut,
            t.Message,
            t.MessageReponse,
            t.AcceptedByUserName,
            t.AcceptedDate,
            numeroCourrier,
            numeroDossierJudiciaire = numeroDossier
        });
    }
    return Ok(result);
}

        // ========== GET: api/transactions/incoming ==========
        [HttpGet("incoming")]
        public async Task<IActionResult> GetIncoming()
        {
            var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
            if (user == null) return Unauthorized();

            var serviceIds = new HashSet<int> { user.IdService };
            var substituted = await _context.Utilisateurs
                .Where(u => u.SubstituteUserId == user.Id)
                .Select(u => u.IdService)
                .Distinct()
                .ToListAsync();
            foreach (var id in substituted) serviceIds.Add(id);

            var transactions = await _context.Transactions
                .Where(t => serviceIds.Contains(t.DestinationServiceId) && t.Statut == "En attente")
                .OrderByDescending(t => t.DateEnvoi)
                .ToListAsync();

            var result = new List<object>();
            foreach (var t in transactions)
            {
                string sujet = "";
                string? numeroCourrier = null;
                string? numeroDossier = null;

                if (t.DocumentType == "Administratif")
                {
                    var doc = await _context.Entites.FindAsync(t.DocumentId);
                    if (doc != null)
                    {
                        sujet = doc.Sujet ?? "";
                        numeroCourrier = !string.IsNullOrWhiteSpace(doc.IdBureauOrdre) ? doc.IdBureauOrdre : doc.NumeroDeCourrier;
                    }
                }
                else
                {
                    var doc = await _context.EntitesDJs.Include(x => x.NumeroDossier).FirstOrDefaultAsync(x => x.Id == t.DocumentId);
                    if (doc != null)
                    {
                        sujet = doc.Sujet ?? "";
                        numeroDossier = doc.NumeroDossier != null ? $"{doc.NumeroDossier.Annee}/{doc.NumeroDossier.Nombre}/{doc.NumeroDossier.NumeroSujet}" : null;
                    }
                }

                var sourceService = await _context.Services.FindAsync(t.SourceServiceId);
                result.Add(new
                {
                    t.Id,
                    t.DocumentId,
                    t.DocumentType,
                    documentSujet = sujet,
                    sourceServiceNom = sourceService?.NomService ?? "",
                    t.Message,
                    t.DateEnvoi,
                    numeroCourrier,
                    numeroDossierJudiciaire = numeroDossier
                });
            }
            return Ok(result);
        }

        // ========== GET: api/transactions/pending-returns ==========
        [HttpGet("pending-returns")]
        public async Task<IActionResult> GetPendingReturns()
        {
            var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
            if (user == null) return Unauthorized();

            var transactions = await _context.Transactions
                .Where(t => t.SourceServiceId == user.IdService && t.DoitRevenir == true && t.Statut == "Accepté")
                .OrderByDescending(t => t.DateEnvoi)
                .ToListAsync();

            var result = new List<object>();
            foreach (var t in transactions)
            {
                string sujet = t.DocumentSujet;
                if (string.IsNullOrEmpty(sujet))
                {
                    sujet = t.DocumentType == "Administratif"
                        ? (await _context.Entites.FindAsync(t.DocumentId))?.Sujet ?? ""
                        : (await _context.EntitesDJs.FindAsync(t.DocumentId))?.Sujet ?? "";
                }

                var destService = await _context.Services.FindAsync(t.DestinationServiceId);
                result.Add(new
                {
                    t.Id,
                    t.DocumentId,
                    t.DocumentType,
                    documentSujet = sujet,
                    destinationServiceNom = destService?.NomService ?? "",
                    t.DateEnvoi,
                    t.Message
                });
            }
            return Ok(result);
        }

        // ========== POST: api/transactions ==========
[HttpPost]
public async Task<IActionResult> Create([FromBody] DemandeTransactionDto dto)
{
    var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
    if (user == null) return Unauthorized();

    // Log received data
    Console.WriteLine($"[TRANSFER] DocumentId={dto.DocumentId}, DocumentType={dto.DocumentType}, DestinationUserId={dto.DestinationUserId}");

    bool isJudicial = dto.DocumentType == "Judiciaire";
    if (!isJudicial)
    {
        var existing = await _context.Transactions
            .FirstOrDefaultAsync(t => t.DocumentId == dto.DocumentId
                                   && t.DocumentType == dto.DocumentType
                                   && t.Statut != "Annulé");
        if (existing != null)
            return BadRequest("Ce document a déjà été transféré. Un seul transfert est autorisé.");
    }

    // Check transmissibility with detailed logging
    bool transmissible = false;
    if (dto.DocumentType == "Administratif")
    {
        var doc = await _context.Entites.FindAsync(dto.DocumentId);
        if (doc == null)
        {
            Console.WriteLine($"[ERROR] Administrative document ID {dto.DocumentId} not found");
            return BadRequest($"Document ID {dto.DocumentId} not found");
        }
        transmissible = doc.EstTransmissible;
        Console.WriteLine($"[DEBUG] Admin Doc ID={dto.DocumentId}, EstTransmissible={doc.EstTransmissible}");
        if (!transmissible)
            return BadRequest("Document non transmissible (administratif).");
    }
    else if (dto.DocumentType == "Judiciaire")
    {
        var doc = await _context.EntitesDJs.FindAsync(dto.DocumentId);
        if (doc == null)
        {
            Console.WriteLine($"[ERROR] Judicial document ID {dto.DocumentId} not found");
            return BadRequest($"Document ID {dto.DocumentId} not found");
        }
        transmissible = doc.EstTransmissible;
        Console.WriteLine($"[DEBUG] Judicial Doc ID={dto.DocumentId}, EstTransmissible={doc.EstTransmissible}");
        if (!transmissible)
            return BadRequest("Document non transmissible (judiciaire).");
    }
    else
    {
        Console.WriteLine($"[ERROR] Unknown DocumentType: {dto.DocumentType}");
        return BadRequest($"Type de document inconnu: {dto.DocumentType}");
    }

    if (!transmissible)
        return BadRequest("Document non transmissible.");

    // Determine destination service
    int destServiceId;
    int? destUserId = dto.DestinationUserId;
    Utilisateur? destUser = null;

    if (dto.DestinationServiceId.HasValue && dto.DestinationServiceId.Value > 0)
    {
        destServiceId = dto.DestinationServiceId.Value;
    }
    else if (dto.DestinationUserId.HasValue)
    {
        destUser = await _context.Utilisateurs.FindAsync(dto.DestinationUserId.Value);
        if (destUser == null)
            return BadRequest("Utilisateur destinataire introuvable.");
        destServiceId = destUser.IdService;
        destUserId = destUser.Id;
    }
    else
    {
        return BadRequest("Veuillez sélectionner un service ou un utilisateur destinataire.");
    }

    if (destServiceId == user.IdService)
        return BadRequest("Vous ne pouvez pas transférer un document à votre propre service.");
    if (destUserId.HasValue && destUserId.Value == user.Id)
        return BadRequest("Vous ne pouvez pas transférer un document à vous-même.");

    bool isConsultant = destUser != null && destUser.Role == "Consultant";
    if (isConsultant)
        dto.DoitRevenir = true;

    var transaction = new Transaction
    {
        DocumentId = dto.DocumentId,
        DocumentType = dto.DocumentType,
        SourceServiceId = user.IdService,
        DestinationServiceId = destServiceId,
        DestinationUserId = destUserId,
        DoitRevenir = dto.DoitRevenir,
        Message = dto.Message ?? "",
        DateEnvoi = DateTime.Now,
        Statut = isConsultant ? "Accepté" : "En attente"
    };

    if (isConsultant)
    {
        transaction.AcceptedByUserId = destUser.Id;
        transaction.AcceptedByUserName = destUser.NomComplet;
        transaction.AcceptedDate = DateTime.Now;
        transaction.DateReponse = DateTime.Now;

        // Move document to Consultant's service
        if (transaction.DocumentType == "Administratif")
        {
            var doc = await _context.Entites.FindAsync(transaction.DocumentId);
            if (doc != null)
            {
                doc.IdService = transaction.DestinationServiceId;
                transaction.DocumentSujet = doc.Sujet;
            }
        }
        else
        {
            var doc = await _context.EntitesDJs.FindAsync(transaction.DocumentId);
            if (doc != null)
            {
                doc.IdService = transaction.DestinationServiceId;
                var destService = await _context.Services.FindAsync(transaction.DestinationServiceId);
                doc.Emplacement = destService?.NomService ?? "Inconnu";
                transaction.DocumentSujet = doc.Sujet;
            }
        }
    }

    _context.Transactions.Add(transaction);
    await _context.SaveChangesAsync();

    return Ok(new { message = "Transaction envoyée", transactionId = transaction.Id });
}

        // ========== POST: api/transactions/{id}/respond ==========
        [HttpPost("{id}/respond")]
        public async Task<IActionResult> Respond(int id, [FromBody] ReponseTransactionDto dto)
        {
            var transaction = await _context.Transactions.FindAsync(id);
            if (transaction == null) return NotFound();

            var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
            if (user == null) return Unauthorized();

            bool authorized = user.IdService == transaction.DestinationServiceId;
            if (!authorized)
            {
                var substitutes = await _context.Utilisateurs
                    .AnyAsync(u => u.SubstituteUserId == user.Id && u.IdService == transaction.DestinationServiceId);
                if (substitutes) authorized = true;
            }
            if (!authorized)
                return BadRequest("Vous n'êtes pas autorisé à répondre à cette transaction.");

            if (transaction.Statut != "En attente")
                return BadRequest($"Transaction déjà {transaction.Statut}.");

            transaction.Statut = dto.Accepte ? "Accepté" : "Refusé";
            transaction.DateReponse = DateTime.Now;
            transaction.MessageReponse = dto.Message;

            if (dto.Accepte)
            {
                transaction.AcceptedByUserId = user.Id;
                transaction.AcceptedByUserName = user.NomComplet;
                transaction.AcceptedDate = DateTime.Now;

                if (transaction.DocumentType == "Administratif")
                {
                    var doc = await _context.Entites.FindAsync(transaction.DocumentId);
                    if (doc != null)
                    {
                        doc.IdService = transaction.DestinationServiceId;
                        transaction.DocumentSujet = doc.Sujet;
                    }
                }
                else
                {
                    var doc = await _context.EntitesDJs.FindAsync(transaction.DocumentId);
                    if (doc != null)
                    {
                        doc.IdService = transaction.DestinationServiceId;
                        var destService = await _context.Services.FindAsync(transaction.DestinationServiceId);
                        doc.Emplacement = destService?.NomService ?? "Inconnu";
                        transaction.DocumentSujet = doc.Sujet;
                    }
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Réponse enregistrée", statut = transaction.Statut });
        }

        // ========== POST: api/transactions/{id}/cancel ==========
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> Cancel(int id)
        {
            var transaction = await _context.Transactions.FindAsync(id);
            if (transaction == null) return NotFound();

            var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
            if (user == null) return Unauthorized();

            if (user.IdService != transaction.SourceServiceId)
                return Forbid("Seul l'émetteur peut annuler.");

            if (transaction.Statut != "En attente")
                return BadRequest("Seules les transactions en attente peuvent être annulées.");

            transaction.Statut = "Annulé";
            transaction.DateReponse = DateTime.Now;
            transaction.MessageReponse = "Annulée par l'émetteur";
            await _context.SaveChangesAsync();
            return Ok(new { message = "Transaction annulée" });
        }

        // ========== POST: api/transactions/{id}/mark-returned ==========
        [HttpPost("{id}/mark-returned")]
        public async Task<IActionResult> MarkReturned(int id)
        {
            var transaction = await _context.Transactions.FindAsync(id);
            if (transaction == null) return NotFound();

            var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
            if (user == null) return Unauthorized();

            if (user.IdService != transaction.SourceServiceId)
                return Forbid("Seul l'émetteur peut marquer le retour.");

            if (!transaction.DoitRevenir)
                return BadRequest("Cette transaction ne nécessite pas de retour.");

            if (transaction.Statut != "Accepté")
                return BadRequest("Seule une transaction acceptée peut être retournée.");

            // Move document back to source service
            if (transaction.DocumentType == "Administratif")
            {
                var doc = await _context.Entites.FindAsync(transaction.DocumentId);
                if (doc != null)
                {
                    doc.IdService = transaction.SourceServiceId;
                }
            }
            else
            {
                var doc = await _context.EntitesDJs.FindAsync(transaction.DocumentId);
                if (doc != null)
                {
                    doc.IdService = transaction.SourceServiceId;
                    var sourceService = await _context.Services.FindAsync(transaction.SourceServiceId);
                    doc.Emplacement = sourceService?.NomService ?? "Inconnu";
                }
            }

            transaction.DoitRevenir = false;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Document marqué comme retourné." });
        }

        // ========== GET: api/transactions/history/{documentId} ==========
        [HttpGet("history/{documentId}")]
        public async Task<IActionResult> GetTransactionHistory(int documentId, [FromQuery] string type)
        {
            var transactions = await _context.Transactions
                .Where(t => t.DocumentId == documentId && t.DocumentType == type)
                .OrderByDescending(t => t.DateEnvoi)
                .Select(t => new
                {
                    t.Id,
                    t.Statut,
                    t.DateEnvoi,
                    t.DateReponse,
                    t.Message,
                    t.MessageReponse,
                    t.DoitRevenir,
                    t.DestinationUserId,
                    t.DestinationServiceId,
                    t.AcceptedByUserName,
                    t.AcceptedDate,
                    SourceServiceName = _context.Services.Where(s => s.IdService == t.SourceServiceId).Select(s => s.NomService).FirstOrDefault(),
                    DestinationServiceName = _context.Services.Where(s => s.IdService == t.DestinationServiceId).Select(s => s.NomService).FirstOrDefault(),
                    DestinationUserName = _context.Utilisateurs.Where(u => u.Id == t.DestinationUserId).Select(u => u.NomComplet).FirstOrDefault()
                })
                .ToListAsync();
            return Ok(transactions);
        }

        // ========== POST: api/transactions/export-selected ==========
        [HttpPost("export-selected")]
        public async Task<IActionResult> ExportSelected([FromBody] List<int> ids)
        {
            var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
            if (user == null) return Unauthorized();

            var transactions = await _context.Transactions
                .Where(t => ids.Contains(t.Id) && t.SourceServiceId == user.IdService && t.Statut == "Accepté")
                .ToListAsync();

            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Transactions_acceptees");
            ws.Cell(1, 1).Value = "ID";
            ws.Cell(1, 2).Value = "Document";
            ws.Cell(1, 3).Value = "N° courrier";
            ws.Cell(1, 4).Value = "N° dossier judiciaire";
            ws.Cell(1, 5).Value = "Service destinataire";
            ws.Cell(1, 6).Value = "Date d'envoi";
            ws.Cell(1, 7).Value = "Accepté par";
            ws.Cell(1, 8).Value = "Date acceptation";
            ws.Cell(1, 9).Value = "Note / Réponse";

            int row = 2;
            foreach (var t in transactions)
            {
                string sujet = t.DocumentSujet;
                if (string.IsNullOrEmpty(sujet))
                {
                    sujet = t.DocumentType == "Administratif"
                        ? (await _context.Entites.FindAsync(t.DocumentId))?.Sujet ?? ""
                        : (await _context.EntitesDJs.FindAsync(t.DocumentId))?.Sujet ?? "";
                }
                string? numeroCourrier = null;
                string? numeroDossier = null;
                if (t.DocumentType == "Administratif")
                {
                    var doc = await _context.Entites.FindAsync(t.DocumentId);
                    if (doc != null)
                        numeroCourrier = !string.IsNullOrWhiteSpace(doc.IdBureauOrdre) ? doc.IdBureauOrdre : doc.NumeroDeCourrier;
                }
                else
                {
                    var doc = await _context.EntitesDJs.Include(x => x.NumeroDossier).FirstOrDefaultAsync(x => x.Id == t.DocumentId);
                    if (doc?.NumeroDossier != null)
                        numeroDossier = $"{doc.NumeroDossier.Annee}/{doc.NumeroDossier.Nombre}/{doc.NumeroDossier.NumeroSujet}";
                }
                var dest = await _context.Services.FindAsync(t.DestinationServiceId);
                ws.Cell(row, 1).Value = t.Id;
                ws.Cell(row, 2).Value = sujet;
                ws.Cell(row, 3).Value = numeroCourrier ?? "";
                ws.Cell(row, 4).Value = numeroDossier ?? "";
                ws.Cell(row, 5).Value = dest?.NomService ?? "";
                ws.Cell(row, 6).Value = t.DateEnvoi.ToString("yyyy-MM-dd HH:mm");
                ws.Cell(row, 7).Value = t.AcceptedByUserName ?? "";
                ws.Cell(row, 8).Value = t.AcceptedDate?.ToString("yyyy-MM-dd HH:mm") ?? "";
                ws.Cell(row, 9).Value = t.MessageReponse ?? "";
                row++;
            }
            ws.Columns().AdjustToContents();
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "transactions_acceptees.xlsx");
        }

        // ========== GET: api/transactions/by-service (Admin only) ==========
        [HttpGet("by-service")]
        public async Task<IActionResult> GetTransactionsByService([FromQuery] int serviceId, [FromQuery] int? year, [FromQuery] int? month)
        {
            var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
            if (user == null) return Unauthorized();
            if (user.Role != "Admin")
                return Forbid("Seul l'administrateur peut voir les transactions par service.");

            var service = await _context.Services.FindAsync(serviceId);
            if (service == null) return NotFound("Service non trouvé");

            var query = _context.Transactions
                .Where(t => t.DestinationServiceId == serviceId && t.Statut == "Accepté");

            if (year.HasValue)
                query = query.Where(t => t.DateEnvoi.Year == year.Value);
            if (month.HasValue)
                query = query.Where(t => t.DateEnvoi.Month == month.Value);

            var transactions = await query.OrderByDescending(t => t.DateEnvoi).ToListAsync();

            var result = new List<object>();
            foreach (var t in transactions)
            {
                string sujet = t.DocumentSujet;
                if (string.IsNullOrEmpty(sujet))
                {
                    sujet = t.DocumentType == "Administratif"
                        ? (await _context.Entites.FindAsync(t.DocumentId))?.Sujet ?? ""
                        : (await _context.EntitesDJs.FindAsync(t.DocumentId))?.Sujet ?? "";
                }

                string? numeroCourrier = null;
                string? numeroDossier = null;
                if (t.DocumentType == "Administratif")
                {
                    var doc = await _context.Entites.FindAsync(t.DocumentId);
                    if (doc != null)
                        numeroCourrier = !string.IsNullOrWhiteSpace(doc.IdBureauOrdre) ? doc.IdBureauOrdre : doc.NumeroDeCourrier;
                }
                else
                {
                    var doc = await _context.EntitesDJs.Include(x => x.NumeroDossier).FirstOrDefaultAsync(x => x.Id == t.DocumentId);
                    if (doc?.NumeroDossier != null)
                        numeroDossier = $"{doc.NumeroDossier.Annee}/{doc.NumeroDossier.Nombre}/{doc.NumeroDossier.NumeroSujet}";
                    if (!string.IsNullOrWhiteSpace(doc?.IdBureauOrdre))
                        numeroCourrier = doc.IdBureauOrdre;
                }

                var sourceService = await _context.Services.FindAsync(t.SourceServiceId);
                var destService = await _context.Services.FindAsync(t.DestinationServiceId);
                result.Add(new
                {
                    t.Id,
                    t.DocumentId,
                    t.DocumentType,
                    documentSujet = sujet,
                    sourceServiceNom = sourceService?.NomService ?? "",
                    destinationServiceNom = destService?.NomService ?? "",
                    t.DoitRevenir,
                    t.DateEnvoi,
                    t.DateReponse,
                    t.Statut,
                    t.Message,
                    t.MessageReponse,
                    t.AcceptedByUserName,
                    t.AcceptedDate,
                    numeroCourrier,
                    numeroDossierJudiciaire = numeroDossier
                });
            }
            return Ok(result);
        }

        // ========== GET: api/transactions/services-list (optional, but convenient) ==========
        [HttpGet("services-list")]
        public async Task<IActionResult> GetServicesList()
        {
            var services = await _context.Services
                .Select(s => new { s.IdService, s.NomService })
                .ToListAsync();
            return Ok(services);
        }
    }
}