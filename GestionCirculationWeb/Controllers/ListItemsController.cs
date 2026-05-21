using GestionCourrier.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GestionCourrier.Controllers
{
    [Authorize(Roles = "Admin")]
    [Route("api/[controller]")]
    [ApiController]
    public class ListItemsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        public ListItemsController(ApplicationDbContext context) => _context = context;

        // GET: api/ListItems?listName=EquipmentType
        [HttpGet]
        public async Task<IActionResult> GetByListName([FromQuery] string listName)
        {
            var items = await _context.ListItems
                .Where(l => l.ListName == listName && l.IsActive)
                .OrderBy(l => l.DisplayOrder)
                .Select(l => new { l.Id, l.Code, l.ValueFr, l.ValueAr, l.DisplayOrder, l.IsActive })
                .ToListAsync();
            return Ok(items);
        }

        // GET: api/ListItems/all (get all list names with their items)
        [HttpGet("all")]
        public async Task<IActionResult> GetAllLists()
        {
            var all = await _context.ListItems
                .OrderBy(l => l.ListName)
                .ThenBy(l => l.DisplayOrder)
                .ToListAsync();
            var grouped = all.GroupBy(l => l.ListName)
                .ToDictionary(g => g.Key, g => g.Select(l => new { l.Id, l.Code, l.ValueFr, l.ValueAr, l.DisplayOrder, l.IsActive }));
            return Ok(grouped);
        }

        // POST: api/ListItems
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ListItem item)
        {
            if (await _context.ListItems.AnyAsync(l => l.ListName == item.ListName && l.Code == item.Code))
                return BadRequest($"Un élément avec le code {item.Code} existe déjà dans la liste {item.ListName}.");
            _context.ListItems.Add(item);
            await _context.SaveChangesAsync();
            return Ok(item);
        }

        // PUT: api/ListItems/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] ListItem updated)
        {
            var item = await _context.ListItems.FindAsync(id);
            if (item == null) return NotFound();
            item.ValueFr = updated.ValueFr;
            item.ValueAr = updated.ValueAr;
            item.DisplayOrder = updated.DisplayOrder;
            item.IsActive = updated.IsActive;
            await _context.SaveChangesAsync();
            return Ok(item);
        }

        // DELETE: api/ListItems/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _context.ListItems.FindAsync(id);
            if (item == null) return NotFound();
            _context.ListItems.Remove(item);
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}