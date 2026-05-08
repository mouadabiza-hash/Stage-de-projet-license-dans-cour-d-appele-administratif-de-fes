using ClosedXML.Excel;
using GestionCourrier.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GestionCourrier.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ActeursJudiciairesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;

        public ActeursJudiciairesController(ApplicationDbContext context, IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
        }

        private async Task<string> GetCurrentUserServiceName()
        {
            var userName = User.Identity?.Name;
            var user = await _context.Utilisateurs
                .Include(u => u.Service)
                .FirstOrDefaultAsync(u => u.Login == userName);
            return user?.Service?.NomService ?? "Inconnu";
        }

        // ========== CRUD ==========
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var items = await BaseQuery()
                .Where(e => !e.EstArchive)
                .OrderByDescending(e => e.DateArchivage)
                .ThenByDescending(e => e.Id)
                .ToListAsync();
            return Ok(items.Select(ToResponse));
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var item = await BaseQuery().FirstOrDefaultAsync(e => e.Id == id);
            return item == null ? NotFound() : Ok(ToResponse(item));
        }

        [HttpGet("archives")]
        public async Task<IActionResult> GetArchives([FromQuery] string? motCle)
        {
            var query = BaseQuery().Where(e => e.EstArchive || e.EtatArchive == "Archive");
            if (!string.IsNullOrWhiteSpace(motCle))
            {
                var keyword = motCle.Trim();
                if (int.TryParse(keyword, out var numero))
                {
                    query = query.Where(e => (e.IdBureauOrdre != null && e.IdBureauOrdre.Contains(keyword)) ||
                        (e.NumeroDossier != null && (e.NumeroDossier.Annee == numero || e.NumeroDossier.Nombre == numero || e.NumeroDossier.NumeroSujet == numero)) ||
                        e.TribunalSource.Contains(keyword) || e.Sujet.Contains(keyword) || e.Destinataire.Contains(keyword) ||
                        e.Description.Contains(keyword) || e.Direction.Contains(keyword) || e.EtatArchive.Contains(keyword) ||
                        e.Emplacement.Contains(keyword));
                }
                else
                {
                    query = query.Where(e => (e.IdBureauOrdre != null && e.IdBureauOrdre.Contains(keyword)) ||
                        e.TribunalSource.Contains(keyword) || e.Sujet.Contains(keyword) || e.Destinataire.Contains(keyword) ||
                        e.Description.Contains(keyword) || e.Direction.Contains(keyword) || e.EtatArchive.Contains(keyword) ||
                        e.Emplacement.Contains(keyword));
                }
            }
            var items = await query
                .OrderByDescending(e => e.DateArchivage)
                .ThenByDescending(e => e.Id)
                .ToListAsync();
            return Ok(items.Select(ToResponse));
        }

        [HttpPost]
        public async Task<IActionResult> Create(CourrierJudiciaireRequest request)
        {
            var validation = await ValidateRequest(request, null);
            if (validation != null) return validation;

            var item = new EntiteDJ
            {
                DateArchivage = request.Date,
                TribunalSource = request.TribunalSource?.Trim() ?? string.Empty,
                Sujet = request.Sujet?.Trim() ?? string.Empty,
                Direction = "Entrant",
                Destinataire = request.Destinataire?.Trim() ?? string.Empty,
                Description = request.Description?.Trim() ?? string.Empty,
                EtatArchive = NormalizeEtat(request.EtatArchive),
                Emplacement = await GetCurrentUserServiceName(),
                LienPdf = request.LienPdf?.Trim() ?? string.Empty,
                IdBureauOrdre = request.IdBureauOrdre,
                IdService = request.IdService,
                EstArchive = false,
                EstTransmissible = true
            };
            ApplyNumeroDossier(item, request);
            _context.EntitesDJs.Add(item);
            await _context.SaveChangesAsync();

            var created = await BaseQuery().FirstAsync(e => e.Id == item.Id);
            return CreatedAtAction(nameof(GetById), new { id = item.Id }, ToResponse(created));
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, CourrierJudiciaireRequest request)
        {
            var item = await _context.EntitesDJs
                .Include(e => e.NumeroDossier)
                .FirstOrDefaultAsync(e => e.Id == id);
            if (item == null) return NotFound();

            var validation = await ValidateRequest(request, id);
            if (validation != null) return validation;

            item.DateArchivage = request.Date;
            item.TribunalSource = request.TribunalSource?.Trim() ?? string.Empty;
            item.Sujet = request.Sujet?.Trim() ?? string.Empty;
            item.Direction = "Entrant";
            item.Destinataire = request.Destinataire?.Trim() ?? string.Empty;
            item.Description = request.Description?.Trim() ?? string.Empty;
            item.EtatArchive = NormalizeEtat(request.EtatArchive);
            // Do NOT update Emplacement here – keep existing location
            item.LienPdf = request.LienPdf?.Trim() ?? string.Empty;
            item.IdBureauOrdre = request.IdBureauOrdre;
            item.IdService = request.IdService;
            ApplyNumeroDossier(item, request);

            await _context.SaveChangesAsync();
            var updated = await BaseQuery().FirstAsync(e => e.Id == id);
            return Ok(ToResponse(updated));
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _context.EntitesDJs.FirstOrDefaultAsync(e => e.Id == id);
            if (item == null) return NotFound();
            _context.EntitesDJs.Remove(item);
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpPut("archiver/{id:int}")]
        public async Task<IActionResult> Archiver(int id)
        {
            var item = await _context.EntitesDJs.FirstOrDefaultAsync(e => e.Id == id);
            if (item == null) return NotFound();
            item.EstArchive = true;
            item.EtatArchive = "Archive";
            await _context.SaveChangesAsync();
            return Ok(ToResponse(item));
        }

        // ========== RETRAITS ==========
        [HttpPost("{id:int}/retraits")]
        public async Task<IActionResult> EnregistrerRetrait(int id, RetraitRequest request)
        {
            var item = await _context.EntitesDJs.FirstOrDefaultAsync(e => e.Id == id);
            if (item == null) return NotFound();

            if (string.IsNullOrWhiteSpace(request.MotifDeRetrait))
                return BadRequest("Motif de retrait obligatoire.");

            var retrait = new Retrait
            {
                EntiteDJId = id,
                DateDeRetrait = request.DateDeRetrait == default ? DateTime.Now : request.DateDeRetrait,
                MotifDeRetrait = request.MotifDeRetrait.Trim(),
                EffectuePar = request.EffectuePar?.Trim() ?? string.Empty,
                DateDeRetour = request.DateDeRetour,
                Notes = request.Notes?.Trim() ?? string.Empty
            };
            _context.Retraits.Add(retrait);
            await _context.SaveChangesAsync();

            var updated = await BaseQuery().FirstAsync(e => e.Id == id);
            return Ok(ToResponse(updated));
        }

        [HttpPut("retraits/{retraitId:int}/retour")]
        public async Task<IActionResult> EnregistrerRetour(int retraitId, RetraitRetourRequest request)
        {
            var retrait = await _context.Retraits.FindAsync(retraitId);
            if (retrait == null) return NotFound("Retrait introuvable");

            retrait.DateDeRetour = request.DateDeRetour == default ? DateTime.Now : request.DateDeRetour;
            if (!string.IsNullOrWhiteSpace(request.Notes))
                retrait.Notes = request.Notes.Trim();

            await _context.SaveChangesAsync();

            var updated = await BaseQuery().FirstAsync(e => e.Id == retrait.EntiteDJId);
            return Ok(ToResponse(updated));
        }

        [HttpGet("retraits-actifs")]
        public async Task<IActionResult> GetRetraitsActifs()
        {
            var retraitsActifs = await _context.Retraits
                .Where(r => r.DateDeRetour == null)
                .Include(r => r.EntiteDJ)
                    .ThenInclude(e => e.Service)
                .Include(r => r.EntiteDJ.NumeroDossier)
                .OrderByDescending(r => r.DateDeRetrait)
                .Select(r => new
                {
                    retraitId = r.Id,
                    documentId = r.EntiteDJ.Id,
                    documentSujet = r.EntiteDJ.Sujet,
                    numeroDossier = r.EntiteDJ.NumeroDossier != null
                        ? $"{r.EntiteDJ.NumeroDossier.Annee}/{r.EntiteDJ.NumeroDossier.Nombre}/{r.EntiteDJ.NumeroDossier.NumeroSujet}"
                        : null,
                    tribunalSource = r.EntiteDJ.TribunalSource,
                    dateRetrait = r.DateDeRetrait,
                    motif = r.MotifDeRetrait,
                    effectuePar = r.EffectuePar,
                    serviceNom = r.EntiteDJ.Service != null ? r.EntiteDJ.Service.NomService : null,
                    notes = r.Notes
                })
                .ToListAsync();
            return Ok(retraitsActifs);
        }

        // ========== DOCUMENTS, IMPORT/EXPORT, RECHERCHE ==========
        [HttpPost("upload-pdf")]
        public async Task<IActionResult> UploadPdf([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Fichier requis.");

            var extension = Path.GetExtension(file.FileName);
            if (!new[] { ".pdf", ".doc", ".docx" }.Contains(extension, StringComparer.OrdinalIgnoreCase))
                return BadRequest("Seuls les fichiers PDF ou Word sont acceptes.");

            var uploadsRoot = Path.Combine(_environment.WebRootPath, "uploads", "documents");
            Directory.CreateDirectory(uploadsRoot);
            var safeBaseName = Path.GetFileNameWithoutExtension(file.FileName);
            safeBaseName = string.Join("-", safeBaseName.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
            if (string.IsNullOrWhiteSpace(safeBaseName)) safeBaseName = "document";
            var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}-{safeBaseName}{extension.ToLowerInvariant()}";
            var filePath = Path.Combine(uploadsRoot, fileName);
            await using (var stream = System.IO.File.Create(filePath))
                await file.CopyToAsync(stream);
            var link = $"/uploads/documents/{fileName}";
            return Ok(new { lienPdf = link });
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string? motCle)
        {
            var query = BaseQuery().Where(e => !e.EstArchive);
            if (!string.IsNullOrWhiteSpace(motCle))
            {
                var keyword = motCle.Trim();
                if (int.TryParse(keyword, out var numero))
                {
                    query = query.Where(e => (e.IdBureauOrdre != null && e.IdBureauOrdre.Contains(keyword)) ||
                        (e.NumeroDossier != null && (e.NumeroDossier.Annee == numero || e.NumeroDossier.Nombre == numero || e.NumeroDossier.NumeroSujet == numero)) ||
                        e.TribunalSource.Contains(keyword) || e.Sujet.Contains(keyword) || e.Destinataire.Contains(keyword) ||
                        e.Description.Contains(keyword) || e.Direction.Contains(keyword) || e.EtatArchive.Contains(keyword) ||
                        e.Emplacement.Contains(keyword));
                }
                else
                {
                    query = query.Where(e => (e.IdBureauOrdre != null && e.IdBureauOrdre.Contains(keyword)) ||
                        e.TribunalSource.Contains(keyword) || e.Sujet.Contains(keyword) || e.Destinataire.Contains(keyword) ||
                        e.Description.Contains(keyword) || e.Direction.Contains(keyword) || e.EtatArchive.Contains(keyword) ||
                        e.Emplacement.Contains(keyword));
                }
            }
            var items = await query
                .OrderByDescending(e => e.DateArchivage)
                .ThenByDescending(e => e.Id)
                .ToListAsync();
            return Ok(items.Select(ToResponse));
        }

        [HttpGet("export/excel")]
        public async Task<IActionResult> ExportExcel()
        {
            var courriers = await BaseQuery()
                .Where(e => !e.EstArchive)
                .OrderByDescending(e => e.DateArchivage)
                .ThenByDescending(e => e.Id)
                .ToListAsync();

            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Courriers juridiques");
            var headers = new[] { "رقم مكتب الضبط", "التاريخ", "المحكمة / المصدر", "رقم ملف الاستئناف القضائي", "الموضوع", "المرسل إليه", "المصلحة", "الحالة", "الموقع", "رابط PDF", "الملاحظات" };
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
            }
            int row = 2;
            foreach (var c in courriers)
            {
                ws.Cell(row, 1).Value = c.IdBureauOrdre;
                ws.Cell(row, 2).Value = c.DateArchivage;
                ws.Cell(row, 2).Style.DateFormat.Format = "dd/MM/yyyy";
                ws.Cell(row, 3).Value = c.TribunalSource;
                ws.Cell(row, 4).Value = FormatNumeroDossier(c);
                ws.Cell(row, 5).Value = c.Sujet;
                ws.Cell(row, 6).Value = c.Destinataire;
                ws.Cell(row, 7).Value = c.Service?.NomService ?? c.IdService.ToString();
                ws.Cell(row, 8).Value = ToArabicEtat(c.EtatArchive);
                ws.Cell(row, 9).Value = c.Emplacement;
                ws.Cell(row, 10).Value = c.LienPdf;
                ws.Cell(row, 11).Value = c.Description;
                row++;
            }
            ws.Columns().AdjustToContents();
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"courriers-juridiques-{DateTime.Now:yyyyMMddHHmm}.xlsx");
        }

        [HttpPost("import/excel")]
        public async Task<IActionResult> ImportExcel(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Fichier Excel requis.");
            int imported = 0;
            var errors = new List<string>();
            using var stream = file.OpenReadStream();
            using var workbook = new XLWorkbook(stream);
            var ws = workbook.Worksheets.First();
            foreach (var row in ws.RowsUsed().Skip(1))
            {
                try
                {
                    var date = ReadDate(row.Cell(2));
                    var tribunalSource = row.Cell(3).GetString().Trim();
                    var sujet = row.Cell(5).GetString().Trim();
                    var numeroDossier = row.Cell(4).GetString().Trim();
                    var service = await ResolveService(row.Cell(7).GetString().Trim());
                    if (date == null || string.IsNullOrWhiteSpace(tribunalSource) || string.IsNullOrWhiteSpace(sujet) || string.IsNullOrWhiteSpace(numeroDossier) || service == null)
                    {
                        errors.Add($"Ligne {row.RowNumber()}: date, tribunal/source, numero dossier, sujet et service sont obligatoires.");
                        continue;
                    }
                    var item = new EntiteDJ
                    {
                        IdBureauOrdre = row.Cell(1).GetString().Trim(),
                        DateArchivage = date.Value,
                        TribunalSource = tribunalSource,
                        Sujet = sujet,
                        Direction = "Entrant",
                        Destinataire = row.Cell(6).GetString().Trim(),
                        IdService = service.IdService,
                        EtatArchive = FromArabicEtat(row.Cell(8).GetString().Trim()),
                        Emplacement = row.Cell(9).GetString().Trim(),
                        EstTransmissible = true,
                        LienPdf = row.Cell(10).GetString().Trim(),
                        Description = row.Cell(11).GetString().Trim(),
                        EstArchive = false
                    };
                    ApplyNumeroDossier(item, new CourrierJudiciaireRequest { NumeroDossier = numeroDossier });
                    _context.EntitesDJs.Add(item);
                    imported++;
                }
                catch (Exception ex) { errors.Add($"Ligne {row.RowNumber()}: {ex.Message}"); }
            }
            await _context.SaveChangesAsync();
            return Ok(new { imported, errors });
        }

        // ========== HELPERS ==========
        private IQueryable<EntiteDJ> BaseQuery()
        {
            return _context.EntitesDJs
                .Include(e => e.Service)
                .Include(e => e.NumeroDossier)
                .Include(e => e.Retraits);
        }

        private static object ToResponse(EntiteDJ e)
        {
            return new
            {
                id = e.Id,
                date = e.DateArchivage,
                tribunalSource = e.TribunalSource,
                sujet = e.Sujet,
                direction = e.Direction,
                destinataire = e.Destinataire,
                description = e.Description,
                etatArchive = e.EtatArchive,
                emplacement = e.Emplacement,
                lienPdf = e.LienPdf,
                estTransmissible = e.EstTransmissible,
                idBureauOrdre = e.IdBureauOrdre,
                idService = e.IdService,
                serviceNom = e.Service?.NomService,
                numeroDossier = e.NumeroDossier != null
                    ? $"{e.NumeroDossier.Annee}/{e.NumeroDossier.Nombre}/{e.NumeroDossier.NumeroSujet}"
                    : null,
                retraitsCount = e.Retraits.Count,
                retraits = e.Retraits.OrderByDescending(r => r.DateDeRetrait).Select(r => new
                {
                    id = r.Id,
                    dateDeRetrait = r.DateDeRetrait,
                    motifDeRetrait = r.MotifDeRetrait,
                    effectuePar = r.EffectuePar,
                    dateDeRetour = r.DateDeRetour,
                    notes = r.Notes
                })
            };
        }

        // ========== VALIDATION AVEC UNICITÉ CROISÉE ==========
        private async Task<IActionResult?> ValidateRequest(CourrierJudiciaireRequest request, int? excludeId)
        {
            if (request.Date == default) return BadRequest("Date obligatoire.");
            if (string.IsNullOrWhiteSpace(request.TribunalSource)) return BadRequest("Tribunal / source obligatoire.");
            if (string.IsNullOrWhiteSpace(request.Sujet)) return BadRequest("Sujet obligatoire.");

            // 1. Unicité interne au judiciaire (IdBureauOrdre)
            if (!string.IsNullOrWhiteSpace(request.IdBureauOrdre) && !await IsIdBureauOrdreUniqueInJudicial(request.IdBureauOrdre, excludeId))
                return BadRequest("رقم مكتب الضبط مستخدم بالفعل في ملف قضائي آخر.");

            // 2. Unicité interne au judiciaire (NumeroDossier)
            if (!string.IsNullOrWhiteSpace(request.NumeroDossier) && !await IsNumeroDossierUniqueInJudicial(request.NumeroDossier, excludeId))
                return BadRequest("الرقم الاستئنافي للملف مستخدم بالفعل في ملف قضائي آخر.");

            // 3. Vérification croisée avec la table administrative (Entite)
            if (!string.IsNullOrWhiteSpace(request.IdBureauOrdre) && await IsIdBureauOrdreTakenByAdministratif(request.IdBureauOrdre, excludeId))
                return BadRequest("رقم مكتب الضبط مستخدم بالفعل في السجل الإداري.");

            // 4. Optionnel : vérifier que NumeroDossier (si renseigné) n'est pas utilisé comme IdBureauOrdre admin
            if (!string.IsNullOrWhiteSpace(request.NumeroDossier) && await IsIdBureauOrdreTakenByAdministratif(request.NumeroDossier, excludeId))
                return BadRequest("الرقم الاستئنافي للملف مستخدم بالفعل كرقم مكتب ضبط في السجل الإداري.");

            if (request.IdService <= 0) return BadRequest("Service obligatoire.");
            if (!await _context.Services.AnyAsync(s => s.IdService == request.IdService)) return BadRequest("Service inexistant.");
            return null;
        }

        private async Task<bool> IsIdBureauOrdreUniqueInJudicial(string? idBureauOrdre, int? excludeId)
        {
            if (string.IsNullOrWhiteSpace(idBureauOrdre)) return true;
            var normalized = idBureauOrdre.Trim();
            return !await _context.EntitesDJs.AnyAsync(e =>
                e.IdBureauOrdre != null &&
                e.IdBureauOrdre.Trim() == normalized &&
                (!excludeId.HasValue || e.Id != excludeId.Value));
        }

        private async Task<bool> IsNumeroDossierUniqueInJudicial(string? numeroDossier, int? excludeId)
        {
            if (string.IsNullOrWhiteSpace(numeroDossier)) return true;
            if (!TryParseNumeroDossier(numeroDossier, out var annee, out var nombre, out var numeroSujet))
                return true; // invalid format, separate validation catches it
            return !await _context.EntitesDJs.AnyAsync(e =>
                e.NumeroDossier != null &&
                e.NumeroDossier.Annee == annee &&
                e.NumeroDossier.Nombre == nombre &&
                e.NumeroDossier.NumeroSujet == numeroSujet &&
                (!excludeId.HasValue || e.Id != excludeId.Value));
        }

        private async Task<bool> IsIdBureauOrdreTakenByAdministratif(string value, int? excludeId)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            var normalized = value.Trim();
            return await _context.Entites.AnyAsync(e =>
                e.TypeDocument == "Administratif" &&
                e.ParentId == null &&
                e.IdBureauOrdre != null &&
                e.IdBureauOrdre.Trim() == normalized &&
                (!excludeId.HasValue || e.IdEntite != excludeId.Value));
        }

        private void ApplyNumeroDossier(EntiteDJ item, CourrierJudiciaireRequest request)
        {
            var hasNumeroDossierTexte = TryParseNumeroDossier(request.NumeroDossier, out var annee, out var nombre, out var numeroSujet);
            if (!hasNumeroDossierTexte && !request.NumeroDossierAnnee.HasValue && !request.NumeroDossierNombre.HasValue && !request.NumeroDossierSujet.HasValue) return;
            if (item.NumeroDossier == null) item.NumeroDossier = new NumeroDossierJuridique();
            item.NumeroDossier.Annee = hasNumeroDossierTexte ? annee : request.NumeroDossierAnnee ?? DateTime.Now.Year;
            item.NumeroDossier.Nombre = hasNumeroDossierTexte ? nombre : request.NumeroDossierNombre ?? 0;
            item.NumeroDossier.NumeroSujet = hasNumeroDossierTexte ? numeroSujet : request.NumeroDossierSujet ?? 0;
        }

        private async Task<Service?> ResolveService(string value)
        {
            if (int.TryParse(value, out var idService))
                return await _context.Services.FirstOrDefaultAsync(s => s.IdService == idService);
            return await _context.Services.FirstOrDefaultAsync(s => s.NomService == value);
        }

        private static DateTime? ReadDate(IXLCell cell)
        {
            if (cell.TryGetValue<DateTime>(out var date)) return date;
            return DateTime.TryParse(cell.GetString(), out date) ? date : null;
        }

        private static string FormatNumeroDossier(EntiteDJ courrier)
        {
            return courrier.NumeroDossier != null
                ? $"{courrier.NumeroDossier.Annee}/{courrier.NumeroDossier.Nombre}/{courrier.NumeroDossier.NumeroSujet}"
                : string.Empty;
        }

        private static bool TryParseNumeroDossier(string? value, out int annee, out int nombre, out int numeroSujet)
        {
            annee = nombre = numeroSujet = 0;
            if (string.IsNullOrWhiteSpace(value)) return false;
            var parts = value.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length == 0 || parts.Length > 3) return false;
            if (!int.TryParse(parts[0], out annee)) return false;
            if (parts.Length > 1 && !int.TryParse(parts[1], out nombre)) return false;
            if (parts.Length > 2 && !int.TryParse(parts[2], out numeroSujet)) return false;
            return true;
        }

        private static string NormalizeEtat(string? etat)
        {
            if (etat?.Equals("En cours", StringComparison.OrdinalIgnoreCase) == true) return "En cours";
            if (etat?.Equals("Traite", StringComparison.OrdinalIgnoreCase) == true || etat?.Equals("Traité", StringComparison.OrdinalIgnoreCase) == true) return "Traite";
            if (etat?.Equals("Archive", StringComparison.OrdinalIgnoreCase) == true || etat?.Equals("Archivé", StringComparison.OrdinalIgnoreCase) == true) return "Archive";
            return "Nouveau";
        }

        private static string FromArabicEtat(string value)
        {
            return value switch
            {
                "قيد المعالجة" => "En cours",
                "تمت المعالجة" => "Traite",
                "مؤرشف" => "Archive",
                _ => NormalizeEtat(value)
            };
        }

        private static string ToArabicEtat(string? value)
        {
            return value switch
            {
                "En cours" => "قيد المعالجة",
                "Traite" => "تمت المعالجة",
                "Archive" => "مؤرشف",
                _ => "جديد"
            };
        }
    }

    // ========== DTOs ==========
    public class CourrierJudiciaireRequest
    {
        public string? IdBureauOrdre { get; set; }
        public DateTime Date { get; set; }
        public string? TribunalSource { get; set; }
        public string? Sujet { get; set; }
        public string? Direction { get; set; }
        public string? Destinataire { get; set; }
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
    }

    public class RetraitRequest
    {
        public DateTime DateDeRetrait { get; set; }
        public string MotifDeRetrait { get; set; } = string.Empty;
        public string? EffectuePar { get; set; }
        public DateTime? DateDeRetour { get; set; }
        public string? Notes { get; set; }
    }

    public class RetraitRetourRequest
    {
        public DateTime DateDeRetour { get; set; }
        public string? Notes { get; set; }
    }
}