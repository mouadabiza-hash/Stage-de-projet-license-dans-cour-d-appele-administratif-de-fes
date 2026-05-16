import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import GenericImportModal from "../components/GenericImportModal";

const TYPE_WARIDAT = "Waridat";
const TYPE_MORASALAT = "Morasalat";
const MODE_LIEE = "Liee";
const MODE_INDEPENDANTE = "Independante";
const CORRESPONDANCE_SORTANTE = "Sortante";
const CORRESPONDANCE_ENTRANTE = "Entrante";
const DOC_TYPE_ADMINISTRATIF = "Administratif";
const DOC_TYPE_JUDICIAIRE = "Judiciaire";

const ALL_COLUMNS = [
  { key: "idBureauOrdre", label: "numero_bureau_ordre", defaultVisible: true, defaultOrder: 1 },
  { key: "typeRegistre", label: "type_registre", defaultVisible: true, defaultOrder: 2 },
  { key: "lienParent", label: "lien_parent", defaultVisible: true, defaultOrder: 3 },
  { key: "date", label: "date", defaultVisible: true, defaultOrder: 4 },
  { key: "source", label: "source", defaultVisible: true, defaultOrder: 5 },
  { key: "sujet", label: "objet", defaultVisible: true, defaultOrder: 6 },
  { key: "destinataire", label: "destinataire", defaultVisible: true, defaultOrder: 7 },
  { key: "service", label: "service", defaultVisible: true, defaultOrder: 8 },
  { key: "etat", label: "etat", defaultVisible: true, defaultOrder: 9 },
  { key: "estTransmissible", label: "transmissible", defaultVisible: true, defaultOrder: 10 },
  { key: "pdf", label: "PDF", defaultVisible: true, defaultOrder: 11 },
  { key: "actions", label: "actions", defaultVisible: true, defaultOrder: 12 },
];

function GererCourriers() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const perms = usePermissions();
  const userServiceId = user?.idService;

  const [courriers, setCourriers] = useState([]);
  const [waridat, setWaridat] = useState([]);
  const [services, setServices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [motCle, setMotCle] = useState("");
  const [numeroRecherche, setNumeroRecherche] = useState("");
  const [dateRecherche, setDateRecherche] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [savingLinked, setSavingLinked] = useState(false);
  const [form, setForm] = useState(getInitialFormInternal());

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Colonnes personnalisables
  const [tableColumns, setTableColumns] = useState([]);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [tempColumns, setTempColumns] = useState([]);

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);

  function getInitialFormInternal(typeRegistre = TYPE_WARIDAT, typeCorrespondance = CORRESPONDANCE_SORTANTE) {
    return {
      idBureauOrdre: "",
      date: "",
      source: "",
      sujet: "",
      destinataire: "",
      description: "",
      etat: "Nouveau",
      lienPdf: "",
      direction: typeRegistre === TYPE_MORASALAT && typeCorrespondance === CORRESPONDANCE_SORTANTE ? "Sortant" : "Entrant",
      idService: userServiceId || "",
      numeroDeCourrier: "",
      typeRegistre,
      morasalatMode: MODE_INDEPENDANTE,
      parentId: "",
      parentLocked: false,
      parentIdBureauOrdre: "",
      typeCorrespondance,
      estTransmissible: false,
      waridatDocumentType: DOC_TYPE_ADMINISTRATIF,
      tribunalSource: "",
      numeroDossier: "",
      numeroPremiereInstance: "",
    };
  }

  const selectedParent = useMemo(
    () => waridat.find((item) => String(item.id) === String(form.parentId)),
    [waridat, form.parentId]
  );

  const isMorasalat = form.typeRegistre === TYPE_MORASALAT;
  const isLinkedMorasalat = isMorasalat && form.morasalatMode === MODE_LIEE;
  const hasActiveSearch = Boolean(motCle.trim() || numeroRecherche.trim() || dateRecherche);
  const showIdBureauOrdreInput = !isLinkedMorasalat;
  const displayedIdBureauOrdre = isLinkedMorasalat
    ? selectedParent?.idBureauOrdre || form.parentIdBureauOrdre || ""
    : form.idBureauOrdre;
  const isWaridat = form.typeRegistre === TYPE_WARIDAT;
  const isWaridatJudiciaire = isWaridat && form.waridatDocumentType === DOC_TYPE_JUDICIAIRE;

  // Column preferences
  useEffect(() => {
    const saved = localStorage.getItem("courriers_columns_prefs");
    if (saved) {
      try { setTableColumns(JSON.parse(saved)); } catch (e) { setTableColumns(getDefaultColumns()); }
    } else {
      setTableColumns(getDefaultColumns());
    }
  }, []);

  useEffect(() => {
    if (tableColumns.length) localStorage.setItem("courriers_columns_prefs", JSON.stringify(tableColumns));
  }, [tableColumns]);

  const getDefaultColumns = () => ALL_COLUMNS.map(col => ({
    key: col.key, label: col.label, visible: col.defaultVisible, order: col.defaultOrder,
  })).sort((a,b) => a.order - b.order);

  const openColumnModal = () => {
    const visibleSorted = tableColumns.filter(c => c.visible).sort((a,b) => a.order - b.order);
    const hiddenSorted = tableColumns.filter(c => !c.visible).sort((a,b) => a.order - b.order);
    setTempColumns([...visibleSorted, ...hiddenSorted]);
    setShowColumnModal(true);
  };

  const toggleColumnVisibility = (key) => {
    setTempColumns(prev => {
      const newCols = prev.map(col => col.key === key ? { ...col, visible: !col.visible } : col);
      const visible = newCols.filter(c => c.visible).map((c, idx) => ({ ...c, order: idx + 1 }));
      const hidden = newCols.filter(c => !c.visible).map((c, idx) => ({ ...c, order: visible.length + idx + 1 }));
      return [...visible, ...hidden];
    });
  };

  const moveColumn = (key, direction) => {
    setTempColumns(prev => {
      const index = prev.findIndex(col => col.key === key);
      if (index === -1) return prev;
      if (!prev[index].visible) return prev;
      const visibleIndices = prev.reduce((acc, col, idx) => col.visible ? [...acc, idx] : acc, []);
      const currentPos = visibleIndices.indexOf(index);
      if (direction === 'up' && currentPos === 0) return prev;
      if (direction === 'down' && currentPos === visibleIndices.length - 1) return prev;
      const newCols = [...prev];
      const targetIndex = direction === 'up' ? visibleIndices[currentPos - 1] : visibleIndices[currentPos + 1];
      [newCols[index], newCols[targetIndex]] = [newCols[targetIndex], newCols[index]];
      let order = 1;
      for (let i = 0; i < newCols.length; i++) { if (newCols[i].visible) newCols[i].order = order++; }
      for (let i = 0; i < newCols.length; i++) { if (!newCols[i].visible) newCols[i].order = order++; }
      return newCols;
    });
  };

  const selectAllColumns = () => setTempColumns(prev => { const n = prev.map(c => ({...c, visible: true})); let o=1; n.forEach(c => c.order=o++); return n; });
  const deselectAllColumns = () => setTempColumns(prev => { const n = prev.map(c => ({...c, visible: false})); let o=1; n.forEach(c => c.order=o++); return n; });
  const saveColumnPreferences = () => { setTableColumns(tempColumns); setShowColumnModal(false); };
  const visibleColumns = tableColumns.filter(col => col.visible).sort((a,b) => a.order - b.order);

  useEffect(() => { fetchCourriers(); fetchWaridat(); fetchServices(); }, []);
  useEffect(() => { const timeout = setTimeout(runSearch, 250); return () => clearTimeout(timeout); }, [motCle, numeroRecherche, dateRecherche]);
  useEffect(() => { setCurrentPage(1); }, [motCle, numeroRecherche, dateRecherche, courriers.length]);

  const fetchCourriers = async () => {
    try { const res = await axios.get("/api/courriers"); setCourriers(res.data); setError(""); }
    catch (err) { setError(getErrorMessage(err, t("erreur_chargement"))); }
  };
  const fetchWaridat = async () => {
    try { const res = await axios.get("/api/courriers/waridat"); setWaridat(res.data); }
    catch (err) { setError(getErrorMessage(err, t("erreur_chargement"))); }
  };
  const fetchServices = async () => {
    try { const res = await axios.get("/api/services"); setServices(res.data); }
    catch (err) { setError(getErrorMessage(err, t("erreur_chargement"))); }
  };

  const selectWaridat = () => {
    if (!perms.canCreateAdministratif && !perms.canCreateJuridique) return;
    setEditingId(null);
    setForm({ ...getInitialFormInternal(TYPE_WARIDAT), waridatDocumentType: perms.canCreateAdministratif ? DOC_TYPE_ADMINISTRATIF : DOC_TYPE_JUDICIAIRE });
    setError(""); setSuccess("");
  };
  const selectMorasalat = () => {
    if (!perms.canCreateAdministratif) return;
    setEditingId(null);
    setForm({ ...getInitialFormInternal(TYPE_MORASALAT, CORRESPONDANCE_SORTANTE), direction: "Sortant" });
    setError(""); setSuccess("");
  };
  const selectCorrespondance = (type) => {
    setForm(prev => ({ ...prev, typeCorrespondance: type, direction: type === CORRESPONDANCE_SORTANTE ? "Sortant" : "Interne" }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : name === "idService" ? Number(value) : value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(getInitialFormInternal(form.typeRegistre, form.typeCorrespondance));
    setError(""); setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((isWaridatJudiciaire && !perms.canCreateJuridique) || (!isWaridatJudiciaire && !perms.canCreateAdministratif)) return;
    setError(""); setSuccess("");
    try {
      if (isWaridatJudiciaire) {
        const payload = {
          idBureauOrdre: form.idBureauOrdre?.trim() || null,
          date: new Date(form.date).toISOString(),
          tribunalSource: form.tribunalSource.trim(),
          sujet: form.sujet.trim(),
          direction: "Entrant",
          description: form.description?.trim() || "",
          etatArchive: form.etat,
          lienPdf: form.lienPdf?.trim() || "",
          idService: Number(form.idService),
          numeroDossier: form.numeroDossier?.trim() || null,
          estTransmissible: Boolean(form.estTransmissible),
          numeroPremiereInstance: form.numeroPremiereInstance?.trim() || null,
        };
        if (editingId) await axios.put(`/api/acteursjudiciaires/${editingId}`, payload);
        else await axios.post("/api/acteursjudiciaires", payload);
      } else {
        await saveCurrentCourrier();
      }
      setSuccess(editingId ? t("modification_succes") : t("ajout_succes"));
      resetForm();
      await fetchCourriers();
      await fetchWaridat();
    } catch (err) { setError(getErrorMessage(err, t("erreur_enregistrement"))); }
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
    if (editingId) return (await axios.put(`/api/courriers/${editingId}`, dataToSend)).data;
    return (await axios.post("/api/courriers", dataToSend)).data;
  };

  const handleSaveWaridatAndAddMorasalat = async () => {
    if (!perms.canCreateAdministratif || savingLinked || isWaridatJudiciaire) return;
    setError(""); setSuccess("");
    if (form.typeRegistre !== TYPE_WARIDAT) return;
    try {
      setSavingLinked(true);
      const existingWarida = !editingId ? findMainWaridatByNumero(courriers, form.idBureauOrdre) : null;
      const savedWarida = existingWarida || (await saveCurrentCourrier());
      await fetchCourriers(); await fetchWaridat();
      handleAddMorasalat(savedWarida);
      setSuccess(existingWarida ? t("warida_existante_liee") : t("warida_cree_liee"));
    } catch (err) { setError(getErrorMessage(err, t("erreur_enregistrement"))); }
    finally { setSavingLinked(false); }
  };

  const handleEdit = (courrier) => {
    if (!perms.canCreateAdministratif && !perms.canCreateJuridique) return;
    if (courrier.typeDocument === DOC_TYPE_JUDICIAIRE) {
      alert(t("edit_judicial_in_judicial_page") || "Modifiez les dossiers judiciaires depuis la page dédiée.");
      return;
    }
    const typeRegistre = courrier.typeRegistre || (courrier.parentId ? TYPE_MORASALAT : TYPE_WARIDAT);
    const typeCorrespondance = courrier.typeCorrespondance || CORRESPONDANCE_SORTANTE;
    const morasalatMode = typeRegistre === TYPE_MORASALAT && courrier.parentId ? MODE_LIEE : MODE_INDEPENDANTE;
    setEditingId(courrier.id);
    setForm({
      idBureauOrdre: courrier.idBureauOrdre || "",
      date: courrier.date ? courrier.date.slice(0,10) : "",
      source: courrier.source || "",
      sujet: courrier.sujet || "",
      destinataire: courrier.destinataire || "",
      description: courrier.description || "",
      etat: courrier.etat || "Nouveau",
      lienPdf: courrier.lienPdf || "",
      direction: courrier.direction || "Entrant",
      idService: courrier.idService || userServiceId,
      numeroDeCourrier: courrier.numeroDeCourrier || "",
      typeRegistre, morasalatMode,
      parentId: courrier.parentId || "",
      parentLocked: Boolean(courrier.parentId),
      parentIdBureauOrdre: courrier.parentId ? courrier.idBureauOrdre || "" : "",
      typeCorrespondance,
      estTransmissible: Boolean(courrier.estTransmissible),
      waridatDocumentType: DOC_TYPE_ADMINISTRATIF,
      tribunalSource: "", numeroDossier: "", numeroPremiereInstance: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddMorasalat = (warida) => {
    if (!perms.canCreateAdministratif) return;
    const parentId = warida.id || warida.idEntite;
    if (!parentId) { setError(t("parent_introuvable")); return; }
    setEditingId(null);
    setForm({
      ...getInitialFormInternal(TYPE_MORASALAT, CORRESPONDANCE_SORTANTE),
      idBureauOrdre: "", parentId, parentLocked: true,
      parentIdBureauOrdre: warida.idBureauOrdre || "",
      morasalatMode: MODE_LIEE,
      direction: "Sortant",
      idService: warida.idService || userServiceId,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!perms.canDelete) return;
    if (!window.confirm(t("confirmation_supprimer"))) return;
    try {
      await axios.delete(`/api/courriers/${id}`);
      setSuccess(t("suppression_succes"));
      await fetchCourriers(); await fetchWaridat();
    } catch (err) { setError(getErrorMessage(err, t("erreur_suppression"))); }
  };

  const runSearch = async () => {
    try {
      if (!motCle.trim() && !numeroRecherche.trim() && !dateRecherche) { await fetchCourriers(); return; }
      const params = new URLSearchParams();
      if (motCle.trim()) params.append("motCle", motCle.trim());
      if (numeroRecherche.trim()) params.append("numeroBureauOrdre", numeroRecherche.trim());
      if (dateRecherche) params.append("date", dateRecherche);
      const res = await axios.get(`/api/courriers/search?${params.toString()}`);
      setCourriers(res.data);
    } catch (err) { setError(getErrorMessage(err, t("erreur_recherche"))); }
  };

  const exportToExcel = () => {
    if (!perms.canExport) return;
    fetch("/api/courriers/export/excel", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(res => { if (!res.ok) throw new Error(); return res.blob(); })
      .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "courriers-administratifs.xlsx"; a.click(); URL.revokeObjectURL(url); })
      .catch(() => setError(t("erreur_export")));
  };

  const handleDocumentSelect = async (e) => {
    if (!perms.canCreateAdministratif && !perms.canCreateJuridique) return;
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData(); formData.append("file", file);
    setUploadingDocument(true);
    try {
      const res = await axios.post("/api/courriers/upload-document", formData);
      setForm(prev => ({ ...prev, lienPdf: res.data.lienPdf }));
      setSuccess(t("document_uploaded"));
    } catch (err) { setError(getErrorMessage(err, t("erreur_upload"))); }
    finally { setUploadingDocument(false); e.target.value = ""; }
  };

  const downloadTemplate = async () => {
    try {
      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5127';
      const res = await fetch(`${baseUrl}/api/courriers/template-excel`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition');
      let filename = 'modele_import.xlsx';
      if (cd && cd.includes('filename=')) {
        const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) filename = match[1].replace(/['"]/g, '');
      }
      a.download = filename; a.click(); window.URL.revokeObjectURL(url);
    } catch (err) { setError(t('erreur_telechargement_modele') || 'Erreur lors du téléchargement du modèle'); }
  };

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentCourriers = courriers.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(courriers.length / rowsPerPage);
  const handlePageChange = (newPage) => { if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage); };

  const renderCourriersTable = () => (
    <div className="data-table-wrapper search-results-table">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{hasActiveSearch ? `${t("resultats_recherche")} (${courriers.length})` : `${t("registre")} (${courriers.length})`}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="rows-per-page">
            <span>{t("afficher")}</span>
            <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option>
            </select>
            <span>{t("lignes")}</span>
          </div>
          <button className="btn-secondary" onClick={openColumnModal} style={{ fontSize: '0.8rem' }}>⚙️ {t("customiser_colonnes")}</button>
        </div>
      </div>
      <table className="modern-table">
        <thead>
          <tr>{visibleColumns.map(col => <th key={col.key}>{t(col.label)}</th>)}</tr>
        </thead>
        <tbody>
          {currentCourriers.length === 0 ? (
            <tr><td colSpan={visibleColumns.length} style={{ textAlign: "center" }}>{t("aucun_enregistrement")}</td></tr>
          ) : (
            currentCourriers.map((courrier) => (
              <tr key={courrier.id}>
                {visibleColumns.map(col => {
                  if (col.key === "actions") {
                    return (
                      <td className="action-icons" key="actions">
                        {perms.canCreateAdministratif && isMainWaridat(courrier) && <button onClick={() => handleAddMorasalat(courrier)}>{t("ajouter_morasala")}</button>}
                        {(perms.canCreateAdministratif || perms.canCreateJuridique) && courrier.typeDocument !== DOC_TYPE_JUDICIAIRE && <button onClick={() => handleEdit(courrier)}>{t("modifier")}</button>}
                        {perms.canDelete && <button onClick={() => handleDelete(courrier.id)}>{t("supprimer")}</button>}
                        {!perms.canCreateAdministratif && !perms.canDelete && <span>-</span>}
                      </td>
                    );
                  }
                  let value = "";
                  switch (col.key) {
                    case "idBureauOrdre": value = courrier.idBureauOrdre || "-"; break;
                    case "typeRegistre": value = formatRegistre(courrier); break;
                    case "lienParent": value = courrier.parentId ? t("ligne_liee") : t("ligne_principale"); break;
                    case "date": value = courrier.date ? new Date(courrier.date).toLocaleDateString() : "-"; break;
                    case "source": value = courrier.source || "-"; break;
                    case "sujet": value = courrier.sujet || "-"; break;
                    case "destinataire": value = courrier.destinataire || "-"; break;
                    case "service": value = courrier.serviceNom || courrier.idService; break;
                    case "etat": value = formatEtat(courrier.etat); break;
                    case "estTransmissible": value = courrier.estTransmissible ? t("oui") : t("non"); break;
                    case "pdf": value = courrier.lienPdf ? <a href={getDocumentHref(courrier.lienPdf)} target="_blank" rel="noreferrer">{t("voir")}</a> : "-"; break;
                    default: value = "-";
                  }
                  return <td key={col.key}>{value}</td>;
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>{t("precedent")}</button>
          <span>{t("page")} {currentPage} / {totalPages}</span>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>{t("suivant")}</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="page-container" dir="rtl">
      <h1 className="page-title">{t("menu_courriers")}</h1>
      <h2 className="page-title">{t("administratif")}</h2>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {(perms.canCreateAdministratif || perms.canCreateJuridique) && (
        <>
          <div className="registry-choice">
            <button className={isWaridat ? "choice-pill active" : "choice-pill"} onClick={selectWaridat}>{t("waridat")}</button>
            <button className={isMorasalat ? "choice-pill active" : "choice-pill"} onClick={selectMorasalat}>{t("morasalat")}</button>
          </div>

          {isWaridat && (
            <div className="registry-choice sub-choice">
              <button
                className={form.waridatDocumentType === DOC_TYPE_ADMINISTRATIF ? "choice-pill active" : "choice-pill"}
                onClick={() => setForm({ ...form, waridatDocumentType: DOC_TYPE_ADMINISTRATIF })}
              >{t("administratif")}</button>
              {perms.canCreateJuridique && (
                <button
                  className={form.waridatDocumentType === DOC_TYPE_JUDICIAIRE ? "choice-pill active" : "choice-pill"}
                  onClick={() => setForm({ ...form, waridatDocumentType: DOC_TYPE_JUDICIAIRE })}
                >{t("judiciaire")}</button>
              )}
            </div>
          )}

          {isMorasalat && (
            <div className="registry-choice sub-choice">
              <button className={form.typeCorrespondance === CORRESPONDANCE_SORTANTE ? "choice-pill active" : "choice-pill"} onClick={() => selectCorrespondance(CORRESPONDANCE_SORTANTE)}>{t("sortante")}</button>
              <button className={form.typeCorrespondance === CORRESPONDANCE_ENTRANTE ? "choice-pill active" : "choice-pill"} onClick={() => selectCorrespondance(CORRESPONDANCE_ENTRANTE)}>{t("entrante")}</button>
            </div>
          )}

          <div className="form-card">
            <h3>{editingId ? t("modifier") : t("ajouter")} {isWaridatJudiciaire ? t("judiciaire") : formatFormTitle(form)}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                {isWaridat && !isWaridatJudiciaire && (
                  <div className="form-field"><label>{t("numero_bureau_ordre")} *</label><input type="text" name="idBureauOrdre" value={form.idBureauOrdre} onChange={handleChange} required /></div>
                )}
                {isWaridatJudiciaire && (
                  <div className="form-field"><label>{t("numero_bureau_ordre")}</label><input type="text" name="idBureauOrdre" value={form.idBureauOrdre} onChange={handleChange} /></div>
                )}
                {isMorasalat && (
                  showIdBureauOrdreInput ? (
                    <div className="form-field"><label>{t("numero_bureau_ordre")} *</label><input type="text" name="idBureauOrdre" value={form.idBureauOrdre} onChange={handleChange} required /></div>
                  ) : (
                    <div className="form-field"><label>{t("numero_bureau_ordre")}</label><input type="text" value={displayedIdBureauOrdre || t("auto_parent")} readOnly /></div>
                  )
                )}
                <div className="form-field"><label>{t("date")} *</label><input type="date" name="date" value={form.date} onChange={handleChange} required /></div>
                {isWaridatJudiciaire ? (
                  <div className="form-field"><label>{t("tribunal_source")} *</label><input name="tribunalSource" value={form.tribunalSource} onChange={handleChange} required /></div>
                ) : (
                  <div className="form-field">
                    <label>{isMorasalat && form.typeCorrespondance === CORRESPONDANCE_SORTANTE ? t("emetteur") : t("source")} *</label>
                    <input type="text" name="source" value={form.source} onChange={handleChange} required />
                  </div>
                )}
                <div className="form-field">
                  <label>{isMorasalat && form.typeCorrespondance === CORRESPONDANCE_ENTRANTE ? t("reponse_sujet") : t("objet")} *</label>
                  <input type="text" name="sujet" value={form.sujet} onChange={handleChange} required />
                </div>
                {!isWaridatJudiciaire && (
                  <div className="form-field"><label>{t("destinataire")}</label><input type="text" name="destinataire" value={form.destinataire} onChange={handleChange} /></div>
                )}
                {isWaridatJudiciaire && (
                  <>
                    <div className="form-field"><label>{t("numero_dossier") || "الرقم الاستئنافي"}</label><input name="numeroDossier" value={form.numeroDossier} onChange={handleChange} placeholder="2026/15/3" /></div>
                    <div className="form-field"><label>{t("numero_premiere_instance") || "الرقم الابتدائي"}</label><input name="numeroPremiereInstance" value={form.numeroPremiereInstance} onChange={handleChange} placeholder="2026/12" /></div>
                  </>
                )}
                <div className="form-field">
                  <label>{t("service")} *</label>
                  <input type="text" value={services.find(s => s.idService === form.idService)?.nomService || ''} disabled />
                  <input type="hidden" name="idService" value={form.idService} />
                </div>
                <div className="form-field">
                  <label>{t("etat")}</label>
                  <select name="etat" value={form.etat} onChange={handleChange}>
                    <option value="Nouveau">{t("nouveau")}</option><option value="En cours">{t("en_cours")}</option>
                    <option value="Traite">{t("traite")}</option><option value="Archive">{t("archive")}</option>
                  </select>
                </div>
                {!isWaridatJudiciaire && (
                  <div className="form-field"><label>{t("numero_interne")}</label><input type="text" name="numeroDeCourrier" value={form.numeroDeCourrier} onChange={handleChange} /></div>
                )}
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
                {isWaridat && !isWaridatJudiciaire && <button type="button" className="btn-secondary" onClick={handleSaveWaridatAndAddMorasalat} disabled={savingLinked}>{savingLinked ? t("saving") : t("ajouter_morasala_liee")}</button>}
                {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>{t("annuler")}</button>}
              </div>
            </form>
          </div>
        </>
      )}

      <div className="registry-panel">
        <div className="registry-panel-header">
          <h3>{t("recherche_registre")}</h3>
          <div className="registry-tools">
            {perms.canExport && <button className="btn-primary" onClick={exportToExcel}>{t("exporter_excel")}</button>}
            {(perms.canCreateAdministratif || perms.canCreateJuridique) && <button className="btn-secondary" onClick={() => setShowImportModal(true)}>📂 {t("importer_excel")}</button>}
            {(perms.canCreateAdministratif || perms.canCreateJuridique) && <button className="btn-secondary" onClick={downloadTemplate}>📥 {t("telecharger_modele")}</button>}
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

      {(perms.canCreateAdministratif || perms.canCreateJuridique) && (
        <GenericImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title={t("importer_courriers")}
          endpoint="/api/courriers/import/excel"
          requiredColumns={["رقم مكتب الضبط", "التاريخ", "المصدر", "الموضوع"]}
          onSuccess={() => { fetchCourriers(); fetchWaridat(); }}
        />
      )}

      {showColumnModal && (
        <div className="modal-overlay" onClick={() => setShowColumnModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t("customiser_colonnes")}</h3>
              <button className="btn-secondary" onClick={() => setShowColumnModal(false)}>{t("fermer")}</button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <button className="btn-secondary" onClick={selectAllColumns}>{t("tout_selectionner")}</button>
              <button className="btn-secondary" onClick={deselectAllColumns}>{t("tout_deselectionner")}</button>
            </div>
            <div className="form-grid">
              {tempColumns.map((col, index) => (
                <div key={col.key} className="form-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={col.visible} onChange={() => toggleColumnVisibility(col.key)} />
                  <span style={{ flex: 1 }}>{t(col.label)}</span>
                  {col.visible && (
                    <>
                      <button type="button" className="btn-secondary btn-small" onClick={() => moveColumn(col.key, 'up')} disabled={index === 0 || !tempColumns.slice(0, index).some(c => c.visible)}>↑</button>
                      <button type="button" className="btn-secondary btn-small" onClick={() => moveColumn(col.key, 'down')} disabled={index === tempColumns.length - 1 || !tempColumns.slice(index + 1).some(c => c.visible)}>↓</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn-primary" onClick={saveColumnPreferences}>{t("appliquer")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
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
function formatEtat(e) { if (e === "En cours") return "قيد المعالجة"; if (e === "Traite" || e === "Traité") return "تمت المعالجة"; if (e === "Archive" || e === "Archivé") return "مؤرشف"; return "جديد"; }
function isMainWaridat(c) { const t = c.typeRegistre || (c.parentId ? TYPE_MORASALAT : TYPE_WARIDAT); return t === TYPE_WARIDAT && !c.parentId; }
function findMainWaridatByNumero(courriers, idBureauOrdre) { const n = (idBureauOrdre || "").trim(); return n ? courriers.find(c => isMainWaridat(c) && (c.idBureauOrdre || "").trim() === n) || null : null; }
function getDocumentHref(v) { if (!v) return ""; if (/^https?:\/\//i.test(v)) return v; const nv = v.startsWith("/") ? v : `/${v}`; return window.location.hostname === "localhost" && window.location.port === "3000" ? `http://localhost:5127${nv}` : nv; }
function getDocumentName(v) { if (!v) return ""; const clean = String(v).split("?")[0].split("#")[0]; return decodeURIComponent(clean.split("/").filter(Boolean).pop() || clean); }
function getErrorMessage(err, fb) { if (typeof err.response?.data === "string") return err.response.data; if (err.response?.data?.message) return err.response.data.message; if (err.message) return err.message; return fb; }

export default GererCourriers;