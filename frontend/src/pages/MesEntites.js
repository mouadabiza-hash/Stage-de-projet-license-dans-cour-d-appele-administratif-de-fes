import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../hooks/usePermissions';
import DocumentModal from '../components/DocumentModal';

function MesEntites() {
  const { t } = useTranslation();
  const perms = usePermissions();

  const [allDocuments, setAllDocuments] = useState([]);
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);

  // ----- search -----
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAllOwn, setSelectAllOwn] = useState(false);
  const [selectAllSub, setSelectAllSub] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [bulkDocs, setBulkDocs] = useState([]);

  const [transferForm, setTransferForm] = useState({
    serviceId: '', userId: '', doitRevenir: false, message: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDocument, setModalDocument] = useState(null);

  const [rowsPerPageOwn, setRowsPerPageOwn] = useState(10);
  const [currentPageOwn, setCurrentPageOwn] = useState(1);
  const [rowsPerPageSub, setRowsPerPageSub] = useState(10);
  const [currentPageSub, setCurrentPageSub] = useState(1);

  // ----- FILTER DOCUMENTS -----
  const filteredDocuments = allDocuments.filter(doc => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const sujet = (doc.sujet || '').toLowerCase();
    const source = (doc.source || '').toLowerCase();
    const destinataire = (doc.destinataire || '').toLowerCase();
    const type = (doc.type || doc.Type || '').toLowerCase();
    const numeroCourrier = (doc.numeroCourrier || doc.IdBureauOrdre || '').toLowerCase();
    const numeroDossier = (doc.numeroDossierJudiciaire || '').toLowerCase();
    const description = (doc.description || doc.Description || '').toLowerCase();
    return (
      sujet.includes(term) ||
      source.includes(term) ||
      destinataire.includes(term) ||
      type.includes(term) ||
      numeroCourrier.includes(term) ||
      numeroDossier.includes(term) ||
      description.includes(term)
    );
  });

  // ----- SPLIT DOCUMENTS -----
  const ownDocuments = filteredDocuments.filter(d => !d.isSubstitute);
  const subDocuments = filteredDocuments.filter(d => d.isSubstitute);

  useEffect(() => { fetchDocuments(); fetchServices(); }, []);
  useEffect(() => { setCurrentPageOwn(1); }, [ownDocuments.length]);
  useEffect(() => { setCurrentPageSub(1); }, [subDocuments.length]);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get('/api/documents');
      setAllDocuments(res.data);
      setError('');
      setSelectedIds([]);
      setSelectAllOwn(false);
      setSelectAllSub(false);
    } catch (err) { setError(t('erreur_chargement')); }
  };

  const fetchServices = async () => {
    try { const res = await axios.get('/api/services'); setServices(res.data); } catch (err) { }
  };

  // ========== SINGLE ACTIONS ==========
  const handleArchive = async (doc) => {
    if (!perms.canArchive) return;
    if (!window.confirm(t('confirmation_archiver'))) return;
    const docType = doc.type || doc.Type;
    const docId = doc.idEntite;
    if (!docType || !docId) { setError(t('erreur_archivage')); return; }
    try {
      if (docType === 'Administratif') await axios.put(`/api/courriers/archiver/${docId}`);
      else await axios.put(`/api/acteursjudiciaires/archiver/${docId}`);
      setSuccess(t('archivage_succes'));
      fetchDocuments();
    } catch (err) { setError(getErrorMessage(err, t('erreur_archivage'))); }
  };

  const openTransferModal = (doc) => {
    if (!perms.canTransfer) return;
    setBulkMode(false);
    setSelectedDoc(doc);
    setUsers([]);
    setTransferForm({ serviceId: '', userId: '', doitRevenir: false, message: '' });
    setShowTransferModal(true);
    setError(''); setSuccess('');
  };

  const handleServiceChange = async (serviceId) => {
    setTransferForm({ ...transferForm, serviceId: serviceId || '', userId: '' });
    setUsers([]);
    if (!serviceId) return;
    try {
      const res = await axios.get(`/api/utilisateurs?serviceId=${serviceId}`);
      setUsers(res.data);
    } catch (err) { setError(t('erreur_chargement')); }
  };

  const handleTransfer = async () => {
    if (bulkMode) {
      if (!transferForm.serviceId) { setError(t('service_destinataire_requis')); return; }
      let ok = 0, fail = 0;
      for (let doc of bulkDocs) {
        try {
          await axios.post('/api/transactions', {
            documentId: doc.idEntite,
            documentType: doc.type || doc.Type,
            destinationServiceId: Number(transferForm.serviceId),
            destinationUserId: transferForm.userId ? Number(transferForm.userId) : null,
            doitRevenir: transferForm.doitRevenir,
            message: transferForm.message
          });
          ok++;
        } catch (err) { fail++; }
      }
      setShowTransferModal(false);
      setBulkDocs([]);
      setSuccess(`${ok} ${t('transactions_envoyees')}${fail > 0 ? ` (${fail} échecs)` : ''}`);
      fetchDocuments();
    } else {
      if (!selectedDoc || !transferForm.serviceId) { setError(t('service_destinataire_requis')); return; }
      try {
        await axios.post('/api/transactions', {
          documentId: selectedDoc.idEntite,
          documentType: selectedDoc.type || selectedDoc.Type,
          destinationServiceId: Number(transferForm.serviceId),
          destinationUserId: transferForm.userId ? Number(transferForm.userId) : null,
          doitRevenir: transferForm.doitRevenir,
          message: transferForm.message
        });
        setShowTransferModal(false);
        setSelectedDoc(null);
        setSuccess(t('transaction_envoyee'));
        fetchDocuments();
      } catch (err) { setError(err.response?.data?.message || t('erreur_transaction')); }
    }
  };

  // ========== BULK ==========
  const openBulkTransferModal = (docs) => {
    if (!perms.canTransfer) return;
    if (docs.length === 0) { setError(t('selection_requise')); return; }
    setBulkMode(true);
    setBulkDocs(docs);
    setUsers([]);
    setTransferForm({ serviceId: '', userId: '', doitRevenir: false, message: '' });
    setShowTransferModal(true);
    setError(''); setSuccess('');
  };

  const handleBulkArchive = async (docs) => {
    if (!perms.canArchive) return;
    if (docs.length === 0) { setError(t('selection_requise')); return; }
    if (!window.confirm(`${t('confirmation_archiver')} (${docs.length} documents)`)) return;
    let ok = 0, fail = 0;
    for (let doc of docs) {
      try {
        if ((doc.type || doc.Type) === 'Administratif') await axios.put(`/api/courriers/archiver/${doc.idEntite}`);
        else await axios.put(`/api/acteursjudiciaires/archiver/${doc.idEntite}`);
        ok++;
      } catch (err) { fail++; }
    }
    setSuccess(`${ok} ${t('archives_succes')}${fail > 0 ? ` (${fail} échecs)` : ''}`);
    fetchDocuments();
  };

  // ========== SELECTION ==========
  const handleSelectAll = (docs, setSelectAllFn, selectAllState) => {
    if (selectAllState) {
      setSelectedIds(prev => prev.filter(id => !docs.map(d => `${d.idEntite}_${d.type || d.Type}`).includes(id)));
    } else {
      const newIds = docs.map(d => `${d.idEntite}_${d.type || d.Type}`);
      setSelectedIds(prev => [...new Set([...prev, ...newIds])]);
    }
    setSelectAllFn(!selectAllState);
  };

  const handleSelectOne = (doc) => {
    const key = `${doc.idEntite}_${doc.type || doc.Type}`;
    setSelectedIds(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const getSelectedDocs = (docs) => docs.filter(d => selectedIds.includes(`${d.idEntite}_${d.type || d.Type}`));

  // ========== CONSULT ==========
  const handleConsult = async (doc) => {
    try {
      const res = await axios.get(`/api/documents/${doc.idEntite}?type=${encodeURIComponent(doc.type || doc.Type)}`);
      setModalDocument(res.data);
    } catch (err) { setModalDocument(doc); }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setModalDocument(null); };

  // ========== RENDER TABLE ==========
  const renderTable = (title, documents, selectAll, setSelectAllFn, rowsPerPage, currentPage, setCurrentPageFn, setRowsPerPageFn) => {
    const idxLast = currentPage * rowsPerPage;
    const idxFirst = idxLast - rowsPerPage;
    const currentDocs = documents.slice(idxFirst, idxLast);
    const totalPages = Math.ceil(documents.length / rowsPerPage);
    const selectedDocs = getSelectedDocs(documents);

    return (
      <div className="data-table-wrapper" style={{ marginBottom: '2rem' }}>
        <h3>{title} ({documents.length})</h3>

        <div className="bulk-toolbar">
          <div className="bulk-toolbar-left">
            <span className="bulk-count">
              {selectedDocs.length} {t('selected')}
            </span>
          </div>
          <div className="bulk-toolbar-right">
            {perms.canTransfer && (
              <button className="btn-primary" disabled={selectedDocs.length === 0}
                onClick={() => openBulkTransferModal(selectedDocs)}>
                {t('transferer_selection')}
              </button>
            )}
            {perms.canArchive && (
              <button className="btn-primary" disabled={selectedDocs.length === 0}
                onClick={() => handleBulkArchive(selectedDocs)}>
                {t('archiver_selection')}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <div className="rows-per-page">
            <span>{t('afficher')}</span>
            <select value={rowsPerPage} onChange={e => { setRowsPerPageFn(Number(e.target.value)); setCurrentPageFn(1); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
            <span>{t('lignes')}</span>
          </div>
        </div>

        <table className="modern-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={selectAll} onChange={() => handleSelectAll(documents, setSelectAllFn, selectAll)} />
              </th>
              <th>{t('titre')}</th>
              <th>{t('numero_bureau_ordre') || "N° Bureau d'ordre"}</th>
              <th>{t('numero_dossier_judiciaire') || 'N° dossier judiciaire'}</th>
              <th>{t('type')}</th>
              <th>{t('date')}</th>
              <th>{t('source')}</th>
              <th>{t('destinataire')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {currentDocs.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center' }}>{t('aucun_document')}</td></tr>
            ) : (
              currentDocs.map(doc => {
                const key = `${doc.idEntite}_${doc.type || doc.Type}`;
                return (
                  <tr key={key}>
                    <td><input type="checkbox" checked={selectedIds.includes(key)} onChange={() => handleSelectOne(doc)} /></td>
                    <td>{doc.sujet || '-'}</td>
                    <td>{doc.numeroCourrier || '-'}</td>
                    <td>{doc.numeroDossierJudiciaire || '-'}</td>
                    <td>{doc.type || doc.Type}</td>
                    <td>{doc.dateCreation ? new Date(doc.dateCreation).toLocaleDateString('ar-MA') : '-'}</td>
                    <td>{doc.source || '-'}</td>
                    <td>{doc.destinataire || '-'}</td>
                    <td className="action-icons">
                      <button onClick={() => handleConsult(doc)}>{t('consulter')}</button>
                      {perms.canTransfer && <button onClick={() => openTransferModal(doc)}>{t('transferer')}</button>}
                      {perms.canArchive && <button onClick={() => handleArchive(doc)}>{t('archiver')}</button>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setCurrentPageFn(currentPage - 1)} disabled={currentPage === 1}>{t('precedent')}</button>
            <span>{t('page')} {currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPageFn(currentPage + 1)} disabled={currentPage === totalPages}>{t('suivant')}</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{t('mes_entites')}</h1>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* ========== SEARCH BAR ========== */}
      <div className="filters">
        <input
          type="text"
          placeholder={t('rechercher_document') || 'Rechercher un document...'}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '250px' }}
        />
        {searchTerm && (
          <button className="btn-secondary" onClick={() => setSearchTerm('')}>
            {t('reinitialiser')}
          </button>
        )}
      </div>

      {/* OWN DOCUMENTS */}
      {renderTable(
        t('my_documents') || 'Mes documents',
        ownDocuments,
        selectAllOwn,
        setSelectAllOwn,
        rowsPerPageOwn,
        currentPageOwn,
        setCurrentPageOwn,
        setRowsPerPageOwn
      )}

      {/* SUBSTITUTE DOCUMENTS (only if any exist) */}
      {subDocuments.length > 0 && renderTable(
        t('substitute_documents') || 'Documents en substitution',
        subDocuments,
        selectAllSub,
        setSelectAllSub,
        rowsPerPageSub,
        currentPageSub,
        setCurrentPageSub,
        setRowsPerPageSub
      )}

      {/* ========== TRANSFER MODAL ========== */}
      {showTransferModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowTransferModal(false)} />
          <div className="modal">
            <h3>{bulkMode ? `${t('transferer')} ${bulkDocs.length} documents` : `${t('transferer')} : ${selectedDoc?.sujet || ''}`}</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>{t('service_destinataire')} *</label>
                <select value={transferForm.serviceId} onChange={e => handleServiceChange(Number(e.target.value))}>
                  <option value="">--</option>
                  {services.map(s => <option key={s.idService} value={s.idService}>{s.nomService}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>{t('personne')}</label>
                <select value={transferForm.userId} onChange={e => setTransferForm({ ...transferForm, userId: e.target.value })}>
                  <option value="">--</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.nomComplet}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="checkbox-field">
                  <input type="checkbox" checked={transferForm.doitRevenir} onChange={e => setTransferForm({ ...transferForm, doitRevenir: e.target.checked })} />
                  {t('doit_revenir')}
                </label>
              </div>
              <div className="form-field full-width">
                <label>{t('message')}</label>
                <textarea value={transferForm.message} onChange={e => setTransferForm({ ...transferForm, message: e.target.value })} rows="3" />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-primary" onClick={handleTransfer}>{t('envoyer')}</button>
              <button className="btn-secondary" onClick={() => setShowTransferModal(false)}>{t('annuler')}</button>
            </div>
          </div>
        </>
      )}

      {isModalOpen && modalDocument && <DocumentModal document={modalDocument} onClose={closeModal} />}
    </div>
  );
}

function getErrorMessage(error, fallback) {
  if (typeof error?.response?.data === 'string') return error.response.data;
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message) return error.message;
  return fallback;
}

export default MesEntites;