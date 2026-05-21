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
            var user = await _context.Utilisateurs.Include(u => u.Service).FirstOrDefaultAsync(u => u.Login == userName);
            return user?.Service?.NomService ?? "Inconnu";
        }

        // ========== CRUD ==========
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
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
        [HttpGet("{id}/retraits")]
public async Task<IActionResult> GetRetraitsByDocument(int id)
{
    var document = await _context.EntitesDJs
        .Include(e => e.Retraits)
        .FirstOrDefaultAsync(e => e.Id == id);
    if (document == null) return NotFound();
    return Ok(document.Retraits.OrderByDescending(r => r.DateDeRetrait).Select(r => new
    {
        r.Id,
        r.DateDeRetrait,
        r.MotifDeRetrait,
        r.EffectuePar,
        r.DateDeRetour,
        r.Notes
    }));
}

        [HttpGet("archives")]
        public async Task<IActionResult> GetArchives([FromQuery] string? motCle)
        {
            var query = BaseQuery().Where(e => e.EstArchive || e.EtatArchive == "Archive");
            if (!string.IsNullOrWhiteSpace(motCle))
            {
                var keyword = motCle.Trim();
                query = query.Where(e =>
                    (e.IdBureauOrdre != null && e.IdBureauOrdre.Contains(keyword)) ||
                    (e.NumeroDossier != null && (e.NumeroDossier.Annee.ToString().Contains(keyword) || e.NumeroDossier.Nombre.ToString().Contains(keyword) || e.NumeroDossier.NumeroSujet.ToString().Contains(keyword))) ||
                    e.TribunalSource.Contains(keyword) || e.Sujet.Contains(keyword) || e.Destinataire.Contains(keyword) ||
                    e.Description.Contains(keyword) || e.Direction.Contains(keyword) || e.EtatArchive.Contains(keyword) ||
                    e.Emplacement.Contains(keyword) || (e.Cabinet != null && e.Cabinet.Contains(keyword)) ||
                    (e.NumeroPremiereInstance != null && e.NumeroPremiereInstance.Contains(keyword)));
            }
            var items = await query.OrderByDescending(e => e.DateArchivage).ThenByDescending(e => e.Id).ToListAsync();
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
                EstTransmissible = request.EstTransmissible,
                Cabinet = request.Cabinet?.Trim(),
                NumeroPremiereInstance = request.NumeroPremiereInstance?.Trim(),
                EstDocumentLie = request.EstDocumentLie,
                ParentJudiciaireId = request.EstDocumentLie ? request.ParentJudiciaireId : null
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
            item.TribunalSource = request.TribunalSource?.Trim() ?? string.Empty;
            item.Sujet = request.Sujet?.Trim() ?? string.Empty;
            item.Direction = "Entrant";
            item.Destinataire = request.Destinataire?.Trim() ?? string.Empty;
            item.Description = request.Description?.Trim() ?? string.Empty;
            item.EtatArchive = NormalizeEtat(request.EtatArchive);
            item.LienPdf = request.LienPdf?.Trim() ?? string.Empty;
            item.IdBureauOrdre = request.IdBureauOrdre;
            item.IdService = request.IdService;
            item.Cabinet = request.Cabinet?.Trim();
            item.NumeroPremiereInstance = request.NumeroPremiereInstance?.Trim();
            item.EstDocumentLie = request.EstDocumentLie;
            item.ParentJudiciaireId = request.EstDocumentLie ? request.ParentJudiciaireId : null;
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
            
            int archivesServiceId = await GetArchivesServiceId();
            item.IdService = archivesServiceId;
            item.EstArchive = true;
            item.EtatArchive = "Archive";
            item.Emplacement = "الحفظ";
            
            await _context.SaveChangesAsync();
            return Ok(ToResponse(item));
        }

        // ========== RETRAITS ==========
        [HttpPost("{id:int}/retraits")]
        public async Task<IActionResult> EnregistrerRetrait(int id, RetraitRequest request)
        {
            var item = await _context.EntitesDJs.FirstOrDefaultAsync(e => e.Id == id);
            if (item == null) return NotFound();
            if (string.IsNullOrWhiteSpace(request.MotifDeRetrait)) return BadRequest("Motif de retrait obligatoire.");
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
                    numeroDossier = r.EntiteDJ.NumeroDossier != null ? $"{r.EntiteDJ.NumeroDossier.Annee}/{r.EntiteDJ.NumeroDossier.Nombre}/{r.EntiteDJ.NumeroDossier.NumeroSujet}" : null,
                    tribunalSource = r.EntiteDJ.TribunalSource,
                    dateRetrait = r.DateDeRetrait,
                    motif = r.MotifDeRetrait,
                    effectuePar = r.EffectuePar,
                    serviceNom = r.EntiteDJ.Service != null ? r.EntiteDJ.Service.NomService : null,
                    notes = r.Notes
                }).ToListAsync();
            return Ok(retraitsActifs);
        }

        // ========== RETRAITS ==========

        [HttpGet("retraits")]
        public async Task<IActionResult> GetAllRetraits([FromQuery] string sort = "dateDesc")
        {
            var query = _context.Retraits
                .Include(r => r.EntiteDJ)
                .ThenInclude(e => e.NumeroDossier)
                .AsQueryable();

            // Tri par date de retrait
            if (sort == "dateDesc")
                query = query.OrderByDescending(r => r.DateDeRetrait);
            else
                query = query.OrderBy(r => r.DateDeRetrait);

            var retraits = await query.Select(r => new
            {
                r.Id,
                r.DateDeRetrait,
                r.DateDeRetour,
                r.MotifDeRetrait,
                r.EffectuePar,
                r.Notes,

                // Infos du dossier lié
                DossierId = r.EntiteDJ.Id,
                DossierNumero = r.EntiteDJ.NumeroDossier != null
                    ? $"{r.EntiteDJ.NumeroDossier.Annee}/{r.EntiteDJ.NumeroDossier.Nombre}/{r.EntiteDJ.NumeroDossier.NumeroSujet}"
                    : (r.EntiteDJ.IdBureauOrdre ?? "—"),
                DossierSujet = r.EntiteDJ.Sujet,
                DossierCabinet = r.EntiteDJ.Cabinet,
                DossierEmplacement = r.EntiteDJ.Emplacement
            }).ToListAsync();

            return Ok(retraits);
        }

        // ========== EXPORT ==========
        [HttpGet("export/archives")]
        public async Task<IActionResult> ExportArchives()
        {
            var archives = await BaseQuery()
                .Where(e => e.EstArchive || e.EtatArchive == "Archive")
                .OrderByDescending(e => e.DateArchivage).ThenByDescending(e => e.Id).ToListAsync();

            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Archives juridiques");
            var headers = new[] { "رقم الاستئنافي", "الرقم الابتدائي", "التاريخ", "المحكمة / المصدر", "الموضوع", "الموقع", "الخزانة", "الحالة", "عدد السحوبات", "رابط PDF", "الملاحظات" };
            for (int i = 0; i < headers.Length; i++) ws.Cell(1, i + 1).Value = headers[i];
            int row = 2;
            foreach (var c in archives)
            {
                ws.Cell(row, 1).Value = c.NumeroDossier != null ? $"{c.NumeroDossier.Annee}/{c.NumeroDossier.Nombre}/{c.NumeroDossier.NumeroSujet}" : c.IdBureauOrdre ?? "";
                ws.Cell(row, 2).Value = c.NumeroPremiereInstance ?? "";
                ws.Cell(row, 3).Value = c.DateArchivage; ws.Cell(row, 3).Style.DateFormat.Format = "dd/MM/yyyy";
                ws.Cell(row, 4).Value = c.TribunalSource;
                ws.Cell(row, 5).Value = c.Sujet;
                ws.Cell(row, 6).Value = c.Emplacement;
                ws.Cell(row, 7).Value = c.Cabinet ?? "";
                ws.Cell(row, 8).Value = ToArabicEtat(c.EtatArchive);
                ws.Cell(row, 9).Value = c.Retraits.Count;
                ws.Cell(row, 10).Value = c.LienPdf;
                ws.Cell(row, 11).Value = c.Description;
                row++;
            }
            ws.Columns().AdjustToContents();
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"archives-juridiques-{DateTime.Now:yyyyMMddHHmm}.xlsx");
        }

        // ========== IMPORT ==========
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
    [FromQuery] string  colIdentifiant,
    [FromQuery] string? colCabinet,
    [FromQuery] string? colEmplacement,
    [FromQuery] string? colDateArchivage)   // ← new
{
    if (file == null || file.Length == 0) return BadRequest("Fichier requis.");
    if (string.IsNullOrWhiteSpace(colIdentifiant))
        return BadRequest("La colonne 'Identifiant' est obligatoire.");

    using var stream = file.OpenReadStream();
    using var workbook = new XLWorkbook(stream);
    var ws = workbook.Worksheet(1);
    var headers = ws.Row(1).Cells().Select(c => c.GetString().Trim()).ToList();

    int idxId   = headers.FindIndex(h => h == colIdentifiant);
    int idxCab  = string.IsNullOrWhiteSpace(colCabinet)       ? -1 : headers.FindIndex(h => h == colCabinet);
    int idxEmp  = string.IsNullOrWhiteSpace(colEmplacement)   ? -1 : headers.FindIndex(h => h == colEmplacement);
    int idxDate = string.IsNullOrWhiteSpace(colDateArchivage) ? -1 : headers.FindIndex(h => h == colDateArchivage);

    if (idxId == -1) return BadRequest("Colonne 'Identifiant' introuvable dans le fichier.");

    var rows       = ws.RowsUsed().Skip(1);
    int archived   = 0;
    var errors     = new List<string>();
    int lineNumber = 2;

    foreach (var row in rows)
    {
        var identifiant = row.Cell(idxId + 1).GetString().Trim();
        var cabinet     = idxCab  >= 0 ? row.Cell(idxCab  + 1).GetString().Trim() : null;
        var emplacement = idxEmp  >= 0 ? row.Cell(idxEmp  + 1).GetString().Trim() : null;

        // ── Parse date archivage ──────────────────────────────────────────────
        DateTime? dateArchivage = null;
        if (idxDate >= 0)
        {
            var cell = row.Cell(idxDate + 1);
            // ClosedXML may store it as a real date value or as a string
            if (cell.DataType == XLDataType.DateTime)
            {
                dateArchivage = cell.GetDateTime();
            }
            else
            {
                var raw = cell.GetString().Trim();
                if (DateTime.TryParseExact(raw,
                        new[] { "dd/MM/yyyy", "yyyy-MM-dd", "d/M/yyyy", "MM/dd/yyyy" },
                        System.Globalization.CultureInfo.InvariantCulture,
                        System.Globalization.DateTimeStyles.None, out var parsed))
                    dateArchivage = parsed;
                else if (!string.IsNullOrWhiteSpace(raw))
                    errors.Add($"Ligne {lineNumber}: format de date invalide '{raw}'.");
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        if (string.IsNullOrWhiteSpace(identifiant))
        {
            errors.Add($"Ligne {lineNumber}: Identifiant vide.");
            lineNumber++;
            continue;
        }

        // Try administrative entity first
        var entite = await _context.Entites
            .FirstOrDefaultAsync(e => e.IdBureauOrdre == identifiant && !e.EstArchive);

        // AFTER
        if (entite != null)
        {
            entite.EstArchive = true;
            entite.Etat       = "Archive";
            if (!string.IsNullOrWhiteSpace(cabinet))
                entite.Description = (string.IsNullOrWhiteSpace(entite.Description) ? "" : entite.Description + " | ")
                                    + $"الخزانة: {cabinet}";
            await _context.SaveChangesAsync();
            archived++;
        }
        else
        {
            var judicial = await _context.EntitesDJs
                .Include(e => e.NumeroDossier)
                .FirstOrDefaultAsync(e =>
                    (e.NumeroDossier != null &&
                     (e.NumeroDossier.Annee    + "/" +
                      e.NumeroDossier.Nombre   + "/" +
                      e.NumeroDossier.NumeroSujet.ToString()) == identifiant) ||
                    e.IdBureauOrdre == identifiant);

            if (judicial != null && !judicial.EstArchive)
            {
                judicial.EstArchive    = true;
                judicial.EtatArchive   = "Archive";
                judicial.Emplacement   = !string.IsNullOrWhiteSpace(emplacement) ? emplacement : "الحفظ";
                if (!string.IsNullOrWhiteSpace(cabinet))     judicial.Cabinet      = cabinet;
                if (dateArchivage.HasValue)                  judicial.DateArchivage = dateArchivage.Value;
                await _context.SaveChangesAsync();
                archived++;
            }
            else if (judicial != null && judicial.EstArchive)
                errors.Add($"Ligne {lineNumber}: Le dossier '{identifiant}' est déjà archivé.");
            else
                errors.Add($"Ligne {lineNumber}: Dossier '{identifiant}' introuvable.");
        }

        lineNumber++;
    }

    return Ok(new { archived, errors });
}

        // ========== PARENTS LIST ==========
        [HttpGet("parents")]
        public async Task<IActionResult> GetParents()
        {
            var parents = await _context.EntitesDJs
                .Where(e => !e.EstDocumentLie && e.NumeroDossier != null) // only main dossiers with judicial number
                .Select(e => new {
                    e.Id,
                    NumeroDossier = e.NumeroDossier != null
                        ? $"{e.NumeroDossier.Annee}/{e.NumeroDossier.Nombre}/{e.NumeroDossier.NumeroSujet}"
                        : null
                })
                .ToListAsync();

            var validParents = parents.Where(p => !string.IsNullOrWhiteSpace(p.NumeroDossier)).ToList();
            return Ok(validParents);
        }

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
            var query = BaseQuery();
            if (!string.IsNullOrWhiteSpace(motCle))
            {
                var keyword = motCle.Trim();
                query = query.Where(e =>
                    (e.IdBureauOrdre != null && e.IdBureauOrdre.Contains(keyword)) ||
                    (e.NumeroDossier != null && (e.NumeroDossier.Annee.ToString().Contains(keyword) || e.NumeroDossier.Nombre.ToString().Contains(keyword) || e.NumeroDossier.NumeroSujet.ToString().Contains(keyword))) ||
                    e.TribunalSource.Contains(keyword) || e.Sujet.Contains(keyword) || e.Destinataire.Contains(keyword) ||
                    e.Description.Contains(keyword) || e.Direction.Contains(keyword) || e.EtatArchive.Contains(keyword) ||
                    e.Emplacement.Contains(keyword) || (e.Cabinet != null && e.Cabinet.Contains(keyword)) ||
                    (e.NumeroPremiereInstance != null && e.NumeroPremiereInstance.Contains(keyword)));
            }
            var items = await query.OrderByDescending(e => e.DateArchivage).ThenByDescending(e => e.Id).ToListAsync();
            return Ok(items.Select(ToResponse));
        }

[HttpGet("template-excel")]
public IActionResult GetTemplateExcel()
{
    using var workbook = new XLWorkbook();
    var ws = workbook.Worksheets.Add("نموذج الاستيراد");

    // ── Headers ── (must match the column names shown in the mapping dropdown)
    var headers = new[]
    {
        "رقم الاستئنافي / رقم مكتب الضبط",  // colIdentifiant  (required)
        "تاريخ الأرشفة",                       // colDateArchivage (optional)
        "الخزانة",                              // colCabinet       (optional)
        "الموقع",                               // colEmplacement   (optional)
    };
    for (int i = 0; i < headers.Length; i++)
    {
        var cell = ws.Cell(1, i + 1);
        cell.Value = headers[i];
        cell.Style.Font.Bold = true;
        cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#D9E1F2");
    }

    // ── Example rows ──
    ws.Cell(2, 1).Value = "2026/15/3";
    ws.Cell(2, 2).Value = DateTime.Now.ToString("dd/MM/yyyy");
    ws.Cell(2, 3).Value = "خزانة أ";
    ws.Cell(2, 4).Value = "الحفظ";

    ws.Cell(3, 1).Value = "12/2026";
    ws.Cell(3, 2).Value = DateTime.Now.ToString("dd/MM/yyyy");
    ws.Cell(3, 3).Value = "خزانة ب";
    ws.Cell(3, 4).Value = "الدور الثاني";

    ws.Columns().AdjustToContents();

    // ── Instructions sheet ──
    var wsInfo = workbook.Worksheets.Add("تعليمات");
    wsInfo.Cell(1, 1).Value = "تعليمات الاستيراد";
    wsInfo.Cell(1, 1).Style.Font.Bold = true;
    wsInfo.Cell(2, 1).Value = "• العمود الأول (الهوية) إلزامي: ضع رقم الاستئنافي (مثال: 2026/15/3) أو رقم مكتب الضبط (مثال: 12/2026)";
    wsInfo.Cell(3, 1).Value = "• تاريخ الأرشفة: بصيغة dd/MM/yyyy مثال: 15/06/2026";
    wsInfo.Cell(4, 1).Value = "• الخزانة والموقع: اختياريان";
    wsInfo.Cell(5, 1).Value = "• الملفات غير الموجودة في النظام ستُبلَّغ كأخطاء";
    wsInfo.Column(1).AdjustToContents();

    using var stream = new MemoryStream();
    workbook.SaveAs(stream);
    return File(
        stream.ToArray(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "نموذج_استيراد_الأرشيف.xlsx");
}

        // ========== HELPERS ==========
        private IQueryable<EntiteDJ> BaseQuery() => _context.EntitesDJs.Include(e => e.Service).Include(e => e.NumeroDossier).Include(e => e.Retraits);

        private static object ToResponse(EntiteDJ e) => new
        {
            e.Id,
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
            cabinet = e.Cabinet,
            numeroPremiereInstance = e.NumeroPremiereInstance,
            estDocumentLie = e.EstDocumentLie,
            parentJudiciaireId = e.ParentJudiciaireId,
            numeroDossier = e.NumeroDossier != null ? $"{e.NumeroDossier.Annee}/{e.NumeroDossier.Nombre}/{e.NumeroDossier.NumeroSujet}" : null,
            retraitsCount = e.Retraits.Count,
            retraits = e.Retraits.OrderByDescending(r => r.DateDeRetrait).Select(r => new { r.Id, r.DateDeRetrait, r.MotifDeRetrait, r.EffectuePar, r.DateDeRetour, r.Notes })
        };

        private async Task<IActionResult?> ValidateRequest(CourrierJudiciaireRequest request, int? excludeId)
        {
            if (request.Date == default) return BadRequest("Date obligatoire.");
            if (string.IsNullOrWhiteSpace(request.TribunalSource) && !request.EstDocumentLie) return BadRequest("Tribunal / source obligatoire.");
            if (string.IsNullOrWhiteSpace(request.Sujet)) return BadRequest("Sujet obligatoire.");

            // 🔒 UNIQUENESS VALIDATION
            // 1. IdBureauOrdre (office register number) – must be unique across both administrative AND judicial
            if (!string.IsNullOrWhiteSpace(request.IdBureauOrdre))
            {
                var normalizedId = request.IdBureauOrdre.Trim();
                bool existsInAdmin = await _context.Entites.AnyAsync(e => e.IdBureauOrdre != null && e.IdBureauOrdre.Trim() == normalizedId && (!excludeId.HasValue || e.IdEntite != excludeId.Value));
                bool existsInJudicial = await _context.EntitesDJs.AnyAsync(e => e.IdBureauOrdre != null && e.IdBureauOrdre.Trim() == normalizedId && (!excludeId.HasValue || e.Id != excludeId.Value));
                if (existsInAdmin || existsInJudicial)
                    return BadRequest("رقم مكتب الضبط مستخدم بالفعل. يجب أن يكون فريداً.");
            }

            // 2. NumeroDossier (judicial appellate number) – unique across judicial documents
            if (TryParseNumeroDossierFlexible(request.NumeroDossier, out int annee, out int nombre, out int sujet))
            {
                bool exists = await _context.EntitesDJs.AnyAsync(e =>
                    e.NumeroDossier != null && e.NumeroDossier.Annee == annee && e.NumeroDossier.Nombre == nombre && e.NumeroDossier.NumeroSujet == sujet &&
                    (!excludeId.HasValue || e.Id != excludeId.Value));
                if (exists)
                    return BadRequest("رقم الاستئنافي للملف مستخدم بالفعل. يجب أن يكون فريداً.");
            }
            else if (!string.IsNullOrWhiteSpace(request.NumeroDossier))
            {
                return BadRequest("تنسيق رقم الاستئنافي غير صحيح. يجب أن يكون بالصيغة: السنة/العدد/الرقم (مثال: 2026/15/3)");
            }

            // 3. NumeroPremiereInstance – unique across judicial documents
            if (!string.IsNullOrWhiteSpace(request.NumeroPremiereInstance))
            {
                bool exists = await _context.EntitesDJs.AnyAsync(e => e.NumeroPremiereInstance != null && e.NumeroPremiereInstance.Trim() == request.NumeroPremiereInstance.Trim() && (!excludeId.HasValue || e.Id != excludeId.Value));
                if (exists)
                    return BadRequest("الرقم الابتدائي مستخدم بالفعل. يجب أن يكون فريداً.");
            }

            if (request.IdService <= 0) return BadRequest("Service obligatoire.");
            if (!await _context.Services.AnyAsync(s => s.IdService == request.IdService)) return BadRequest("Service inexistant.");
            if (request.EstDocumentLie && (!request.ParentJudiciaireId.HasValue || request.ParentJudiciaireId.Value <= 0))
                return BadRequest("Veuillez choisir un dossier parent pour la وثيقة مربوطة.");
            return null;
        }

        private void ApplyNumeroDossier(EntiteDJ item, CourrierJudiciaireRequest request)
        {
            if (TryParseNumeroDossierFlexible(request.NumeroDossier, out var a, out var b, out var c))
            {
                if (item.NumeroDossier == null) item.NumeroDossier = new NumeroDossierJuridique();
                item.NumeroDossier.Annee = a;
                item.NumeroDossier.Nombre = b;
                item.NumeroDossier.NumeroSujet = c;
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
        private async Task<int> GetArchivesServiceId()
        {
            var archivesService = await _context.Services
                .FirstOrDefaultAsync(s => s.NomService == "الحفظ" || s.NomService == "Archives");
            if (archivesService == null)
                throw new InvalidOperationException("Service 'الحفظ' not found. Please create it first.");
            return archivesService.IdService;
        }
        private static string NormalizeEtat(string? e) => e switch { "En cours" => "En cours", "Traite" => "Traite", "Archive" => "Archive", _ => "Nouveau" };
        private static string ToArabicEtat(string? e) => e switch { "En cours" => "قيد المعالجة", "Traite" => "تمت المعالجة", "Archive" => "مؤرشف", _ => "جديد" };
    }

    // DTOs
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
        public string? NumeroDossier { get; set; }          // الرقم الاستئنافي
        public string? Cabinet { get; set; }
        public string? NumeroPremiereInstance { get; set; }  // الرقم الابتدائي
        public bool EstDocumentLie { get; set; } = false;
        public int? ParentJudiciaireId { get; set; }
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