import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import GererCourriersJuridiques from "./GererCourriersJuridiques";
import { useAuth } from '../context/AuthContext';

const TYPE_WARIDAT = "Waridat";
const TYPE_MORASALAT = "Morasalat";
const MODE_LIEE = "Liee";
const MODE_INDEPENDANTE = "Independante";
const CORRESPONDANCE_SORTANTE = "Sortante";
const CORRESPONDANCE_ENTRANTE = "Entrante";

function GererCourriers() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const userServiceId = user?.idService;

  const [activeRegistre, setActiveRegistre] = useState("administratif");
  const [courriers, setCourriers] = useState([]);
  const [waridat, setWaridat] = useState([]);
  const [services, setServices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [motCle, setMotCle] = useState("");
  const [numeroRecherche, setNumeroRecherche] = useState("");
  const [dateRecherche, setDateRecherche] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importing, setImporting] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [savingLinked, setSavingLinked] = useState(false);
  const [form, setForm] = useState(getInitialForm());

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const selectedParent = useMemo(
    () => waridat.find((item) => String(item.id) === String(form.parentId)),
    [waridat, form.parentId]
  );

  const isMorasalat = form.typeRegistre === TYPE_MORASALAT;
  const isLinkedMorasalat = isMorasalat && form.morasalatMode === MODE_LIEE;
  const hasActiveSearch = Boolean(
    motCle.trim() || numeroRecherche.trim() || dateRecherche
  );
  const showIdBureauOrdreInput = !isLinkedMorasalat;
  const displayedIdBureauOrdre = isLinkedMorasalat
    ? selectedParent?.idBureauOrdre || form.parentIdBureauOrdre || ""
    : form.idBureauOrdre;

  useEffect(() => {
    fetchCourriers();
    fetchWaridat();
    fetchServices();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(runSearch, 250);
    return () => clearTimeout(timeout);
  }, [motCle, numeroRecherche, dateRecherche]);

  useEffect(() => {
    setCurrentPage(1);
  }, [motCle, numeroRecherche, dateRecherche, courriers.length]);

  const fetchCourriers = async () => {
    try {
      const res = await axios.get("/api/courriers");
      setCourriers(res.data);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_chargement")));
    }
  };

  const fetchWaridat = async () => {
    try {
      const res = await axios.get("/api/courriers/waridat");
      setWaridat(res.data);
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_chargement")));
    }
  };

  const fetchServices = async () => {
    try {
      const res = await axios.get("/api/services");
      setServices(res.data);
      if (res.data.length > 0) {
        const defaultServiceId = userServiceId || res.data[0].idService;
        setForm((prev) => ({ ...prev, idService: defaultServiceId }));
      }
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_chargement")));
    }
  };

  const selectWaridat = () => {
    setEditingId(null);
    setForm({
      ...getInitialForm(services),
      typeRegistre: TYPE_WARIDAT,
      morasalatMode: MODE_INDEPENDANTE,
      typeCorrespondance: CORRESPONDANCE_SORTANTE,
      direction: "Entrant",
    });
    setError("");
    setSuccess("");
  };

  const selectMorasalat = () => {
    setEditingId(null);
    setForm({
      ...getInitialForm(services),
      typeRegistre: TYPE_MORASALAT,
      morasalatMode: MODE_INDEPENDANTE,
      typeCorrespondance: CORRESPONDANCE_SORTANTE,
      direction: "Sortant",
    });
    setError("");
    setSuccess("");
  };

  const selectCorrespondance = (typeCorrespondance) => {
    setForm((prev) => ({
      ...prev,
      typeRegistre: TYPE_MORASALAT,
      morasalatMode: prev.parentLocked ? MODE_LIEE : MODE_INDEPENDANTE,
      parentId: prev.parentLocked ? prev.parentId : "",
      parentIdBureauOrdre: prev.parentLocked ? prev.parentIdBureauOrdre : "",
      typeCorrespondance,
      direction: typeCorrespondance === CORRESPONDANCE_SORTANTE ? "Sortant" : "Interne",
    }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name === "idService" ? Number(value) : value,
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(getInitialForm(services, form.typeRegistre, form.typeCorrespondance));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await saveCurrentCourrier();
      setSuccess(editingId ? t("modification_succes") : t("ajout_succes"));
      resetForm();
      await fetchCourriers();
      await fetchWaridat();
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_enregistrement")));
    }
  };

  const saveCurrentCourrier = async () => {
    const validationError = validateForm(form, isLinkedMorasalat);
    if (validationError) throw new Error(validationError);
    const dataToSend = {
      idBureauOrdre: isLinkedMorasalat ? "" : form.idBureauOrdre.trim(),
      date: new Date(form.date).toISOString(),
      source: form.source.trim(),
      sujet: form.sujet.trim(),
      destinataire: form.destinataire.trim(),
      description: form.description.trim(),
      etat: form.etat,
      lienPdf: form.lienPdf.trim(),
      direction: getDirection(form),
      typeRegistre: form.typeRegistre,
      typeCorrespondance: isMorasalat ? form.typeCorrespondance : null,
      parentId: isLinkedMorasalat ? Number(form.parentId) : null,
      idService: Number(form.idService),
      numeroDeCourrier: String(form.numeroDeCourrier || "").trim(),
      estTransmissible: Boolean(form.estTransmissible),
    };
    if (editingId) {
      const response = await axios.put(`/api/courriers/${editingId}`, dataToSend);
      return response.data;
    }
    const response = await axios.post("/api/courriers", dataToSend);
    return response.data;
  };

  const handleSaveWaridatAndAddMorasalat = async () => {
    if (savingLinked) return;
    setError("");
    setSuccess("");
    if (form.typeRegistre !== TYPE_WARIDAT) return;
    try {
      setSavingLinked(true);
      const existingWarida = !editingId ? findMainWaridatByNumero(courriers, form.idBureauOrdre) : null;
      const savedWarida = existingWarida || (await saveCurrentCourrier());
      await fetchCourriers();
      await fetchWaridat();
      handleAddMorasalat(savedWarida);
      setSuccess(existingWarida ? t("warida_existante_liee") : t("warida_cree_liee"));
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_enregistrement")));
    } finally {
      setSavingLinked(false);
    }
  };

  const handleEdit = (courrier) => {
    const typeRegistre = courrier.typeRegistre || (courrier.parentId ? TYPE_MORASALAT : TYPE_WARIDAT);
    const typeCorrespondance = courrier.typeCorrespondance || CORRESPONDANCE_SORTANTE;
    const morasalatMode = typeRegistre === TYPE_MORASALAT && courrier.parentId ? MODE_LIEE : MODE_INDEPENDANTE;
    setEditingId(courrier.id);
    setForm({
      idBureauOrdre: courrier.idBureauOrdre || "",
      date: courrier.date ? courrier.date.slice(0, 10) : "",
      source: courrier.source || "",
      sujet: courrier.sujet || "",
      destinataire: courrier.destinataire || "",
      description: courrier.description || "",
      etat: courrier.etat || "Nouveau",
      lienPdf: courrier.lienPdf || "",
      direction: courrier.direction || "Entrant",
      idService: courrier.idService || getDefaultServiceId(services),
      numeroDeCourrier: courrier.numeroDeCourrier || "",
      typeRegistre,
      morasalatMode,
      parentId: courrier.parentId || "",
      parentLocked: Boolean(courrier.parentId),
      parentIdBureauOrdre: courrier.parentId ? courrier.idBureauOrdre || "" : "",
      typeCorrespondance,
      estTransmissible: Boolean(courrier.estTransmissible),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddMorasalat = (warida) => {
    const parentId = warida.id || warida.idEntite;
    if (!parentId) {
      setError(t("parent_introuvable"));
      return;
    }
    setEditingId(null);
    setForm({
      ...getInitialForm(services, TYPE_MORASALAT, CORRESPONDANCE_SORTANTE),
      idBureauOrdre: "",
      parentId,
      parentLocked: true,
      parentIdBureauOrdre: warida.idBureauOrdre || "",
      morasalatMode: MODE_LIEE,
      typeRegistre: TYPE_MORASALAT,
      typeCorrespondance: CORRESPONDANCE_SORTANTE,
      direction: "Sortant",
      idService: warida.idService || getDefaultServiceId(services),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("confirmation_supprimer"))) return;
    try {
      await axios.delete(`/api/courriers/${id}`);
      setSuccess(t("suppression_succes"));
      await fetchCourriers();
      await fetchWaridat();
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_suppression")));
    }
  };

  const runSearch = async () => {
    try {
      if (!motCle.trim() && !numeroRecherche.trim() && !dateRecherche) {
        await fetchCourriers();
        return;
      }
      const params = new URLSearchParams();
      if (motCle.trim()) params.append("motCle", motCle.trim());
      if (numeroRecherche.trim()) params.append("numeroBureauOrdre", numeroRecherche.trim());
      if (dateRecherche) params.append("date", dateRecherche);
      const res = await axios.get(`/api/courriers/search?${params.toString()}`);
      setCourriers(res.data);
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_recherche")));
    }
  };

  const exportToExcel = () => {
    fetch("/api/courriers/export/excel", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "courriers-administratifs.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError(t("erreur_export")));
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setImporting(true);
    try {
      const res = await axios.post("/api/courriers/import/excel", formData);
      setSuccess(t("import_succes", { count: res.data.imported }));
      if (res.data.errors?.length) setError(res.data.errors.join(" | "));
      await fetchCourriers();
      await fetchWaridat();
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_import")));
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleDocumentSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploadingDocument(true);
    try {
      const res = await axios.post("/api/courriers/upload-document", formData);
      setForm((prev) => ({ ...prev, lienPdf: res.data.lienPdf }));
      setSuccess(t("document_uploaded"));
    } catch (err) {
      setError(getErrorMessage(err, t("erreur_upload")));
    } finally {
      setUploadingDocument(false);
      e.target.value = "";
    }
  };

  // Pagination
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentCourriers = courriers.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(courriers.length / rowsPerPage);
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const renderCourriersTable = () => (
    <div className="data-table-wrapper search-results-table">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>
          {hasActiveSearch
            ? `${t("resultats_recherche")} (${courriers.length})`
            : `${t("registre")} (${courriers.length})`}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{t("afficher")}</span>
          <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
          <span>{t("lignes")}</span>
        </div>
      </div>
      <table className="modern-table">
        <thead>
          <tr>
            <th>{t("numero_bureau_ordre")}</th>
            <th>{t("type_registre")}</th>
            <th>{t("lien_parent")}</th>
            <th>{t("date")}</th>
            <th>{t("source")}</th>
            <th>{t("objet")}</th>
            <th>{t("destinataire")}</th>
            <th>{t("service")}</th>
            <th>{t("etat")}</th>
            <th>{t("transmissible")}</th>
            <th>PDF</th>
            <th>{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          {currentCourriers.length === 0 ? (
            <tr>
              <td colSpan="12" style={{ textAlign: "center" }}>{t("aucun_enregistrement")}</td>
            </tr>
          ) : (
            currentCourriers.map((courrier) => (
              <tr key={courrier.id}>
                <td>{courrier.idBureauOrdre || "-"}</td>
                <td>{formatRegistre(courrier)}</td>
                <td>{courrier.parentId ? t("ligne_liee") : t("ligne_principale")}</td>
                <td>{courrier.date ? new Date(courrier.date).toLocaleDateString() : "-"}</td>
                <td>{courrier.source || "-"}</td>
                <td>{courrier.sujet || "-"}</td>
                <td>{courrier.destinataire || "-"}</td>
                <td>{courrier.serviceNom || courrier.idService}</td>
                <td>{formatEtat(courrier.etat)}</td>
                <td>{courrier.estTransmissible ? t("oui") : t("non")}</td>
                <td>
                  {courrier.lienPdf ? (
                    <a href={getDocumentHref(courrier.lienPdf)} target="_blank" rel="noreferrer">{t("voir")}</a>
                  ) : "-"}
                </td>
                <td className="action-icons">
                  {isMainWaridat(courrier) && (
                    <button onClick={() => handleAddMorasalat(courrier)}>{t("ajouter_morasala")}</button>
                  )}
                  <button onClick={() => handleEdit(courrier)}>{t("modifier")}</button>
                  <button onClick={() => handleDelete(courrier.id)}>{t("supprimer")}</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
            {t("precedent")}
          </button>
          <span>{t("page")} {currentPage} / {totalPages}</span>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
            {t("suivant")}
          </button>
        </div>
      )}
    </div>
  );

  if (activeRegistre === "juridique") {
    return (
      <div className="page-container" dir="rtl">
        <h1 className="page-title">{t("menu_courriers")}</h1>
        <div className="registry-choice">
          <button className="choice-pill" onClick={() => setActiveRegistre("administratif")}>{t("administratif")}</button>
          <button className="choice-pill active" onClick={() => setActiveRegistre("juridique")}>{t("judiciaire")}</button>
        </div>
        <GererCourriersJuridiques embedded />
      </div>
    );
  }

  return (
    <div className="page-container" dir="rtl">
      <h1 className="page-title">{t("menu_courriers")}</h1>
      <div className="registry-choice">
        <button className="choice-pill active" onClick={() => setActiveRegistre("administratif")}>{t("administratif")}</button>
        <button className="choice-pill" onClick={() => setActiveRegistre("juridique")}>{t("judiciaire")}</button>
      </div>
      <h2 className="page-title">{t("administratif")}</h2>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="registry-choice">
        <button className={form.typeRegistre === TYPE_WARIDAT ? "choice-pill active" : "choice-pill"} onClick={selectWaridat}>{t("waridat")}</button>
        <button className={form.typeRegistre === TYPE_MORASALAT ? "choice-pill active" : "choice-pill"} onClick={selectMorasalat}>{t("morasalat")}</button>
      </div>

      {isMorasalat && (
        <div className="registry-choice sub-choice">
          <button className={form.typeCorrespondance === CORRESPONDANCE_SORTANTE ? "choice-pill active" : "choice-pill"} onClick={() => selectCorrespondance(CORRESPONDANCE_SORTANTE)}>{t("sortante")}</button>
          <button className={form.typeCorrespondance === CORRESPONDANCE_ENTRANTE ? "choice-pill active" : "choice-pill"} onClick={() => selectCorrespondance(CORRESPONDANCE_ENTRANTE)}>{t("entrante")}</button>
        </div>
      )}

      <div className="form-card">
        <h3>{editingId ? t("modifier") : t("ajouter")} {formatFormTitle(form)}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {showIdBureauOrdreInput ? (
              <div className="form-field"><label>{t("numero_bureau_ordre")} *</label><input type="text" name="idBureauOrdre" value={form.idBureauOrdre} onChange={handleChange} required /></div>
            ) : (
              <div className="form-field"><label>{t("numero_bureau_ordre")}</label><input type="text" value={displayedIdBureauOrdre || t("auto_parent")} readOnly /></div>
            )}
            <div className="form-field"><label>{t("date")} *</label><input type="date" name="date" value={form.date} onChange={handleChange} required /></div>
            <div className="form-field"><label>{isMorasalat && form.typeCorrespondance === CORRESPONDANCE_SORTANTE ? t("emetteur") : t("source")} *</label><input type="text" name="source" value={form.source} onChange={handleChange} required /></div>
            <div className="form-field"><label>{isMorasalat && form.typeCorrespondance === CORRESPONDANCE_ENTRANTE ? t("reponse_sujet") : t("objet")} *</label><input type="text" name="sujet" value={form.sujet} onChange={handleChange} required /></div>
            <div className="form-field"><label>{t("destinataire")}</label><input type="text" name="destinataire" value={form.destinataire} onChange={handleChange} /></div>
            <div className="form-field">
              <label>{t("service")} *</label>
              <input
                type="text"
                value={services.find(s => s.idService === form.idService)?.nomService || ''}
                disabled
              />
              <input type="hidden" name="idService" value={form.idService} />
            </div>
            <div className="form-field"><label>{t("etat")}</label><select name="etat" value={form.etat} onChange={handleChange}>
              <option value="Nouveau">{t("nouveau")}</option><option value="En cours">{t("en_cours")}</option>
              <option value="Traite">{t("traite")}</option><option value="Archive">{t("archive")}</option>
            </select></div>
            <div className="form-field"><label>{t("numero_interne")}</label><input type="text" name="numeroDeCourrier" value={form.numeroDeCourrier} onChange={handleChange} /></div>
            <div className="form-field full-width">
              <label>{t("document_pdf_word")}</label>
              <div className="document-control">
                <label className="document-upload-button">{uploadingDocument ? t("uploading") : t("choisir_fichier")}<input type="file" accept=".pdf,.doc,.docx" onChange={handleDocumentSelect} /></label>
                <div className={form.lienPdf ? "document-link-preview filled" : "document-link-preview"}><span title={form.lienPdf}>{form.lienPdf ? getDocumentName(form.lienPdf) : t("aucun_fichier")}</span>{form.lienPdf && <a href={getDocumentHref(form.lienPdf)} target="_blank" rel="noreferrer">{t("ouvrir")}</a>}</div>
                <div className="document-link-input"><input type="text" name="lienPdf" value={form.lienPdf} onChange={handleChange} placeholder={t("lien_manuel")} />{form.lienPdf && <a href={getDocumentHref(form.lienPdf)} target="_blank" rel="noreferrer">{t("ouvrir")}</a>}</div>
              </div>
            </div>
            <div className="form-field"><label>{t("transmissible")}</label><label className="checkbox-field"><input type="checkbox" name="estTransmissible" checked={form.estTransmissible} onChange={handleChange} /> {t("oui")}</label></div>
            <div className="form-field full-width"><label>{t("notes")}</label><textarea name="description" value={form.description} onChange={handleChange} rows="3" /></div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">{editingId ? t("modifier") : t("ajouter")}</button>
            {form.typeRegistre === TYPE_WARIDAT && <button type="button" className="btn-secondary" onClick={handleSaveWaridatAndAddMorasalat} disabled={savingLinked}>{savingLinked ? t("saving") : t("ajouter_morasala_liee")}</button>}
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>{t("annuler")}</button>}
          </div>
        </form>
      </div>

      <div className="registry-panel">
        <div className="registry-panel-header">
          <h3>{t("recherche_registre")}</h3>
          <div className="registry-tools">
            <button className="btn-primary" onClick={exportToExcel}>{t("exporter_excel")}</button>
            <label className="btn-secondary import-label">{importing ? t("importing") : t("importer_excel")}<input type="file" accept=".xlsx" onChange={handleFileSelect} /></label>
          </div>
        </div>
        <div className="filters">
          <input type="text" value={motCle} onChange={(e) => setMotCle(e.target.value)} placeholder={t("rechercher_par_mot")} />
          <input type="text" value={numeroRecherche} onChange={(e) => setNumeroRecherche(e.target.value)} placeholder={t("numero_bureau_ordre")} />
          <input type="date" value={dateRecherche} onChange={(e) => setDateRecherche(e.target.value)} />
          <button className="btn-secondary" onClick={() => { setMotCle(""); setNumeroRecherche(""); setDateRecherche(""); fetchCourriers(); }}>{t("reinitialiser")}</button>
        </div>
        {renderCourriersTable()}
      </div>
    </div>
  );
}

// Helper functions
function getInitialForm(services = [], typeRegistre = TYPE_WARIDAT, typeCorrespondance = CORRESPONDANCE_SORTANTE) {
  return {
    idBureauOrdre: "", date: "", source: "", sujet: "", destinataire: "", description: "", etat: "Nouveau", lienPdf: "",
    direction: typeRegistre === TYPE_MORASALAT && typeCorrespondance === CORRESPONDANCE_SORTANTE ? "Sortant" : "Entrant",
    idService: getDefaultServiceId(services), numeroDeCourrier: "", typeRegistre, morasalatMode: MODE_INDEPENDANTE,
    parentId: "", parentLocked: false, parentIdBureauOrdre: "", typeCorrespondance, estTransmissible: false,
  };
}
function getDefaultServiceId(services) { return services.length ? services[0].idService : ""; }
function validateForm(form, isLinkedMorasalat) {
  if (!isLinkedMorasalat && !form.idBureauOrdre.trim()) return "رقم مكتب الضبط إجباري للسطر الرئيسي";
  if (isLinkedMorasalat && !form.parentId) return "المرجو اختيار الواردة المرتبطة";
  if (!form.date) return "التاريخ إجباري";
  if (!form.source.trim()) return "المصدر إجباري";
  if (!form.sujet.trim()) return "الموضوع إجباري";
  if (!form.idService) return "المصلحة إجبارية";
  return "";
}
function getDirection(form) { return form.typeRegistre === TYPE_WARIDAT ? "Entrant" : (form.typeCorrespondance === CORRESPONDANCE_SORTANTE ? "Sortant" : "Interne"); }
function formatFormTitle(form) { return form.typeRegistre === TYPE_WARIDAT ? "الواردات" : (form.typeCorrespondance === CORRESPONDANCE_ENTRANTE ? "المراسلات الواردة" : "المراسلات الصادرة"); }
function formatRegistre(c) { return c.typeRegistre === TYPE_MORASALAT ? (c.typeCorrespondance === CORRESPONDANCE_ENTRANTE ? "المراسلات الواردة" : "المراسلات الصادرة") : "الواردات"; }
function formatEtat(e) {
  if (e === "En cours") return "قيد المعالجة";
  if (e === "Traite" || e === "Traité") return "تمت المعالجة";
  if (e === "Archive" || e === "Archivé") return "مؤرشف";
  return "جديد";
}
function isMainWaridat(c) { const t = c.typeRegistre || (c.parentId ? TYPE_MORASALAT : TYPE_WARIDAT); return t === TYPE_WARIDAT && !c.parentId; }
function findMainWaridatByNumero(courriers, idBureauOrdre) { const n = (idBureauOrdre || "").trim(); return n ? courriers.find(c => isMainWaridat(c) && (c.idBureauOrdre || "").trim() === n) || null : null; }
function getDocumentHref(v) {
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  const nv = v.startsWith("/") ? v : `/${v}`;
  return window.location.hostname === "localhost" && window.location.port === "3000" ? `http://localhost:5127${nv}` : nv;
}
function getDocumentName(v) { if (!v) return ""; const clean = String(v).split("?")[0].split("#")[0]; return decodeURIComponent(clean.split("/").filter(Boolean).pop() || clean); }
function getErrorMessage(err, fb) { if (typeof err.response?.data === "string") return err.response.data; if (err.response?.data?.message) return err.response.data.message; if (err.message) return err.message; return fb; }

export default GererCourriers;