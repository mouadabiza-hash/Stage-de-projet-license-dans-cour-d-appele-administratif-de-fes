using GestionCourrier.Models;
using GestionCourrier.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Unicode;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews()
    .AddJsonOptions(options =>
    {
        // Force UTF-8 encoding without escaping Arabic characters
        options.JsonSerializerOptions.Encoder = JavaScriptEncoder.Create(UnicodeRanges.BasicLatin, UnicodeRanges.Arabic);
        // No Encoding property – remove it
    });

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

// -------------------- SEED (only if database is empty) --------------------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.Migrate();

    if (!await db.Services.AnyAsync())
    {
        // 19 services
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

        // 6 test users with roles
        db.Utilisateurs.AddRange(
            new Utilisateur { NomComplet = "Administrateur IT",   Login = "admin",      Password = BCrypt.Net.BCrypt.HashPassword("admin123"), IdService = 1,  Role = AppRoles.Admin },
            new Utilisateur { NomComplet = "Directeur Général",   Login = "directeur",  Password = BCrypt.Net.BCrypt.HashPassword("test123"),  IdService = 1,  Role = AppRoles.Directeur },
            new Utilisateur { NomComplet = "Agent Greffe",        Login = "greffier",   Password = BCrypt.Net.BCrypt.HashPassword("test123"),  IdService = 2,  Role = AppRoles.Greffier },
            new Utilisateur { NomComplet = "Agent Enregistrement",Login = "enreg",      Password = BCrypt.Net.BCrypt.HashPassword("test123"),  IdService = 4,  Role = AppRoles.Enregistrement },
            new Utilisateur { NomComplet = "Agent Archive",       Login = "archive",    Password = BCrypt.Net.BCrypt.HashPassword("test123"),  IdService = 13, Role = AppRoles.Archive },
            new Utilisateur { NomComplet = "Employé Standard",    Login = "employe",    Password = BCrypt.Net.BCrypt.HashPassword("test123"),  IdService = 5,  Role = AppRoles.Employe }
        );
        await db.SaveChangesAsync();
    }
}
// ------------------------------------------------------------------------

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
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads/documents")),
    RequestPath = "/uploads/documents"
});

app.UseRouting();
app.UseCors("ReactPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapControllerRoute(name: "default", pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();