using System.ComponentModel.DataAnnotations.Schema;

public class ListItem
{
    public int Id { get; set; }
    public string ListName { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;

    [Column(TypeName = "nvarchar(max)")]
    public string ValueFr { get; set; } = string.Empty;

    [Column(TypeName = "nvarchar(max)")]
    public string ValueAr { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}