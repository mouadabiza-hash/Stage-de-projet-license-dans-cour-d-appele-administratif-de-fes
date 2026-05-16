import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

function GererCourriersJuridiques() {
  const perms = usePermissions();
  const { t } = useTranslation();
  const { user } = useAuth();
  const userServiceId = user?.idService;
  const role = user?.role;

  // Access control – only Enregistrement
  if (role !== 'Enregistrement' && role !== 'Admin') {   // Admin can still access but won't via menu
    return <div className="error-message">{t('access_denied') || 'Accès refusé'}</div>;
  }

  const [services, setServices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(getInitialFormInternal());

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

  useEffect(() => { fetchServices(); }, []);

  const fetchServices = async () => {
    try { const res = await axios.get("/api/services"); setServices(res.data); } catch (err) {}
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : name === "idService" ? Number(value) : value }));
  };

  const handleDocumentSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const res = await axios.post("/api/acteursjudiciaires/upload-pdf", formData);
      setForm(prev => ({ ...prev, lienPdf: res.data.lienPdf }));
      setSuccess(t("document_uploaded") || "Document téléchargé");
    } catch (err) { setError(getErrorMessage(err, t("erreur_upload") || "Erreur d'upload")); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.date || !form.tribunalSource.trim() || !form.sujet.trim() || !form.idService) {
      setError(t("erreur_champs") || "Champs obligatoires manquants");
      return;
    }
    const payload = {
      idBureauOrdre: form.idBureauOrdre?.trim() || null,
      date: new Date(form.date).toISOString(),
      tribunalSource: form.tribunalSource.trim(),
      sujet: form.sujet.trim(),
      direction: "Entrant",
      description: form.description.trim(),
      etatArchive: form.etatArchive,
      lienPdf: form.lienPdf.trim(),
      idService: Number(form.idService),
      numeroDossier: form.numeroDossier?.trim() || null,
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
    } catch (err) { setError(getErrorMessage(err, t("erreur_enregistrement") || "Erreur")); }
  };

  const handleEdit = (c) => {
    // not used because we removed the table, but keep for possible future use
  };

  const resetForm = () => { setEditingId(null); setForm(getInitialFormInternal()); setError(""); };

  return (
    <div className="page-container" dir="rtl">
      <h1 className="page-title">{t("menu_dossiers_juridiques") || "تدبير الملفات القضائية"}</h1>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="form-card">
        <h3>{editingId ? t("modifier") : t("ajouter")} {t("courrier_judiciaire") || "مراسلة قضائية"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field"><label>{t("date") || "التاريخ"} *</label><input type="date" name="date" value={form.date} onChange={handleChange} required /></div>
            <div className="form-field"><label>{t("tribunal_source") || "المحكمة/المصدر"} *</label><input name="tribunalSource" value={form.tribunalSource} onChange={handleChange} required /></div>
            <div className="form-field"><label>{t("numero_dossier") || "الرقم الاستئنافي"}</label><input name="numeroDossier" value={form.numeroDossier} onChange={handleChange} placeholder="2026/15/3" /></div>
            <div className="form-field"><label>{t("numero_premiere_instance") || "الرقم الابتدائي"}</label><input name="numeroPremiereInstance" value={form.numeroPremiereInstance} onChange={handleChange} placeholder="2026/12" /></div>
            <div className="form-field"><label>{t("objet") || "الموضوع"} *</label><input name="sujet" value={form.sujet} onChange={handleChange} required /></div>
            <div className="form-field"><label>{t("service") || "المصلحة"} *</label>
              <input type="text" value={services.find(s => s.idService === form.idService)?.nomService || ""} disabled />
              <input type="hidden" name="idService" value={form.idService} />
            </div>
            <div className="form-field"><label>{t("etat") || "الحالة"}</label>
              <select name="etatArchive" value={form.etatArchive} onChange={handleChange}>
                <option value="Nouveau">{t("nouveau") || "جديد"}</option>
                <option value="En cours">{t("en_cours") || "قيد المعالجة"}</option>
                <option value="Traite">{t("traite") || "تمت المعالجة"}</option>
                <option value="Archive">{t("archive") || "مؤرشف"}</option>
              </select>
            </div>
            <div className="form-field"><label>{t("transmissible") || "قابل للإحالة"}</label>
              <label className="checkbox-field"><input type="checkbox" name="estTransmissible" checked={form.estTransmissible} onChange={handleChange} /> {t("oui") || "نعم"}</label>
            </div>
            <div className="form-field full-width"><label>{t("document_pdf_word") || "الوثيقة PDF/Word"}</label>
              <div className="document-control">
                <label className="document-upload-button">{uploading ? t("uploading") || "رفع..." : t("choisir_fichier") || "اختيار ملف"}<input type="file" accept=".pdf,.doc,.docx" onChange={handleDocumentSelect} /></label>
                <div className={form.lienPdf ? "document-link-preview filled" : "document-link-preview"}><span title={form.lienPdf}>{form.lienPdf ? getDocumentName(form.lienPdf) : t("aucun_fichier") || "لا ملف"}</span>{form.lienPdf && <a href={getDocumentHref(form.lienPdf)} target="_blank" rel="noreferrer">{t("ouvrir") || "فتح"}</a>}</div>
                <div className="document-link-input"><input name="lienPdf" value={form.lienPdf} onChange={handleChange} placeholder={t("lien_manuel") || "رابط"} />{form.lienPdf && <a href={getDocumentHref(form.lienPdf)} target="_blank" rel="noreferrer">{t("ouvrir") || "فتح"}</a>}</div>
              </div>
            </div>
            <div className="form-field full-width"><label>{t("notes") || "ملاحظات"}</label><textarea name="description" value={form.description} onChange={handleChange} rows="3" /></div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">{editingId ? t("modifier") : t("ajouter")}</button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>{t("annuler")}</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

function getDocumentHref(v) { if (!v) return ""; if (/^https?:\/\//i.test(v)) return v; const nv = v.startsWith("/") ? v : `/${v}`; return window.location.hostname === "localhost" && window.location.port === "3000" ? `http://localhost:5127${nv}` : nv; }
function getDocumentName(v) { if (!v) return ""; const clean = String(v).split("?")[0].split("#")[0]; return decodeURIComponent(clean.split("/").filter(Boolean).pop() || clean); }
function getErrorMessage(err, fb) { if (!err) return fb; if (typeof err === "string") return err; const data = err.response?.data; if (data) { if (typeof data === "string") return data; if (data.message) return data.message; try { return JSON.stringify(data); } catch { return fb; } } return err.message || fb; }

export default GererCourriersJuridiques;