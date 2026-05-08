using Microsoft.EntityFrameworkCore;

namespace GestionCourrier.Models
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Service> Services { get; set; }
        public DbSet<EntiteDJ> EntitesDJs { get; set; }
        public DbSet<Entite> Entites { get; set; }
        public DbSet<NumeroDossierJuridique> NumerosDossierJuridique { get; set; }
        public DbSet<Retrait> Retraits { get; set; }
        public DbSet<Transaction> Transactions { get; set; }
        public DbSet<Registre> Registres { get; set; }
        public DbSet<Reponse> Reponses { get; set; }
        public DbSet<Equipment> Equipements { get; set; }
        public DbSet<Utilisateur> Utilisateurs { get; set; }
        public DbSet<Id> Ids { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Relation Service -> EntiteDJ
            modelBuilder.Entity<EntiteDJ>()
                .HasOne(e => e.Service)
                .WithMany(s => s.EntitesDJ)
                .HasForeignKey(e => e.IdService)
                .OnDelete(DeleteBehavior.Restrict);

            // Relation Service -> Entite
            modelBuilder.Entity<Entite>()
                .HasOne(e => e.Service)
                .WithMany(s => s.Entites)
                .HasForeignKey(e => e.IdService)
                .OnDelete(DeleteBehavior.Restrict);

            // Relation Service -> Registre
            modelBuilder.Entity<Registre>()
                .HasOne(r => r.Service)
                .WithMany(s => s.Registres)
                .HasForeignKey(r => r.IdService)
                .OnDelete(DeleteBehavior.Restrict);

            // Relation Service -> Equipment
            modelBuilder.Entity<Equipment>()
                .HasOne(eq => eq.Service)
                .WithMany(s => s.Equipements)
                .HasForeignKey(eq => eq.IdService)
                .OnDelete(DeleteBehavior.Restrict);

            // Relation Service -> Utilisateur
            modelBuilder.Entity<Utilisateur>()
                .HasOne(u => u.Service)
                .WithMany(s => s.Utilisateurs)
                .HasForeignKey(u => u.IdService)
                .OnDelete(DeleteBehavior.Restrict);

            // Relation 1-1 entre EntiteDJ et NumeroDossierJuridique
            modelBuilder.Entity<NumeroDossierJuridique>()
                .HasOne(n => n.EntiteDJ)
                .WithOne(e => e.NumeroDossier)
                .HasForeignKey<NumeroDossierJuridique>(n => n.EntiteDJId)
                .OnDelete(DeleteBehavior.Cascade);

            // Relation EntiteDJ -> Retraits (1-n)
            modelBuilder.Entity<Retrait>()
                .HasOne(r => r.EntiteDJ)
                .WithMany(e => e.Retraits)
                .HasForeignKey(r => r.EntiteDJId)
                .OnDelete(DeleteBehavior.Cascade);

            // Relations pour Transaction
            modelBuilder.Entity<Transaction>()
                .HasOne(t => t.SourceService)
                .WithMany() // Pas de navigation inverse explicite
                .HasForeignKey(t => t.SourceServiceId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Transaction>()
                .HasOne(t => t.DestinationService)
                .WithMany()
                .HasForeignKey(t => t.DestinationServiceId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Transaction>()
                .HasOne(t => t.DestinationUser)
                .WithMany() // Un utilisateur peut avoir plusieurs transactions comme destination
                .HasForeignKey(t => t.DestinationUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Relation Registre -> Reponses (1-n)
            modelBuilder.Entity<Reponse>()
                .HasOne(r => r.Registre)
                .WithMany(reg => reg.Reponses)
                .HasForeignKey(r => r.RegistreId)
                .OnDelete(DeleteBehavior.Cascade);

            // Conversion de l'énumération TypeGenerale vers int
            modelBuilder.Entity<Entite>()
                .Property(e => e.TypeGenerale)
                .HasConversion<int>();
        }
    }
}