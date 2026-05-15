import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import GenericImportModal from "../components/GenericImportModal";

function GererCourriersJuridiques({ embedded = false, perms }) {
  const hookPerms = usePermissions();
  const effectivePerms = perms || hookPerms;
  const { t } = useTranslation();
  const { user } = useAuth();
  const userServiceId = user?.idService;
  const role = user?.role;

  // Table column visibility
  const showBureauOrdreCol = role === 'Admin' || role === 'Greffier';
  const showNumeroDossierCol = role !== 'Greffier';   // visible for everyone except greffier

  // Form field visibility
  const showIdBureauOrdreInput = role === 'Admin' || role === 'Greffier';   // optional, only for these roles
  const showNumeroDossierInput = role === 'Admin' || role === 'Greffier';   // optional, only for these roles

  const [courriers, setCourriers] = useState([]);
  const [services, setServices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [motCle, setMotCle] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(getInitialFormInternal());
  const [selectedArchiveItem, setSelectedArchiveItem] = useState(null);
  const [retraitForm, setRetraitForm] = useState(getInitialRetraitForm());
  const userModifiedRetraitDate = useRef(false);

  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);

  function getInitialFormInternal() {
    return {
      idBureauOrdre: "",
      date: "",
      tribunalSource: "",
      numeroDossier: "",
      numeroPremiereInstance: "",
      sujet: "",
      description: "",
      etatArchive: "Nouveau",
      lienPdf: "",
      idService: userServiceId || "",
      estTransmissible: true,
    };
  }

  useEffect(() => { fetchCourriers(); fetchServices(); }, []);
  useEffect(() => { const timeout = setTimeout(fetchCourriers, 250); return () => clearTimeout(timeout); }, [motCle]);
  useEffect(() => { setCurrentPage(1); }, [motCle, courriers.length]);

  const fetchCourriers = async () => {
    try {
      const url = motCle.trim()
        ? `/api/acteursjudiciaires/search?motCle=${encodeURIComponent(motCle.trim())}`
        : "/api/acteursjudiciaires";
      const res = await axios.get(url);
      setCourriers(res.data);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_chargement") || "Erreur de chargement"));
    }
  };

  const fetchServices = async () => {
    try {
      const res = await axios.get("/api/services");
      setServices(res.data);
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_chargement") || "Erreur de chargement"));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name === "idService" ? Number(value) : value,
    }));
  };

  const handleRetraitChange = (e) => {
    const { name, value } = e.target;
    setRetraitForm((prev) => ({ ...prev, [name]: value }));
    if (name === "dateDeRetrait") userModifiedRetraitDate.current = true;
    if (name === "dateDeRetour" && value && !userModifiedRetraitDate.current) {
      const today = new Date().toISOString().slice(0, 10);
      setRetraitForm((prev) => ({ ...prev, dateDeRetrait: today }));
    }
  };

  const handleDocumentSelect = async (e) => {
    if (!effectivePerms.canCreateJuridique) return;
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const res = await axios.post("/api/acteursjudiciaires/upload-pdf", formData);
      setForm((prev) => ({ ...prev, lienPdf: res.data.lienPdf }));
      setSuccess(t("document_uploaded") || "Document téléchargé");
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_upload") || "Erreur d'upload"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!effectivePerms.canCreateJuridique) return;
    setError(""); setSuccess("");
    const validationError = validateForm(form);
    if (validationError) { setError(validationError); return; }
    const payload = {
      idBureauOrdre: showIdBureauOrdreInput ? (form.idBureauOrdre?.trim() || null) : null,
      date: new Date(form.date).toISOString(),
      tribunalSource: form.tribunalSource.trim(),
      sujet: form.sujet.trim(),
      direction: "Entrant",
      description: form.description.trim(),
      etatArchive: form.etatArchive,
      lienPdf: form.lienPdf.trim(),
      idService: Number(form.idService),
      numeroDossier: showNumeroDossierInput ? (form.numeroDossier?.trim() || null) : null,
      estTransmissible: Boolean(form.estTransmissible),
      numeroPremiereInstance: form.numeroPremiereInstance?.trim() || null,
    };
    try {
      if (editingId) {
        await axios.put(`/api/acteursjudiciaires/${editingId}`, payload);
        setSuccess(t("modification_succes") || "Modifié");
      } else {
        await axios.post("/api/acteursjudiciaires", payload);
        setSuccess(t("ajout_succes") || "Ajouté");
      }
      resetForm();
      await fetchCourriers();
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_enregistrement") || "Erreur"));
    }
  };

  const handleEdit = (c) => {
    if (!effectivePerms.canCreateJuridique) return;
    setEditingId(c.id);
    setForm({
      idBureauOrdre: c.idBureauOrdre || "",
      date: c.date ? c.date.slice(0, 10) : "",
      tribunalSource: c.tribunalSource || "",
      numeroDossier: c.numeroDossier || "",
      numeroPremiereInstance: c.numeroPremiereInstance || "",
      sujet: c.sujet || "",
      description: c.description || "",
      etatArchive: c.etatArchive || "Nouveau",
      lienPdf: c.lienPdf || "",
      idService: c.idService || userServiceId,
      estTransmissible: Boolean(c.estTransmissible),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!effectivePerms.canDelete) return;
    if (!window.confirm(t("confirmation_supprimer") || "Supprimer ?")) return;
    try {
      await axios.delete(`/api/acteursjudiciaires/${id}`);
      setSuccess(t("suppression_succes") || "Supprimé");
      await fetchCourriers();
    } catch (err) { setError(getErrorMessage(err, t("erreur_suppression") || "Erreur")); }
  };

  const openArchiveService = (c) => {
    if (!effectivePerms.canArchive) return;
    setSelectedArchiveItem(c);
    setRetraitForm(getInitialRetraitForm());
    setError(""); setSuccess("");
  };
  const closeArchiveService = () => setSelectedArchiveItem(null);

  const handleSaveRetrait = async (e) => {
    e.preventDefault();
    if (!effectivePerms.canArchive || !selectedArchiveItem) return;
    if (!retraitForm.motifDeRetrait.trim()) { setError(t("motif_retrait_requis") || "Motif requis"); return; }
    try {
      const payload = {
        dateDeRetrait: retraitForm.dateDeRetrait ? new Date(retraitForm.dateDeRetrait).toISOString() : new Date().toISOString(),
        dateDeRetour: null,
        motifDeRetrait: retraitForm.motifDeRetrait.trim(),
        effectuePar: retraitForm.effectuePar.trim(),
        notes: retraitForm.notes.trim(),
      };
      await axios.post(`/api/acteursjudiciaires/${selectedArchiveItem.id}/retraits`, payload);
      setSuccess(t("retrait_enregistre") || "Retrait enregistré");
      await fetchCourriers();
    } catch (err) { setError(getErrorMessage(err, t("erreur_retrait") || "Erreur")); }
  };

  const handleSaveRetour = async (retraitId) => {
    if (!effectivePerms.canArchive) return;
    try {
      await axios.put(`/api/acteursjudiciaires/retraits/${retraitId}/retour`, { dateDeRetour: new Date().toISOString(), notes: "" });
      setSuccess(t("retour_enregistre") || "Retour enregistré");
      await fetchCourriers();
    } catch (err) { setError(getErrorMessage(err, t("erreur_retour") || "Erreur")); }
  };

  const handleCancelRetrait = async (retraitId) => {
    if (!effectivePerms.canArchive) return;
    if (!window.confirm(t("confirmation_annuler_retrait") || "Annuler ?")) return;
    try {
      await axios.delete(`/api/acteursjudiciaires/retraits/${retraitId}`);
      setSuccess(t("retrait_annule") || "Retrait annulé");
      await fetchCourriers();
    } catch (err) { setError(getErrorMessage(err, t("erreur_annulation_retrait") || "Erreur")); }
  };

  const resetForm = () => { setEditingId(null); setForm(getInitialFormInternal()); setError(""); };

  const exportToExcel = () => {
    if (!effectivePerms.canExport) return;
    fetch("/api/acteursjudiciaires/export/excel", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(res => res.blob()).then(blob => {
        const url = URL.createObjectURL(blob); const a = document.createElement("a");
        a.href = url; a.download = "courriers-juridiques.xlsx"; a.click(); URL.revokeObjectURL(url);
      }).catch(() => setError(t("erreur_export")));
  };

  const downloadTemplate = async () => {
    if (!effectivePerms.canCreateJuridique) return;
    const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:5127";
    const res = await fetch(`${baseUrl}/api/acteursjudiciaires/template-excel`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "modele_import_juridiques.xlsx"; a.click(); URL.revokeObjectURL(url);
  };

  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const currentCourriers = courriers.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(courriers.length / rowsPerPage);
  const handlePageChange = (newPage) => { if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage); };

  return (
    <div className={embedded ? "courriers-juridiques-content" : "page-container"} dir="rtl">
      {!embedded && <h1 className="page-title">{t("menu_dossiers_juridiques") || "الملفات القضائية"}</h1>}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {effectivePerms.canCreateJuridique && (
        <div className="form-card">
          <h3>{editingId ? t("modifier") : t("ajouter")} {t("courrier_judiciaire") || "مراسلة قضائية"}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* Optional IdBureauOrdre – only for Admin and Greffier */}
              {showIdBureauOrdreInput && (
                <div className="form-field">
                  <label>{t("numero_bureau_ordre") || "رقم مكتب الضبط"}</label>
                  <input name="idBureauOrdre" value={form.idBureauOrdre} onChange={handleChange} placeholder="12/2026" />
                </div>
              )}
              <div className="form-field"><label>{t("date") || "التاريخ"} *</label><input type="date" name="date" value={form.date} onChange={handleChange} required /></div>
              <div className="form-field"><label>{t("tribunal_source") || "المحكمة/المصدر"} *</label><input name="tribunalSource" value={form.tribunalSource} onChange={handleChange} required /></div>
              {/* Optional NumeroDossier – only for Admin and Greffier */}
              {showNumeroDossierInput && (
                <div className="form-field">
                  <label>{t("numero_dossier") || "الرقم الاستئنافي"}</label>
                  <input name="numeroDossier" value={form.numeroDossier} onChange={handleChange} placeholder="2026/15/3" />
                </div>
              )}
              <div className="form-field"><label>{t("numero_premiere_instance") || "الرقم الابتدائي"}</label><input name="numeroPremiereInstance" value={form.numeroPremiereInstance} onChange={handleChange} placeholder="2026/12" /></div>
              <div className="form-field"><label>{t("objet") || "الموضوع"} *</label><input name="sujet" value={form.sujet} onChange={handleChange} required /></div>
              <div className="form-field"><label>{t("service") || "المصلحة"} *</label><input type="text" value={services.find(s => s.idService === form.idService)?.nomService || ""} disabled /><input type="hidden" name="idService" value={form.idService} /></div>
              <div className="form-field"><label>{t("etat") || "الحالة"}</label><select name="etatArchive" value={form.etatArchive} onChange={handleChange}><option value="Nouveau">{t("nouveau") || "جديد"}</option><option value="En cours">{t("en_cours") || "قيد المعالجة"}</option><option value="Traite">{t("traite") || "تمت المعالجة"}</option><option value="Archive">{t("archive") || "مؤرشف"}</option></select></div>
              <div className="form-field"><label>{t("transmissible") || "قابل للإحالة"}</label><label className="checkbox-field"><input type="checkbox" name="estTransmissible" checked={form.estTransmissible} onChange={handleChange} /> {t("oui") || "نعم"}</label></div>
              <div className="form-field full-width"><label>{t("document_pdf_word") || "الوثيقة PDF/Word"}</label><div className="document-control"><label className="document-upload-button">{uploading ? t("uploading") || "رفع..." : t("choisir_fichier") || "اختيار ملف"}<input type="file" accept=".pdf,.doc,.docx" onChange={handleDocumentSelect} /></label><div className={form.lienPdf ? "document-link-preview filled" : "document-link-preview"}><span title={form.lienPdf}>{form.lienPdf ? getDocumentName(form.lienPdf) : t("aucun_fichier") || "لا ملف"}</span>{form.lienPdf && <a href={getDocumentHref(form.lienPdf)} target="_blank" rel="noreferrer">{t("ouvrir") || "فتح"}</a>}</div><div className="document-link-input"><input name="lienPdf" value={form.lienPdf} onChange={handleChange} placeholder={t("lien_manuel") || "رابط"} />{form.lienPdf && <a href={getDocumentHref(form.lienPdf)} target="_blank" rel="noreferrer">{t("ouvrir") || "فتح"}</a>}</div></div></div>
              <div className="form-field full-width"><label>{t("notes") || "ملاحظات"}</label><textarea name="description" value={form.description} onChange={handleChange} rows="3" /></div>
            </div>
            <div className="form-actions"><button type="submit" className="btn-primary">{editingId ? t("modifier") : t("ajouter")}</button>{editingId && <button type="button" className="btn-secondary" onClick={resetForm}>{t("annuler")}</button>}</div>
          </form>
        </div>
      )}

      {effectivePerms.canArchive && selectedArchiveItem && (
        <div className="form-card archive-service-panel">
          {/* retrait panel unchanged */}
        </div>
      )}

      <div className="registry-panel">
        <div className="registry-panel-header">
          <h3>{t("recherche_registre") || "البحث والسجل"}</h3>
          <div className="registry-tools">
            {effectivePerms.canExport && <button className="btn-primary" onClick={exportToExcel}>{t("exporter_excel")}</button>}
            {effectivePerms.canCreateJuridique && <button className="btn-secondary" onClick={() => setShowImportModal(true)}>📂 {t("importer_excel")}</button>}
            {effectivePerms.canCreateJuridique && <button className="btn-secondary" onClick={downloadTemplate}>📥 {t("telecharger_modele")}</button>}
          </div>
        </div>
        <div className="filters"><input value={motCle} onChange={(e) => setMotCle(e.target.value)} placeholder={t("rechercher_par_mot") || "بحث..."} /><button className="btn-secondary" onClick={() => setMotCle("")}>{t("reinitialiser")}</button></div>
        <div className="data-table-wrapper">
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "1rem" }}>
            <div className="rows-per-page"><span>{t("afficher")}</span><select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option></select><span>{t("lignes")}</span></div>
          </div>
          <table className="modern-table">
            <thead>
              <tr>
                {showBureauOrdreCol && <th>{t("numero_bureau_ordre") || "رقم مكتب الضبط"}</th>}
                <th>{t("date") || "التاريخ"}</th>
                <th>{t("tribunal_source") || "المحكمة/المصدر"}</th>
                {showNumeroDossierCol && <th>{t("numero_dossier") || "الرقم الاستئنافي"}</th>}
                <th>{t("numero_premiere_instance") || "الرقم الابتدائي"}</th>
                <th>{t("objet") || "الموضوع"}</th>
                <th>{t("service") || "المصلحة"}</th>
                <th>{t("etat") || "الحالة"}</th>
                <th>{t("emplacement") || "الموقع"}</th>
                <th>{t("retraits") || "السحوبات"}</th>
                <th>PDF</th>
                <th>{t("actions") || "الإجراءات"}</th>
              </tr>
            </thead>
            <tbody>
              {currentCourriers.length === 0 ? (
                <tr><td colSpan={ (showBureauOrdreCol ? 1 : 0) + 1 + 1 + (showNumeroDossierCol ? 1 : 0) + 1 + 1 + 1 + 1 + 1 + 1 + 1 }>{t("aucun_element_judiciaire")}</td></tr>
              ) : (
                currentCourriers.map((c) => (
                  <tr key={c.id}>
                    {showBureauOrdreCol && <td>{c.idBureauOrdre || "-"}</td>}
                    <td>{formatDate(c.date)}</td>
                    <td>{c.tribunalSource || "-"}</td>
                    {showNumeroDossierCol && <td>{c.numeroDossier || "-"}</td>}
                    <td>{c.numeroPremiereInstance || "-"}</td>
                    <td>{c.sujet || "-"}</td>
                    <td>{c.serviceNom || c.idService || "-"}</td>
                    <td>{formatEtat(c.etatArchive)}</td>
                    <td>{c.emplacement || "-"}</td>
                    <td>{c.retraitsCount ?? 0}</td>
                    <td>{c.lienPdf ? <a href={getDocumentHref(c.lienPdf)} target="_blank" rel="noreferrer">{t("ouvrir") || "فتح"}</a> : "-"}</td>
                    <td className="action-icons">
                      {effectivePerms.canCreateJuridique && <button onClick={() => handleEdit(c)}>{t("modifier") || "تعديل"}</button>}
                      {effectivePerms.canArchive && <button onClick={() => openArchiveService(c)}>{t("service_archives") || "خدمة الأرشيف"}</button>}
                      {effectivePerms.canDelete && <button onClick={() => handleDelete(c.id)}>{t("supprimer") || "حذف"}</button>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {totalPages > 1 && (<div className="pagination"><button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>{t("precedent")}</button><span>{t("page")} {currentPage} / {totalPages}</span><button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>{t("suivant")}</button></div>)}
        </div>
      </div>

      {effectivePerms.canCreateJuridique && <GenericImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title={t("importer_juridiques")} endpoint="/api/acteursjudiciaires/import/excel" requiredColumns={["رقم مكتب الضبط", "التاريخ", "المحكمة/المصدر", "الموضوع"]} onSuccess={fetchCourriers} />}
    </div>
  );
}

// Helper functions unchanged
function getInitialRetraitForm() { return { dateDeRetrait: new Date().toISOString().slice(0,10), dateDeRetour: "", motifDeRetrait: "", effectuePar: "", notes: "" }; }
function validateForm(f) { if (!f.date) return "التاريخ إجباري"; if (!f.tribunalSource.trim()) return "المحكمة / المصدر إجباري"; if (!f.sujet.trim()) return "الموضوع إجباري"; if (!f.idService) return "المصلحة إجبارية"; return ""; }
function formatDate(v) { return v ? new Date(v).toLocaleDateString() : "-"; }
function formatEtat(v) { if (v === "En cours") return "قيد المعالجة"; if (v === "Traite") return "تمت المعالجة"; if (v === "Archive") return "مؤرشف"; return "جديد"; }
function getDocumentHref(v) { if (!v) return ""; if (/^https?:\/\//i.test(v)) return v; const nv = v.startsWith("/") ? v : `/${v}`; return window.location.hostname === "localhost" && window.location.port === "3000" ? `http://localhost:5127${nv}` : nv; }
function getDocumentName(v) { if (!v) return ""; const clean = String(v).split("?")[0].split("#")[0]; return decodeURIComponent(clean.split("/").filter(Boolean).pop() || clean); }
function getErrorMessage(err, fb) { if (!err) return fb; if (typeof err === "string") return err; const data = err.response?.data; if (data) { if (typeof data === "string") return data; if (data.message) return data.message; try { return JSON.stringify(data); } catch { return fb; } } return err.message || fb; }

export default GererCourriersJuridiques;