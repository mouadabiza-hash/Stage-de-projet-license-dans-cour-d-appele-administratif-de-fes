using ClosedXML.Excel;
using GestionCourrier.DTOs;
using GestionCourrier.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GestionCourrier.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ServicesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ServicesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] string? search, [FromQuery] string? etage)
        {
            var query = _context.Services.AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(s => s.NomService.Contains(search) || s.Description.Contains(search));
            if (!string.IsNullOrWhiteSpace(etage))
                query = query.Where(s => s.Etage == etage);
            var services = await query.ToListAsync();
            return Ok(services);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateServiceDto dto)
        {
            if (await _context.Services.AnyAsync(s => s.IdService == dto.IdService))
                return BadRequest("Un service avec cet ID existe déjà.");
            var service = new Service
            {
                IdService = dto.IdService,
                NomService = dto.NomService,
                Description = dto.Description ?? "",
                Etage = dto.Etage
            };
            _context.Services.Add(service);
            await _context.SaveChangesAsync();
            return Ok(service);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateServiceDto dto)
        {
            var service = await _context.Services.FindAsync(id);
            if (service == null) return NotFound();
            if (!string.IsNullOrWhiteSpace(dto.NomService)) service.NomService = dto.NomService;
            if (dto.Description != null) service.Description = dto.Description;
            if (dto.Etage != null) service.Etage = dto.Etage;
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var service = await _context.Services.FindAsync(id);
            if (service == null) return NotFound();
            _context.Services.Remove(service);
            await _context.SaveChangesAsync();
            return Ok();
        }

[HttpGet("export/excel")]
public async Task<IActionResult> ExportExcel()
{
    var services = await _context.Services.ToListAsync();
    using var workbook = new XLWorkbook();
    var ws = workbook.Worksheets.Add("الخدمات");
    ws.RightToLeft = true;

    // Headers in Arabic (without ID)
    var headers = new[] { "الاسم", "الوصف", "الطابق" };

    // Style header row
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
    foreach (var s in services)
    {
        ws.Cell(row, 1).Value = s.NomService;
        ws.Cell(row, 2).Value = s.Description ?? "";
        ws.Cell(row, 3).Value = s.Etage ?? "";

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
    return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "services.xlsx");
}

        [HttpPost("import/preview")]
        public async Task<IActionResult> ImportPreview(IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier requis.");
            using var stream = file.OpenReadStream();
            using var workbook = new XLWorkbook(stream);
            var ws = workbook.Worksheet(1);
            var headers = ws.Row(1).Cells().Select(c => c.GetString().Trim()).ToList();
            return Ok(headers);
        }

        [HttpPost("import/execute")]
        public async Task<IActionResult> ImportExecute(IFormFile file, 
            [FromQuery] string colId, 
            [FromQuery] string colNom, 
            [FromQuery] string colDescription, 
            [FromQuery] string colEtage)
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier requis.");
            if (string.IsNullOrWhiteSpace(colId) || string.IsNullOrWhiteSpace(colNom))
                return BadRequest("ID et Nom sont obligatoires.");

            using var stream = file.OpenReadStream();
            using var workbook = new XLWorkbook(stream);
            var ws = workbook.Worksheet(1);
            var headerRow = ws.Row(1);
            var headers = headerRow.Cells().Select(c => c.GetString().Trim()).ToList();
            int idxId = headers.FindIndex(h => h == colId);
            int idxNom = headers.FindIndex(h => h == colNom);
            int idxDesc = string.IsNullOrWhiteSpace(colDescription) ? -1 : headers.FindIndex(h => h == colDescription);
            int idxEtage = string.IsNullOrWhiteSpace(colEtage) ? -1 : headers.FindIndex(h => h == colEtage);
            if (idxId == -1 || idxNom == -1) return BadRequest("Colonne(s) obligatoire(s) introuvable(s).");

            var rows = ws.RowsUsed().Skip(1);
            int imported = 0;
            var errors = new List<string>();
            int lineNumber = 2;
            var seenIds = new HashSet<int>();
            foreach (var row in rows)
            {
                var idStr = row.Cell(idxId + 1).GetString().Trim();
                var nom = row.Cell(idxNom + 1).GetString().Trim();
                var desc = idxDesc != -1 ? row.Cell(idxDesc + 1).GetString().Trim() : "";
                var etage = idxEtage != -1 ? row.Cell(idxEtage + 1).GetString().Trim() : null;
                var lineErrors = new List<string>();
                int? idParsed = null;
                if (string.IsNullOrWhiteSpace(idStr))
                    lineErrors.Add("ID manquant");
                else if (!int.TryParse(idStr, out int id))
                    lineErrors.Add("ID invalide (nombre entier requis)");
                else
                    idParsed = id;
                if (string.IsNullOrWhiteSpace(nom)) lineErrors.Add("Nom obligatoire");
                if (lineErrors.Any())
                {
                    errors.Add($"Ligne {lineNumber}: {string.Join(" | ", lineErrors)}");
                }
                else
                {
                    int id = idParsed.Value;
                    if (seenIds.Contains(id))
                        errors.Add($"Ligne {lineNumber}: ID '{id}' dupliqué dans le fichier");
                    else if (await _context.Services.AnyAsync(s => s.IdService == id))
                        errors.Add($"Ligne {lineNumber}: ID '{id}' existe déjà dans la base");
                    else
                    {
                        seenIds.Add(id);
                        _context.Services.Add(new Service
                        {
                            IdService = id,
                            NomService = nom,
                            Description = desc,
                            Etage = etage
                        });
                        imported++;
                    }
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
            var ws = workbook.Worksheets.Add("Modele");
            var headers = new[] { "ID (numéro unique)", "Nom du service", "Description", "Étage" };
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
            }
            ws.Cell(2, 1).Value = 10;
            ws.Cell(2, 2).Value = "Service test";
            ws.Cell(2, 3).Value = "Description test";
            ws.Cell(2, 4).Value = "1er étage";
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "modele_import_services.xlsx");
        }
    }
}