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
            var user = await _context.Utilisateurs.Include(u => u.Service)
                .FirstOrDefaultAsync(u => u.Login == userName);
            return user?.Service?.NomService ?? "Inconnu";
        }

        // ========== CRUD ==========
       [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            // NO LONGER FILTERS OUT ARCHIVED ITEMS
            var items = await BaseQuery()
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
                if (int.TryParse(keyword, out var num))
                {
                    query = query.Where(e =>
                        (e.IdBureauOrdre != null && e.IdBureauOrdre.Contains(keyword)) ||
                        (e.NumeroDossier != null && (e.NumeroDossier.Annee == num || e.NumeroDossier.Nombre == num || e.NumeroDossier.NumeroSujet == num)) ||
                        e.TribunalSource.Contains(keyword) || e.Sujet.Contains(keyword) || e.Destinataire.Contains(keyword) ||
                        e.Description.Contains(keyword) || e.Direction.Contains(keyword) || e.EtatArchive.Contains(keyword) ||
                        e.Emplacement.Contains(keyword) || (e.Cabinet != null && e.Cabinet.Contains(keyword)));
                }
                else
                {
                    query = query.Where(e =>
                        (e.IdBureauOrdre != null && e.IdBureauOrdre.Contains(keyword)) ||
                        e.TribunalSource.Contains(keyword) || e.Sujet.Contains(keyword) || e.Destinataire.Contains(keyword) ||
                        e.Description.Contains(keyword) || e.Direction.Contains(keyword) || e.EtatArchive.Contains(keyword) ||
                        e.Emplacement.Contains(keyword) || (e.Cabinet != null && e.Cabinet.Contains(keyword)));
                }
            }
            var items = await query.OrderByDescending(e => e.DateArchivage)
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
                TribunalSource = request.TribunalSource.Trim(),
                Sujet = request.Sujet.Trim(),
                Direction = "Entrant",
                Destinataire = string.Empty,                   // always empty for judicial
                Description = request.Description?.Trim() ?? string.Empty,
                EtatArchive = NormalizeEtat(request.EtatArchive),
                Emplacement = await GetCurrentUserServiceName(),
                LienPdf = request.LienPdf?.Trim() ?? string.Empty,
                IdBureauOrdre = request.IdBureauOrdre,
                IdService = request.IdService,
                EstArchive = false,
                EstTransmissible = true,
                Cabinet = request.Cabinet?.Trim(),
                NumeroPremiereInstance = request.NumeroPremiereInstance?.Trim()   // NEW
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
            var item = await _context.EntitesDJs.Include(e => e.NumeroDossier).FirstOrDefaultAsync(e => e.Id == id);
            if (item == null) return NotFound();

            var validation = await ValidateRequest(request, id);
            if (validation != null) return validation;

            item.DateArchivage = request.Date;
            item.TribunalSource = request.TribunalSource.Trim();
            item.Sujet = request.Sujet.Trim();
            item.Direction = "Entrant";
            item.Destinataire = string.Empty;                  // always empty
            item.Description = request.Description?.Trim() ?? string.Empty;
            item.EtatArchive = NormalizeEtat(request.EtatArchive);
            item.LienPdf = request.LienPdf?.Trim() ?? string.Empty;
            item.IdBureauOrdre = request.IdBureauOrdre;
            item.IdService = request.IdService;
            item.Cabinet = request.Cabinet?.Trim();
            item.NumeroPremiereInstance = request.NumeroPremiereInstance?.Trim();   // NEW
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
            item.Emplacement = "الحفظ";               // ← ALWAYS THE ARCHIVE SERVICE
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
                DateDeRetour = null,
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
            if (retrait == null) return NotFound();
            retrait.DateDeRetour = request.DateDeRetour == default ? DateTime.Now : request.DateDeRetour;
            if (!string.IsNullOrWhiteSpace(request.Notes)) retrait.Notes = request.Notes.Trim();
            await _context.SaveChangesAsync();
            var updated = await BaseQuery().FirstAsync(e => e.Id == retrait.EntiteDJId);
            return Ok(ToResponse(updated));
        }

        [HttpDelete("retraits/{retraitId:int}")]
        public async Task<IActionResult> CancelRetrait(int retraitId)
        {
            var retrait = await _context.Retraits.FindAsync(retraitId);
            if (retrait == null) return NotFound();
            _context.Retraits.Remove(retrait);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Retrait annulé" });
        }

        [HttpGet("retraits-actifs")]
        public async Task<IActionResult> GetRetraitsActifs()
        {
            var retraitsActifs = await _context.Retraits.Where(r => r.DateDeRetour == null)
                .Include(r => r.EntiteDJ).ThenInclude(e => e.Service)
                .Include(r => r.EntiteDJ.NumeroDossier)
                .Select(r => new
                {
                    r.Id,
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
                }).ToListAsync();
            return Ok(retraitsActifs);
        }

        // ========== EXPORT FOR ARCHIVES ==========
        [HttpGet("export/archives")]
        public async Task<IActionResult> ExportArchives()
        {
            var archives = await BaseQuery()
                .Where(e => e.EstArchive || e.EtatArchive == "Archive")
                .OrderByDescending(e => e.DateArchivage)
                .ThenByDescending(e => e.Id)
                .ToListAsync();

            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Archives juridiques");
            var headers = new[] {
                "رقم الاستئنافي", "التاريخ", "المحكمة / المصدر", "الموضوع",
                "الموقع", "الخزانة", "الحالة", "عدد السحوبات", "رابط PDF", "الملاحظات"
            };
            for (int i = 0; i < headers.Length; i++)
                ws.Cell(1, i + 1).Value = headers[i];

            int row = 2;
            foreach (var c in archives)
            {
                ws.Cell(row, 1).Value = c.NumeroDossier != null
                    ? $"{c.NumeroDossier.Annee}/{c.NumeroDossier.Nombre}/{c.NumeroDossier.NumeroSujet}"
                    : c.IdBureauOrdre ?? "";
                ws.Cell(row, 2).Value = c.DateArchivage;
                ws.Cell(row, 2).Style.DateFormat.Format = "dd/MM/yyyy";
                ws.Cell(row, 3).Value = c.TribunalSource;
                ws.Cell(row, 4).Value = c.Sujet;
                ws.Cell(row, 5).Value = c.Emplacement;
                ws.Cell(row, 6).Value = c.Cabinet ?? "";
                ws.Cell(row, 7).Value = ToArabicEtat(c.EtatArchive);
                ws.Cell(row, 8).Value = c.Retraits.Count;
                ws.Cell(row, 9).Value = c.LienPdf;
                ws.Cell(row, 10).Value = c.Description;
                row++;
            }
            ws.Columns().AdjustToContents();
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"archives-juridiques-{DateTime.Now:yyyyMMddHHmm}.xlsx");
        }

        // ========== IMPORT FOR ARCHIVING EXISTING DOCUMENTS ==========
        [HttpPost("import-archive/preview")]
        public IActionResult ImportArchivePreview(IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier requis.");
            using var stream = file.OpenReadStream();
            using var workbook = new XLWorkbook(stream);
            var ws = workbook.Worksheet(1);
            var headers = ws.Row(1).Cells().Select(c => c.GetString().Trim()).ToList();
            return Ok(headers);
        }

        [HttpPost("import-archive/execute")]
        public async Task<IActionResult> ImportArchiveExecute(
            IFormFile file,
            [FromQuery] string colIdentifiant,
            [FromQuery] string? colCabinet,
            [FromQuery] string? colEmplacement)   // accepted but ignored – we force "الحفظ"
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier requis.");
            if (string.IsNullOrWhiteSpace(colIdentifiant))
                return BadRequest("La colonne 'Identifiant' est obligatoire.");

            using var stream = file.OpenReadStream();
            using var workbook = new XLWorkbook(stream);
            var ws = workbook.Worksheet(1);
            var headers = ws.Row(1).Cells().Select(c => c.GetString().Trim()).ToList();

            int idxId = headers.FindIndex(h => h == colIdentifiant);
            int idxCab = string.IsNullOrWhiteSpace(colCabinet) ? -1 : headers.FindIndex(h => h == colCabinet);
            // idxEmp is intentionally ignored

            if (idxId == -1)
                return BadRequest("Colonne 'Identifiant' introuvable dans le fichier.");

            var rows = ws.RowsUsed().Skip(1);
            int archived = 0;
            var errors = new List<string>();
            int lineNumber = 2;

            foreach (var row in rows)
            {
                var identifiant = row.Cell(idxId + 1).GetString().Trim();
                var cabinet = idxCab >= 0 ? row.Cell(idxCab + 1).GetString().Trim() : null;

                if (string.IsNullOrWhiteSpace(identifiant))
                {
                    errors.Add($"Ligne {lineNumber}: Identifiant vide.");
                    lineNumber++;
                    continue;
                }

                // Search in administrative entities (IdBureauOrdre)
                var entite = await _context.Entites
                    .FirstOrDefaultAsync(e => e.IdBureauOrdre == identifiant && !e.EstArchive);

                if (entite != null)
                {
                    entite.EstArchive = true;
                    entite.Etat = "Archive";
                    if (!string.IsNullOrWhiteSpace(cabinet))
                        entite.Description = (string.IsNullOrWhiteSpace(entite.Description) ? "" : entite.Description + " | ") + $"الخزانة: {cabinet}";
                    await _context.SaveChangesAsync();
                    archived++;
                }
                else
                {
                    // Search in judicial entities (composed NumeroDossier or IdBureauOrdre)
                    var judicial = await _context.EntitesDJs
                        .Include(e => e.NumeroDossier)
                        .FirstOrDefaultAsync(e =>
                            (e.NumeroDossier != null &&
                             (e.NumeroDossier.Annee.ToString() + "/" + e.NumeroDossier.Nombre.ToString() + "/" + e.NumeroDossier.NumeroSujet.ToString()) == identifiant) ||
                            e.IdBureauOrdre == identifiant);

                    if (judicial != null && !judicial.EstArchive)
                    {
                        judicial.EstArchive = true;
                        judicial.EtatArchive = "Archive";
                        judicial.Emplacement = "الحفظ";    // ← FORCE THE ARCHIVE LOCATION
                        if (!string.IsNullOrWhiteSpace(cabinet))
                            judicial.Cabinet = cabinet;
                        await _context.SaveChangesAsync();
                        archived++;
                    }
                    else if (judicial != null && judicial.EstArchive)
                    {
                        errors.Add($"Ligne {lineNumber}: Le dossier '{identifiant}' est déjà archivé.");
                    }
                    else
                    {
                        errors.Add($"Ligne {lineNumber}: Dossier '{identifiant}' introuvable.");
                    }
                }
                lineNumber++;
            }

            return Ok(new { archived, errors });
        }

        // ========== OTHER ENDPOINTS (upload, search, template) ==========
        [HttpPost("upload-pdf")]
        public async Task<IActionResult> UploadPdf([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier requis.");
            var ext = Path.GetExtension(file.FileName);
            if (!new[] { ".pdf", ".doc", ".docx" }.Contains(ext, StringComparer.OrdinalIgnoreCase))
                return BadRequest("Seuls les fichiers PDF ou Word sont acceptes.");
            var uploadsRoot = Path.Combine(_environment.WebRootPath, "uploads", "documents");
            Directory.CreateDirectory(uploadsRoot);
            var safeName = Path.GetFileNameWithoutExtension(file.FileName);
            safeName = string.Join("-", safeName.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
            if (string.IsNullOrWhiteSpace(safeName)) safeName = "document";
            var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}-{safeName}{ext.ToLowerInvariant()}";
            var filePath = Path.Combine(uploadsRoot, fileName);
            await using (var stream = System.IO.File.Create(filePath)) await file.CopyToAsync(stream);
            return Ok(new { lienPdf = $"/uploads/documents/{fileName}" });
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string? motCle)
        {
        var query = BaseQuery();   // no Where(!e.EstArchive)
        if (!string.IsNullOrWhiteSpace(motCle))
        {
        var keyword = motCle.Trim();
        if (int.TryParse(keyword, out var num))
        {
            query = query.Where(e =>
                (e.IdBureauOrdre != null && e.IdBureauOrdre.Contains(keyword)) ||
                (e.NumeroDossier != null && (e.NumeroDossier.Annee == num || e.NumeroDossier.Nombre == num || e.NumeroDossier.NumeroSujet == num)) ||
                e.TribunalSource.Contains(keyword) || e.Sujet.Contains(keyword) || e.Destinataire.Contains(keyword) ||
                e.Description.Contains(keyword) || e.Direction.Contains(keyword) || e.EtatArchive.Contains(keyword) ||
                e.Emplacement.Contains(keyword) || (e.Cabinet != null && e.Cabinet.Contains(keyword)));
        }
        else
        {
            query = query.Where(e =>
                (e.IdBureauOrdre != null && e.IdBureauOrdre.Contains(keyword)) ||
                e.TribunalSource.Contains(keyword) || e.Sujet.Contains(keyword) || e.Destinataire.Contains(keyword) ||
                e.Description.Contains(keyword) || e.Direction.Contains(keyword) || e.EtatArchive.Contains(keyword) ||
                e.Emplacement.Contains(keyword) || (e.Cabinet != null && e.Cabinet.Contains(keyword)));
        }
        }
        var items = await query.OrderByDescending(e => e.DateArchivage).ThenByDescending(e => e.Id).ToListAsync();
        return Ok(items.Select(ToResponse));
        }

        [HttpGet("template-excel")]
        public IActionResult GetTemplateExcel()
        {
            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Modele");
            var headers = new[] { "رقم مكتب الضبط", "التاريخ", "المحكمة / المصدر", "رقم ملف الاستئناف القضائي", "الموضوع", "المرسل إليه", "المصلحة", "الحالة", "الموقع", "الخزانة", "رابط PDF", "الملاحظات" };
            for (int i = 0; i < headers.Length; i++) ws.Cell(1, i + 1).Value = headers[i];
            ws.Cell(2, 1).Value = "12/2026";
            ws.Cell(2, 2).Value = DateTime.Now.ToString("dd/MM/yyyy");
            ws.Cell(2, 3).Value = "محكمة الاستئناف";
            ws.Cell(2, 4).Value = "2026/15/3";
            ws.Cell(2, 5).Value = "نزع الملكية";
            ws.Cell(2, 7).Value = "خلية المعلوميات";
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "modele_import_juridiques.xlsx");
        }

        // ========== HELPERS ==========
        private IQueryable<EntiteDJ> BaseQuery() =>
            _context.EntitesDJs.Include(e => e.Service).Include(e => e.NumeroDossier).Include(e => e.Retraits);

        private static object ToResponse(EntiteDJ e) => new
        {
                e.Id,
                date = e.DateArchivage,
                tribunalSource = e.TribunalSource,
                sujet = e.Sujet,
                direction = e.Direction,
                // destinataire is REMOVED from response
                description = e.Description,
                etatArchive = e.EtatArchive,
                emplacement = e.Emplacement,
                lienPdf = e.LienPdf,
                estTransmissible = e.EstTransmissible,
                idBureauOrdre = e.IdBureauOrdre,
                idService = e.IdService,
                serviceNom = e.Service?.NomService,
                cabinet = e.Cabinet,
                numeroPremiereInstance = e.NumeroPremiereInstance,   // NEW
                numeroDossier = e.NumeroDossier != null
                    ? $"{e.NumeroDossier.Annee}/{e.NumeroDossier.Nombre}/{e.NumeroDossier.NumeroSujet}"
                    : null,
                retraitsCount = e.Retraits.Count,
                retraits = e.Retraits.OrderByDescending(r => r.DateDeRetrait).Select(r => new
                {
                    r.Id, r.DateDeRetrait, r.MotifDeRetrait, r.EffectuePar, r.DateDeRetour, r.Notes
                })  
        };

        private async Task<IActionResult?> ValidateRequest(CourrierJudiciaireRequest request, int? excludeId)
        {
            if (request.Date == default) return BadRequest("Date obligatoire.");
            if (string.IsNullOrWhiteSpace(request.TribunalSource)) return BadRequest("Tribunal / source obligatoire.");
            if (string.IsNullOrWhiteSpace(request.Sujet)) return BadRequest("Sujet obligatoire.");
            if (!string.IsNullOrWhiteSpace(request.IdBureauOrdre) &&
                !await IsIdBureauOrdreUniqueInJudicial(request.IdBureauOrdre, excludeId))
                return BadRequest("رقم مكتب الضبط مستخدم بالفعل في ملف قضائي آخر.");
            if (!string.IsNullOrWhiteSpace(request.NumeroDossier) &&
                !await IsNumeroDossierUniqueInJudicial(request.NumeroDossier, excludeId))
                return BadRequest("الرقم الاستئنافي للملف مستخدم بالفعل في ملف قضائي آخر.");
            if (!string.IsNullOrWhiteSpace(request.IdBureauOrdre) &&
                await IsIdBureauOrdreTakenByAdministratif(request.IdBureauOrdre, excludeId))
                return BadRequest("رقم مكتب الضبط مستخدم بالفعل في السجل الإداري.");
            if (!string.IsNullOrWhiteSpace(request.NumeroDossier) &&
                await IsIdBureauOrdreTakenByAdministratif(request.NumeroDossier, excludeId))
                return BadRequest("الرقم الاستئنافي للملف مستخدم بالفعل كرقم مكتب ضبط في السجل الإداري.");
            if (request.IdService <= 0) return BadRequest("Service obligatoire.");
            if (!await _context.Services.AnyAsync(s => s.IdService == request.IdService))
                return BadRequest("Service inexistant.");
            return null;
        }

        private async Task<bool> IsIdBureauOrdreUniqueInJudicial(string? idBureauOrdre, int? excludeId)
        {
            if (string.IsNullOrWhiteSpace(idBureauOrdre)) return true;
            var normalized = idBureauOrdre.Trim();
            return !await _context.EntitesDJs.AnyAsync(e =>
                e.IdBureauOrdre != null && e.IdBureauOrdre.Trim() == normalized &&
                (!excludeId.HasValue || e.Id != excludeId.Value));
        }

        private async Task<bool> IsNumeroDossierUniqueInJudicial(string? numeroDossier, int? excludeId)
        {
            if (string.IsNullOrWhiteSpace(numeroDossier)) return true;
            if (!TryParseNumeroDossierFlexible(numeroDossier, out var a, out var b, out var c)) return true;
            return !await _context.EntitesDJs.AnyAsync(e =>
                e.NumeroDossier != null &&
                e.NumeroDossier.Annee == a && e.NumeroDossier.Nombre == b && e.NumeroDossier.NumeroSujet == c &&
                (!excludeId.HasValue || e.Id != excludeId.Value));
        }

        private async Task<bool> IsIdBureauOrdreTakenByAdministratif(string value, int? excludeId)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            var normalized = value.Trim();
            return await _context.Entites.AnyAsync(e =>
                e.TypeDocument == "Administratif" && e.ParentId == null &&
                e.IdBureauOrdre != null && e.IdBureauOrdre.Trim() == normalized &&
                (!excludeId.HasValue || e.IdEntite != excludeId.Value));
        }

        private void ApplyNumeroDossier(EntiteDJ item, CourrierJudiciaireRequest request)
        {
            if (TryParseNumeroDossierFlexible(request.NumeroDossier, out var a, out var b, out var c))
            {
                if (item.NumeroDossier == null) item.NumeroDossier = new NumeroDossierJuridique();
                item.NumeroDossier.Annee = a; item.NumeroDossier.Nombre = b; item.NumeroDossier.NumeroSujet = c;
            }
        }

        private void ApplyNumeroDossierFlexible(EntiteDJ item, string? numeroDossier)
        {
            if (TryParseNumeroDossierFlexible(numeroDossier, out var a, out var b, out var c))
            {
                if (item.NumeroDossier == null) item.NumeroDossier = new NumeroDossierJuridique();
                item.NumeroDossier.Annee = a; item.NumeroDossier.Nombre = b; item.NumeroDossier.NumeroSujet = c;
            }
        }

        private static bool TryParseNumeroDossierFlexible(string? v, out int a, out int b, out int c)
        {
            a = b = c = 0;
            if (string.IsNullOrWhiteSpace(v)) return false;
            var cleaned = v.Trim().Replace(" ", "").Replace(" ", "");
            var parts = cleaned.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0 || parts.Length > 3) return false;
            if (!int.TryParse(parts[0], out a)) return false;
            if (parts.Length > 1 && !int.TryParse(parts[1], out b)) return false;
            if (parts.Length > 2 && !int.TryParse(parts[2], out c)) return false;
            return true;
        }

        private static string NormalizeEtat(string? e) => e switch
        {
            "En cours" => "En cours", "Traite" => "Traite", "Archive" => "Archive", _ => "Nouveau"
        };

        private static string ToArabicEtat(string? e) => e switch
        {
            "En cours" => "قيد المعالجة", "Traite" => "تمت المعالجة", "Archive" => "مؤرشف", _ => "جديد"
        };
    }

    // DTOs
    public class CourrierJudiciaireRequest
{
    public string? IdBureauOrdre { get; set; }
    public DateTime Date { get; set; }
    public string TribunalSource { get; set; } = string.Empty;
    public string Sujet { get; set; } = string.Empty;
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
    public string? Cabinet { get; set; }
    public string? NumeroPremiereInstance { get; set; }   // NEW
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