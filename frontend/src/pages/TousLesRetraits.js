import React, { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useModal } from "../context/ModalContext";
import { usePermissions } from "../hooks/usePermissions";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../hooks/useConfirm";

function TousLesRetraits() {
  const { t } = useTranslation();
  const { showConfirm } = useModal();
  const { showToast } = useToast();
  const { confirm, ConfirmModalComponent } = useConfirm();
  const perms = usePermissions();
  const canManageRetraits = perms.canArchive;

  const [retraits, setRetraits] = useState([]);
  const [filteredRetraits, setFilteredRetraits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState("");
  const [globalSuccess, setGlobalSuccess] = useState("");
  
  // 🔥 État pour la recherche
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("numero"); // "numero" ou "date"

  // Charger les retraits au montage
  useEffect(() => {
    fetchAllRetraits();
  }, []);

  // Filtrer les retraits quand la recherche change
  useEffect(() => {
    applyFilters();
  }, [searchTerm, searchType, retraits]);

  const fetchAllRetraits = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/acteursjudiciaires/retraits?sort=dateDesc");
      setRetraits(res.data);
      setFilteredRetraits(res.data);
      setGlobalError("");
    } catch (err) {
      setGlobalError(getErrorMessage(err, t("erreur_chargement")));
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Fonction de filtrage
  const applyFilters = () => {
    if (!searchTerm.trim()) {
      setFilteredRetraits(retraits);
      return;
    }

    const term = searchTerm.trim().toLowerCase();
    
    let filtered = retraits.filter((r) => {
      if (searchType === "numero") {
        // Recherche par numéro de dossier
        return (r.dossierNumero && r.dossierNumero.toLowerCase().includes(term)) ||
               (r.dossierSujet && r.dossierSujet.toLowerCase().includes(term));
      } else if (searchType === "date") {
        // Recherche par date (format: DD/MM/YYYY ou YYYY-MM-DD)
        const dateStr = r.dateDeRetrait ? new Date(r.dateDeRetrait).toLocaleDateString() : "";
        const dateStrAr = r.dateDeRetrait ? formatDate(r.dateDeRetrait) : "";
        return dateStr.includes(term) || dateStrAr.includes(term);
      }
      return false;
    });

    setFilteredRetraits(filtered);
  };

  // 🔥 Réinitialiser la recherche
  const resetSearch = () => {
    setSearchTerm("");
    setSearchType("numero");
    setFilteredRetraits(retraits);
    setGlobalError("");
  };

  // ---- Actions ----
  const handleRetour = async (retraitId) => {
    if (!canManageRetraits) {
      showToast(t("access_denied") || "Vous n'avez pas les droits", "error");
      return;
    }
    
    const retrait = retraits.find(r => r.id === retraitId);
    if (!retrait || retrait.dateDeRetour) {
      showToast(t("retrait_deja_retourne") || "Retrait déjà retourné", "warning");
      return;
    }
    
    try {
      await axios.put(`/api/acteursjudiciaires/retraits/${retraitId}/retour`, {
        dateDeRetour: new Date().toISOString(),
        notes: "",
      });
      showToast(t("retour_enregistre") || "Retour enregistré", "success");
      await fetchAllRetraits();
    } catch (err) {
      showToast(getErrorMessage(err, t("erreur_retour")), "error");
    }
  };

  // 🔥 CORRECTION : Utiliser confirm de useConfirm au lieu de showConfirm
  const handleAnnuler = async (retraitId) => {
    if (!canManageRetraits) {
      showToast(t("access_denied") || "Vous n'avez pas les droits", "error");
      return;
    }
    
    const confirmed = await confirm(
      t("confirmation_annuler_retrait") || "Voulez-vous vraiment annuler ce retrait ? Cette action est irréversible.",
      { 
        title: t("attention") || "Attention", 
        confirmText: t("annuler_retrait") || "Annuler le retrait",
        cancelText: t("annuler") || "Annuler"
      }
    );
    
    if (!confirmed) return;
    
    try {
      await axios.delete(`/api/acteursjudiciaires/retraits/${retraitId}`);
      showToast(t("retrait_annule") || "Retrait annulé avec succès", "success");
      await fetchAllRetraits();
    } catch (err) {
      showToast(getErrorMessage(err, t("erreur_annulation_retrait")), "error");
    }
  };

  // ---- Export Excel ----
  const exportToExcel = () => {
    fetch("/api/acteursjudiciaires/export/retraits", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "tous_les_retraits.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => showToast(t("erreur_export") || "Erreur export", "error"));
  };

  return (
    <div className="page-container" dir="rtl">
      <ConfirmModalComponent />
      
      <h1 className="page-title">{t("tous_retraits_titre") || "جميع السحوبات"}</h1>

      {globalError && <div className="error-message">{globalError}</div>}
      {globalSuccess && <div className="success-message">{globalSuccess}</div>}

      <div className="registry-panel">
        <div className="registry-panel-header">
          <h3>{t("liste_retraits") || "قائمة السحوبات"}</h3>
          <div className="registry-tools">
            <button className="btn-primary" onClick={exportToExcel}>
              {t("exporter_excel") || "تصدير Excel"}
            </button>
          </div>
        </div>

        {/* 🔥 BARRE DE RECHERCHE */}
        <div className="filters" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select 
              value={searchType} 
              onChange={(e) => setSearchType(e.target.value)}
              className="form-input"
              style={{ width: 'auto', minWidth: '120px' }}
            >
              <option value="numero">{t('rechercher_par_numero') || 'رقم الملف'}</option>
              <option value="date">{t('rechercher_par_date') || 'التاريخ'}</option>
            </select>
            
            <input
              type="text"
              placeholder={
                searchType === 'numero' 
                  ? (t('rechercher_numero_dossier') || 'بحث برقم الملف...')
                  : (t('rechercher_date') || 'بحث بالتاريخ...')
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ flex: 1, minWidth: '200px' }}
            />
            
            <button className="btn-secondary" onClick={resetSearch}>
              {t('reinitialiser') || 'إعادة تعيين'}
            </button>
            
            <span style={{ marginRight: 'auto', color: '#6b7d90', fontSize: '0.9rem' }}>
              {t('total') || 'المجموع'}: {filteredRetraits.length}
            </span>
          </div>
        </div>

        {loading ? (
          <p>{t("chargement") || "Chargement..."}</p>
        ) : (
          <div className="data-table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>{t("date_retrait") || "تاريخ السحب"}</th>
                  <th>{t("numero_dossier") || "رقم الملف"}</th>
                  <th>{t("sujet") || "الموضوع"}</th>
                  <th>{t("motif_retrait") || "السبب"}</th>
                  <th>{t("effectue_par") || "تم بواسطة"}</th>
                  <th>{t("date_retour") || "تاريخ الإرجاع"}</th>
                  <th>{t("statut") || "الحالة"}</th>
                  {canManageRetraits && <th>{t("actions") || "الإجراءات"}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRetraits.length === 0 ? (
                  <tr>
                    <td colSpan={canManageRetraits ? 8 : 7}>
                      {searchTerm.trim() 
                        ? (t("aucun_resultat") || "لا توجد نتائج مطابقة للبحث")
                        : (t("aucun_retrait_trouve") || "لا توجد سحوبات")}
                    </td>
                  </tr>
                ) : (
                  filteredRetraits.map((r) => {
                    const actif = !r.dateDeRetour;
                    return (
                      <tr key={r.id}>
                        <td>{formatDate(r.dateDeRetrait)}</td>
                        <td>{r.dossierNumero || "-"}</td>
                        <td>{r.dossierSujet || "-"}</td>
                        <td>{r.motifDeRetrait || "-"}</td>
                        <td>{r.effectuePar || "-"}</td>
                        <td>{r.dateDeRetour ? formatDate(r.dateDeRetour) : "-"}</td>
                        <td>
                          {actif
                            ? t("en_cours") || "جاري"
                            : t("retourne") || "مرجع"}
                        </td>
                        {canManageRetraits && (
                          <td className="action-icons">
                            <button
                              onClick={() => handleRetour(r.id)}
                              disabled={!actif}
                              style={{
                                opacity: actif ? 1 : 0.5,
                                cursor: actif ? "pointer" : "not-allowed",
                              }}
                            >
                              {t("retourner") || "إرجاع"}
                            </button>
                            <button
                              onClick={() => handleAnnuler(r.id)}
                              style={{
                                backgroundColor: "#dc2626",
                                color: "white",
                              }}
                            >
                              {t("annuler_retrait") || "إلغاء"}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Helpers ----
function formatDate(value) {
  if (!value) return "-";
  if (value === "0001-01-01T00:00:00" || (typeof value === "string" && value.startsWith("0001"))) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  const data = error.response?.data;
  if (data) {
    if (typeof data === "string") return data;
    if (data.message) return data.message;
    if (data.title) return data.title;
    try { return JSON.stringify(data); } catch { return fallback; }
  }
  if (error.message) return error.message;
  return fallback;
}

export default TousLesRetraits;