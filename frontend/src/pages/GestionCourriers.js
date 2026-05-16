import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

const TYPE_ADMINISTRATIF = 'administratif';
const TYPE_JUDICIAIRE   = 'judiciaire';
const TYPE_SORTANT       = 'sortant';

function GestionCourriers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const perms = usePermissions();
  const serviceId = user?.idService;

  if (!perms.canCreateAdministratif && !perms.canCreateJuridique && !perms.canExport) {
    return <div className="error-message">{t('access_denied')}</div>;
  }

  // ---------- active tab ----------
  const [tab, setTab] = useState(TYPE_ADMINISTRATIF);

  // ---------- data ----------
  const [allDocs, setAllDocs] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ---------- form ----------
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(emptyForm(TYPE_ADMINISTRATIF));

  // ---------- judicial sub‑type ----------
  const [judMode, setJudMode] = useState('file');
  const [parentFiles, setParentFiles] = useState([]);

  // ---------- reply modals ----------
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyForm, setReplyForm] = useState({ destinataire:'', sujet:'', date: new Date().toISOString().slice(0,10), lienPdf:'', description:'' });
  const [uploadingReply, setUploadingReply] = useState(false);

  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [answerTarget, setAnswerTarget] = useState(null);
  const [answerForm, setAnswerForm] = useState({ source:'', sujet:'', date: new Date().toISOString().slice(0,10), lienPdf:'', description:'' });
  const [uploadingAnswer, setUploadingAnswer] = useState(false);

  // ---------- view reply ----------
  const [showViewReplyModal, setShowViewReplyModal] = useState(false);
  const [viewedReply, setViewedReply] = useState(null);

  // ---------- replied IDs (for immediate button feedback) ----------
  const [repliedIds, setRepliedIds] = useState(new Set());

  // ---------- table ----------
  const [search, setSearch] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // ---------- helpers ----------
  function emptyForm(type) {
    return {
      idBureauOrdre: '',
      date: '',
      source: '',
      sujet: '',
      destinataire: '',
      description: '',
      etat: 'Nouveau',
      lienPdf: '',
      idService: serviceId || '',
      estTransmissible: type === TYPE_JUDICIAIRE ? true : false,
      numeroDeCourrier: '',
      tribunalSource: '',
      typeJudiciaire: '',
      numeroPremiereInstance: '',
      destinataireSortant: '',
      estDocumentLie: false,
      parentJudiciaireId: '',
    };
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [courriersRes, servicesRes] = await Promise.all([
        axios.get('/api/courriers'),
        axios.get('/api/services')
      ]);
      setAllDocs(courriersRes.data);
      setServices(servicesRes.data);
      // rebuild repliedIds from ALL documents (including replies)
      const ids = new Set();
      courriersRes.data.forEach(d => { if (d.parentId) ids.add(Number(d.parentId)); });
      setRepliedIds(ids);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, t('erreur_chargement')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchParentFiles = useCallback(async () => {
    try {
      const res = await axios.get('/api/acteursjudiciaires/parents');
      setParentFiles(res.data);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---------- main docs (no parent) ----------
  const mainDocs = useMemo(() => allDocs.filter(d => !d.parentId), [allDocs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return mainDocs;
    const kw = search.toLowerCase();
    return mainDocs.filter(d =>
      (d.idBureauOrdre||'').toLowerCase().includes(kw) ||
      (d.sujet||'').toLowerCase().includes(kw) ||
      (d.source||d.tribunalSource||'').toLowerCase().includes(kw) ||
      (d.destinataire||'').toLowerCase().includes(kw)
    );
  }, [mainDocs, search]);

  const idxLast = page * rowsPerPage;
  const idxFirst = idxLast - rowsPerPage;
  const currentItems = filtered.slice(idxFirst, idxLast);
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  useEffect(() => { setPage(1); }, [search]);

  // ---------- form handlers ----------
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : name === 'idService' ? Number(value) : value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm(tab));
    setJudMode('file');
    setError(''); setSuccess('');
  };

  const switchTab = (type) => {
    setTab(type);
    resetForm();
    window.scrollTo({ top: 0 });
  };

  // ---------- submit main document ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!perms.canCreateAdministratif && !perms.canCreateJuridique) return;
    setError(''); setSuccess('');

    try {
      if (tab === TYPE_ADMINISTRATIF || tab === TYPE_SORTANT) {
        const payload = {
          idBureauOrdre: form.idBureauOrdre.trim(),
          date: new Date(form.date).toISOString(),
          source: tab === TYPE_SORTANT ? 'Sortant' : form.source.trim(),
          sujet: form.sujet.trim(),
          destinataire: tab === TYPE_SORTANT ? form.destinataireSortant.trim() : '',
          description: form.description.trim(),
          etat: 'Nouveau',
          lienPdf: form.lienPdf.trim(),
          direction: tab === TYPE_SORTANT ? 'Sortant' : 'Entrant',
          typeRegistre: tab === TYPE_SORTANT ? 'Morasalat' : 'Waridat',
          typeCorrespondance: tab === TYPE_SORTANT ? 'Sortante' : null,
          parentId: null,
          idService: Number(form.idService),
          numeroDeCourrier: form.numeroDeCourrier?.trim() || '',
          estTransmissible: Boolean(form.estTransmissible),
        };
        if (editingId) await axios.put(`/api/courriers/${editingId}`, payload);
        else await axios.post('/api/courriers', payload);
      } else if (tab === TYPE_JUDICIAIRE) {
        const payload = {
          idBureauOrdre: form.idBureauOrdre?.trim() || null,
          date: new Date(form.date).toISOString(),
          tribunalSource: form.tribunalSource.trim(),
          sujet: form.sujet.trim(),
          direction: 'Entrant',
          description: form.description.trim(),
          etatArchive: form.etat,
          lienPdf: form.lienPdf.trim(),
          idService: Number(form.idService),
          estTransmissible: true,
          numeroPremiereInstance: form.numeroPremiereInstance?.trim() || null,
          estDocumentLie: judMode === 'linked',
          parentJudiciaireId: judMode === 'linked' ? Number(form.parentJudiciaireId) : null,
        };
        if (editingId) await axios.put(`/api/acteursjudiciaires/${editingId}`, payload);
        else await axios.post('/api/acteursjudiciaires', payload);
      }
      setSuccess(editingId ? t('modification_succes') : t('ajout_succes'));
      resetForm();
      fetchData();
    } catch (err) { setError(getErrorMessage(err, t('erreur_enregistrement'))); }
  };

  // ---------- edit ----------
  const handleEdit = (doc) => {
    if (!perms.canCreateAdministratif && !perms.canCreateJuridique) return;
    let type;
    if (doc.typeDocument === 'Judiciaire') type = TYPE_JUDICIAIRE;
    else if (doc.typeRegistre === 'Morasalat' && doc.typeCorrespondance === 'Sortante') type = TYPE_SORTANT;
    else type = TYPE_ADMINISTRATIF;
    setTab(type);
    setEditingId(doc.id);
    setJudMode(doc.estDocumentLie ? 'linked' : 'file');
    setForm({
      ...emptyForm(type),
      idBureauOrdre: doc.idBureauOrdre || '',
      date: doc.date ? doc.date.slice(0,10) : '',
      source: doc.source || '',
      sujet: doc.sujet || '',
      destinataire: doc.destinataire || '',
      description: doc.description || '',
      etat: doc.etat || 'Nouveau',
      lienPdf: doc.lienPdf || '',
      idService: doc.idService || serviceId,
      estTransmissible: Boolean(doc.estTransmissible),
      numeroDeCourrier: doc.numeroDeCourrier || '',
      tribunalSource: doc.tribunalSource || '',
      typeJudiciaire: doc.typeJudiciaire || '',
      numeroPremiereInstance: doc.numeroPremiereInstance || '',
      destinataireSortant: doc.destinataire || '',
      estDocumentLie: doc.estDocumentLie || false,
      parentJudiciaireId: doc.parentJudiciaireId || '',
    });
    window.scrollTo({ top: 0 });
  };

  // ---------- delete ----------
  const handleDelete = async (id, typeDoc) => {
    if (!perms.canDelete) return;
    if (!window.confirm(t('confirmation_supprimer'))) return;
    try {
      if (typeDoc === 'Judiciaire') await axios.delete(`/api/acteursjudiciaires/${id}`);
      else await axios.delete(`/api/courriers/${id}`);
      setSuccess(t('suppression_succes'));
      fetchData();
    } catch (err) { setError(getErrorMessage(err, t('erreur_suppression'))); }
  };

  // ---------- transfer ----------
  const handleTransfer = async (doc) => {
    const svc = prompt('ID du service destinataire :');
    if (!svc) return;
    const msg = prompt('Message :');
    try {
      await axios.post('/api/transactions', {
        documentId: doc.id,
        documentType: doc.typeDocument || 'Administratif',
        destinationServiceId: Number(svc),
        destinationUserId: null,
        doitRevenir: false,
        message: msg || ''
      });
      setSuccess(t('transaction_envoyee'));
      fetchData();
    } catch (err) { setError(err.response?.data?.message || t('erreur_transaction')); }
  };

  // ---------- reply (incoming → outgoing) ----------
  const openReplyModal = (doc) => {
    setReplyTarget(doc);
    setReplyForm({ destinataire:'', sujet:'', date: new Date().toISOString().slice(0,10), lienPdf:'', description:'' });
    setShowReplyModal(true);
  };

  const submitReply = async () => {
    const { destinataire, sujet, date, lienPdf, description } = replyForm;
    if (!sujet.trim()) return;
    try {
      await axios.post('/api/courriers', {
        idBureauOrdre: '',
        date: new Date(date).toISOString(),
        source: 'Réponse',
        sujet: sujet.trim(),
        destinataire: destinataire.trim(),
        description: description.trim(),
        etat: 'Nouveau',
        lienPdf: lienPdf.trim(),
        direction: 'Sortant',
        typeRegistre: 'Morasalat',
        typeCorrespondance: 'Sortante',
        parentId: replyTarget.id,
        idService: serviceId,
        numeroDeCourrier: '',
        estTransmissible: false,
      });
      setSuccess(t('reply_added'));
      setShowReplyModal(false);
      setRepliedIds(prev => new Set(prev).add(Number(replyTarget.id)));
      fetchData();
    } catch (err) { setError(getErrorMessage(err, t('erreur_enregistrement'))); }
  };

  const handleReplyUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    setUploadingReply(true);
    try {
      const res = await axios.post('/api/courriers/upload-document', fd);
      setReplyForm(prev => ({ ...prev, lienPdf: res.data.lienPdf }));
    } catch (err) { setError(getErrorMessage(err, t('erreur_upload'))); }
    finally { setUploadingReply(false); e.target.value = ''; }
  };

  // ---------- answer (outgoing → incoming) ----------
  const openAnswerModal = (doc) => {
    setAnswerTarget(doc);
    setAnswerForm({ source:'', sujet:'RE: ' + doc.sujet, date: new Date().toISOString().slice(0,10), lienPdf:'', description:'' });
    setShowAnswerModal(true);
  };

const submitAnswer = async () => {
    setError('');   // clear any previous error
    const { source, sujet, date, lienPdf, description } = answerForm;
    if (!description.trim()) {
        setError(t('reponse_requise') || 'La réponse est obligatoire.');
        return;
    }
    try {
        await axios.post('/api/courriers', {
            idBureauOrdre: '',
            date: new Date(date).toISOString(),
            source: source.trim() || 'Réponse',
            sujet: sujet.trim() || 'RE: ' + answerTarget.sujet,
            destinataire: '',
            description: description.trim(),
            etat: 'Nouveau',
            lienPdf: lienPdf.trim(),
            direction: 'Entrant',
            typeRegistre: 'Waridat',
            typeCorrespondance: null,
            parentId: answerTarget.id,
            idService: serviceId,
            numeroDeCourrier: '',
            estTransmissible: false,
        });
        setSuccess(t('reply_added'));
        setShowAnswerModal(false);
        setRepliedIds(prev => new Set(prev).add(Number(answerTarget.id)));
        fetchData();
    } catch (err) { setError(getErrorMessage(err, t('erreur_enregistrement'))); }
};

  const handleAnswerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    setUploadingAnswer(true);
    try {
      const res = await axios.post('/api/courriers/upload-document', fd);
      setAnswerForm(prev => ({ ...prev, lienPdf: res.data.lienPdf }));
    } catch (err) { setError(getErrorMessage(err, t('erreur_upload'))); }
    finally { setUploadingAnswer(false); e.target.value = ''; }
  };

  // ---------- view reply ----------
  const handleViewReply = (doc) => {
    const child = allDocs.find(d => Number(d.parentId) === Number(doc.id));
    if (child) {
      setViewedReply(child);
      setShowViewReplyModal(true);
    } else {
      alert(t('no_reply'));
    }
  };

  // ---------- upload main ----------
  const handleMainUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    setUploading(true);
    try {
      const url = tab === TYPE_JUDICIAIRE ? '/api/acteursjudiciaires/upload-pdf' : '/api/courriers/upload-document';
      const res = await axios.post(url, fd);
      setForm(prev => ({ ...prev, lienPdf: res.data.lienPdf }));
      setSuccess(t('document_uploaded'));
    } catch (err) { setError(getErrorMessage(err, t('erreur_upload'))); }
    finally { setUploading(false); e.target.value = ''; }
  };

  // --------------------------------------------------------------------
  return (
    <div className="page-container" dir="rtl">
      <h1 className="page-title">{t('menu_courriers')}</h1>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* ---------- Tabs ---------- */}
      <div className="registry-choice">
        {[TYPE_ADMINISTRATIF, TYPE_JUDICIAIRE, TYPE_SORTANT].map(type => (
          <button key={type} className={`choice-pill ${tab === type ? 'active' : ''}`} onClick={() => switchTab(type)}>
            {t(type)}
          </button>
        ))}
      </div>

      {/* ---------- Form ---------- */}
      {(perms.canCreateAdministratif || perms.canCreateJuridique) && (
        <div className="form-card">
          <h3>{editingId ? t('modifier') : t('ajouter')} – {t(tab)}</h3>
          <form onSubmit={handleSubmit}>
            {tab === TYPE_JUDICIAIRE && (
              <div className="registry-choice sub-choice" style={{ marginBottom:'1.5rem' }}>
                <button type="button" className={`choice-pill ${judMode==='file'?'active':''}`} onClick={()=>{setJudMode('file'); setForm(emptyForm(TYPE_JUDICIAIRE));}}>
                  ملف
                </button>
                <button type="button" className={`choice-pill ${judMode==='linked'?'active':''}`} onClick={()=>{setJudMode('linked'); setForm(emptyForm(TYPE_JUDICIAIRE)); fetchParentFiles();}}>
                  وثيقة مربوطة بملف
                </button>
              </div>
            )}

            <div className="form-grid">
              {/* idBureauOrdre – optional for judicial, required for others */}
              <div className="form-field">
                <label>{t('numero_bureau_ordre')} {tab !== TYPE_JUDICIAIRE ? '*' : ''}</label>
                <input type="text" name="idBureauOrdre" value={form.idBureauOrdre} onChange={handleChange} required={tab !== TYPE_JUDICIAIRE} />
              </div>

              {/* Date */}
              <div className="form-field"><label>{t('date')} *</label><input type="date" name="date" value={form.date} onChange={handleChange} required /></div>

              {/* Source / Tribunal */}
              {tab === TYPE_JUDICIAIRE ? (
                <div className="form-field">
                  <label>{t('tribunal_source')} *</label>
                  <select name="tribunalSource" value={form.tribunalSource} onChange={handleChange} required={judMode!=='linked'}>
                    <option value="">-- {t('choisir')} --</option>
                    <option value="محكمة الاستئناف">محكمة الاستئناف</option>
                    <option value="المحكمة الابتدائية">المحكمة الابتدائية</option>
                    <option value="المجلس الأعلى">المجلس الأعلى</option>
                  </select>
                </div>
              ) : tab !== TYPE_SORTANT && (
                <div className="form-field"><label>{t('source')} *</label><input type="text" name="source" value={form.source} onChange={handleChange} required /></div>
              )}

              {/* Parent dossier selector */}
              {tab === TYPE_JUDICIAIRE && judMode==='linked' && (
                <div className="form-field">
                  <label>{t('choisir_dossier_parent') || 'اختيار الملف'}</label>
                  <select name="parentJudiciaireId" value={form.parentJudiciaireId} onChange={handleChange} required>
                    <option value="">-- {t('choisir')} --</option>
                    {parentFiles.map(p=><option key={p.id} value={p.id}>{p.numeroDossier}</option>)}
                  </select>
                </div>
              )}

              {/* Objet */}
              <div className="form-field"><label>{t('objet')} *</label><input type="text" name="sujet" value={form.sujet} onChange={handleChange} required /></div>

              {/* Destinataire – only for Sortant */}
              {tab === TYPE_SORTANT && (
                <div className="form-field"><label>{t('destinataire')}</label><input type="text" name="destinataireSortant" value={form.destinataireSortant} onChange={handleChange} /></div>
              )}

              {/* Judicial extra fields (standalone file only) */}
              {tab===TYPE_JUDICIAIRE && judMode!=='linked' && (<>
                <div className="form-field"><label>{t('numero_premiere_instance')||'الرقم الابتدائي'}</label><input name="numeroPremiereInstance" value={form.numeroPremiereInstance} onChange={handleChange} placeholder="2026/12" /></div>
                <div className="form-field"><label>{t('type_judiciaire')||'النوع'}</label><select name="typeJudiciaire" value={form.typeJudiciaire} onChange={handleChange}><option value="">-- {t('choisir')} --</option><option value="جنحة">جنحة</option><option value="جناية">جناية</option><option value="مخالفة">مخالفة</option></select></div>
              </>)}

              {/* Service */}
              <div className="form-field"><label>{t('service')} *</label><input type="text" value={services.find(s=>s.idService===form.idService)?.nomService||''} disabled /><input type="hidden" name="idService" value={form.idService} /></div>

              {/* État (not sortant) */}
              {tab !== TYPE_SORTANT && (
                <div className="form-field"><label>{t('etat')}</label><select name="etat" value={form.etat} onChange={handleChange}><option value="Nouveau">{t('nouveau')}</option><option value="En cours">{t('en_cours')}</option><option value="Traite">{t('traite')}</option><option value="Archive">{t('archive')}</option></select></div>
              )}

              {/* Numéro interne (admin only) */}
              {tab === TYPE_ADMINISTRATIF && <div className="form-field"><label>{t('numero_interne')}</label><input type="text" name="numeroDeCourrier" value={form.numeroDeCourrier} onChange={handleChange} /></div>}

              {/* PDF */}
              <div className="form-field full-width">
                <label>{t('document_pdf_word')}</label>
                <div className="document-control">
                  <label className="document-upload-button">{uploading ? t('uploading') : t('choisir_fichier')}<input type="file" accept=".pdf,.doc,.docx" onChange={handleMainUpload} /></label>
                  <div className={form.lienPdf ? "document-link-preview filled" : "document-link-preview"}><span title={form.lienPdf}>{form.lienPdf ? getDocumentName(form.lienPdf) : t('aucun_fichier')}</span>{form.lienPdf && <a href={getDocumentHref(form.lienPdf)} target="_blank" rel="noreferrer">{t('ouvrir')}</a>}</div>
                  <div className="document-link-input"><input type="text" name="lienPdf" value={form.lienPdf} onChange={handleChange} placeholder={t('lien_manuel')} />{form.lienPdf && <a href={getDocumentHref(form.lienPdf)} target="_blank" rel="noreferrer">{t('ouvrir')}</a>}</div>
                </div>
              </div>

              {/* Transmissible (admin only) */}
              {tab === TYPE_ADMINISTRATIF && <div className="form-field"><label>{t('transmissible')}</label><label className="checkbox-field"><input type="checkbox" name="estTransmissible" checked={form.estTransmissible} onChange={handleChange} /> {t('oui')}</label></div>}

              {/* Notes */}
              <div className="form-field full-width"><label>{t('notes')}</label><textarea name="description" value={form.description} onChange={handleChange} rows="3" /></div>
            </div>
            <div className="form-actions"><button type="submit" className="btn-primary">{editingId ? t('modifier') : t('ajouter')}</button>{editingId && <button type="button" className="btn-secondary" onClick={resetForm}>{t('annuler')}</button>}</div>
          </form>
        </div>
      )}

      {/* ---------- Registry table ---------- */}
      <div className="data-table-wrapper" style={{ marginTop:'2rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.5rem', marginBottom:'1rem' }}>
          <h3 style={{ margin:0 }}>{t('registre')} ({filtered.length})</h3>
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
            <input type="text" placeholder={t('rechercher_par_mot')} value={search} onChange={e=>setSearch(e.target.value)} style={{ minWidth:'200px' }} />
            <div className="rows-per-page"><span>{t('afficher')}</span><select value={rowsPerPage} onChange={e=>{setRowsPerPage(Number(e.target.value)); setPage(1);}}><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option></select><span>{t('lignes')}</span></div>
          </div>
        </div>

        {loading ? <div className="loading">{t('chargement')}</div> : (
          <table className="modern-table">
            <thead><tr><th>{t('numero_bureau_ordre')}</th><th>{t('date')}</th><th>{t('source')}</th><th>{t('sujet')}</th><th>{t('type_registre')}</th><th>{t('etat')}</th><th>PDF</th><th>{t('actions')}</th></tr></thead>
            <tbody>
              {currentItems.length===0 ? (
                <tr><td colSpan="8" style={{ textAlign:'center' }}>{t('aucun_enregistrement')}</td></tr>
              ) : (
                currentItems.map(doc => {
                  const rowKey = `${doc.id}_${doc.typeDocument||'admin'}`;
                  const isJud = doc.typeDocument==='Judiciaire';
                  const isSort = doc.typeRegistre==='Morasalat' && doc.typeCorrespondance==='Sortante';
                  const canEdit = perms.canCreateAdministratif || perms.canCreateJuridique;
                  const showReplyBtn = repliedIds.has(Number(doc.id));
                  return (
                    <tr key={rowKey}>
                      <td>{doc.idBureauOrdre||'-'}</td>
                      <td>{formatDate(doc.date)}</td>
                      <td>{doc.source||doc.tribunalSource||'-'}</td>
                      <td>{doc.sujet||'-'}</td>
                      <td><span className={`type-badge ${isJud?'judiciaire':isSort?'sortante':'administratif'}`}>{isJud?t('judiciaire'):isSort?t('sortante'):t('administratif')}</span></td>
                      <td>{formatEtat(doc.etat||doc.etatArchive)}</td>
                      <td>{doc.lienPdf?<a href={getDocumentHref(doc.lienPdf)} target="_blank" rel="noreferrer">PDF</a>:'-'}</td>
                      <td className="action-icons">
                        {canEdit && <button onClick={()=>handleEdit(doc)}>{t('modifier')}</button>}
                        {perms.canDelete && <button onClick={()=>handleDelete(doc.id, doc.typeDocument)}>{t('supprimer')}</button>}
                        {perms.canTransfer && <button onClick={()=>handleTransfer(doc)}>{t('transferer')}</button>}
                        {!isSort && <button onClick={()=>openReplyModal(doc)}>{t('repondre')}</button>}
                        {isSort && <button onClick={()=>openAnswerModal(doc)}>{t('ajouter_reponse')}</button>}
                        {showReplyBtn && <button className="btn-view-reply" onClick={()=>handleViewReply(doc)}>{t('voir_reponse')}</button>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
        {totalPages>1 && (
          <div className="pagination">
            <button onClick={()=>setPage(p=>p-1)} disabled={page===1}>{t('precedent')}</button>
            <span>{t('page')} {page} / {totalPages}</span>
            <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages}>{t('suivant')}</button>
          </div>
        )}
      </div>

      {/* ---------- Reply modal (incoming → outgoing) ---------- */}
      {showReplyModal && (
        <div className="modal-overlay" onClick={()=>setShowReplyModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="registry-panel-header"><h3>{t('repondre')}</h3><button className="btn-secondary" onClick={()=>setShowReplyModal(false)}>{t('fermer')}</button></div>
            <div className="form-grid">
              <div className="form-field"><label>{t('destinataire')}</label><input value={replyForm.destinataire} onChange={e=>setReplyForm({...replyForm,destinataire:e.target.value})} /></div>
              <div className="form-field"><label>{t('sujet')} *</label><input value={replyForm.sujet} onChange={e=>setReplyForm({...replyForm,sujet:e.target.value})} required /></div>
              <div className="form-field"><label>{t('date')}</label><input type="date" value={replyForm.date} onChange={e=>setReplyForm({...replyForm,date:e.target.value})} /></div>
              <div className="form-field full-width">
                <label>{t('document_pdf_word')}</label>
                <div className="document-control">
                  <label className="document-upload-button">{uploadingReply?t('uploading'):t('choisir_fichier')}<input type="file" accept=".pdf,.doc,.docx" onChange={handleReplyUpload} /></label>
                  <div className={replyForm.lienPdf?"document-link-preview filled":"document-link-preview"}><span title={replyForm.lienPdf}>{replyForm.lienPdf?getDocumentName(replyForm.lienPdf):t('aucun_fichier')}</span>{replyForm.lienPdf&&<a href={getDocumentHref(replyForm.lienPdf)} target="_blank" rel="noreferrer">{t('ouvrir')}</a>}</div>
                  <div className="document-link-input"><input type="text" value={replyForm.lienPdf} onChange={e=>setReplyForm({...replyForm,lienPdf:e.target.value})} placeholder={t('lien_manuel')} />{replyForm.lienPdf&&<a href={getDocumentHref(replyForm.lienPdf)} target="_blank" rel="noreferrer">{t('ouvrir')}</a>}</div>
                </div>
              </div>
              <div className="form-field full-width"><label>{t('notes')}</label><textarea value={replyForm.description} onChange={e=>setReplyForm({...replyForm,description:e.target.value})} rows="3" /></div>
            </div>
            <div className="form-actions"><button className="btn-primary" onClick={submitReply}>{t('envoyer')}</button><button className="btn-secondary" onClick={()=>setShowReplyModal(false)}>{t('annuler')}</button></div>
          </div>
        </div>
      )}

  {/* ---------- Answer modal (outgoing → incoming) ---------- */}
{showAnswerModal && (
  <div className="modal-overlay" onClick={() => setShowAnswerModal(false)}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="registry-panel-header">
        <h3>{t('ajouter_reponse')}</h3>
        <button className="btn-secondary" onClick={() => setShowAnswerModal(false)}>{t('fermer')}</button>
      </div>

      {/* Show error if required field is empty */}
      {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="form-grid">
        <div className="form-field">
          <label>{t('source')}</label>
          <input
            value={answerForm.source}
            onChange={e => setAnswerForm({...answerForm, source: e.target.value})}
          />
        </div>
        <div className="form-field">
          <label>{t('sujet')}</label>
          <input
            value={answerForm.sujet}
            onChange={e => setAnswerForm({...answerForm, sujet: e.target.value})}
          />
        </div>
        <div className="form-field">
          <label>{t('date')}</label>
          <input
            type="date"
            value={answerForm.date}
            onChange={e => setAnswerForm({...answerForm, date: e.target.value})}
          />
        </div>
        <div className="form-field full-width">
          <label>{t('document_pdf_word')}</label>
          {/* ... document upload (unchanged) ... */}
        </div>
        <div className="form-field full-width">
          <label>{t('reponse')} *</label>
          <textarea
            value={answerForm.description}
            onChange={e => setAnswerForm({...answerForm, description: e.target.value})}
            rows="4"
            required
          />
        </div>
      </div>

      <div className="form-actions">
        <button
          className="btn-primary"
          onClick={() => {
            if (!answerForm.description.trim()) {
              setError(t('reponse_requise') || 'La réponse est obligatoire.');
              return;
            }
            submitAnswer();
          }}
        >
          {t('envoyer')}
        </button>
        <button className="btn-secondary" onClick={() => setShowAnswerModal(false)}>{t('annuler')}</button>
      </div>
    </div>
  </div>
)}

      {/* ---------- View reply modal (shows all fields) ---------- */}
      {showViewReplyModal && viewedReply && (
        <div className="modal-overlay" onClick={()=>setShowViewReplyModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="registry-panel-header"><h3>{t('reponse')}</h3><button className="btn-secondary" onClick={()=>setShowViewReplyModal(false)}>{t('fermer')}</button></div>
            <div className="form-grid">
              <div className="form-field"><label>{t('source')}</label><input value={viewedReply.source||''} disabled /></div>
              {viewedReply.destinataire && (
                <div className="form-field"><label>{t('destinataire')}</label><input value={viewedReply.destinataire} disabled /></div>
              )}
              <div className="form-field"><label>{t('sujet')}</label><input value={viewedReply.sujet||''} disabled /></div>
              <div className="form-field"><label>{t('date')}</label><input value={formatDate(viewedReply.date)} disabled /></div>
              {viewedReply.lienPdf && (
                <div className="form-field full-width"><label>{t('document_pdf_word')}</label><a href={getDocumentHref(viewedReply.lienPdf)} target="_blank" rel="noreferrer" className="btn-secondary">{t('ouvrir')}</a></div>
              )}
              <div className="form-field full-width"><label>{t('description')}</label><textarea value={viewedReply.description||''} disabled rows="4" /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Helpers ----------
function formatDate(v) { if (!v) return '-'; return new Date(v).toLocaleDateString(); }
function formatEtat(e) { if (e==='En cours') return 'قيد المعالجة'; if (e==='Traite') return 'تمت المعالجة'; if (e==='Archive') return 'مؤرشفة'; return 'جديد'; }
function getDocumentHref(v) { if (!v) return ''; if (/^https?:\/\//i.test(v)) return v; const nv = v.startsWith('/') ? v : `/${v}`; return window.location.hostname==='localhost' && window.location.port==='3000' ? `http://localhost:5127${nv}` : nv; }
function getDocumentName(v) { if (!v) return ''; const clean = String(v).split('?')[0].split('#')[0]; return decodeURIComponent(clean.split('/').filter(Boolean).pop()||clean); }
function getErrorMessage(err, fb) { if (typeof err?.response?.data==='string') return err.response.data; if (err?.response?.data?.message) return err.response.data.message; if (err?.message) return err.message; return fb; }

export default GestionCourriers;