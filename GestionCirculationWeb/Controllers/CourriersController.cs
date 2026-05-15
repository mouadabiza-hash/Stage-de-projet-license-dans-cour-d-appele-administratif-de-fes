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
    public class CourriersController : ControllerBase
    {
        private const string TypeDocumentAdministratif = "Administratif";
        private const string TypeRegistreWaridat = "Waridat";
        private const string TypeRegistreMorasalat = "Morasalat";
        private const string TypeCorrespondanceSortante = "Sortante";
        private const string TypeCorrespondanceEntrante = "Entrante";

        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;

        public CourriersController(ApplicationDbContext context, IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
        }

        // ========== LISTE UNIFIÉE (administratif + judiciaire) ==========
        [HttpGet]
        public async Task<IActionResult> GetAll(string? numeroBureauOrdre, DateTime? date, string? type)
        {
            var query = GetUnifiedQuery().Where(e => e.ParentId == null);
            query = ApplyStructuredFilters(query, numeroBureauOrdre, date, type);
            var courriers = await query
                .OrderByDescending(e => e.DateCreation)
                .ThenByDescending(e => e.Id)
                .ToListAsync();
            return Ok(courriers.Select(ToUnifiedResponse));
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var admin = await BaseQuery().FirstOrDefaultAsync(e => e.IdEntite == id);
            if (admin != null) return Ok(ToResponse(admin));

            var judicial = await _context.EntitesDJs.Include(e => e.Service).FirstOrDefaultAsync(e => e.Id == id);
            if (judicial == null) return NotFound("Courrier introuvable");
            return Ok(ToJudicialResponse(judicial));
        }

        [HttpGet("waridat")]
        public async Task<IActionResult> GetWaridat()
        {
            var waridat = await BaseQuery()
                .Where(e => !e.EstArchive && e.ParentId == null &&
                    (e.TypeRegistre == TypeRegistreWaridat || e.TypeRegistre == null || e.TypeRegistre == string.Empty))
                .OrderByDescending(e => e.DateCreation)
                .ThenByDescending(e => e.IdEntite)
                .ToListAsync();
            return Ok(waridat.Select(ToResponse));
        }

        // ========== CRUD administratif ==========
        [HttpPost]
        public async Task<IActionResult> Create(CourrierAdministratifRequest request)
        {
            var validation = await ValidateRequest(request);
            if (validation != null) return validation;

            try
            {
                var (idBureauOrdre, parentId, direction, typeCorrespondance) = await ProcessRegistrationLogic(request, null);
                var courrier = new Entite
                {
                    IdBureauOrdre = idBureauOrdre,
                    DateCreation = request.Date,
                    Source = request.Source.Trim(),
                    Sujet = request.Sujet.Trim(),
                    Destinataire = request.Destinataire?.Trim() ?? string.Empty,
                    Description = request.Description?.Trim() ?? string.Empty,
                    Etat = NormalizeEtat(request.Etat),
                    LienPdf = request.LienPdf?.Trim() ?? string.Empty,
                    Direction = direction,
                    TypeDocument = TypeDocumentAdministratif,
                    TypeGenerale = GetTypeGenerale(direction),
                    NumeroDeCourrier = request.NumeroDeCourrier?.Trim() ?? string.Empty,
                    IdService = request.IdService,
                    EstArchive = false,
                    EstTransmissible = request.EstTransmissible,
                    ParentId = parentId,
                    TypeRegistre = NormalizeTypeRegistre(request.TypeRegistre),
                    TypeCorrespondance = typeCorrespondance
                };
                _context.Entites.Add(courrier);
                await _context.SaveChangesAsync();

                var created = await BaseQuery().FirstAsync(e => e.IdEntite == courrier.IdEntite);
                return CreatedAtAction(nameof(GetById), new { id = courrier.IdEntite }, ToResponse(created));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, CourrierAdministratifRequest request)
        {
            var courrier = await _context.Entites.FirstOrDefaultAsync(e => e.IdEntite == id && e.TypeDocument == TypeDocumentAdministratif);
            if (courrier == null) return NotFound("Courrier introuvable");

            var validation = await ValidateRequest(request);
            if (validation != null) return validation;

            try
            {
                var oldIdBureauOrdre = courrier.IdBureauOrdre;
                var (idBureauOrdre, parentId, direction, typeCorrespondance) = await ProcessRegistrationLogic(request, id);

                courrier.IdBureauOrdre = idBureauOrdre;
                courrier.DateCreation = request.Date;
                courrier.Source = request.Source.Trim();
                courrier.Sujet = request.Sujet.Trim();
                courrier.Destinataire = request.Destinataire?.Trim() ?? string.Empty;
                courrier.Description = request.Description?.Trim() ?? string.Empty;
                courrier.Etat = NormalizeEtat(request.Etat);
                courrier.LienPdf = request.LienPdf?.Trim() ?? string.Empty;
                courrier.Direction = direction;
                courrier.TypeGenerale = GetTypeGenerale(direction);
                courrier.NumeroDeCourrier = request.NumeroDeCourrier?.Trim() ?? string.Empty;
                courrier.IdService = request.IdService;
                courrier.EstTransmissible = request.EstTransmissible;
                courrier.ParentId = parentId;
                courrier.TypeRegistre = NormalizeTypeRegistre(request.TypeRegistre);
                courrier.TypeCorrespondance = typeCorrespondance;

                if (courrier.TypeRegistre == TypeRegistreWaridat && oldIdBureauOrdre != idBureauOrdre)
                {
                    var children = await _context.Entites
                        .Where(e => e.ParentId == id && e.TypeDocument == TypeDocumentAdministratif)
                        .ToListAsync();
                    foreach (var child in children) child.IdBureauOrdre = idBureauOrdre;
                }

                await _context.SaveChangesAsync();
                var updated = await BaseQuery().FirstAsync(e => e.IdEntite == id);
                return Ok(ToResponse(updated));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var courrier = await _context.Entites.FirstOrDefaultAsync(e => e.IdEntite == id && e.TypeDocument == TypeDocumentAdministratif);
            if (courrier == null) return NotFound("Courrier introuvable");
            _context.Entites.Remove(courrier);
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpPut("archiver/{id:int}")]
        public async Task<IActionResult> Archiver(int id)
        {
            var courrier = await _context.Entites.FirstOrDefaultAsync(e => e.IdEntite == id && e.TypeDocument == TypeDocumentAdministratif);
            if (courrier == null) return NotFound("Courrier introuvable");
            courrier.EstArchive = true;
            courrier.Etat = "Archive";
            await _context.SaveChangesAsync();
            return Ok(ToResponse(courrier));
        }

        [HttpPost("upload-document")]
        public async Task<IActionResult> UploadDocument([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier requis.");
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
            await using (var stream = System.IO.File.Create(filePath)) await file.CopyToAsync(stream);
            return Ok(new { lienPdf = $"/uploads/documents/{fileName}" });
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search(string? motCle, string? numeroBureauOrdre, DateTime? date, string? type)
        {
            var query = GetUnifiedQuery().Where(e => e.ParentId == null);
            query = ApplyStructuredFilters(query, numeroBureauOrdre, date, type);
            if (!string.IsNullOrWhiteSpace(motCle))
            {
                var keyword = motCle.Trim();
                query = query.Where(e =>
                    (e.IdBureauOrdre != null && e.IdBureauOrdre.StartsWith(keyword)) ||
                    e.Source.StartsWith(keyword) || e.Sujet.StartsWith(keyword) ||
                    e.Destinataire.StartsWith(keyword) || e.Description.StartsWith(keyword) ||
                    e.Etat.StartsWith(keyword));
            }
            var results = await query.OrderByDescending(e => e.DateCreation).ThenByDescending(e => e.Id).ToListAsync();
            return Ok(results.Select(ToUnifiedResponse));
        }

        [HttpGet("export/excel")]
        public async Task<IActionResult> ExportExcel(string? motCle, string? numeroBureauOrdre, DateTime? date, string? type)
        {
            var query = GetUnifiedQuery().Where(e => e.ParentId == null);
            query = ApplyStructuredFilters(query, numeroBureauOrdre, date, type);
            if (!string.IsNullOrWhiteSpace(motCle))
            {
                var keyword = motCle.Trim();
                query = query.Where(e =>
                    (e.IdBureauOrdre != null && e.IdBureauOrdre.StartsWith(keyword)) ||
                    e.Source.StartsWith(keyword) || e.Sujet.StartsWith(keyword) ||
                    e.Destinataire.StartsWith(keyword) || e.Description.StartsWith(keyword) ||
                    e.Etat.StartsWith(keyword));
            }
            var courriers = await query.OrderByDescending(e => e.DateCreation).ThenByDescending(e => e.Id).ToListAsync();

            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Courriers");
            string[] headers = {
                "رقم مكتب الضبط", "تاريخ الواردة / المراسلة", "مصدر الواردة", "موضوع الواردة",
                "المرسل إليه / المحال عليه", "المراسلات الصادرة", "المراسلات الواردة", "المصلحة",
                "الحالة", "الرقم الداخلي", "رابط PDF", "الملاحظات / النتيجة"
            };
            for (int i = 0; i < headers.Length; i++)
                ws.Cell(1, i + 1).Value = headers[i];

            int row = 2;
            foreach (var c in courriers)
            {
                ws.Cell(row, 1).Value = c.IdBureauOrdre;
                ws.Cell(row, 2).Value = c.DateCreation;
                ws.Cell(row, 2).Style.DateFormat.Format = "dd/MM/yyyy";
                ws.Cell(row, 3).Value = c.IsJudicial ? c.Source : (c.TypeRegistre == TypeRegistreMorasalat ? string.Empty : c.Source);
                ws.Cell(row, 4).Value = c.IsJudicial ? c.Sujet : (c.TypeRegistre == TypeRegistreMorasalat ? string.Empty : c.Sujet);
                ws.Cell(row, 5).Value = c.IsJudicial ? c.Destinataire : (c.TypeRegistre == TypeRegistreMorasalat ? string.Empty : c.Destinataire);
                ws.Cell(row, 6).Value = (c.TypeRegistre == TypeRegistreMorasalat && (c.TypeCorrespondance == TypeCorrespondanceSortante || c.Direction == "Sortant")) ? FormatCorrespondanceFromUnified(c) : "";
                ws.Cell(row, 7).Value = (c.TypeRegistre == TypeRegistreMorasalat && (c.TypeCorrespondance == TypeCorrespondanceEntrante || c.Direction == "Interne")) ? FormatCorrespondanceFromUnified(c) : "";
                ws.Cell(row, 8).Value = c.ServiceNom;
                ws.Cell(row, 9).Value = ToArabicEtat(c.Etat);
                ws.Cell(row, 10).Value = c.NumeroDeCourrier;
                ws.Cell(row, 11).Value = c.LienPdf;
                ws.Cell(row, 12).Value = c.Description;
                row++;
            }
            ws.Row(1).Style.Font.Bold = true;
            ws.Row(1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            ws.SheetView.FreezeRows(1);
            ws.Columns(1, headers.Length).Width = 24;
            ws.Column(6).Width = 45;
            ws.Column(7).Width = 45;
            ws.Column(12).Width = 40;

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "courriers-administratifs.xlsx");
        }

        [HttpPost("import/excel")]
        public async Task<IActionResult> ImportExcel(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Fichier Excel requis.");

            var userName = User.Identity?.Name;
            var currentUser = await _context.Utilisateurs
                .Include(u => u.Service)
                .FirstOrDefaultAsync(u => u.Login == userName);
            if (currentUser == null) return Unauthorized();
            int defaultServiceId = currentUser.IdService;

            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            stream.Position = 0;

            using var workbook = new XLWorkbook(stream);
            var ws = workbook.Worksheet(1);
            var rows = ws.RowsUsed().Skip(1);
            int imported = 0;
            var errors = new List<string>();
            int lineNumber = 2;
            var seenIdBureauOrdre = new HashSet<string>();

            foreach (var row in rows)
            {
                var idBureauOrdre = row.Cell(1).GetString().Trim();
                var dateText = row.Cell(2).GetString().Trim();
                var source = row.Cell(3).GetString().Trim();
                var sujet = row.Cell(4).GetString().Trim();
                var destinataire = row.Cell(5).GetString().Trim();
                var correspondanceSortante = row.Cell(6).GetString().Trim();
                var correspondanceEntrante = row.Cell(7).GetString().Trim();
                var etatText = row.Cell(9).GetString().Trim();
                var numeroText = row.Cell(10).GetString().Trim();
                var lienPdf = row.Cell(11).GetString().Trim();
                var description = row.Cell(12).GetString().Trim();

                var hasWaridatFields = !string.IsNullOrWhiteSpace(source) || !string.IsNullOrWhiteSpace(sujet);
                var hasSortante = !string.IsNullOrWhiteSpace(correspondanceSortante);
                var hasEntrante = !string.IsNullOrWhiteSpace(correspondanceEntrante);
                var typeRegistre = hasWaridatFields ? TypeRegistreWaridat : TypeRegistreMorasalat;
                var typeCorrespondance = hasSortante ? TypeCorrespondanceSortante : (hasEntrante ? TypeCorrespondanceEntrante : (string?)null);
                var direction = typeRegistre == TypeRegistreWaridat
                    ? "Entrant"
                    : typeCorrespondance == TypeCorrespondanceSortante ? "Sortant" : "Interne";

                if (!hasWaridatFields)
                {
                    source = hasEntrante ? "Import Excel" : source;
                    sujet = hasSortante ? correspondanceSortante : correspondanceEntrante;
                }

                var lineErrors = new List<string>();

                if (string.IsNullOrWhiteSpace(idBureauOrdre))
                    lineErrors.Add("Numero bureau d'ordre obligatoire");
                else if (seenIdBureauOrdre.Contains(idBureauOrdre))
                    lineErrors.Add($"Numero bureau d'ordre '{idBureauOrdre}' dupliqué dans le fichier");
                else if (await ExistsIdBureauOrdre(idBureauOrdre))
                    lineErrors.Add($"Numero bureau d'ordre '{idBureauOrdre}' existe déjà dans la base");
                else
                    seenIdBureauOrdre.Add(idBureauOrdre);

                if (!TryReadDate(row.Cell(2), dateText, out var dateValue))
                    lineErrors.Add("Date non valide");
                if (string.IsNullOrWhiteSpace(source))
                    lineErrors.Add("Source obligatoire");
                if (string.IsNullOrWhiteSpace(sujet))
                    lineErrors.Add("Sujet obligatoire");

                if (lineErrors.Any())
                {
                    errors.Add($"Ligne {lineNumber}: {string.Join(" | ", lineErrors)}");
                }
                else
                {
                    _context.Entites.Add(new Entite
                    {
                        IdBureauOrdre = idBureauOrdre,
                        DateCreation = dateValue,
                        Direction = direction,
                        TypeGenerale = GetTypeGenerale(direction),
                        Source = source,
                        Sujet = sujet,
                        Destinataire = destinataire,
                        IdService = defaultServiceId,
                        Etat = NormalizeEtat(FromArabicEtat(etatText)),
                        NumeroDeCourrier = numeroText,
                        LienPdf = lienPdf,
                        Description = description,
                        TypeDocument = TypeDocumentAdministratif,
                        TypeRegistre = typeRegistre,
                        TypeCorrespondance = typeCorrespondance,
                        ParentId = null,
                        EstArchive = false,
                        EstTransmissible = false
                    });
                    imported++;
                }
                lineNumber++;
            }
            await _context.SaveChangesAsync();
            return Ok(new { imported, errors });
        }

        [HttpGet("template-excel")]
        public IActionResult GetTemplateExcel()
        {
            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Template");
            var headers = new[] { "رقم مكتب الضبط", "التاريخ", "المصدر", "الموضوع", "المرسل إليه", "المراسلات الصادرة", "المراسلات الواردة", "المصلحة", "الحالة", "الرقم الداخلي", "رابط PDF", "الملاحظات / النتيجة" };
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
            }
            ws.Cell(2, 1).Value = "12/2026";
            ws.Cell(2, 2).Value = "01/01/2026";
            ws.Cell(2, 3).Value = "Ministère X";
            ws.Cell(2, 4).Value = "Objet du courrier";
            ws.Cell(2, 8).Value = "خلية المعلوميات";
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "modele_import_courriers.xlsx");
        }

        // ========== MÉTHODES PRIVÉES ==========
        private IQueryable<UnifiedCourrier> GetUnifiedQuery()
        {
            var administratifs = _context.Entites
                .Include(e => e.Service)
                .Where(e => e.TypeDocument == TypeDocumentAdministratif)
                .Select(e => new UnifiedCourrier
                {
                    Id = e.IdEntite,
                    IsJudicial = false,
                    IdBureauOrdre = e.IdBureauOrdre,
                    DateCreation = e.DateCreation,
                    Source = e.Source,
                    Sujet = e.Sujet,
                    Destinataire = e.Destinataire,
                    Description = e.Description,
                    Etat = e.Etat,
                    LienPdf = e.LienPdf,
                    Direction = e.Direction,
                    TypeRegistre = string.IsNullOrWhiteSpace(e.TypeRegistre) ? (e.ParentId.HasValue ? TypeRegistreMorasalat : TypeRegistreWaridat) : e.TypeRegistre,
                    TypeCorrespondance = e.TypeCorrespondance,
                    ParentId = e.ParentId,
                    NumeroDeCourrier = e.NumeroDeCourrier,
                    EstTransmissible = e.EstTransmissible,
                    IdService = e.IdService,
                    ServiceNom = e.Service != null ? e.Service.NomService : null,
                    EstArchive = e.EstArchive
                });

            var judiciaires = _context.EntitesDJs
                .Include(e => e.Service)
                .Select(e => new UnifiedCourrier
                {
                    Id = e.Id,
                    IsJudicial = true,
                    IdBureauOrdre = e.IdBureauOrdre,
                    DateCreation = e.DateArchivage,
                    Source = e.TribunalSource,
                    Sujet = e.Sujet,
                    Destinataire = e.Destinataire,
                    Description = e.Description,
                    Etat = e.EtatArchive,
                    LienPdf = e.LienPdf,
                    Direction = "Entrant",
                    TypeRegistre = TypeRegistreWaridat,
                    TypeCorrespondance = null,
                    ParentId = null,
                    NumeroDeCourrier = "",
                    EstTransmissible = e.EstTransmissible,
                    IdService = e.IdService,
                    ServiceNom = e.Service != null ? e.Service.NomService : null,
                    EstArchive = e.EstArchive
                });

            return administratifs.Concat(judiciaires);
        }

        private static object ToUnifiedResponse(UnifiedCourrier u)
        {
            return new
            {
                id = u.Id,
                idBureauOrdre = u.IdBureauOrdre,
                date = u.DateCreation,
                sujet = u.Sujet,
                source = u.Source,
                destinataire = u.Destinataire,
                description = u.Description,
                etat = u.Etat,
                lienPdf = u.LienPdf,
                direction = u.Direction,
                typeRegistre = u.TypeRegistre,
                typeCorrespondance = u.TypeCorrespondance,
                parentId = u.ParentId,
                typeDocument = u.IsJudicial ? "Judiciaire" : "Administratif",
                typeGenerale = u.Direction == "Sortant" ? TypeEntite.CourrierSortant : (u.Direction == "Interne" ? TypeEntite.Interne : TypeEntite.CourrierEntrant),
                numeroDeCourrier = u.NumeroDeCourrier,
                estTransmissible = u.EstTransmissible,
                idService = u.IdService,
                serviceNom = u.ServiceNom
            };
        }

        private IQueryable<Entite> BaseQuery() => _context.Entites.Include(e => e.Service).Where(e => e.TypeDocument == TypeDocumentAdministratif);

        private static object ToResponse(Entite e) => new
        {
            id = e.IdEntite,
            idBureauOrdre = e.IdBureauOrdre,
            date = e.DateCreation,
            sujet = e.Sujet,
            source = e.Source,
            destinataire = e.Destinataire,
            description = e.Description,
            etat = e.Etat,
            lienPdf = e.LienPdf,
            direction = e.Direction,
            typeRegistre = string.IsNullOrWhiteSpace(e.TypeRegistre) ? (e.ParentId.HasValue ? TypeRegistreMorasalat : TypeRegistreWaridat) : e.TypeRegistre,
            typeCorrespondance = e.TypeCorrespondance,
            parentId = e.ParentId,
            typeDocument = e.TypeDocument,
            typeGenerale = e.TypeGenerale,
            numeroDeCourrier = e.NumeroDeCourrier,
            estTransmissible = e.EstTransmissible,
            idService = e.IdService,
            serviceNom = e.Service?.NomService
        };

        private static object ToJudicialResponse(EntiteDJ e) => new
        {
            id = e.Id,
            idBureauOrdre = e.IdBureauOrdre,
            date = e.DateArchivage,
            sujet = e.Sujet,
            source = e.TribunalSource,
            destinataire = e.Destinataire,
            description = e.Description,
            etat = e.EtatArchive,
            lienPdf = e.LienPdf,
            direction = "Entrant",
            typeRegistre = TypeRegistreWaridat,
            typeCorrespondance = (string?)null,
            parentId = (int?)null,
            typeDocument = "Judiciaire",
            typeGenerale = TypeEntite.CourrierEntrant,
            numeroDeCourrier = "",
            estTransmissible = e.EstTransmissible,
            idService = e.IdService,
            serviceNom = e.Service?.NomService
        };

        private async Task<(string idBureauOrdre, int? parentId, string direction, string? typeCorrespondance)> ProcessRegistrationLogic(CourrierAdministratifRequest request, int? excludeId)
        {
            var typeRegistre = NormalizeTypeRegistre(request.TypeRegistre);
            var typeCorrespondance = NormalizeTypeCorrespondance(request.TypeCorrespondance, request.Direction);
            var direction = NormalizeDirection(request.Direction);
            var idBureauOrdre = request.IdBureauOrdre!.Trim();

            if (await ExistsIdBureauOrdre(idBureauOrdre, excludeId))
                throw new InvalidOperationException("Ce numero bureau d'ordre existe deja dans le registre administratif.");

            if (!await IsIdBureauOrdreUniqueWithJudicial(idBureauOrdre, excludeId))
                throw new InvalidOperationException("Ce numero bureau d'ordre est déjà utilisé dans un dossier judiciaire.");

            if (typeRegistre == TypeRegistreMorasalat && request.ParentId.HasValue && request.ParentId.Value > 0)
            {
                var parent = await FindWaridatParent(request.ParentId.Value);
                if (parent == null) throw new InvalidOperationException("Waridat parent introuvable.");
                if (string.IsNullOrWhiteSpace(parent.IdBureauOrdre)) throw new InvalidOperationException("La waridat parent n'a pas de numero bureau d'ordre.");
                return (parent.IdBureauOrdre, parent.IdEntite, typeCorrespondance == TypeCorrespondanceSortante ? "Sortant" : "Interne", typeCorrespondance);
            }

            return (idBureauOrdre, null, typeRegistre == TypeRegistreWaridat ? "Entrant" : (typeCorrespondance == TypeCorrespondanceSortante ? "Sortant" : "Interne"), typeCorrespondance);
        }

        private async Task<bool> IsIdBureauOrdreUniqueWithJudicial(string idBureauOrdre, int? excludeId = null)
        {
            if (string.IsNullOrWhiteSpace(idBureauOrdre)) return true;
            var normalized = idBureauOrdre.Trim();
            var conflict = await _context.EntitesDJs.AnyAsync(e =>
                (e.NumeroDossier != null &&
                    (e.NumeroDossier.Annee.ToString() + "/" + e.NumeroDossier.Nombre.ToString() + "/" + e.NumeroDossier.NumeroSujet.ToString()) == normalized) ||
                (e.IdBureauOrdre != null && e.IdBureauOrdre.Trim() == normalized));
            return !conflict;
        }

        private async Task<bool> ExistsIdBureauOrdre(string idBureauOrdre, int? excludedId = null)
        {
            var normalized = idBureauOrdre.Trim();
            return await _context.Entites.AnyAsync(e =>
                e.TypeDocument == TypeDocumentAdministratif && e.ParentId == null &&
                e.IdBureauOrdre != null && e.IdBureauOrdre.Trim() == normalized &&
                (!excludedId.HasValue || e.IdEntite != excludedId.Value));
        }

        private async Task<Entite?> FindWaridatParent(int parentId) =>
            await _context.Entites.FirstOrDefaultAsync(e =>
                e.IdEntite == parentId && e.TypeDocument == TypeDocumentAdministratif &&
                (e.TypeRegistre == TypeRegistreWaridat || e.TypeRegistre == null || e.TypeRegistre == string.Empty) &&
                e.ParentId == null);

        private async Task<IActionResult?> ValidateRequest(CourrierAdministratifRequest request)
        {
            var typeRegistre = NormalizeTypeRegistre(request.TypeRegistre);
            if (typeRegistre == TypeRegistreWaridat && string.IsNullOrWhiteSpace(request.IdBureauOrdre))
                return BadRequest("Numero bureau d'ordre obligatoire.");
            if (typeRegistre == TypeRegistreMorasalat && (!request.ParentId.HasValue || request.ParentId.Value <= 0) && string.IsNullOrWhiteSpace(request.IdBureauOrdre))
                return BadRequest("Numero bureau d'ordre obligatoire pour une morasalat independante.");
            if (request.Date == default) return BadRequest("Date obligatoire.");
            if (string.IsNullOrWhiteSpace(request.Source)) return BadRequest("Source obligatoire.");
            if (string.IsNullOrWhiteSpace(request.Sujet)) return BadRequest("Sujet obligatoire.");
            if (request.IdService <= 0) return BadRequest("Service obligatoire.");
            if (!await _context.Services.AnyAsync(s => s.IdService == request.IdService)) return BadRequest("Service inexistant.");
            return null;
        }

        private static IQueryable<UnifiedCourrier> ApplyStructuredFilters(IQueryable<UnifiedCourrier> query, string? numeroBureauOrdre, DateTime? date, string? type)
        {
            if (!string.IsNullOrWhiteSpace(numeroBureauOrdre))
                query = query.Where(e => e.IdBureauOrdre != null && e.IdBureauOrdre.StartsWith(numeroBureauOrdre.Trim()));
            if (date.HasValue)
                query = query.Where(e => e.DateCreation.Date == date.Value.Date);
            if (!string.IsNullOrWhiteSpace(type))
            {
                var normalized = type.Trim();
                if (normalized.Equals(TypeRegistreWaridat, StringComparison.OrdinalIgnoreCase))
                    query = query.Where(e => e.TypeRegistre == TypeRegistreWaridat);
                else if (normalized.Equals(TypeRegistreMorasalat, StringComparison.OrdinalIgnoreCase))
                    query = query.Where(e => e.TypeRegistre == TypeRegistreMorasalat || e.ParentId != null);
                else if (normalized.Equals(TypeCorrespondanceSortante, StringComparison.OrdinalIgnoreCase))
                    query = query.Where(e => e.TypeCorrespondance == TypeCorrespondanceSortante || e.Direction == "Sortant");
                else if (normalized.Equals(TypeCorrespondanceEntrante, StringComparison.OrdinalIgnoreCase))
                    query = query.Where(e => e.TypeCorrespondance == TypeCorrespondanceEntrante || e.Direction == "Interne");
                else
                    query = query.Where(e => e.Direction == NormalizeDirection(type));
            }
            return query;
        }

        private static bool TryReadDate(IXLCell cell, string text, out DateTime value)
        {
            if (cell.DataType == XLDataType.DateTime) { value = cell.GetDateTime(); return true; }
            return DateTime.TryParse(text, out value);
        }

        private static string NormalizeDirection(string? direction) =>
            direction?.Equals("Sortant", StringComparison.OrdinalIgnoreCase) == true ? "Sortant" :
            direction?.Equals("Interne", StringComparison.OrdinalIgnoreCase) == true ? "Interne" : "Entrant";

        private static string NormalizeTypeRegistre(string? typeRegistre) =>
            typeRegistre?.Equals(TypeRegistreMorasalat, StringComparison.OrdinalIgnoreCase) == true ? TypeRegistreMorasalat : TypeRegistreWaridat;

        private static string? NormalizeTypeCorrespondance(string? typeCorrespondance, string? direction) =>
            typeCorrespondance?.Equals(TypeCorrespondanceEntrante, StringComparison.OrdinalIgnoreCase) == true ? TypeCorrespondanceEntrante :
            typeCorrespondance?.Equals(TypeCorrespondanceSortante, StringComparison.OrdinalIgnoreCase) == true ? TypeCorrespondanceSortante :
            direction?.Equals("Interne", StringComparison.OrdinalIgnoreCase) == true ? TypeCorrespondanceEntrante : TypeCorrespondanceSortante;

        private static string NormalizeEtat(string? etat) =>
            etat?.Equals("En cours", StringComparison.OrdinalIgnoreCase) == true ? "En cours" :
            (etat?.Equals("Traite", StringComparison.OrdinalIgnoreCase) == true || etat?.Equals("Traité", StringComparison.OrdinalIgnoreCase) == true) ? "Traite" :
            (etat?.Equals("Archive", StringComparison.OrdinalIgnoreCase) == true || etat?.Equals("Archivé", StringComparison.OrdinalIgnoreCase) == true) ? "Archive" : "Nouveau";

        private static string FromArabicEtat(string? etat) =>
            etat switch
            {
                "جديد" => "Nouveau",
                "قيد المعالجة" => "En cours",
                "تمت المعالجة" => "Traite",
                "مؤرشف" => "Archive",
                _ => etat ?? string.Empty
            };

        private static string ToArabicEtat(string? etat) =>
            etat switch
            {
                "En cours" => "قيد المعالجة",
                "Traite" => "تمت المعالجة",
                "Archive" => "مؤرشف",
                _ => "جديد"
            };

        private static TypeEntite GetTypeGenerale(string direction) =>
            direction == "Sortant" ? TypeEntite.CourrierSortant : direction == "Interne" ? TypeEntite.Interne : TypeEntite.CourrierEntrant;

        private static string FormatCorrespondanceFromUnified(UnifiedCourrier c)
        {
            var parts = new List<string>();
            if (c.DateCreation != default) parts.Add(c.DateCreation.ToString("dd/MM/yyyy"));
            if (!string.IsNullOrWhiteSpace(c.Source)) parts.Add($"المصدر: {c.Source}");
            if (!string.IsNullOrWhiteSpace(c.Destinataire)) parts.Add($"المرسل إليه: {c.Destinataire}");
            if (!string.IsNullOrWhiteSpace(c.Sujet)) parts.Add($"الموضوع/الجواب: {c.Sujet}");
            if (!string.IsNullOrWhiteSpace(c.Description)) parts.Add($"النتيجة: {c.Description}");
            return string.Join(" | ", parts);
        }
    }

    public class UnifiedCourrier
    {
        public int Id { get; set; }
        public bool IsJudicial { get; set; }
        public string? IdBureauOrdre { get; set; }
        public DateTime DateCreation { get; set; }
        public string Source { get; set; } = string.Empty;
        public string Sujet { get; set; } = string.Empty;
        public string Destinataire { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Etat { get; set; } = string.Empty;
        public string LienPdf { get; set; } = string.Empty;
        public string Direction { get; set; } = string.Empty;
        public string TypeRegistre { get; set; } = string.Empty;
        public string? TypeCorrespondance { get; set; }
        public int? ParentId { get; set; }
        public string NumeroDeCourrier { get; set; } = string.Empty;
        public bool EstTransmissible { get; set; }
        public int IdService { get; set; }
        public string? ServiceNom { get; set; }
        public bool EstArchive { get; set; }
    }

    public class CourrierAdministratifRequest
    {
        public string? IdBureauOrdre { get; set; }
        public DateTime Date { get; set; }
        public string Source { get; set; } = string.Empty;
        public string Sujet { get; set; } = string.Empty;
        public string? Destinataire { get; set; }
        public string? Description { get; set; }
        public string? Etat { get; set; }
        public string? LienPdf { get; set; }
        public string? Direction { get; set; }
        public string? TypeRegistre { get; set; }
        public string? TypeCorrespondance { get; set; }
        public int? ParentId { get; set; }
        public int IdService { get; set; }
        public string? NumeroDeCourrier { get; set; }
        public bool EstTransmissible { get; set; }
    }
}