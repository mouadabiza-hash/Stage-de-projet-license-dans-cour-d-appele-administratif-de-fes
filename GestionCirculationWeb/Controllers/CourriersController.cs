using System.Security.Claims;
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

        // ========== UNIFIED LIST ==========
        [HttpGet]
        public async Task<IActionResult> GetAll(string? numeroBureauOrdre, DateTime? date, string? type)
        {
            var query = GetUnifiedQuery();
            query = ApplyStructuredFilters(query, numeroBureauOrdre, date, type);
            var courriers = await query.OrderByDescending(e => e.DateCreation).ThenByDescending(e => e.Id).ToListAsync();
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

        // ========== CREATE ==========
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
                    Source = request.Source?.Trim() ?? string.Empty,
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
            
            int archivesServiceId = await GetArchivesServiceId();
            courrier.IdService = archivesServiceId;
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

        // ========== SEARCH ==========
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

        // ========== EXPORT ==========
private static void ApplyHeaderStructure(IXLWorksheet ws)
{
    var grayFill  = XLColor.FromArgb(165, 165, 165);
    var lightGray = XLColor.FromArgb(242, 242, 242);
    var whiteFont = XLColor.White;
    var blackFont = XLColor.Black;

    void ApplyMainHeader(IXLRange range, string value)
    {
        range.Merge();
        range.Value = value;
        range.Style.Font.Bold = true;
        range.Style.Font.FontColor = whiteFont;
        range.Style.Fill.BackgroundColor = grayFill;
        range.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        range.Style.Alignment.Vertical   = XLAlignmentVerticalValues.Center;
        range.Style.Alignment.WrapText   = true;
        range.Style.Border.OutsideBorder      = XLBorderStyleValues.Medium;
        range.Style.Border.OutsideBorderColor = XLColor.Black;
    }

    // Top primary groupings (Columns A-F for الواردات, Columns G-L for المراسلات)
    ApplyMainHeader(ws.Range("A1:F2"), "الواردات");
    ApplyMainHeader(ws.Range("G1:L1"), "المراسلات");
    ws.Row(1).Height = 30;

    // Sub-groupings under المراسلات (Note: Ranges must follow Left-to-Right alpha ordering)
    ApplyMainHeader(ws.Range("G2:I2"), "صادرة");
    ApplyMainHeader(ws.Range("J2:K2"), "الواردة");
    ApplyMainHeader(ws.Range("L2:L3"), "النتيجة ");
    ws.Row(2).Height = 40;

    // Loop through headers array and reverse write them from Column 1 (A) to Column 11 (K)
    string[] colHeaders = { "المصدر والجواب", "التاريخ", "الموضوع", "المرسل إليه", "التاريخ", "الموضوع", "اسم وموطن المرسل إليه", "تاريخ الوصول", "رقمها", "التاريخ الرسالة", "رقم الترتيبي" };
    
    for (int i = 0; i < colHeaders.Length; i++)
    {
        // Maps index 10 ("رقم الترتيبي") to Column 1, index 9 to Column 2, down to index 0 to Column 11
        int targetColumn = 11 - i; 
        
        var cell = ws.Cell(3, targetColumn);
        cell.Value = colHeaders[i];
        cell.Style.Font.Bold = true;
        cell.Style.Font.FontColor = blackFont;
        cell.Style.Fill.BackgroundColor = grayFill;
        cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        cell.Style.Alignment.Vertical   = XLAlignmentVerticalValues.Center;
        cell.Style.Alignment.WrapText   = true;
        cell.Style.Border.OutsideBorder      = XLBorderStyleValues.Thin;
        cell.Style.Border.OutsideBorderColor = XLColor.Black;
    }
    ws.Row(3).Height = 50;

    var headerBlock = ws.Range("A1:L3");
    headerBlock.Style.Border.OutsideBorder      = XLBorderStyleValues.Medium;
    headerBlock.Style.Border.OutsideBorderColor = XLColor.Black;

    // Inverted column base widths to follow the new structure layout
    ws.Column(1).Width  = 13; // رقم الترتيبي
    ws.Column(2).Width  = 13; // التاريخ الرسالة
    ws.Column(3).Width  = 13; // رقمها
    ws.Column(4).Width  = 15; // تاريخ الوصول
    ws.Column(5).Width  = 35; // اسم وموطن المرسل إليه
    ws.Column(6).Width  = 40; // الموضوع
    ws.Column(7).Width  = 15; // التاريخ
    ws.Column(8).Width  = 30; // المرسل إليه
    ws.Column(9).Width  = 40; // الموضوع
    ws.Column(10).Width = 15; // التاريخ
    ws.Column(11).Width = 40; // المصدر والجواب
    ws.Column(12).Width = 30; // النتيجة
}
        

[HttpGet("export/excel")]
public async Task<IActionResult> ExportExcel(string? motCle, string? numeroBureauOrdre, DateTime? date, string? type, [FromQuery] List<int> ids)
{
    var query = GetUnifiedQuery().Where(e => e.ParentId == null);
    
    // 🔥 FILTRE PRINCIPAL : UNIQUEMENT LES ENTITÉS AVEC UN NUMÉRO DE BUREAU D'ORDRE
    query = query.Where(e => !string.IsNullOrEmpty(e.IdBureauOrdre));
    
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
    
    var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
    if (userRole == "Enregistrement" || userRole == "Procedures")
        query = query.Where(e => string.IsNullOrEmpty(e.IdBureauOrdre));
    else if (userRole == "Greffier")
        query = query.Where(e => !string.IsNullOrEmpty(e.IdBureauOrdre));

    if (ids != null && ids.Any())
        query = query.Where(e => ids.Contains(e.Id));

    var courriers = await query.ToListAsync();
    courriers = courriers.OrderBy(c =>
    {
        if (string.IsNullOrWhiteSpace(c.IdBureauOrdre)) return int.MaxValue;
        var parts = c.IdBureauOrdre.Split('/');
        return parts.Length > 0 && int.TryParse(parts[0], out int num) ? num : int.MaxValue;
    }).ToList();

    // Load list items for mapping
    var sourceItems = await _context.ListItems.Where(l => l.ListName == "Source").ToListAsync();
    var stateItems = await _context.ListItems.Where(l => l.ListName == "DocumentState").ToListAsync();
    var directionItems = await _context.ListItems.Where(l => l.ListName == "Direction").ToListAsync();
    var corrTypeItems = await _context.ListItems.Where(l => l.ListName == "CorrespondanceType").ToListAsync();

    // Determine current language (from Accept-Language header)
    var lang = Request.Headers["Accept-Language"].ToString().StartsWith("ar") ? "ar" : "fr";

    string GetLabel(IEnumerable<ListItem> items, string code)
    {
        if (string.IsNullOrEmpty(code)) return "-";
        var item = items.FirstOrDefault(i => i.Code == code);
        if (item == null) return code;
        return lang == "ar" ? item.ValueAr : item.ValueFr;
    }

    using var workbook = new XLWorkbook();
    var ws = workbook.Worksheets.Add("Courriers");
    ws.RightToLeft = true;

    // Apply your existing header structure (your ApplyHeaderStructure method)
    ApplyHeaderStructure(ws);

    var bodyGray = XLColor.FromArgb(242, 242, 242);
    int row = 4;

    foreach (var c in courriers)
    {
        DateTime? extractedDateMessage = null;
        var desc = c.Description ?? "";
        var match = System.Text.RegularExpressions.Regex.Match(desc, @"تاريخ الرسالة:\s*(\S+)");
        if (match.Success && DateTime.TryParse(match.Groups[1].Value, out DateTime parsedDate))
            extractedDateMessage = parsedDate;

        string resultNote = "", sourceReply = "";
        DateTime? date1 = null;
        string subject1 = "", destinataire = "";
        DateTime? date2 = null;
        string subject2 = "", senderName = "";
        DateTime? arrivalDate = null;
        string number = "";
        DateTime? letterDate = null;
        string serialNumber = "";

        var reply = await _context.Entites.FirstOrDefaultAsync(e => e.ParentId == c.Id && e.TypeDocument == "Administratif");
        bool isOutgoing = (c.TypeRegistre == "Morasalat" && c.TypeCorrespondance == "Sortante") || c.Direction == "Sortant";

        if (isOutgoing)
        {
            subject1 = c.Sujet ?? "";
            destinataire = GetLabel(sourceItems, c.Destinataire);
            date2 = c.DateCreation;
            serialNumber = c.IdBureauOrdre ?? "";
            if (reply != null) { sourceReply = reply.Sujet ?? ""; date1 = reply.DateCreation; }
        }
        else
        {
            subject2 = c.Sujet ?? "";
            senderName = GetLabel(sourceItems, c.Source);
            arrivalDate = c.DateCreation;
            number = c.NumeroDeCourrier ?? "";
            letterDate = extractedDateMessage;
            serialNumber = c.IdBureauOrdre ?? "";
            if (reply != null) { subject1 = reply.Sujet ?? ""; destinataire = GetLabel(sourceItems, reply.Destinataire); date2 = reply.DateCreation; }
        }

        ws.Cell(row, 1).Value = serialNumber;
        SetDate(ws.Cell(row, 2), letterDate);
        ws.Cell(row, 3).Value = number;
        SetDate(ws.Cell(row, 4), arrivalDate);
        ws.Cell(row, 5).Value = senderName;
        ws.Cell(row, 6).Value = subject2;
        SetDate(ws.Cell(row, 7), date2);
        ws.Cell(row, 8).Value = destinataire;
        ws.Cell(row, 9).Value = subject1;
        SetDate(ws.Cell(row, 10), date1);
        ws.Cell(row, 11).Value = sourceReply;
        ws.Cell(row, 12).Value = resultNote;

        var rowRange = ws.Range(row, 1, row, 12);
        rowRange.Style.Fill.BackgroundColor = bodyGray;
        rowRange.Style.Font.FontColor = XLColor.Black;
        rowRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        rowRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        rowRange.Style.Alignment.WrapText = true;
        rowRange.Style.Border.OutsideBorder = XLBorderStyleValues.Medium;
        rowRange.Style.Border.OutsideBorderColor = XLColor.Black;
        rowRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
        rowRange.Style.Border.InsideBorderColor = XLColor.FromArgb(180, 180, 180);
        ws.Row(row).Height = 35;
        row++;
    }

    if (row > 4) ws.Range(4, 1, row - 1, 12).Style.Border.OutsideBorder = XLBorderStyleValues.Medium;
    ws.Columns().AdjustToContents();

    using var stream = new MemoryStream();
    workbook.SaveAs(stream);
    return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"courriers_{DateTime.Now:yyyyMMddHHmm}.xlsx");
}
        // ========== TEMPLATE ==========
        [HttpGet("template-excel")]
        public IActionResult GetTemplateExcel([FromQuery] string? type)
        {
            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Import");
            var normalizedType = (type ?? "administratif").Trim().ToLower();

            switch (normalizedType)
            {
                case "judiciaire_file":
                    BuildJudiciaryFileTemplate(ws);
                    break;
                case "judiciaire_linked":
                    BuildJudiciaryLinkedTemplate(ws);
                    break;
                case "sortant":
                    BuildSortantTemplate(ws);
                    break;
                default:
                    BuildAdministratifTemplate(ws);
                    break;
            }

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"template_{normalizedType}.xlsx");
        }

        private static void ApplyTemplateStyle(IXLWorksheet ws, string[] headers, string[][] examples)
        {
            var headerFill   = XLColor.FromArgb(31, 78, 121);
            var exampleFill  = XLColor.FromArgb(242, 242, 242);
            var white        = XLColor.White;
            var black        = XLColor.Black;

            for (int col = 1; col <= headers.Length; col++)
            {
                var cell = ws.Cell(1, col);
                cell.Value = headers[col - 1];
                cell.Style.Font.Bold = true;
                cell.Style.Font.FontColor = white;
                cell.Style.Fill.BackgroundColor = headerFill;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                cell.Style.Alignment.Vertical   = XLAlignmentVerticalValues.Center;
                cell.Style.Alignment.WrapText   = true;
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Medium;
                cell.Style.Border.OutsideBorderColor = black;
                ws.Column(col).Width = 22;
            }
            ws.Row(1).Height = 40;

            for (int r = 0; r < examples.Length; r++)
            {
                for (int c = 0; c < examples[r].Length && c < headers.Length; c++)
                {
                    var cell = ws.Cell(r + 2, c + 1);
                    cell.Value = examples[r][c];
                    cell.Style.Fill.BackgroundColor = exampleFill;
                    cell.Style.Font.FontColor = black;
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    cell.Style.Alignment.Vertical   = XLAlignmentVerticalValues.Center;
                    cell.Style.Alignment.WrapText   = true;
                    cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                    cell.Style.Border.OutsideBorderColor = XLColor.FromArgb(180, 180, 180);
                }
                ws.Row(r + 2).Height = 25;
            }

            ws.Cell(1, headers.Length + 1).Value = "⚠ Ne pas modifier la ligne 1 (en-têtes)";
            ws.Cell(1, headers.Length + 1).Style.Font.Italic = true;
            ws.Cell(1, headers.Length + 1).Style.Font.FontColor = XLColor.OrangeRed;
        }

        private static void BuildAdministratifTemplate(IXLWorksheet ws)
        {
            var headers = new[] { "رقم مكتب الضبط", "الموضوع", "المصدر", "تاريخ الوصول", "الوصف / الملاحظات", "الرقم الداخلي", "تاريخ الرسالة" };
            var examples = new[]
            {
                new[] { "1/2026", "طلب معلومات", "وزارة العدل", "15/03/2026", "مراجعة الطلب", "123", "10/03/2026" },
                new[] { "2/2026", "استفسار قانوني", "المحكمة الابتدائية", "20/03/2026", "", "124", "18/03/2026" }
            };
            ApplyTemplateStyle(ws, headers, examples);
        }

        private static void BuildJudiciaryFileTemplate(IXLWorksheet ws)
        {
            var headers = new[] { "رقم مكتب الضبط", "الموضوع", "مصدر المحكمة", "التاريخ", "رقم الملف الاستئنافي", "رقم أول درجة", "الوصف" };
            var examples = new[]
            {
                new[] { "10/2026", "نزاع عقاري", "المحكمة الابتدائية", "01/04/2026", "2026/10/3", "2025/5/1", "ملف مدني" },
                new[] { "11/2026", "طعن بالاستئناف", "محكمة الاستئناف", "05/04/2026", "2026/11/3", "2025/6/2", "" }
            };
            ApplyTemplateStyle(ws, headers, examples);
        }

        private static void BuildJudiciaryLinkedTemplate(IXLWorksheet ws)
        {
            var headers = new[] { "الموضوع", "معرف الملف الأصلي", "التاريخ", "الوصف" };
            var examples = new[]
            {
                new[] { "مذكرة استدعاء", "42", "10/04/2026", "وثيقة مرتبطة بالملف رقم 42" },
                new[] { "حكم ابتدائي", "117", "12/04/2026", "" }
            };
            ApplyTemplateStyle(ws, headers, examples);
        }

        private static void BuildSortantTemplate(IXLWorksheet ws)
        {
            var headers = new[] { "رقم مكتب الضبط", "الموضوع", "المرسل إليه", "التاريخ", "الوصف / الملاحظات", "الرقم الداخلي" };
            var examples = new[]
            {
                new[] { "5/2026", "رد على استفسار", "المحكمة الابتدائية", "22/03/2026", "", "501" },
                new[] { "6/2026", "إشعار", "وزارة العدل", "25/03/2026", "هام", "502" }
            };
            ApplyTemplateStyle(ws, headers, examples);
        }

        private static void SetDate(IXLCell cell, DateTime? value)
        {
            if (value.HasValue)
            {
                cell.Value = value.Value;
                cell.Style.DateFormat.Format = "dd/MM/yyyy";
            }
        }

        // ========== IMPORT PREVIEW ==========
        [HttpPost("import/preview")]
        public IActionResult ImportPreview(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Fichier requis.");

            try
            {
                using var stream = file.OpenReadStream();
                using var workbook = new XLWorkbook(stream);
                var ws = workbook.Worksheet(1);

                var headers = ws.Row(1)
                    .Cells()
                    .Select(c => c.GetString().Trim())
                    .Where(s => !string.IsNullOrEmpty(s))
                    .ToList();

                return Ok(headers);
            }
            catch (Exception ex)
            {
                return BadRequest($"Erreur de lecture: {ex.Message}");
            }
        }

        // ========== IMPORT EXECUTE ==========
        [HttpPost("import/execute")]
        public async Task<IActionResult> ImportExecute(
            IFormFile file,
            [FromQuery] string type,
            [FromQuery] string? colSerialNumber,
            [FromQuery] string? colSubject,
            [FromQuery] string? colSenderName,
            [FromQuery] string? colArrivalDate,
            [FromQuery] string? colResultNote,
            [FromQuery] string? colNumber,
            [FromQuery] string? colLetterDate,
            [FromQuery] string? colTribunalSource,
            [FromQuery] string? colDate,
            [FromQuery] string? colNumeroDossier,
            [FromQuery] string? colNumeroPremiereInstance,
            [FromQuery] string? colDescription,
            [FromQuery] string? colParentJudiciaireId,
            [FromQuery] string? colDestinataire)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Fichier requis.");

            if (string.IsNullOrWhiteSpace(type))
                return BadRequest("Le paramètre 'type' est obligatoire.");

            var userName = User.Identity?.Name;
            var currentUser = await _context.Utilisateurs.FirstOrDefaultAsync(u => u.Login == userName);
            int defaultServiceId = currentUser?.IdService ?? 1;

            using var stream = file.OpenReadStream();
            using var workbook = new XLWorkbook(stream);
            var ws = workbook.Worksheet(1);

            var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var headerRow = ws.Row(1);
            int colIdx = 1;
            foreach (var cell in headerRow.Cells())
            {
                var headerText = cell.GetString().Trim();
                if (!string.IsNullOrEmpty(headerText) && !headerMap.ContainsKey(headerText))
                    headerMap[headerText] = colIdx;
                colIdx++;
            }

            string GetVal(IXLRow row, string? mappedHeader)
            {
                if (string.IsNullOrWhiteSpace(mappedHeader)) return "";
                if (!headerMap.TryGetValue(mappedHeader, out int idx)) return "";
                return row.Cell(idx).GetString().Trim();
            }

            var dataRows = ws.RowsUsed().Skip(1).ToList();
            int imported = 0;
            var errors = new List<string>();
            int lineNumber = 2;

            var normalizedType = type.Trim().ToLower();

            foreach (var row in dataRows)
            {
                if (row.IsEmpty()) { lineNumber++; continue; }

                var lineErrors = new List<string>();

                try
                {
                    switch (normalizedType)
                    {
                        case "administratif_entrant":
                            await ImportAdministratif(row, lineErrors, defaultServiceId,
                                GetVal(row, colSerialNumber), GetVal(row, colSubject), GetVal(row, colSenderName),
                                GetVal(row, colArrivalDate), GetVal(row, colResultNote), GetVal(row, colNumber),
                                GetVal(row, colLetterDate));
                            if (lineErrors.Count == 0) imported++;
                            break;

                        case "judiciaire_file":
                            await ImportJudiciaireFile(row, lineErrors, defaultServiceId,
                                GetVal(row, colSerialNumber), GetVal(row, colSubject), GetVal(row, colTribunalSource),
                                GetVal(row, colDate), GetVal(row, colNumeroDossier), GetVal(row, colNumeroPremiereInstance),
                                GetVal(row, colDescription));
                            if (lineErrors.Count == 0) imported++;
                            break;

                        case "judiciaire_linked":
                            await ImportJudiciaireLinked(row, lineErrors, defaultServiceId,
                                GetVal(row, colSubject), GetVal(row, colParentJudiciaireId),
                                GetVal(row, colDate), GetVal(row, colDescription));
                            if (lineErrors.Count == 0) imported++;
                            break;

                        case "sortant":
                            await ImportSortant(row, lineErrors, defaultServiceId,
                                GetVal(row, colSerialNumber), GetVal(row, colSubject), GetVal(row, colDestinataire),
                                GetVal(row, colDate), GetVal(row, colResultNote), GetVal(row, colNumber));
                            if (lineErrors.Count == 0) imported++;
                            break;

                        default:
                            lineErrors.Add($"Type inconnu: {type}");
                            break;
                    }
                }
                catch (Exception ex)
                {
                    lineErrors.Add($"Erreur inattendue: {ex.Message}");
                }

                if (lineErrors.Any())
                    errors.Add($"Ligne {lineNumber}: {string.Join(" | ", lineErrors)}");

                lineNumber++;
            }

            return Ok(new { imported, errors });
        }

        // ========== IMPORT HELPERS ==========
        private async Task ImportAdministratif(IXLRow row, List<string> errors, int serviceId,
            string serialNumber, string subject, string senderName, string arrivalDateStr,
            string description, string number, string letterDateStr)
        {
            if (string.IsNullOrWhiteSpace(serialNumber))
                errors.Add("رقم مكتب الضبط (N° bureau d'ordre) est vide");

            if (string.IsNullOrWhiteSpace(subject))
                errors.Add("الموضوع (Objet) est obligatoire");

            if (string.IsNullOrWhiteSpace(senderName))
                errors.Add("المصدر (Source) est obligatoire");

            if (!TryParseDate(arrivalDateStr, out DateTime arrivalDate))
                errors.Add($"تاريخ الوصول invalide: '{arrivalDateStr}' (format attendu: dd/MM/yyyy)");

            if (errors.Any()) return;

            var norm = serialNumber.Trim();
            if (await _context.Entites.AnyAsync(e =>
                    e.TypeDocument == "Administratif" && e.ParentId == null && e.IdBureauOrdre == norm))
            {
                errors.Add($"رقم '{norm}' existe déjà en base");
                return;
            }

            string finalDescription = description;
            if (!string.IsNullOrWhiteSpace(letterDateStr))
            {
                if (TryParseDate(letterDateStr, out DateTime ld))
                    finalDescription = $"تاريخ الرسالة: {ld:yyyy-MM-dd}" +
                                       (string.IsNullOrWhiteSpace(description) ? "" : $" | {description}");
                else
                    finalDescription = $"تاريخ الرسالة: {letterDateStr}" +
                                       (string.IsNullOrWhiteSpace(description) ? "" : $" | {description}");
            }

            var entity = new Entite
            {
                IdBureauOrdre    = norm,
                DateCreation     = arrivalDate,
                Source           = senderName,
                Sujet            = subject,
                Destinataire     = "محكمة الاستئناف",
                Description      = finalDescription,
                Etat             = "Nouveau",
                Direction        = "Entrant",
                TypeRegistre     = "Waridat",
                TypeDocument     = "Administratif",
                TypeGenerale     = TypeEntite.CourrierEntrant,
                NumeroDeCourrier = number,
                IdService        = serviceId,
                ParentId         = null,
                EstTransmissible = true
            };
            _context.Entites.Add(entity);
            await _context.SaveChangesAsync();
        }

        private async Task ImportSortant(IXLRow row, List<string> errors, int serviceId,
            string serialNumber, string subject, string destinataire, string dateStr,
            string description, string number)
        {
            if (string.IsNullOrWhiteSpace(serialNumber))
                errors.Add("رقم مكتب الضبط est vide");

            if (string.IsNullOrWhiteSpace(subject))
                errors.Add("الموضوع est obligatoire");

            if (!TryParseDate(dateStr, out DateTime date))
                errors.Add($"التاريخ invalide: '{dateStr}'");

            if (errors.Any()) return;

            var norm = serialNumber.Trim();
            if (await _context.Entites.AnyAsync(e =>
                    e.TypeDocument == "Administratif" && e.ParentId == null && e.IdBureauOrdre == norm))
            {
                errors.Add($"رقم '{norm}' existe déjà en base");
                return;
            }

            var entity = new Entite
            {
                IdBureauOrdre    = norm,
                DateCreation     = date,
                Source           = "Sortant",
                Sujet            = subject,
                Destinataire     = destinataire,
                Description      = description,
                Etat             = "Nouveau",
                Direction        = "Sortant",
                TypeRegistre     = "Morasalat",
                TypeCorrespondance = "Sortante",
                TypeDocument     = "Administratif",
                TypeGenerale     = TypeEntite.CourrierSortant,
                NumeroDeCourrier = number,
                IdService        = serviceId,
                ParentId         = null,
                EstTransmissible = false
            };
            _context.Entites.Add(entity);
            await _context.SaveChangesAsync();
        }

        private async Task ImportJudiciaireFile(IXLRow row, List<string> errors, int serviceId,
            string serialNumber, string subject, string tribunalSource, string dateStr,
            string numeroDossier, string numeroPremiereInstance, string description)
        {
            if (string.IsNullOrWhiteSpace(subject))
                errors.Add("الموضوع est obligatoire");

            if (!TryParseDate(dateStr, out DateTime date))
                errors.Add($"التاريخ invalide: '{dateStr}'");

            if (errors.Any()) return;

            if (!string.IsNullOrWhiteSpace(serialNumber))
            {
                var norm = serialNumber.Trim();
                if (await _context.EntitesDJs.AnyAsync(e => e.IdBureauOrdre == norm))
                {
                    errors.Add($"رقم '{norm}' existe déjà dans les dossiers judiciaires");
                    return;
                }
            }

            var entity = new EntiteDJ
            {
                IdBureauOrdre          = string.IsNullOrWhiteSpace(serialNumber) ? null : serialNumber.Trim(),
                DateArchivage          = date,
                TribunalSource         = tribunalSource,
                Sujet                  = subject,
                Destinataire           = "محكمة الاستئناف",
                Description            = description,
                EtatArchive            = "Nouveau",
                LienPdf                = "",
                IdService              = serviceId,
                EstTransmissible       = true,
                EstArchive             = false,
                EstDocumentLie         = false,
                ParentJudiciaireId     = null,
                NumeroPremiereInstance = string.IsNullOrWhiteSpace(numeroPremiereInstance) ? null : numeroPremiereInstance.Trim()
            };

            _context.EntitesDJs.Add(entity);
            await _context.SaveChangesAsync();
        }

        private async Task ImportJudiciaireLinked(IXLRow row, List<string> errors, int serviceId,
            string subject, string parentIdStr, string dateStr, string description)
        {
            if (string.IsNullOrWhiteSpace(subject))
                errors.Add("الموضوع est obligatoire");

            if (!int.TryParse(parentIdStr, out int parentId) || parentId <= 0)
                errors.Add($"معرف الملف الأصلي (ID parent) invalide: '{parentIdStr}'");

            if (!TryParseDate(dateStr, out DateTime date))
                errors.Add($"التاريخ invalide: '{dateStr}'");

            if (errors.Any()) return;

            var parent = await _context.EntitesDJs.FirstOrDefaultAsync(e => e.Id == parentId);
            if (parent == null)
            {
                errors.Add($"الملف الأصلي (ID={parentId}) غير موجود");
                return;
            }

            var entity = new EntiteDJ
            {
                IdBureauOrdre      = null,
                DateArchivage      = date,
                TribunalSource     = parent.TribunalSource,
                Sujet              = subject,
                Destinataire       = "محكمة الاستئناف",
                Description        = description,
                EtatArchive        = "Nouveau",
                LienPdf            = "",
                IdService          = serviceId,
                EstTransmissible   = true,
                EstArchive         = false,
                EstDocumentLie     = true,
                ParentJudiciaireId = parentId
            };
            _context.EntitesDJs.Add(entity);
            await _context.SaveChangesAsync();
        }

        private static bool TryParseDate(string raw, out DateTime result)
        {
            result = DateTime.Now;
            if (string.IsNullOrWhiteSpace(raw)) return false;

            var formats = new[]
            {
                "dd/MM/yyyy", "d/M/yyyy", "dd/MM/yy",
                "yyyy-MM-dd", "MM/dd/yyyy", "d/MM/yyyy"
            };
            return DateTime.TryParseExact(raw, formats,
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out result)
                || DateTime.TryParse(raw, out result);
        }

        // ================== PRIVATE HELPERS ==================
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
                    EstArchive = e.EstArchive,
                    Emplacement = e.Service != null ? e.Service.NomService : ""
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
                    EstArchive = e.EstArchive,
                    Emplacement = e.Service != null ? e.Service.NomService : ""
                });

            return administratifs.Concat(judiciaires);
        }

        private static object ToUnifiedResponse(UnifiedCourrier u) => new
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
            serviceNom = u.ServiceNom,
            hasTransaction = false,
            emplacement = u.Emplacement
        };

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
            var idBureauOrdre = (request.IdBureauOrdre ?? string.Empty).Trim();

            if (request.ParentId.HasValue && request.ParentId.Value > 0)
                return (idBureauOrdre, request.ParentId.Value, direction, typeCorrespondance);

            if (string.IsNullOrEmpty(idBureauOrdre))
                throw new InvalidOperationException("Le numéro de bureau d'ordre est obligatoire pour un enregistrement principal.");

            if (await ExistsIdBureauOrdre(idBureauOrdre, excludeId))
                throw new InvalidOperationException("Ce numéro de bureau d'ordre existe déjà dans le registre administratif.");

            if (!await IsIdBureauOrdreUniqueWithJudicial(idBureauOrdre, excludeId))
                throw new InvalidOperationException("Ce numéro de bureau d'ordre est déjà utilisé dans un dossier judiciaire.");

            return (idBureauOrdre, null, typeRegistre == TypeRegistreWaridat ? "Entrant" : (typeCorrespondance == TypeCorrespondanceSortante ? "Sortant" : "Interne"), typeCorrespondance);
        }

        private async Task<bool> ExistsIdBureauOrdre(string idBureauOrdre, int? excludedId = null)
        {
            var normalized = idBureauOrdre.Trim();
            return await _context.Entites.AnyAsync(e =>
                e.TypeDocument == TypeDocumentAdministratif && e.ParentId == null &&
                e.IdBureauOrdre != null && e.IdBureauOrdre.Trim() == normalized &&
                (!excludedId.HasValue || e.IdEntite != excludedId.Value));
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

        private async Task<IActionResult?> ValidateRequest(CourrierAdministratifRequest request)
        {
            bool isStandalone = !request.ParentId.HasValue || request.ParentId.Value <= 0;

            var userName = User.Identity?.Name;
            var currentUser = await _context.Utilisateurs.FirstOrDefaultAsync(u => u.Login == userName);
            bool isGreffier = currentUser?.Role == "Greffier";

            if (isStandalone && isGreffier && string.IsNullOrWhiteSpace(request.IdBureauOrdre))
                return BadRequest("Le numéro de bureau d'ordre est obligatoire pour le greffier.");

            if (request.Date == default) return BadRequest("Date obligatoire.");
            if (string.IsNullOrWhiteSpace(request.Sujet)) return BadRequest("Sujet obligatoire.");
            if (request.IdService <= 0) return BadRequest("Service obligatoire.");
            if (!await _context.Services.AnyAsync(s => s.IdService == request.IdService))
                return BadRequest("Service inexistant.");
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

        private static TypeEntite GetTypeGenerale(string direction) =>
            direction == "Sortant" ? TypeEntite.CourrierSortant : direction == "Interne" ? TypeEntite.Interne : TypeEntite.CourrierEntrant;

        private async Task<int> GetArchivesServiceId()
        {
            var archivesService = await _context.Services
                .FirstOrDefaultAsync(s => s.NomService == "الحفظ" || s.NomService == "Archives");
            if (archivesService == null)
                throw new InvalidOperationException("Service 'الحفظ' not found. Please create it first.");
            return archivesService.IdService;
        }
    }

    public class CourrierAdministratifRequest
    {
        public string? IdBureauOrdre { get; set; }
        public DateTime Date { get; set; }
        public string? Source { get; set; }
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
        public string Emplacement { get; set; } = "";
    }
}