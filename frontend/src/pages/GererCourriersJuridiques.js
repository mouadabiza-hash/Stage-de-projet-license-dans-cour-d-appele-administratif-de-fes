import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

function GererCourriersJuridiques({ embedded = false }) {
  const { t } = useTranslation();
  const [courriers, setCourriers] = useState([]);
  const [services, setServices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [motCle, setMotCle] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState(getInitialForm());
  const [selectedArchiveItem, setSelectedArchiveItem] = useState(null);
  const [retraitForm, setRetraitForm] = useState(getInitialRetraitForm());
  const userModifiedRetraitDate = useRef(false);

  useEffect(() => {
    fetchCourriers();
    fetchServices();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(fetchCourriers, 250);
    return () => clearTimeout(timeout);
  }, [motCle]);

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
      if (res.data.length) {
        setForm((prev) => ({ ...prev, idService: prev.idService || res.data[0].idService }));
      }
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
    setError("");
    setSuccess("");
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    const payload = {
      idBureauOrdre: form.idBureauOrdre?.trim() || null,
      date: new Date(form.date).toISOString(),
      tribunalSource: form.tribunalSource.trim(),
      sujet: form.sujet.trim(),
      direction: "Entrant",
      destinataire: form.destinataire.trim(),
      description: form.description.trim(),
      etatArchive: form.etatArchive,
      lienPdf: form.lienPdf.trim(),
      idService: Number(form.idService),
      numeroDossier: form.numeroDossier?.trim() || null,
      estTransmissible: Boolean(form.estTransmissible),
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
    setEditingId(c.id);
    setForm({
      idBureauOrdre: c.idBureauOrdre || "",
      date: c.date ? c.date.slice(0, 10) : "",
      tribunalSource: c.tribunalSource || "",
      numeroDossier: c.numeroDossier || "",
      sujet: c.sujet || "",
      destinataire: c.destinataire || "",
      description: c.description || "",
      etatArchive: c.etatArchive || "Nouveau",
      lienPdf: c.lienPdf || "",
      idService: c.idService || (services.length ? services[0].idService : ""),
      estTransmissible: Boolean(c.estTransmissible),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("confirmation_supprimer") || "Supprimer ?")) return;
    try {
      await axios.delete(`/api/acteursjudiciaires/${id}`);
      setSuccess(t("suppression_succes") || "Supprimé");
      await fetchCourriers();
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_suppression") || "Erreur"));
    }
  };

  const openArchiveService = (c) => {
    setSelectedArchiveItem(c);
    setRetraitForm(getInitialRetraitForm());
    setError("");
    setSuccess("");
  };

  const closeArchiveService = () => setSelectedArchiveItem(null);

  const handleSaveRetrait = async (e) => {
    e.preventDefault();
    if (!selectedArchiveItem) return;
    if (!retraitForm.motifDeRetrait.trim()) {
      setError(t("motif_retrait_requis") || "Motif requis");
      return;
    }
    try {
      const payload = {
        dateDeRetrait: retraitForm.dateDeRetrait ? new Date(retraitForm.dateDeRetrait).toISOString() : new Date().toISOString(),
        dateDeRetour: retraitForm.dateDeRetour ? new Date(retraitForm.dateDeRetour).toISOString() : null,
        motifDeRetrait: retraitForm.motifDeRetrait.trim(),
        effectuePar: retraitForm.effectuePar.trim(),
        notes: retraitForm.notes.trim(),
      };
      await axios.post(`/api/acteursjudiciaires/${selectedArchiveItem.id}/retraits`, payload);
      setSuccess(t("retrait_enregistre") || "Retrait enregistré");
      await fetchCourriers();
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_retrait") || "Erreur"));
    }
  };

  const handleSaveRetour = async (retraitId) => {
    try {
      await axios.put(`/api/acteursjudiciaires/retraits/${retraitId}/retour`, {
        dateDeRetour: new Date().toISOString(),
        notes: "",
      });
      setSuccess(t("retour_enregistre") || "Retour enregistré");
      await fetchCourriers();
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_retour") || "Erreur"));
    }
  };

  const handleCancelRetrait = async (retraitId) => {
    if (!window.confirm(t("confirmation_annuler_retrait") || "Annuler ?")) return;
    try {
      await axios.delete(`/api/acteursjudiciaires/retraits/${retraitId}`);
      setSuccess(t("retrait_annule") || "Retrait annulé");
      await fetchCourriers();
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_annulation_retrait") || "Erreur"));
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(getInitialForm(services));
    setError("");
  };

  const exportToExcel = () => {
    fetch("/api/acteursjudiciaires/export/excel", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "courriers-juridiques.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError(t("erreur_export") || "Erreur export"));
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setImporting(true);
    try {
      const res = await axios.post("/api/acteursjudiciaires/import/excel", formData);
      setSuccess(t("import_succes", { count: res.data.imported }) || `Importé ${res.data.imported}`);
      if (res.data.errors?.length) setError(res.data.errors.join(" | "));
      await fetchCourriers();
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_import") || "Erreur import"));
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className={embedded ? "courriers-juridiques-content" : "page-container"} dir="rtl">
      {!embedded && <h1 className="page-title">{t("menu_dossiers_juridiques") || "الملفات القضائية"}</h1>}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="form-card">
        <h3>{editingId ? t("modifier") : t("ajouter")} {t("courrier_judiciaire") || "مراسلة قضائية"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label>{t("numero_bureau_ordre") || "رقم مكتب الضبط"}</label>
              <input name="idBureauOrdre" value={form.idBureauOrdre} onChange={handleChange} />
            </div>
            <div className="form-field">
              <label>{t("numero_dossier") || "الرقم الاستئنافي"}</label>
              <input name="numeroDossier" value={form.numeroDossier} onChange={handleChange} placeholder="2026/15/3" />
            </div>
            <div className="form-field">
              <label>{t("date") || "التاريخ"} *</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label>{t("tribunal_source") || "المحكمة/المصدر"} *</label>
              <input name="tribunalSource" value={form.tribunalSource} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label>{t("objet") || "الموضوع"} *</label>
              <input name="sujet" value={form.sujet} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label>{t("destinataire") || "المرسل إليه"}</label>
              <input name="destinataire" value={form.destinataire} onChange={handleChange} />
            </div>
            <div className="form-field">
              <label>{t("service") || "المصلحة"} *</label>
              <input type="text" value={services.find(s => s.idService === form.idService)?.nomService || ''} disabled />
              <input type="hidden" name="idService" value={form.idService} />
            </div>
            <div className="form-field">
              <label>{t("etat") || "الحالة"}</label>
              <select name="etatArchive" value={form.etatArchive} onChange={handleChange}>
                <option value="Nouveau">{t("nouveau") || "جديد"}</option>
                <option value="En cours">{t("en_cours") || "قيد المعالجة"}</option>
                <option value="Traite">{t("traite") || "تمت المعالجة"}</option>
                <option value="Archive">{t("archive") || "مؤرشف"}</option>
              </select>
            </div>
            <div className="form-field">
              <label>{t("transmissible") || "قابل للإحالة"}</label>
              <label className="checkbox-field">
                <input type="checkbox" name="estTransmissible" checked={form.estTransmissible} onChange={handleChange} /> {t("oui") || "نعم"}
              </label>
            </div>
            {/* Emplacement field removed – set automatically by backend */}
            <div className="form-field full-width">
              <label>{t("document_pdf_word") || "الوثيقة PDF/Word"}</label>
              <div className="document-control">
                <label className="document-upload-button">
                  {uploading ? t("uploading") || "رفع..." : t("choisir_fichier") || "اختيار ملف"}
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleDocumentSelect} />
                </label>
                <div className={form.lienPdf ? "document-link-preview filled" : "document-link-preview"}>
                  <span title={form.lienPdf}>{form.lienPdf ? getDocumentName(form.lienPdf) : t("aucun_fichier") || "لا ملف"}</span>
                  {form.lienPdf && <a href={getDocumentHref(form.lienPdf)} target="_blank" rel="noreferrer">{t("ouvrir") || "فتح"}</a>}
                </div>
                <div className="document-link-input">
                  <input name="lienPdf" value={form.lienPdf} onChange={handleChange} placeholder={t("lien_manuel") || "رابط"} />
                  {form.lienPdf && <a href={getDocumentHref(form.lienPdf)} target="_blank" rel="noreferrer">{t("ouvrir") || "فتح"}</a>}
                </div>
              </div>
            </div>
            <div className="form-field full-width">
              <label>{t("notes") || "ملاحظات"}</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows="3" />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">{editingId ? t("modifier") || "تعديل" : t("ajouter") || "إضافة"}</button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>{t("annuler") || "إلغاء"}</button>}
          </div>
        </form>
      </div>

      {selectedArchiveItem && (
        <div className="form-card archive-service-panel">
          <div className="registry-panel-header">
            <div><h3>{t("service_archives") || "خدمة الأرشيف"}</h3><p>{selectedArchiveItem.numeroDossier || "-"} - {selectedArchiveItem.sujet}</p></div>
            <button className="btn-secondary" onClick={closeArchiveService}>{t("fermer") || "إغلاق"}</button>
          </div>
          <form onSubmit={handleSaveRetrait}>
            <div className="form-grid">
              <div className="form-field"><label>{t("date_retrait") || "تاريخ السحب"}</label><input type="date" name="dateDeRetrait" value={retraitForm.dateDeRetrait} onChange={handleRetraitChange} /></div>
              <div className="form-field"><label>{t("date_retour") || "تاريخ الإرجاع"} ({t("optionnel") || "اختياري"})</label><input type="date" name="dateDeRetour" value={retraitForm.dateDeRetour} onChange={handleRetraitChange} /></div>
              <div className="form-field"><label>{t("motif_retrait") || "سبب السحب"} *</label><input name="motifDeRetrait" value={retraitForm.motifDeRetrait} onChange={handleRetraitChange} required /></div>
              <div className="form-field"><label>{t("effectue_par") || "تم بواسطة"}</label><input name="effectuePar" value={retraitForm.effectuePar} onChange={handleRetraitChange} /></div>
              <div className="form-field full-width"><label>{t("notes") || "ملاحظات"}</label><textarea name="notes" value={retraitForm.notes} onChange={handleRetraitChange} rows="2" /></div>
            </div>
            <div className="form-actions"><button type="submit" className="btn-primary">{t("enregistrer_retrait") || "تسجيل السحب"}</button></div>
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
                {(selectedArchiveItem.retraits || []).length === 0 ? (
                  <tr><td colSpan="6">{t("aucun_retrait") || "لا توجد سحوبات"}</td></tr>
                ) : (
                  selectedArchiveItem.retraits.map((retrait) => {
                    const active = !retrait.dateDeRetour || (typeof retrait.dateDeRetour === "string" && (retrait.dateDeRetour === "" || retrait.dateDeRetour.startsWith("0001")));
                    return (
                      <tr key={retrait.id}>
                        <td>{formatDate(retrait.dateDeRetrait)}</td>
                        <td>{retrait.motifDeRetrait || "-"}</td>
                        <td>{retrait.effectuePar || "-"}</td>
                        <td>{retrait.dateDeRetour ? formatDate(retrait.dateDeRetour) : "-"}</td>
                        <td>{retrait.notes || "-"}</td>
                        <td className="action-icons">
                          <button onClick={() => handleSaveRetour(retrait.id)} disabled={!active} style={{ opacity: active ? 1 : 0.5 }}>{t("retourner") || "إرجاع"}</button>
                          <button onClick={() => handleCancelRetrait(retrait.id)} style={{ backgroundColor: "#dc2626", color: "white" }}>{t("annuler_retrait") || "إلغاء السحب"}</button>
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

      <div className="registry-panel">
        <div className="registry-panel-header">
          <h3>{t("recherche_registre") || "البحث والسجل"}</h3>
          <div className="registry-tools">
            <button className="btn-primary" onClick={exportToExcel}>{t("exporter_excel") || "تصدير Excel"}</button>
            <label className="btn-secondary import-label">
              {importing ? t("importing") || "استيراد..." : t("importer_excel") || "استيراد Excel"}
              <input type="file" accept=".xlsx" onChange={handleImportExcel} />
            </label>
          </div>
        </div>
        <div className="filters">
          <input value={motCle} onChange={(e) => setMotCle(e.target.value)} placeholder={t("rechercher_par_mot") || "بحث..."} />
          <button className="btn-secondary" onClick={() => setMotCle("")}>{t("reinitialiser") || "إعادة تعيين"}</button>
        </div>
        <div className="data-table-wrapper">
          <table className="modern-table">
            <thead>
              <tr>
                <th>{t("numero_bureau_ordre") || "رقم مكتب الضبط"}</th>
                <th>{t("numero_dossier") || "الرقم الاستئنافي"}</th>
                <th>{t("date") || "التاريخ"}</th>
                <th>{t("tribunal_source") || "المحكمة/المصدر"}</th>
                <th>{t("objet") || "الموضوع"}</th>
                <th>{t("destinataire") || "المرسل إليه"}</th>
                <th>{t("service") || "المصلحة"}</th>
                <th>{t("etat") || "الحالة"}</th>
                <th>{t("emplacement") || "الموقع"}</th>
                <th>{t("retraits") || "السحوبات"}</th>
                <th>PDF</th>
                <th>{t("actions") || "الإجراءات"}</th>
              </tr>
            </thead>
            <tbody>
              {courriers.length === 0 ? (
                <tr><td colSpan="12">{t("aucun_element_judiciaire") || "لا توجد ملفات"}</td></tr>
              ) : (
                courriers.map(c => (
                  <tr key={c.id}>
                    <td>{c.idBureauOrdre || "-"}</td>
                    <td>{c.numeroDossier || "-"}</td>
                    <td>{formatDate(c.date)}</td>
                    <td>{c.tribunalSource || "-"}</td>
                    <td>{c.sujet || "-"}</td>
                    <td>{c.destinataire || "-"}</td>
                    <td>{c.serviceNom || c.idService || "-"}</td>
                    <td>{formatEtat(c.etatArchive)}</td>
                    <td>{c.emplacement || "-"}</td>
                    <td>{c.retraitsCount ?? 0}</td>
                    <td>{c.lienPdf ? <a href={getDocumentHref(c.lienPdf)} target="_blank" rel="noreferrer">{t("ouvrir") || "فتح"}</a> : "-"}</td>
                    <td className="action-icons">
                      <button onClick={() => handleEdit(c)}>{t("modifier") || "تعديل"}</button>
                      <button onClick={() => handleDelete(c.id)}>{t("supprimer") || "حذف"}</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ========== HELPER FUNCTIONS ==========
function getInitialForm(services = []) {
  return {
    idBureauOrdre: "", date: "", tribunalSource: "", numeroDossier: "", sujet: "", destinataire: "", description: "",
    etatArchive: "Nouveau", lienPdf: "", idService: services.length ? services[0].idService : "", estTransmissible: true,
  };
}
function getInitialRetraitForm() {
  return { dateDeRetrait: new Date().toISOString().slice(0, 10), dateDeRetour: "", motifDeRetrait: "", effectuePar: "", notes: "" };
}
function validateForm(f) {
  if (!f.date) return "التاريخ إجباري";
  if (!f.tribunalSource.trim()) return "المحكمة / المصدر إجباري";
  if (!f.sujet.trim()) return "الموضوع إجباري";
  if (!f.idService) return "المصلحة إجبارية";
  return "";
}
function formatDate(v) { return v ? new Date(v).toLocaleDateString() : "-"; }
function formatEtat(v) {
  if (v === "En cours") return "قيد المعالجة";
  if (v === "Traite") return "تمت المعالجة";
  if (v === "Archive") return "مؤرشف";
  return "جديد";
}
function getDocumentHref(v) {
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  const nv = v.startsWith("/") ? v : `/${v}`;
  return window.location.hostname === "localhost" && window.location.port === "3000" ? `http://localhost:5127${nv}` : nv;
}
function getDocumentName(v) {
  if (!v) return "";
  const clean = String(v).split("?")[0].split("#")[0];
  return decodeURIComponent(clean.split("/").filter(Boolean).pop() || clean);
}
function getErrorMessage(err, fb) {
  if (!err) return fb;
  if (typeof err === "string") return err;
  const data = err.response?.data;
  if (data) {
    if (typeof data === "string") return data;
    if (data.message) return data.message;
    try { return JSON.stringify(data); } catch { return fb; }
  }
  return err.message || fb;
}
export default GererCourriersJuridiques;