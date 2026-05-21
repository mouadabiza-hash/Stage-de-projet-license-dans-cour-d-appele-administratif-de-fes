import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';
import DocumentModal from '../components/DocumentModal';

function MesEntites() {
  const { t } = useTranslation();
  const perms = usePermissions();
  const { user } = useAuth();
  const serviceId = user?.idService;

  const [allDocuments, setAllDocuments] = useState([]);
  const [services, setServices] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [hiddenIds, setHiddenIds] = useState([]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAllOwn, setSelectAllOwn] = useState(false);
  const [selectAllSub, setSelectAllSub] = useState(false);

  // Choice modal
  const [showTransferChoice, setShowTransferChoice] = useState(false);
  const [transferChoiceDoc, setTransferChoiceDoc] = useState(null);

  // Multi transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [bulkTransferDocs, setBulkTransferDocs] = useState([]);
  const [transferSelections, setTransferSelections] = useState([]);
  const [transferCurrentService, setTransferCurrentService] = useState('');
  const [transferCurrentUserIds, setTransferCurrentUserIds] = useState([]);
  const [transferMessage, setTransferMessage] = useState('');
  const [transferDoitRevenir, setTransferDoitRevenir] = useState(false);

  // Single transfer modal (judicial)
  const [showSingleTransferModal, setShowSingleTransferModal] = useState(false);
  const [singleTransferTarget, setSingleTransferTarget] = useState(null);
  const [singleTransferServiceId, setSingleTransferServiceId] = useState('');
  const [singleTransferUsers, setSingleTransferUsers] = useState([]);
  const [singleTransferUserId, setSingleTransferUserId] = useState('');
  const [singleTransferDoitRevenir, setSingleTransferDoitRevenir] = useState(false);
  const [singleTransferMessage, setSingleTransferMessage] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDocument, setModalDocument] = useState(null);

  const [rowsPerPageOwn, setRowsPerPageOwn] = useState(10);
  const [currentPageOwn, setCurrentPageOwn] = useState(1);
  const [rowsPerPageSub, setRowsPerPageSub] = useState(10);
  const [currentPageSub, setCurrentPageSub] = useState(1);

  // Load hidden IDs from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('hiddenMesEntites');
    if (stored) setHiddenIds(JSON.parse(stored));
  }, []);

  // Filter out hidden documents
  const visibleDocuments = useMemo(() => {
    return allDocuments.filter(doc => {
      const key = `${doc.idEntite}_${doc.type || doc.Type}`;
      return !hiddenIds.includes(key);
    });
  }, [allDocuments, hiddenIds]);

  const filteredDocuments = useMemo(() => {
    if (!searchTerm.trim()) return visibleDocuments;
    const term = searchTerm.toLowerCase();
    return visibleDocuments.filter(doc =>
      (doc.sujet || '').toLowerCase().includes(term) ||
      (doc.source || '').toLowerCase().includes(term) ||
      (doc.destinataire || '').toLowerCase().includes(term) ||
      (doc.type || '').toLowerCase().includes(term) ||
      (doc.numeroCourrier || '').toLowerCase().includes(term)
    );
  }, [visibleDocuments, searchTerm]);

  const ownDocuments = filteredDocuments.filter(d => !d.isSubstitute);
  const subDocuments = filteredDocuments.filter(d => d.isSubstitute);

  useEffect(() => { fetchDocuments(); fetchServices(); fetchAllUsers(); }, []);
  useEffect(() => { setCurrentPageOwn(1); }, [ownDocuments.length]);
  useEffect(() => { setCurrentPageSub(1); }, [subDocuments.length]);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get('/api/documents');
      setAllDocuments(res.data);
      setError('');
    } catch (err) {
      setError(t('erreur_chargement'));
    }
  };
  const fetchServices = async () => {
    try {
      const res = await axios.get('/api/services');
      setServices(res.data);
    } catch (err) {}
  };
  const fetchAllUsers = async () => {
    try {
      const res = await axios.get('/api/utilisateurs');
      setAllUsers(res.data);
    } catch (err) {}
  };

  const handleHide = (doc) => {
    const key = `${doc.idEntite}_${doc.type || doc.Type}`;
    const newHidden = [...hiddenIds, key];
    setHiddenIds(newHidden);
    localStorage.setItem('hiddenMesEntites', JSON.stringify(newHidden));
    setSelectedIds(prev => prev.filter(id => id !== key));
  };

  const handleArchive = async (doc) => {
    if (!perms.canArchive) return;
    if (!window.confirm(t('confirmation_archiver'))) return;
    const docType = doc.type || doc.Type;
    const docId = doc.idEntite;
    try {
      if (docType === 'Administratif') await axios.put(`/api/courriers/archiver/${docId}`);
      else await axios.put(`/api/acteursjudiciaires/archiver/${docId}`);
      setSuccess(t('archivage_succes'));
      fetchDocuments();
    } catch (err) {
      setError(t('erreur_archivage'));
    }
  };

  // ---------- Multi transfer ----------
  const openTransferModal = (doc) => {
    setTransferTarget(doc);
    setBulkTransferDocs([]);
    setTransferSelections([]);
    setTransferCurrentService('');
    setTransferCurrentUserIds([]);
    setTransferMessage('');
    setTransferDoitRevenir(false);
    setShowTransferModal(true);
  };

  const openBulkTransferModal = (docs) => {
    if (docs.length === 0) return;
    setTransferTarget(null);
    setBulkTransferDocs(docs);
    setTransferSelections([]);
    setTransferCurrentService('');
    setTransferCurrentUserIds([]);
    setTransferMessage('');
    setTransferDoitRevenir(false);
    setShowTransferModal(true);
  };

  const handleTransferServiceChange = (svcId) => {
    setTransferCurrentService(svcId);
    setTransferCurrentUserIds([]);
  };
  const toggleCurrentUser = (userId) => {
    setTransferCurrentUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };
  const addCurrentSelection = () => {
    if (!transferCurrentService || transferCurrentUserIds.length === 0) return;
    setTransferSelections(prev => {
      const existing = prev.find(s => s.serviceId === transferCurrentService);
      if (existing) {
        return prev.map(s => s.serviceId === transferCurrentService
          ? { ...s, userIds: [...new Set([...s.userIds, ...transferCurrentUserIds])] }
          : s);
      }
      return [...prev, { serviceId: transferCurrentService, userIds: [...transferCurrentUserIds] }];
    });
    setTransferCurrentService('');
    setTransferCurrentUserIds([]);
  };
  const removeSelection = (serviceId) => {
    setTransferSelections(prev => prev.filter(s => s.serviceId !== serviceId));
  };

  const handleMultiTransfer = async () => {
    const allUserIds = transferSelections.flatMap(s => s.userIds);
    if (allUserIds.length === 0) {
      setError(t('selection_requise'));
      return;
    }
    const docs = bulkTransferDocs.length > 0 ? bulkTransferDocs : [transferTarget];
    try {
      for (let doc of docs) {
        await axios.post('/api/transactions/batch', {
          documentId: doc.idEntite,
          documentType: doc.type || doc.Type,
          destinationUserIds: allUserIds,
          doitRevenir: transferDoitRevenir,
          message: transferMessage
        });
      }
      setSuccess(t('transaction_envoyee'));
      setShowTransferModal(false);
      fetchDocuments();
    } catch (err) {
      setError(err.response?.data || t('erreur_transaction'));
    }
  };

  // ---------- Single transfer (judicial) ----------
  const openSingleTransferModal = (doc) => {
    setSingleTransferTarget(doc);
    setSingleTransferServiceId('');
    setSingleTransferUsers([]);
    setSingleTransferUserId('');
    setSingleTransferDoitRevenir(false);
    setSingleTransferMessage('');
    setShowSingleTransferModal(true);
  };

  const handleSingleServiceChange = async (svcId) => {
    setSingleTransferServiceId(svcId);
    setSingleTransferUsers([]);
    setSingleTransferUserId('');
    if (!svcId) return;
    try {
      const res = await axios.get(`/api/utilisateurs?serviceId=${svcId}`);
      setSingleTransferUsers(res.data);
    } catch (err) {
      setError(t('erreur_chargement'));
    }
  };

  const handleSingleTransfer = async () => {
    if (!singleTransferTarget || !singleTransferUserId) {
      setError(t('selection_requise'));
      return;
    }
    try {
      await axios.post('/api/transactions', {
        documentId: singleTransferTarget.idEntite,
        documentType: singleTransferTarget.type || singleTransferTarget.Type,
        destinationServiceId: null,
        destinationUserId: Number(singleTransferUserId),
        doitRevenir: singleTransferDoitRevenir,
        message: singleTransferMessage
      });
      setSuccess(t('transaction_envoyee'));
      setShowSingleTransferModal(false);
      fetchDocuments();
    } catch (err) {
      setError(err.response?.data || t('erreur_transaction'));
    }
  };

  // ---------- Choice ----------
  const openTransferChoice = (doc) => {
    setTransferChoiceDoc(doc);
    setShowTransferChoice(true);
  };
  const handleTransferChoice = (mode) => {
    setShowTransferChoice(false);
    if (mode === 'single') openSingleTransferModal(transferChoiceDoc);
    else if (mode === 'multi') openTransferModal(transferChoiceDoc);
  };

  // ---------- Bulk archive ----------
  const handleBulkArchive = async (docs) => {
    if (!perms.canArchive || docs.length === 0) return;
    if (!window.confirm(`${t('confirmation_archiver')} (${docs.length} documents)`)) return;
    let ok = 0, fail = 0;
    for (let doc of docs) {
      try {
        if ((doc.type || doc.Type) === 'Administratif')
          await axios.put(`/api/courriers/archiver/${doc.idEntite}`);
        else
          await axios.put(`/api/acteursjudiciaires/archiver/${doc.idEntite}`);
        ok++;
      } catch { fail++; }
    }
    setSuccess(`${ok} ${t('archives_succes')}${fail > 0 ? ` (${fail} échecs)` : ''}`);
    fetchDocuments();
  };

  // Selection helpers
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

  const handleConsult = async (doc) => {
    try {
      const res = await axios.get(`/api/documents/${doc.idEntite}?type=${encodeURIComponent(doc.type || doc.Type)}`);
      setModalDocument(res.data);
    } catch {
      setModalDocument(doc);
    }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setModalDocument(null); };

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
          <div className="bulk-toolbar-left"><span className="bulk-count">{selectedDocs.length} {t('selected')}</span></div>
          <div className="bulk-toolbar-right">
            {perms.canTransfer && (
              <button className="btn-primary" disabled={selectedDocs.length === 0} onClick={() => openBulkTransferModal(selectedDocs)}>
                {t('transferer_selection')}
              </button>
            )}
            {perms.canArchive && (
              <button className="btn-primary" disabled={selectedDocs.length === 0} onClick={() => handleBulkArchive(selectedDocs)}>
                {t('archiver_selection')}
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <div className="rows-per-page">
            <span>{t('afficher')}</span>
            <select value={rowsPerPage} onChange={e => { setRowsPerPageFn(Number(e.target.value)); setCurrentPageFn(1); }}>
              <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option>
            </select>
            <span>{t('lignes')}</span>
          </div>
        </div>
        <table className="modern-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" checked={selectAll} onChange={() => handleSelectAll(documents, setSelectAllFn, selectAll)} /></th>
              <th>{t('titre')}</th>
              <th>{t('numero_bureau_ordre')}</th>
              <th>{t('numero_dossier_judiciaire')}</th>
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
                const isJudicial = doc.type === 'Judiciaire' || doc.Type === 'Judiciaire';
                // Transfer condition: own service + transmissible + (judicial OR not already transferred)
                const canTransfer = !doc.estArchive && !doc.isSubstitute && doc.estTransmissible === true && (isJudicial ? true : !doc.hasTransaction);
                const showHide = (!doc.estTransmissible || doc.hasTransaction);
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
                      {canTransfer && perms.canTransfer && (
                        isJudicial ? (
                          <button onClick={() => openSingleTransferModal(doc)}>{t('transferer')}</button>
                        ) : (
                          <button onClick={() => openTransferChoice(doc)}>{t('transferer')}</button>
                        )
                      )}
                      {showHide && (
                        <button onClick={() => handleHide(doc)}>{t('masquer') || 'إخفاء'}</button>
                      )}
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
      <div className="filters">
        <input type="text" placeholder={t('rechercher_document')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ flex: 1, minWidth: '250px' }} />
        {searchTerm && <button className="btn-secondary" onClick={() => setSearchTerm('')}>{t('reinitialiser')}</button>}
      </div>

      {renderTable(t('my_documents'), ownDocuments, selectAllOwn, setSelectAllOwn, rowsPerPageOwn, currentPageOwn, setCurrentPageOwn, setRowsPerPageOwn)}
      {subDocuments.length > 0 && renderTable(t('substitute_documents'), subDocuments, selectAllSub, setSelectAllSub, rowsPerPageSub, currentPageSub, setCurrentPageSub, setRowsPerPageSub)}

      {/* Choice Modal */}
      {showTransferChoice && (
        <>
          <div className="modal-overlay" onClick={() => setShowTransferChoice(false)} />
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="registry-panel-header">
              <h3>{t('transfer_choice_title') || 'اختر طريقة الإحالة'}</h3>
              <button className="btn-secondary" onClick={() => setShowTransferChoice(false)}>{t('fermer')}</button>
            </div>
            <div className="form-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
              <button className="btn-primary" onClick={() => handleTransferChoice('single')}>{t('transfer_to_one') || 'إلى شخص واحد'}</button>
              <button className="btn-primary" onClick={() => handleTransferChoice('multi')}>{t('transfer_to_many') || 'إلى عدة أشخاص'}</button>
            </div>
          </div>
        </>
      )}

      {/* Multi Transfer Modal */}
      {showTransferModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowTransferModal(false)} />
          <div className="modal" style={{ maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="registry-panel-header">
              <h3>{bulkTransferDocs.length > 0 ? `${t('transferer')} ${bulkTransferDocs.length} documents` : `${t('transferer')} : ${transferTarget?.sujet || ''}`}</h3>
              <button className="btn-secondary" onClick={() => setShowTransferModal(false)}>{t('fermer')}</button>
            </div>
            <div className="form-grid">
              <div className="form-field full-width">
                <label>{t('ajouter_personnes_service')}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select value={transferCurrentService} onChange={e => handleTransferServiceChange(e.target.value)} style={{ flex: 1 }}>
                    <option value="">-- {t('choisir_service')} --</option>
                    {services.filter(s => s.idService !== serviceId).map(s => <option key={s.idService} value={s.idService}>{s.nomService}</option>)}
                  </select>
                  <button className="btn-secondary" onClick={addCurrentSelection} disabled={!transferCurrentService || transferCurrentUserIds.length === 0}>{t('ajouter')}</button>
                </div>
              </div>
              {transferCurrentService && (
                <div className="form-field full-width">
                  <label>{t('choisir_personnes')}</label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>
                    {allUsers.filter(u => u.idService === Number(transferCurrentService)).map(u => (
                      <label key={u.id} className="transfer-user-label">
                        <input type="checkbox" checked={transferCurrentUserIds.includes(u.id)} onChange={() => toggleCurrentUser(u.id)} />
                        <span>{u.nomComplet}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {transferSelections.length > 0 && (
                <div className="form-field full-width">
                  <label>{t('personnes_selectionnees')}</label>
                  <div style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>
                    {transferSelections.map(sel => {
                      const svc = services.find(s => s.idService === Number(sel.serviceId));
                      const svcName = svc ? svc.nomService : `Service #${sel.serviceId}`;
                      return (
                        <div key={sel.serviceId} style={{ marginBottom: '0.5rem', background: '#f9fbfd', padding: '0.5rem', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>{svcName}</strong>
                            <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => removeSelection(sel.serviceId)}>✕</button>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
                            {allUsers.filter(u => sel.userIds.includes(u.id)).map(u => <span key={u.id} style={{ background: 'var(--soft-line)', padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem' }}>{u.nomComplet}</span>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="form-field full-width">
                <label className="checkbox-field">
                  <input type="checkbox" checked={transferDoitRevenir} onChange={e => setTransferDoitRevenir(e.target.checked)} />
                  {t('doit_revenir')}
                </label>
              </div>
              <div className="form-field full-width">
                <label>{t('message')}</label>
                <textarea value={transferMessage} onChange={e => setTransferMessage(e.target.value)} rows="3" />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-primary" onClick={handleMultiTransfer} disabled={transferSelections.flatMap(s => s.userIds).length === 0}>
                {t('envoyer')} ({transferSelections.flatMap(s => s.userIds).length})
              </button>
              <button className="btn-secondary" onClick={() => setShowTransferModal(false)}>{t('annuler')}</button>
            </div>
          </div>
        </>
      )}

      {/* Single Transfer Modal (Judicial) */}
      {showSingleTransferModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowSingleTransferModal(false)} />
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="registry-panel-header">
              <h3>{t('transferer')} : {singleTransferTarget?.sujet || ''}</h3>
              <button className="btn-secondary" onClick={() => setShowSingleTransferModal(false)}>{t('fermer')}</button>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label>{t('service_destinataire')} *</label>
                <select value={singleTransferServiceId} onChange={e => handleSingleServiceChange(e.target.value)}>
                  <option value="">--</option>
                  {services.filter(s => s.idService !== serviceId).map(s => <option key={s.idService} value={s.idService}>{s.nomService}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>{t('personne')} *</label>
                <select value={singleTransferUserId} onChange={e => setSingleTransferUserId(e.target.value)}>
                  <option value="">--</option>
                  {singleTransferUsers.map(u => <option key={u.id} value={u.id}>{u.nomComplet}</option>)}
                </select>
              </div>
              <div className="form-field full-width">
                <label className="checkbox-field">
                  <input type="checkbox" checked={singleTransferDoitRevenir} onChange={e => setSingleTransferDoitRevenir(e.target.checked)} />
                  {t('doit_revenir')}
                </label>
              </div>
              <div className="form-field full-width">
                <label>{t('message')}</label>
                <textarea value={singleTransferMessage} onChange={e => setSingleTransferMessage(e.target.value)} rows="3" />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-primary" onClick={handleSingleTransfer}>{t('envoyer')}</button>
              <button className="btn-secondary" onClick={() => setShowSingleTransferModal(false)}>{t('annuler')}</button>
            </div>
          </div>
        </>
      )}

      {isModalOpen && modalDocument && <DocumentModal document={modalDocument} onClose={closeModal} />}
    </div>
  );
}

export default MesEntites;