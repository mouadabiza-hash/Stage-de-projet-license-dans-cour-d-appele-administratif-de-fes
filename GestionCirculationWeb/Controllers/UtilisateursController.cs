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
    public class UtilisateursController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public UtilisateursController(ApplicationDbContext context)
        {
            _context = context;
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return claim != null ? int.Parse(claim) : 0;
        }

        // ========== GET ALL ==========
        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] string? search, [FromQuery] int? serviceId)
        {
            var query = _context.Utilisateurs.Include(u => u.Service).AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(u => u.NomComplet.Contains(search) || u.Login.Contains(search));
            if (serviceId.HasValue)
                query = query.Where(u => u.IdService == serviceId.Value);
            var users = await query.ToListAsync();
            return Ok(users.Select(u => new
            {
                u.Id,
                u.NomComplet,
                u.Login,
                u.IdService,
                NomService = u.Service?.NomService,
                Role = u.Role,
                SubstituteUserId = u.SubstituteUserId
            }));
        }

        // ========== GET BY ID ==========
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var user = await _context.Utilisateurs.Include(u => u.Service).FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();
            return Ok(new
            {
                user.Id,
                user.NomComplet,
                user.Login,
                user.IdService,
                NomService = user.Service?.NomService,
                Role = user.Role,
                SubstituteUserId = user.SubstituteUserId
            });
        }

        // ========== CREATE ==========
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateUtilisateurDto dto)
        {
            if (await _context.Utilisateurs.AnyAsync(u => u.Login == dto.Login))
                return BadRequest("Ce login existe déjà.");

            var hashedPassword = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            var user = new Utilisateur
            {
                NomComplet = dto.NomComplet,
                Login = dto.Login,
                Password = hashedPassword,
                IdService = dto.IdService,
                Role = dto.Role,
                SubstituteUserId = dto.SubstituteUserId
            };
            _context.Utilisateurs.Add(user);
            await _context.SaveChangesAsync();
            return Ok(new { user.Id });
        }

        // ========== UPDATE ==========
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateUtilisateurDto dto)
        {
            var user = await _context.Utilisateurs.FindAsync(id);
            if (user == null) return NotFound();

            // Prevent password change for Admin role
            if (!string.IsNullOrWhiteSpace(dto.Password) && user.Role == "Admin")
                return BadRequest("Le mot de passe de l'administrateur ne peut pas être modifié.");

            var oldSubstituteId = user.SubstituteUserId;

            if (dto.NomComplet != null) user.NomComplet = dto.NomComplet;
            if (dto.Login != null) user.Login = dto.Login;
            if (dto.IdService.HasValue) user.IdService = dto.IdService.Value;
            if (dto.Role != null) user.Role = dto.Role;
            if (!string.IsNullOrWhiteSpace(dto.Password))
                user.Password = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            // Handle substitute change
            if (dto.SubstituteUserId.HasValue)
                user.SubstituteUserId = dto.SubstituteUserId.Value;
            else if (dto.SubstituteUserId == null)
                user.SubstituteUserId = null;

            await _context.SaveChangesAsync();

            // Record substitution history if changed
            if (oldSubstituteId != user.SubstituteUserId)
            {
                // Close current active history record if any
                var activeHistory = await _context.SubstitutionHistories
                    .FirstOrDefaultAsync(h => h.UserId == id && h.DateRemoved == null);
                if (activeHistory != null)
                    activeHistory.DateRemoved = DateTime.Now;

                // Create new active record if a substitute is assigned
                if (user.SubstituteUserId.HasValue)
                {
                    var newHistory = new SubstitutionHistory
                    {
                        UserId = id,
                        SubstituteUserId = user.SubstituteUserId.Value,
                        DateAssigned = DateTime.Now,
                        DateRemoved = null
                    };
                    _context.SubstitutionHistories.Add(newHistory);
                }

                await _context.SaveChangesAsync();
            }

            return Ok();
        }

        // ========== DELETE ==========
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var user = await _context.Utilisateurs.FindAsync(id);
            if (user == null) return NotFound();
            _context.Utilisateurs.Remove(user);
            await _context.SaveChangesAsync();
            return Ok();
        }

        // ========== SUBSTITUTION HISTORY ==========
        [HttpGet("substitution-history")]
        public async Task<IActionResult> GetSubstitutionHistory()
        {
            var userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            var history = await _context.SubstitutionHistories
                .Include(h => h.SubstituteUser)
                .Where(h => h.UserId == userId)
                .OrderByDescending(h => h.DateAssigned)
                .Select(h => new
                {
                    h.Id,
                    SubstituteName = h.SubstituteUser != null ? h.SubstituteUser.NomComplet : "",
                    h.DateAssigned,
                    h.DateRemoved,
                    IsActive = h.DateRemoved == null
                })
                .ToListAsync();

            return Ok(history);
        }
        [HttpDelete("substitution-history/{id}")]
public async Task<IActionResult> DeleteSubstitutionHistory(int id)
{
    var history = await _context.SubstitutionHistories.FindAsync(id);
    if (history == null) return NotFound();
    _context.SubstitutionHistories.Remove(history);
    await _context.SaveChangesAsync();
    return Ok(new { message = "Historique supprimé" });
}
        // ========== EXPORT EXCEL ==========
        [HttpGet("export/excel")]
        public async Task<IActionResult> ExportExcel()
        {
            var users = await _context.Utilisateurs.Include(u => u.Service).ToListAsync();
            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("المستخدمين");
            ws.RightToLeft = true;

            var headers = new[] { "الاسم الكامل", "اسم الدخول", "الخدمة" };
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
            foreach (var u in users)
            {
                ws.Cell(row, 1).Value = u.NomComplet;
                ws.Cell(row, 2).Value = u.Login;
                ws.Cell(row, 3).Value = u.Service?.NomService ?? "";
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
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "utilisateurs.xlsx");
        }

        // ========== IMPORT PREVIEW ==========
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

        // ========== IMPORT EXECUTE ==========
        [HttpPost("import/execute")]
        public async Task<IActionResult> ImportExecute(IFormFile file,
            [FromQuery] string colNom,
            [FromQuery] string colLogin,
            [FromQuery] string colServiceId)
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier requis.");
            if (string.IsNullOrWhiteSpace(colNom) || string.IsNullOrWhiteSpace(colLogin) || string.IsNullOrWhiteSpace(colServiceId))
                return BadRequest("Veuillez associer toutes les colonnes obligatoires.");

            using var stream = file.OpenReadStream();
            using var workbook = new XLWorkbook(stream);
            var ws = workbook.Worksheet(1);
            var headerRow = ws.Row(1);
            var headers = headerRow.Cells().Select(c => c.GetString().Trim()).ToList();
            int idxNom = headers.FindIndex(h => h == colNom);
            int idxLogin = headers.FindIndex(h => h == colLogin);
            int idxService = headers.FindIndex(h => h == colServiceId);
            if (idxNom == -1 || idxLogin == -1 || idxService == -1)
                return BadRequest("Colonne(s) introuvable(s) dans le fichier.");

            var rows = ws.RowsUsed().Skip(1);
            int imported = 0;
            var errors = new List<string>();
            int lineNumber = 2;
            var seenLogin = new HashSet<string>();
            var services = await _context.Services.ToDictionaryAsync(s => s.NomService, s => s.IdService);

            foreach (var row in rows)
            {
                var nom = row.Cell(idxNom + 1).GetString().Trim();
                var login = row.Cell(idxLogin + 1).GetString().Trim();
                var serviceVal = row.Cell(idxService + 1).GetString().Trim();
                var lineErrors = new List<string>();

                if (string.IsNullOrWhiteSpace(nom)) lineErrors.Add("Nom complet obligatoire");
                if (string.IsNullOrWhiteSpace(login)) lineErrors.Add("Login obligatoire");
                else if (seenLogin.Contains(login)) lineErrors.Add($"Login '{login}' dupliqué dans le fichier");
                else if (await _context.Utilisateurs.AnyAsync(u => u.Login == login)) lineErrors.Add($"Login '{login}' existe déjà dans la base");
                else seenLogin.Add(login);

                if (string.IsNullOrWhiteSpace(serviceVal)) lineErrors.Add("Service obligatoire");

                if (lineErrors.Any())
                {
                    errors.Add($"Ligne {lineNumber}: {string.Join(" | ", lineErrors)}");
                }
                else
                {
                    int serviceId;
                    if (int.TryParse(serviceVal, out serviceId))
                    {
                        if (!await _context.Services.AnyAsync(s => s.IdService == serviceId))
                        {
                            errors.Add($"Ligne {lineNumber}: Service ID {serviceId} introuvable");
                            lineNumber++;
                            continue;
                        }
                    }
                    else
                    {
                        if (!services.TryGetValue(serviceVal, out serviceId))
                        {
                            errors.Add($"Ligne {lineNumber}: Service '{serviceVal}' introuvable");
                            lineNumber++;
                            continue;
                        }
                    }

                    var defaultPassword = "Password123!";
                    var hashedPassword = BCrypt.Net.BCrypt.HashPassword(defaultPassword);

                    _context.Utilisateurs.Add(new Utilisateur
                    {
                        NomComplet = nom,
                        Login = login,
                        Password = hashedPassword,
                        IdService = serviceId
                    });
                    imported++;
                }
                lineNumber++;
            }

            await _context.SaveChangesAsync();
            return Ok(new { imported, errors });
        }

        // ========== TEMPLATE EXCEL ==========
        [HttpGet("template-excel")]
        public IActionResult GetTemplateExcel()
        {
            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Modele");
            var headers = new[] { "Nom complet", "Login", "Service (ID ou nom)" };
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
            }
            ws.Cell(2, 1).Value = "John Doe";
            ws.Cell(2, 2).Value = "johndoe";
            ws.Cell(2, 3).Value = "خلية المعلوميات";
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "modele_import_utilisateurs.xlsx");
        }
    }
}