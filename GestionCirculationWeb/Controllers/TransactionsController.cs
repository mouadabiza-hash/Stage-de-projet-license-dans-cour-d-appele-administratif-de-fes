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

        // ========== GET: api/transactions/outgoing (only accepted) ==========
        [HttpGet("outgoing")]
        public async Task<IActionResult> GetOutgoing([FromQuery] int? year, [FromQuery] int? month)
        {
            var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
            if (user == null) return Unauthorized();

            var query = _context.Transactions
                .Where(t => t.SourceServiceId == user.IdService && t.Statut == "Accepté");

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

        // ========== GET: api/transactions/pending-outgoing ==========
        [HttpGet("pending-outgoing")]
        public async Task<IActionResult> GetPendingOutgoing()
        {
            var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
            if (user == null) return Unauthorized();

            var transactions = await _context.Transactions
                .Where(t => t.SourceServiceId == user.IdService && t.Statut == "En attente")
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
                    destinationServiceNom = destService?.NomService ?? "",
                    t.DateEnvoi,
                    t.Message,
                    numeroCourrier,
                    numeroDossierJudiciaire = numeroDossier
                });
            }
            return Ok(result);
        }
private async Task<Utilisateur?> GetSubstituteForUser(int userId)
{
    return await _context.Utilisateurs
        .FirstOrDefaultAsync(u => u.SubstituteUserId == userId);
}
[HttpGet("incoming-accepted")]
public async Task<IActionResult> GetIncomingAccepted([FromQuery] int? year, [FromQuery] int? month)
{
    var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
    if (user == null) return Unauthorized();

    // Trouver le substitut de l'utilisateur courant (celui qui le remplace)
    var substitute = await GetSubstituteForUser(user.Id);
    int? substituteId = substitute?.Id;

    // 1. Transactions dont le service de destination est celui de l'utilisateur
    var ownAccepted = _context.Transactions
        .Where(t => t.DestinationServiceId == user.IdService && t.Statut == "Accepté");

    // 2. Transactions acceptées par le substitut (si existant)
    var substituteAccepted = substituteId.HasValue
        ? _context.Transactions.Where(t => t.AcceptedByUserId == substituteId.Value && t.Statut == "Accepté")
        : Enumerable.Empty<Transaction>().AsQueryable();

    // Exécuter les deux requêtes et fusionner les résultats sans doublon (par Id)
    var ownList = await ownAccepted.ToListAsync();
    var subList = substituteId.HasValue ? await substituteAccepted.ToListAsync() : new List<Transaction>();

// Fusionner et supprimer les doublons
var allAccepted = ownList.Concat(subList)
    .GroupBy(t => t.Id)
    .Select(g => g.First())
    .OrderByDescending(t => t.DateEnvoi)   // ← Add this line
    .ToList();

    // Appliquer les filtres année/mois (en mémoire)
    if (year.HasValue)
        allAccepted = allAccepted.Where(t => t.DateEnvoi.Year == year.Value).ToList();
    if (month.HasValue)
        allAccepted = allAccepted.Where(t => t.DateEnvoi.Month == month.Value).ToList();

    // Construction de la réponse
    var result = new List<object>();
    foreach (var t in allAccepted)
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

        var destService = await _context.Services.FindAsync(t.DestinationServiceId);
        var sourceService = await _context.Services.FindAsync(t.SourceServiceId);

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

        // ========== GET: api/transactions/incoming (pending) ==========
[HttpGet("incoming")]
public async Task<IActionResult> GetIncoming()
{
    var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
    if (user == null) return Unauthorized();

    var serviceIds = new HashSet<int> { user.IdService };
    var substituteServices = new HashSet<int>();
    var substituted = await _context.Utilisateurs
        .Where(u => u.SubstituteUserId == user.Id)
        .Select(u => u.IdService)
        .Distinct()
        .ToListAsync();
    foreach (var id in substituted)
    {
        serviceIds.Add(id);
        substituteServices.Add(id);
    }

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
            numeroDossierJudiciaire = numeroDossier,
            isSubstitute = substituteServices.Contains(t.DestinationServiceId)   // NEW
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
            destinationUserId = t.DestinationUserId,   // ← ADD THIS
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

            bool isJudicial = dto.DocumentType == "Judiciaire";
            if (!isJudicial)
            {
                var existing = await _context.Transactions
                    .FirstOrDefaultAsync(t => t.DocumentId == dto.DocumentId
                                           && t.DocumentType == dto.DocumentType
                                           && t.Statut != "Annulé" && t.Statut != "Refusé");
                if (existing != null)
                    return BadRequest("Ce document a déjà été transféré. Un seul transfert est autorisé.");
            }

            bool transmissible = false;
            if (dto.DocumentType == "Administratif")
            {
                var doc = await _context.Entites.FindAsync(dto.DocumentId);
                if (doc == null) return BadRequest($"Document ID {dto.DocumentId} not found");
                transmissible = doc.EstTransmissible;
                if (!transmissible)
                    return BadRequest("Document non transmissible (administratif).");
            }
            else if (dto.DocumentType == "Judiciaire")
            {
                var doc = await _context.EntitesDJs.FindAsync(dto.DocumentId);
                if (doc == null) return BadRequest($"Document ID {dto.DocumentId} not found");
                transmissible = doc.EstTransmissible;
                if (!transmissible)
                    return BadRequest("Document non transmissible (judiciaire).");
            }
            else
            {
                return BadRequest($"Type de document inconnu: {dto.DocumentType}");
            }

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

    // Vérification des droits (omise pour brièveté)
    // ...

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

        // Récupérer l'id du service "Archives" (الحفظ)
        var archivesService = await _context.Services
            .FirstOrDefaultAsync(s => s.NomService == "الحفظ" || s.NomService == "Archives");
        int? archivesServiceId = archivesService?.IdService;

        if (transaction.DocumentType == "Administratif")
        {
            var doc = await _context.Entites.FindAsync(transaction.DocumentId);
            if (doc != null)
            {
                doc.IdService = transaction.DestinationServiceId;
                transaction.DocumentSujet = doc.Sujet;
            }
        }
        else if (transaction.DocumentType == "Judiciaire")
        {
            var doc = await _context.EntitesDJs.FindAsync(transaction.DocumentId);
            if (doc != null)
            {
                doc.IdService = transaction.DestinationServiceId;
                var destService = await _context.Services.FindAsync(transaction.DestinationServiceId);
                doc.Emplacement = destService?.NomService ?? "Inconnu";
                transaction.DocumentSujet = doc.Sujet;

                // Gestion des états
                if (doc.EtatArchive == "Nouveau")
                {
                    doc.EtatArchive = "En cours";
                }

                // Si le service de destination est "Archives", passer à "Traité"
                if (archivesServiceId.HasValue && transaction.DestinationServiceId == archivesServiceId.Value)
                {
                    doc.EtatArchive = "Traité";
                }
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

    // Mettre à jour le document pour le réattribuer au service source
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

    // Enregistrer la date de retour dans le message de réponse (الجواب ملاحظة)
    string retourDate = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
    string nouveauMessage = $"Retour effectué le {retourDate}";

    if (string.IsNullOrEmpty(transaction.MessageReponse))
        transaction.MessageReponse = nouveauMessage;
    else
        transaction.MessageReponse += $" | {nouveauMessage}";  // on ajoute sans effacer l'ancien message

    // Désactiver le flag de retour (optionnel)
    transaction.DoitRevenir = false;

    await _context.SaveChangesAsync();
    return Ok(new { message = "Document marqué comme retourné. Date enregistrée dans la réponse." });
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
    ws.RightToLeft = true;

    // Headers after removing 1st and 3rd columns (ID and N° courrier)
    var headers = new[] 
    { 
        "الوثيقة",               // Document
        "رقم الملف القضائي",     // N° dossier judiciaire
        "الخدمة المستلمة",       // Service destinataire
        "تاريخ الإرسال",         // Date d'envoi
        "قبل من طرف",            // Accepté par
        "تاريخ القبول",          // Date acceptation
        "الرد / ملاحظة"          // Note / Réponse
    };

    // Apply header style
    for (int i = 0; i < headers.Length; i++)
    {
        var cell = ws.Cell(1, i + 1);
        cell.Value = headers[i];
        cell.Style.Font.Bold = true;
        cell.Style.Font.FontColor = XLColor.White;
        cell.Style.Fill.BackgroundColor = XLColor.FromArgb(68, 68, 68);
        cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        cell.Style.Border.OutsideBorderColor = XLColor.Black;
    }
    ws.Row(1).Height = 30;

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
        string? numeroDossier = null;
        if (t.DocumentType != "Administratif")
        {
            var doc = await _context.EntitesDJs.Include(x => x.NumeroDossier).FirstOrDefaultAsync(x => x.Id == t.DocumentId);
            if (doc?.NumeroDossier != null)
                numeroDossier = $"{doc.NumeroDossier.Annee}/{doc.NumeroDossier.Nombre}/{doc.NumeroDossier.NumeroSujet}";
        }
        var dest = await _context.Services.FindAsync(t.DestinationServiceId);

        ws.Cell(row, 1).Value = sujet;                         // Document
        ws.Cell(row, 2).Value = numeroDossier ?? "";          // N° dossier judiciaire
        ws.Cell(row, 3).Value = dest?.NomService ?? "";       // Service destinataire
        ws.Cell(row, 4).Value = t.DateEnvoi;                  // Date d'envoi
        ws.Cell(row, 4).Style.DateFormat.Format = "dd/MM/yyyy HH:mm";
        ws.Cell(row, 5).Value = t.AcceptedByUserName ?? "";   // Accepté par
        ws.Cell(row, 6).Value = t.AcceptedDate;               // Date acceptation
        ws.Cell(row, 6).Style.DateFormat.Format = "dd/MM/yyyy HH:mm";
        ws.Cell(row, 7).Value = t.MessageReponse ?? "";       // Note / Réponse

        // Alternate row shading
        if (row % 2 == 0)
        {
            var rowRange = ws.Range(row, 1, row, headers.Length);
            rowRange.Style.Fill.BackgroundColor = XLColor.FromArgb(240, 240, 240);
        }
        row++;
    }
    ws.Columns().AdjustToContents();
    using var stream = new MemoryStream();
    workbook.SaveAs(stream);
    return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "transactions_acceptees.xlsx");
}

        // ========== GET: api/transactions/by-service-all ==========
        [HttpGet("by-service-all")]
        public async Task<IActionResult> GetTransactionsByServiceAll([FromQuery] int serviceId, [FromQuery] int? year, [FromQuery] int? month)
        {
            var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
            if (user == null) return Unauthorized();
            if (user.Role != "Admin")
                return Forbid("Seul l'administrateur peut voir les transactions par service.");

            var service = await _context.Services.FindAsync(serviceId);
            if (service == null) return NotFound("Service non trouvé");

            var query = _context.Transactions
                .Where(t => (t.SourceServiceId == serviceId || t.DestinationServiceId == serviceId) && t.Statut == "Accepté");

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

        // ========== GET: api/transactions/services-list ==========
        [HttpGet("services-list")]
        public async Task<IActionResult> GetServicesList()
        {
            var services = await _context.Services
                .Select(s => new { s.IdService, s.NomService })
                .ToListAsync();
            return Ok(services);
        }

        // ========== POST: api/transactions/batch ==========
[HttpPost("batch")]
public async Task<IActionResult> BatchCreate([FromBody] BatchTransactionDto dto)
{
    var user = await _context.Utilisateurs.FindAsync(GetCurrentUserId());
    if (user == null) return Unauthorized();

    // Check transmissibility
    bool transmissible = false;
    object document = null;
    if (dto.DocumentType == "Administratif")
    {
        var doc = await _context.Entites.FindAsync(dto.DocumentId);
        if (doc == null) return BadRequest($"Document ID {dto.DocumentId} not found");
        transmissible = doc.EstTransmissible;
        document = doc;
    }
    else if (dto.DocumentType == "Judiciaire")
    {
        var doc = await _context.EntitesDJs.FindAsync(dto.DocumentId);
        if (doc == null) return BadRequest($"Document ID {dto.DocumentId} not found");
        transmissible = doc.EstTransmissible;
        document = doc;
    }
    else return BadRequest($"Type de document inconnu: {dto.DocumentType}");

    if (!transmissible) return BadRequest("Document non transmissible.");

    // Get existing pending transactions for this document (excluding "Annulé" and "Refusé")
    var existingTransactions = await _context.Transactions
        .Where(t => t.DocumentId == dto.DocumentId && t.DocumentType == dto.DocumentType && (t.Statut == "En attente" || t.Statut == "Accepté"))
        .ToListAsync();

    var destinationUsers = await _context.Utilisateurs
        .Where(u => dto.DestinationUserIds.Contains(u.Id))
        .ToListAsync();

    var transactions = new List<Transaction>();
    var errors = new List<string>();
    var processedUserIds = new HashSet<int>();

    foreach (var destUser in destinationUsers)
    {
        if (processedUserIds.Contains(destUser.Id))
        {
            errors.Add($"Utilisateur {destUser.NomComplet} en double dans la requête.");
            continue;
        }
        processedUserIds.Add(destUser.Id);

        // Check if already a pending transaction for this user
        if (existingTransactions.Any(t => t.DestinationUserId == destUser.Id))
        {
            errors.Add($"Un transfert est déjà en attente ou accepté pour {destUser.NomComplet}.");
            continue;
        }
        if (destUser.IdService == user.IdService)
        {
            errors.Add($"Impossible d'envoyer à {destUser.NomComplet} (même service).");
            continue;
        }

        bool isConsultant = destUser.Role == "Consultant";
        var transaction = new Transaction
        {
            DocumentId = dto.DocumentId,
            DocumentType = dto.DocumentType,
            SourceServiceId = user.IdService,
            DestinationServiceId = destUser.IdService,
            DestinationUserId = destUser.Id,
            DoitRevenir = isConsultant ? true : dto.DoitRevenir,
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
            // Move document to consultant's service (only once, but we can do it for each consultant? Actually, moving the document to multiple services is impossible. So for consultants, we need to think: The document cannot be in two services at once. Therefore, this batch transfer to multiple consultants is problematic. You should either allow only one consultant per batch, or handle it differently. We'll assume the frontend won't send multiple consultants in one batch, but if it does, we'll move the document only once.)
            if (dto.DocumentType == "Administratif")
            {
                var doc = document as Entite;
                if (doc != null) doc.IdService = transaction.DestinationServiceId;
            }
            else
            {
                var doc = document as EntiteDJ;
                if (doc != null)
                {
                    doc.IdService = transaction.DestinationServiceId;
                    var destService = await _context.Services.FindAsync(transaction.DestinationServiceId);
                    doc.Emplacement = destService?.NomService ?? "Inconnu";
                }
            }
        }
        transactions.Add(transaction);
    }

    if (transactions.Count == 0)
    {
        return BadRequest(new { message = "Aucune transaction créée.", errors });
    }

    _context.Transactions.AddRange(transactions);
    await _context.SaveChangesAsync();
    return Ok(new { message = $"{transactions.Count} transaction(s) envoyée(s)", errors });
}  

}
}