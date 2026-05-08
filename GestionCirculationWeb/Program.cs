using GestionCourrier.Models;
using GestionCourrier.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using BCrypt.Net;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// JWT
var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];
if (string.IsNullOrEmpty(jwtKey) || string.IsNullOrEmpty(jwtIssuer) || string.IsNullOrEmpty(jwtAudience))
    throw new InvalidOperationException("JWT settings missing in appsettings.json");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });
builder.Services.AddAuthorization();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Workflow
builder.Services.AddScoped<ApprovalWorkflowService>();

System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

var app = builder.Build();

// Seed – nettoyage complet et recréation des services / utilisateurs
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.Migrate();

    // Supprimer toutes les données dans l'ordre inverse des dépendances
    db.Transactions.RemoveRange(db.Transactions);
    db.Retraits.RemoveRange(db.Retraits);
    db.NumerosDossierJuridique.RemoveRange(db.NumerosDossierJuridique);
    db.Entites.RemoveRange(db.Entites);
    db.EntitesDJs.RemoveRange(db.EntitesDJs);
    db.Utilisateurs.RemoveRange(db.Utilisateurs);
    db.Services.RemoveRange(db.Services);
    await db.SaveChangesAsync();

    // ---- Création des 19 services (noms en arabe) ----
    var servicesList = new List<Service>
    {
        new Service { IdService = 1, NomService = "خلية المعلوميات",     Description = "Cellule informatique", Etage = "2ème" },
        new Service { IdService = 2, NomService = "مكتب الضبط",         Description = "Greffe", Etage = "1er" },
        new Service { IdService = 3, NomService = "فتح الملفات",   Description = "Caisse", Etage = "RDC" },
        new Service { IdService = 4, NomService = "التوزيع",            Description = "Distribution", Etage = "2ème" },
        new Service { IdService = 5, NomService = "رئيس المصلحة",       Description = "Chef de service", Etage = "2ème" },
        new Service { IdService = 6, NomService = "مدير النظام",        Description = "Admin système", Etage = "2ème" },
        new Service { IdService = 7, NomService = "التبليغ",            Description = "Notification", Etage = "1er" },
        new Service { IdService = 8, NomService = "خبرة",               Description = "Expertise", Etage = "1er" },
        new Service { IdService = 9, NomService = "النقض",              Description = "Cassation", Etage = "2ème" },
        new Service { IdService = 10, NomService = "تسليم النسخ",       Description = "Remise des copies", Etage = "RDC" },
        new Service { IdService = 11, NomService = "الكتابة الخاصة",    Description = "Secrétariat particulier", Etage = "2ème" },
        new Service { IdService = 12, NomService = "الجلسات",           Description = "Audiences", Etage = "1er" },
        new Service { IdService = 13, NomService = "الحفظ",             Description = "Archivage", Etage = "Sous-sol" },
        new Service { IdService = 14, NomService = "الإجراءات",         Description = "Procédures", Etage = "1er" },
        new Service { IdService = 15, NomService = "المستشار المقرر",   Description = "Conseiller rapporteur", Etage = "2ème" },
        new Service { IdService = 16, NomService = "الاستعجالي",        Description = "Référé", Etage = "1er" },
        new Service { IdService = 17, NomService = "قضاء الموضوع",      Description = "Jugement au fond", Etage = "2ème" },
        new Service { IdService = 18, NomService = "المفوض الملكي",     Description = "Commissaire royal", Etage = "2ème" },
        new Service { IdService = 19, NomService = "الرئيس الأول",      Description = "Premier président", Etage = "3ème" }
    };
    db.Services.AddRange(servicesList);
    await db.SaveChangesAsync();

    // ---- Création des utilisateurs de test ----
    db.Utilisateurs.AddRange(
        new Utilisateur { NomComplet = "Administrateur IT",   Login = "admin",    Password = BCrypt.Net.BCrypt.HashPassword("admin123"), IdService = 1 },
        new Utilisateur { NomComplet = "Agent Greffe",        Login = "greffier", Password = BCrypt.Net.BCrypt.HashPassword("test123"), IdService = 2 },
        new Utilisateur { NomComplet = "Agent Caisse",        Login = "caisse",   Password = BCrypt.Net.BCrypt.HashPassword("test123"), IdService = 3 },
        new Utilisateur { NomComplet = "Agent Distribution",  Login = "enreg",    Password = BCrypt.Net.BCrypt.HashPassword("test123"), IdService = 4 }
    );
    await db.SaveChangesAsync();
}

// Middleware pipeline
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
else
{
    app.UseDeveloperExceptionPage();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseCors("ReactPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapControllerRoute(name: "default", pattern: "{controller=Home}/{action=Index}/{id?}");
app.Run();
