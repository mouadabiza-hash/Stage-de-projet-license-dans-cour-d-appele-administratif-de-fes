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
    public class EquipementsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public EquipementsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] string? search, [FromQuery] int? type, [FromQuery] int? etat, [FromQuery] bool? decharge)
        {
            var query = _context.Equipements.Include(e => e.Service).AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(e => e.Serial.Contains(search) || (e.Service != null && e.Service.NomService.Contains(search)));
            if (type.HasValue) query = query.Where(e => e.Type == type.Value);
            if (etat.HasValue) query = query.Where(e => e.Etat == etat.Value);
            if (decharge == true) query = query.Where(e => !e.EstCharge);
            var equipements = await query.ToListAsync();
            return Ok(equipements.Select(e => new
            {
                e.Id,
                e.Serial,
                e.Type,
                e.Etat,
                e.IdService,
                e.EstCharge,
                e.DateDechargement,
                ServiceNom = e.Service?.NomService,
                e.AdditionalInfo
            }));
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateEquipmentDto dto)
        {
            if (await _context.Equipements.AnyAsync(e => e.Serial == dto.Serial))
                return BadRequest("Un équipement avec ce numéro de série existe déjà.");
            var equip = new Equipment
            {
                Serial = dto.Serial,
                Type = dto.Type,
                Etat = dto.Etat,
                IdService = dto.IdService,
                EstCharge = true,
                DateDechargement = null,
                AdditionalInfo = dto.AdditionalInfo
            };
            _context.Equipements.Add(equip);
            await _context.SaveChangesAsync();
            return Ok(equip);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateEquipmentDto dto)
        {
            var equip = await _context.Equipements.FindAsync(id);
            if (equip == null) return NotFound();
            equip.Serial = dto.Serial;
            equip.Type = dto.Type;
            equip.Etat = dto.Etat;
            equip.IdService = dto.IdService;
            equip.AdditionalInfo = dto.AdditionalInfo;
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var equip = await _context.Equipements.FindAsync(id);
            if (equip == null) return NotFound();
            _context.Equipements.Remove(equip);
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpPost("{id}/charger")]
        public async Task<IActionResult> Charger(int id)
        {
            var equip = await _context.Equipements.FindAsync(id);
            if (equip == null) return NotFound();
            equip.EstCharge = true;
            equip.DateDechargement = null;
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpPost("{id}/decharger")]
        public async Task<IActionResult> Decharger(int id, [FromBody] DechargerDto? dto)
        {
            var equip = await _context.Equipements.FindAsync(id);
            if (equip == null) return NotFound();
            equip.EstCharge = false;
            equip.DateDechargement = dto?.DateDechargement ?? DateTime.Now;
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpGet("export/excel")]
        public async Task<IActionResult> ExportExcel()
        {
            var equipements = await _context.Equipements.Include(e => e.Service).ToListAsync();

            var typeItems = await _context.ListItems.Where(l => l.ListName == "EquipmentType").ToListAsync();
            var etatItems = await _context.ListItems.Where(l => l.ListName == "EquipmentEtat").ToListAsync();

            var lang = Request.Headers["Accept-Language"].ToString().StartsWith("ar") ? "ar" : "fr";

            string GetTypeLabel(int code)
            {
                var item = typeItems.FirstOrDefault(t => t.Code == code.ToString());
                return item == null ? code.ToString() : (lang == "ar" ? item.ValueAr : item.ValueFr);
            }

            string GetEtatLabel(int code)
            {
                var item = etatItems.FirstOrDefault(e => e.Code == code.ToString());
                return item == null ? code.ToString() : (lang == "ar" ? item.ValueAr : item.ValueFr);
            }

            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("المعدات");
            ws.RightToLeft = true;

            var headers = new[]
            {
                "الرقم المسلسل",
                "النوع",
                "الحالة",
                "الخدمة",
                "مشحون",
                "تاريخ التفريغ",
                "معلومات إضافية"
            };

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
            foreach (var e in equipements)
            {
                ws.Cell(row, 1).Value = e.Serial;
                ws.Cell(row, 2).Value = GetTypeLabel(e.Type);
                ws.Cell(row, 3).Value = GetEtatLabel(e.Etat);
                ws.Cell(row, 4).Value = e.Service?.NomService ?? "";
                ws.Cell(row, 5).Value = e.EstCharge ? "نعم" : "لا";
                ws.Cell(row, 6).Value = e.DateDechargement?.ToString("yyyy-MM-dd HH:mm") ?? "";
                ws.Cell(row, 7).Value = e.AdditionalInfo ?? "";

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
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "equipements.xlsx");
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
            [FromQuery] string colSerie,
            [FromQuery] string colType,
            [FromQuery] string colEtat,
            [FromQuery] string colServiceId,
            [FromQuery] string? colAdditionalInfo)   // new optional parameter
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier requis.");
            if (string.IsNullOrWhiteSpace(colSerie) || string.IsNullOrWhiteSpace(colType) ||
                string.IsNullOrWhiteSpace(colEtat) || string.IsNullOrWhiteSpace(colServiceId))
                return BadRequest("Veuillez associer toutes les colonnes obligatoires.");

            using var stream = file.OpenReadStream();
            using var workbook = new XLWorkbook(stream);
            var ws = workbook.Worksheet(1);
            var headerRow = ws.Row(1);
            var headers = headerRow.Cells().Select(c => c.GetString().Trim()).ToList();
            int idxSerie = headers.FindIndex(h => h == colSerie);
            int idxType = headers.FindIndex(h => h == colType);
            int idxEtat = headers.FindIndex(h => h == colEtat);
            int idxService = headers.FindIndex(h => h == colServiceId);
            int idxAdditionalInfo = string.IsNullOrWhiteSpace(colAdditionalInfo) ? -1 : headers.FindIndex(h => h == colAdditionalInfo);
            if (idxSerie == -1 || idxType == -1 || idxEtat == -1 || idxService == -1)
                return BadRequest("Colonne(s) introuvable(s) dans le fichier.");

            var rows = ws.RowsUsed().Skip(1);
            int imported = 0;
            var errors = new List<string>();
            int lineNumber = 2;
            var seenSerials = new HashSet<string>();   // change to string
            var services = await _context.Services.ToDictionaryAsync(s => s.NomService, s => s.IdService);

            foreach (var row in rows)
            {
                var serieStr = row.Cell(idxSerie + 1).GetString().Trim();
                var typeStr = row.Cell(idxType + 1).GetString().Trim();
                var etatStr = row.Cell(idxEtat + 1).GetString().Trim();
                var serviceVal = row.Cell(idxService + 1).GetString().Trim();
                var additionalInfo = idxAdditionalInfo >= 0 ? row.Cell(idxAdditionalInfo + 1).GetString().Trim() : null;
                var lineErrors = new List<string>();

                if (string.IsNullOrWhiteSpace(serieStr))
                    lineErrors.Add("Série vide");
                else if (seenSerials.Contains(serieStr))
                    lineErrors.Add($"Série '{serieStr}' dupliquée dans le fichier");
                else if (await _context.Equipements.AnyAsync(e => e.Serial == serieStr))
                    lineErrors.Add($"Série '{serieStr}' existe déjà dans la base");
                else
                    seenSerials.Add(serieStr);

                if (!int.TryParse(typeStr, out int type) || type < 1 || type > 4)
                    lineErrors.Add("Type invalide (1..4)");
                if (!int.TryParse(etatStr, out int etat) || etat < 1 || etat > 4)
                    lineErrors.Add("État invalide (1..4)");

                if (string.IsNullOrWhiteSpace(serviceVal))
                    lineErrors.Add("Service obligatoire");
                else
                {
                    int serviceId;
                    if (int.TryParse(serviceVal, out serviceId))
                    {
                        if (!await _context.Services.AnyAsync(s => s.IdService == serviceId))
                            lineErrors.Add($"Service ID {serviceId} introuvable");
                    }
                    else
                    {
                        if (!services.TryGetValue(serviceVal, out serviceId))
                            lineErrors.Add($"Service '{serviceVal}' introuvable");
                    }
                }

                if (lineErrors.Any())
                    errors.Add($"Ligne {lineNumber}: {string.Join(" | ", lineErrors)}");
                else
                {
                    _context.Equipements.Add(new Equipment
                    {
                        Serial = serieStr,
                        Type = type,
                        Etat = etat,
                        IdService = int.TryParse(serviceVal, out int sid) ? sid : services[serviceVal],
                        EstCharge = true,
                        DateDechargement = null,
                        AdditionalInfo = additionalInfo
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
            var ws = workbook.Worksheets.Add("Modele");
            var headers = new[] { "Série", "Type", "État", "Service (ID ou nom)", "Informations supplémentaires" };
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
            }
            ws.Cell(2, 1).Value = "ABC123";
            ws.Cell(2, 2).Value = 1;
            ws.Cell(2, 3).Value = 1;
            ws.Cell(2, 4).Value = "خلية المعلوميات";
            ws.Cell(2, 5).Value = "exemple info";
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "modele_import_equipements.xlsx");
        }
    }
}