using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace GestionCourrier.Models
{
    public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
    {
        public ApplicationDbContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();

            optionsBuilder.UseSqlServer(
                "Server=.\\SQLEXPRESS;Database=GestionCourrierDb_New;Trusted_Connection=True;TrustServerCertificate=True;Encrypt=False;"
            );

            return new ApplicationDbContext(optionsBuilder.Options);
        }
    }
}
