import React, { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useModal } from "../context/ModalContext";
import { usePermissions } from "../hooks/usePermissions";

function TousLesRetraits() {
  const { t } = useTranslation();
  const { showConfirm } = useModal();
  const perms = usePermissions();
  const canManageRetraits = perms.canArchive;

  const [retraits, setRetraits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState("");
  const [globalSuccess, setGlobalSuccess] = useState("");

  // Charger les retraits au montage
  useEffect(() => {
    fetchAllRetraits();
  }, []);

  const fetchAllRetraits = async () => {
    try {
      setLoading(true);
      // Adaptez l'URL selon votre API
      const res = await axios.get("/api/acteursjudiciaires/retraits?sort=dateDesc");
      setRetraits(res.data);
      setGlobalError("");
    } catch (err) {
      setGlobalError(getErrorMessage(err, t("erreur_chargement")));
    } finally {
      setLoading(false);
    }
  };

  // ---- Actions ----
  const handleRetour = async (retraitId) => {
    if (!canManageRetraits) return;
    const retrait = retraits.find(r => r.id === retraitId);
    if (!retrait || retrait.dateDeRetour) {
      setGlobalError(t("retrait_deja_retourne") || "Retrait déjà retourné");
      return;
    }
    try {
      await axios.put(`/api/acteursjudiciaires/retraits/${retraitId}/retour`, {
        dateDeRetour: new Date().toISOString(),
        notes: "",
      });
      setGlobalSuccess(t("retour_enregistre") || "Retour enregistré");
      await fetchAllRetraits();
    } catch (err) {
      setGlobalError(getErrorMessage(err, t("erreur_retour")));
    }
  };

  const handleAnnuler = async (retraitId) => {
    if (!canManageRetraits) return;
    const confirmed = await showConfirm(t("confirmation_annuler_retrait") || "Annuler ce retrait ?", null, t("confirmation"));
    if (!confirmed) return;
    try {
      await axios.delete(`/api/acteursjudiciaires/retraits/${retraitId}`);
      setGlobalSuccess(t("retrait_annule") || "Retrait annulé");
      await fetchAllRetraits();
    } catch (err) {
      setGlobalError(getErrorMessage(err, t("erreur_annulation_retrait")));
    }
  };

  // ---- Export Excel (optionnel) ----
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
      .catch(() => setGlobalError(t("erreur_export") || "Erreur export"));
  };

  return (
    <div className="page-container" dir="rtl">
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
                {retraits.length === 0 ? (
                  <tr>
                    <td colSpan={canManageRetraits ? 8 : 7}>
                      {t("aucun_retrait_trouve") || "لا توجد سحوبات"}
                    </td>
                  </tr>
                ) : (
                  retraits.map((r) => {
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

// ---- Helpers (identiques à ceux de GererArchivesJuridiques) ----
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