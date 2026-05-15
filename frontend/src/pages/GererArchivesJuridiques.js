import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { usePermissions } from '../hooks/usePermissions';

function GererArchivesJuridiques() {
  const { t } = useTranslation();
  const perms = usePermissions();
  const canManageRetraits = perms.canArchive;

  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [motCle, setMotCle] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [globalSuccess, setGlobalSuccess] = useState("");
  const [panelError, setPanelError] = useState("");
  const [panelSuccess, setPanelSuccess] = useState("");
  const [retraitForm, setRetraitForm] = useState(getInitialRetraitForm());
  const userModifiedRetraitDate = useRef(false);

  // ----- Import state (archive-existing) -----
  const [importFile, setImportFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({
    colIdentifiant: '',
    colCabinet: '',
  });
  const [showMapping, setShowMapping] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(fetchArchives, 250);
    return () => clearTimeout(timeout);
  }, [motCle]);

  const fetchArchives = async () => {
    try {
      const url = motCle.trim()
        ? `/api/acteursjudiciaires/archives?motCle=${encodeURIComponent(motCle.trim())}`
        : "/api/acteursjudiciaires/archives";
      const res = await axios.get(url);
      setItems(res.data);
      setGlobalError("");
      if (selectedItem) {
        const refreshed = res.data.find((i) => i.id === selectedItem.id);
        setSelectedItem(refreshed || null);
      }
    } catch (err) {
      setGlobalError(getErrorMessage(err, t("erreur_chargement") || "Erreur de chargement"));
    }
  };

  // ========== RETRAIT HANDLERS ==========
  const handleRetraitChange = (e) => {
    const { name, value } = e.target;
    setRetraitForm((prev) => ({ ...prev, [name]: value }));
    if (name === "dateDeRetrait") userModifiedRetraitDate.current = true;
    if (name === "dateDeRetour" && value && !userModifiedRetraitDate.current) {
      const today = new Date().toISOString().slice(0, 10);
      setRetraitForm((prev) => ({ ...prev, dateDeRetrait: today }));
    }
    setPanelError("");
    setPanelSuccess("");
  };

  const isRetraitReturned = (retrait) => {
    if (!retrait.dateDeRetour) return false;
    if (typeof retrait.dateDeRetour === "string") {
      if (retrait.dateDeRetour === "" || retrait.dateDeRetour.startsWith("0001")) return false;
    }
    return true;
  };

  const isActiveRetrait = (retrait) => !isRetraitReturned(retrait);
  const hasActiveRetrait = (item) => item?.retraits?.some((r) => isActiveRetrait(r));

  const selectItem = (item) => {
    setSelectedItem(item);
    setRetraitForm(getInitialRetraitForm());
    userModifiedRetraitDate.current = false;
    setPanelError("");
    setPanelSuccess("");
    setGlobalError("");
    setGlobalSuccess("");
  };

  const handleSaveRetrait = async (e) => {
    e.preventDefault();
    if (!selectedItem || !canManageRetraits) return;
    if (hasActiveRetrait(selectedItem)) {
      setPanelError(t("retrait_deja_en_cours") || "هذا الملف عليه سحب حالياً. يجب تسجيل الإرجاع أولاً.");
      return;
    }
    if (!retraitForm.motifDeRetrait.trim()) {
      setPanelError(t("motif_retrait_requis") || "Motif requis");
      return;
    }
    try {
      const payload = {
        dateDeRetrait: retraitForm.dateDeRetrait
          ? new Date(retraitForm.dateDeRetrait).toISOString()
          : new Date().toISOString(),
        dateDeRetour: null, // always null on creation
        motifDeRetrait: retraitForm.motifDeRetrait.trim(),
        effectuePar: retraitForm.effectuePar.trim(),
        notes: retraitForm.notes.trim(),
      };
      await axios.post(`/api/acteursjudiciaires/${selectedItem.id}/retraits`, payload);
      setPanelSuccess(t("retrait_enregistre") || "تم تسجيل السحب بنجاح");
      setRetraitForm(getInitialRetraitForm());
      userModifiedRetraitDate.current = false;
      await fetchArchives();
    } catch (err) {
      setPanelError(getErrorMessage(err, t("erreur_retrait") || "Erreur lors du retrait"));
    }
  };

  const handleSaveRetour = async (retraitId) => {
    if (!canManageRetraits) return;
    const retrait = selectedItem?.retraits?.find(r => r.id === retraitId);
    if (!retrait) {
      setPanelError("Retrait introuvable");
      return;
    }
    if (!isActiveRetrait(retrait)) {
      setPanelError(t("retrait_deja_retourne") || "Ce retrait a déjà été retourné.");
      return;
    }
    try {
      await axios.put(`/api/acteursjudiciaires/retraits/${retraitId}/retour`, {
        dateDeRetour: new Date().toISOString(),
        notes: "",
      });
      setPanelSuccess(t("retour_enregistre") || "Retour enregistré");
      await fetchArchives();
    } catch (err) {
      setPanelError(getErrorMessage(err, t("erreur_retour") || "Erreur lors du retour"));
    }
  };

  const handleCancelRetrait = async (retraitId) => {
    if (!canManageRetraits) return;
    if (!window.confirm(t("confirmation_annuler_retrait") || "Annuler ce retrait ?")) return;
    try {
      await axios.delete(`/api/acteursjudiciaires/retraits/${retraitId}`);
      setPanelSuccess(t("retrait_annule") || "Retrait annulé");
      await fetchArchives();
    } catch (err) {
      setPanelError(getErrorMessage(err, t("erreur_annulation_retrait") || "Erreur lors de l'annulation"));
    }
  };

  const closePanel = () => {
    setSelectedItem(null);
    setPanelError("");
    setPanelSuccess("");
  };

  // ========== IMPORT (ARCHIVE EXISTING) HANDLERS ==========
  const handleImportFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/api/acteursjudiciaires/import-archive/preview', formData);
      setHeaders(res.data);
      setShowMapping(true);
      setMapping({ colIdentifiant: '', colCabinet: '', colEmplacement: '' });
    } catch (err) {
      setGlobalError(t('erreur_lecture_fichier'));
    }
  };

  const executeImport = async () => {
    if (!importFile) return;
    const formData = new FormData();
    formData.append('file', importFile);
    const params = new URLSearchParams({
      colIdentifiant: mapping.colIdentifiant,
      colCabinet: mapping.colCabinet || '',
      colEmplacement: mapping.colEmplacement || ''
    });
    try {
      const res = await axios.post(`/api/acteursjudiciaires/import-archive/execute?${params.toString()}`, formData);
      const data = res.data;
      let msg = `${data.archived} dossier(s) archivé(s).`;
      if (data.errors && data.errors.length > 0) {
        msg += `\n\n${t('details_erreurs')} :\n${data.errors.join('\n')}`;
      }
      alert(msg);
      if (data.archived > 0) fetchArchives();
      setShowMapping(false);
      setImportFile(null);
      setMapping({ colIdentifiant: '', colCabinet: '', colEmplacement: '' });
    } catch (err) {
      setGlobalError(t('erreur_import'));
    }
  };

  // ========== EXPORT (ARCHIVES) ==========
  const exportToExcel = () => {
    fetch("/api/acteursjudiciaires/export/archives", {
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
        a.download = "archives-juridiques.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setGlobalError(t("erreur_export") || "Erreur export"));
  };

  const downloadTemplate = () => {
    fetch("/api/acteursjudiciaires/template-excel", {
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
        a.download = "modele_import_archives.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setGlobalError(t("erreur_telechargement_modele") || "Erreur modèle"));
  };

  return (
    <div className="page-container" dir="rtl">
      <h1 className="page-title">{t("menu_archives_juridiques") || "إدارة أرشيف الملفات القضائية"}</h1>
      {globalError && <div className="error-message">{globalError}</div>}
      {globalSuccess && <div className="success-message">{globalSuccess}</div>}
      <div className="registry-panel">
        <div className="registry-panel-header">
          <h3>{t("archives") || "الأرشيف"}</h3>
          <div className="registry-tools">
            <button className="btn-primary" onClick={exportToExcel}>{t('exporter_excel')}</button>
            <label className="btn-secondary" style={{ cursor: 'pointer' }}>
              📂 {t('importer_excel')}
              <input type="file" accept=".xlsx" onChange={handleImportFileSelect} style={{ display: 'none' }} />
            </label>
            <button className="btn-secondary" onClick={downloadTemplate}>📥 {t('telecharger_modele')}</button>
          </div>
        </div>
        <div className="filters">
          <input value={motCle} onChange={(e) => setMotCle(e.target.value)} placeholder={t("rechercher_par_mot") || "بحث..."} />
          <button className="btn-secondary" onClick={() => setMotCle("")}>{t("reinitialiser") || "إعادة تعيين"}</button>
        </div>

        {/* Column mapping panel for archive import */}
        {showMapping && (
          <div className="mapping-panel">
            <h4>{t('associer_colonnes')}</h4>
            <div className="form-grid">
              <div className="form-field">
                <label>{t('colonne_identifiant') || 'Colonne Identifiant'} *</label>
                <select value={mapping.colIdentifiant} onChange={e => setMapping({...mapping, colIdentifiant: e.target.value})}>
                  <option value="">-- {t('choisir')} --</option>
                  {headers.map(h => <option key={h}>{h}</option>)}
                </select>
                <small>{t('identifiant_hint') || 'رقم الاستنافي أو رقم مكتب الضبط'}</small>
              </div>
              <div className="form-field">
                <label>{t('colonne_cabinet') || 'Colonne الخزانة'} ({t('optionnel')})</label>
                <select value={mapping.colCabinet} onChange={e => setMapping({...mapping, colCabinet: e.target.value})}>
                  <option value="">-- {t('choisir')} --</option>
                  {headers.map(h => <option key={h}>{h}</option>)}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-primary" onClick={executeImport}>{t('importer')}</button>
              <button className="btn-secondary" onClick={() => setShowMapping(false)}>{t('annuler')}</button>
            </div>
          </div>
        )}

        <div className="data-table-wrapper">
          <table className="modern-table">
            <thead>
              <tr>
                <th>{t("numero_dossier") || "الرقم الاستئنافي"}</th>
                <th>{t("numero_premiere_instance") || "الرقم الابتدائي"}</th>            
                <th>{t("date") || "التاريخ"}</th>
                <th>{t("tribunal_source") || "المحكمة/المصدر"}</th>
                <th>{t("objet") || "الموضوع"}</th>
                <th>{t("emplacement") || "الموقع"}</th>
                <th>{t("cabinet") || "الخزانة"}</th>
                <th>{t("retraits") || "السحوبات"}</th>
                {canManageRetraits && <th>{t("actions") || "الإجراءات"}</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={canManageRetraits ? 8 : 7}>{t("aucun_element_judiciaire") || "لا توجد ملفات"}</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.numeroDossier || "-"}</td>
                    <td>{item.numeroPremiereInstance || "-"}</td>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.tribunalSource || "-"}</td>
                    <td>{item.sujet || "-"}</td>
                    <td>{item.emplacement || "-"}</td>
                    <td>{item.cabinet || "-"}</td>
                    <td>{item.retraitsCount ?? 0}</td>
                    {canManageRetraits && (
                      <td className="action-icons">
                        <button onClick={() => selectItem(item)}>
                          {t("gerer_retraits") || "إدارة السحب"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retrait management panel – only for Admin and Archive */}
      {selectedItem && canManageRetraits && (
        <div className="form-card archive-service-panel">
          <div className="registry-panel-header">
            <div>
              <h3>{t("service_archives") || "خدمة الأرشيف"}</h3>
              <p>{selectedItem.numeroDossier || "-"} - {selectedItem.sujet}</p>
            </div>
            <button className="btn-secondary" onClick={closePanel}>{t("fermer") || "إغلاق"}</button>
          </div>

          {panelError && <div className="error-message" style={{ marginBottom: "1rem" }}>{panelError}</div>}
          {panelSuccess && <div className="success-message" style={{ marginBottom: "1rem" }}>{panelSuccess}</div>}

          <form onSubmit={handleSaveRetrait}>
            <div className="form-grid">
              <div className="form-field">
                <label>{t("date_retrait") || "تاريخ السحب"}</label>
                <input type="date" name="dateDeRetrait" value={retraitForm.dateDeRetrait} onChange={handleRetraitChange} />
              </div>
              <div className="form-field">
                <label>{t("date_retour") || "تاريخ الإرجاع"} ({t("optionnel") || "اختياري"})</label>
                <input type="date" name="dateDeRetour" value={retraitForm.dateDeRetour} onChange={handleRetraitChange} />
              </div>
              <div className="form-field">
                <label>{t("motif_retrait") || "سبب السحب"} *</label>
                <input name="motifDeRetrait" value={retraitForm.motifDeRetrait} onChange={handleRetraitChange} required />
              </div>
              <div className="form-field">
                <label>{t("effectue_par") || "تم بواسطة"}</label>
                <input name="effectuePar" value={retraitForm.effectuePar} onChange={handleRetraitChange} />
              </div>
              <div className="form-field full-width">
                <label>{t("notes") || "ملاحظات"}</label>
                <textarea name="notes" value={retraitForm.notes} onChange={handleRetraitChange} rows="2" />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">{t("enregistrer_retrait") || "تسجيل السحب"}</button>
            </div>
          </form>

          <div className="data-table-wrapper">
            <h3>{t("historique_retraits") || "سجل السحوبات"}</h3>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>{t("date_retrait") || "تاريخ السحب"}</th>
                  <th>{t("motif_retrait") || "السبب"}</th>
                  <th>{t("effectue_par") || "تم بواسطة"}</th>
                  <th>{t("date_retour") || "تاريخ الإرجاع"}</th>
                  <th>{t("notes") || "ملاحظات"}</th>
                  <th>{t("actions") || "الإجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {(selectedItem.retraits || []).length === 0 ? (
                  <tr><td colSpan="6">{t("aucun_retrait") || "لا توجد سحوبات"}</td></tr>
                ) : (
                  selectedItem.retraits.map((retrait) => {
                    const actif = isActiveRetrait(retrait);
                    return (
                      <tr key={retrait.id}>
                        <td>{formatDate(retrait.dateDeRetrait)}</td>
                        <td>{retrait.motifDeRetrait || "-"}</td>
                        <td>{retrait.effectuePar || "-"}</td>
                        <td>{retrait.dateDeRetour ? formatDate(retrait.dateDeRetour) : "-"}</td>
                        <td>{retrait.notes || "-"}</td>
                        <td className="action-icons">
                          <button
                            onClick={() => handleSaveRetour(retrait.id)}
                            disabled={!actif}
                            style={{ opacity: actif ? 1 : 0.5, cursor: actif ? "pointer" : "not-allowed" }}
                          >
                            {t("retourner") || "إرجاع"}
                          </button>
                          <button
                            onClick={() => handleCancelRetrait(retrait.id)}
                            style={{ backgroundColor: "#dc2626", color: "white" }}
                          >
                            {t("annuler_retrait") || "إلغاء السحب"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== HELPERS ==========
function getInitialRetraitForm() {
  return {
    dateDeRetrait: new Date().toISOString().slice(0, 10),
    dateDeRetour: "",
    motifDeRetrait: "",
    effectuePar: "",
    notes: "",
  };
}

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

export default GererArchivesJuridiques;