import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DocumentModal from '../components/DocumentModal';

function Dashboard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
  const navigate = useNavigate();
  const { user } = useAuth();
  const serviceId = user?.idService;

  const [pending, setPending] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [pendingReturns, setPendingReturns] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hiddenIds, setHiddenIds] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [currentDocument, setCurrentDocument] = useState(null);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [modalDocument, setModalDocument] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [incomingReply, setIncomingReply] = useState({});

  // Documents table
  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Transfer state
  const [showTransferChoice, setShowTransferChoice] = useState(false);
  const [transferChoiceDoc, setTransferChoiceDoc] = useState(null);
  const [showSingleTransferModal, setShowSingleTransferModal] = useState(false);
  const [singleTransferTarget, setSingleTransferTarget] = useState(null);
  const [singleTransferServiceId, setSingleTransferServiceId] = useState('');
  const [singleTransferUsers, setSingleTransferUsers] = useState([]);
  const [singleTransferUserId, setSingleTransferUserId] = useState('');
  const [singleTransferDoitRevenir, setSingleTransferDoitRevenir] = useState(false);
  const [singleTransferMessage, setSingleTransferMessage] = useState('');
  const [singleTransferDocType, setSingleTransferDocType] = useState('Judiciaire');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferSelections, setTransferSelections] = useState([]);
  const [transferCurrentService, setTransferCurrentService] = useState('');
  const [transferCurrentUserIds, setTransferCurrentUserIds] = useState([]);
  const [transferMessage, setTransferMessage] = useState('');
  const [transferDoitRevenir, setTransferDoitRevenir] = useState(false);

  // Toast messages
  const [successMessage, setSuccessMessage] = useState({ text: '', visible: false });
  const [errorMessage, setErrorMessage] = useState({ text: '', visible: false });

  const showSuccess = (text) => {
    setSuccessMessage({ text, visible: true });
    setTimeout(() => setSuccessMessage({ text: '', visible: false }), 5000);
  };
  const showError = (text) => {
    setErrorMessage({ text, visible: true });
    setTimeout(() => setErrorMessage({ text: '', visible: false }), 6000);
  };

  useEffect(() => {
    const stored = localStorage.getItem('hiddenDashboardTransactions');
    if (stored) setHiddenIds(JSON.parse(stored));
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [hiddenIds]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [pendingRes, outgoingRes, returnsRes, incomingRes, usersRes, servicesRes, docsRes, pendingTxRes] = await Promise.all([
        axios.get('/api/transactions/pending-outgoing'),
        axios.get('/api/transactions/outgoing'),
        axios.get('/api/transactions/pending-returns'),
        axios.get('/api/transactions/incoming'),
        axios.get('/api/utilisateurs'),
        axios.get('/api/services'),
        axios.get('/api/documents'),
        axios.get('/api/transactions/pending-outgoing')
      ]);
      setPending(pendingRes.data);
      const filtered = outgoingRes.data.filter(tx => !hiddenIds.includes(tx.id));
      setCompleted(filtered.filter(tx => isAccepted(tx.statut) || isRejected(tx.statut)));
      setPendingReturns(returnsRes.data);
      setIncoming(incomingRes.data);
      setAllUsers(usersRes.data);
      setServices(servicesRes.data);
      setPendingTransactions(pendingTxRes.data);

      const myDocs = docsRes.data.filter(doc => doc.idService === serviceId && !doc.isSubstitute);
      setDocuments(myDocs);
      setError('');
    } catch (err) {
      console.error(err);
      showError(t('erreur_chargement_donnees'));
    } finally {
      setLoading(false);
    }
  };

  const isAccepted = (statut) => String(statut || '').toLowerCase().includes('accept');
  const isRejected = (statut) => String(statut || '').toLowerCase().includes('refus');
  const isCancelled = (statut) => String(statut || '').toLowerCase().includes('annul');
  const formatDate = (value) => value ? new Date(value).toLocaleDateString(locale) : '-';

  const handleCancelOutgoing = async (id) => {
    if (window.confirm(t('confirmation_annuler'))) {
      await axios.post(`/api/transactions/${id}/cancel`);
      fetchAllData();
      showSuccess(t('transaction_annulee'));
    }
  };
  const handleHide = (id) => {
    if (window.confirm(t('confirmation_masquer'))) {
      const newHidden = [...hiddenIds, id];
      setHiddenIds(newHidden);
      localStorage.setItem('hiddenDashboardTransactions', JSON.stringify(newHidden));
      showSuccess(t('transaction_masquee'));
    }
  };
  const handleMarkReturned = async (id) => {
    if (window.confirm(t('confirmation_retour'))) {
      await axios.post(`/api/transactions/${id}/mark-returned`);
      fetchAllData();
      showSuccess(t('document_retourne'));
    }
  };
  const handleIncomingRespond = async (id, accepte) => {
    const message = incomingReply[id] || '';
    try {
      await axios.post(`/api/transactions/${id}/respond`, { accepte, message });
      setIncoming(prev => prev.filter(n => n.id !== id));
      fetchAllData();
      showSuccess(accepte ? t('transaction_acceptee') : t('transaction_refusee'));
    } catch (err) {
      showError(err.response?.data?.message || t('erreur_reponse'));
    }
  };

  // --- Transfer functions ---
  const openTransferChoice = (doc) => {
    setTransferChoiceDoc(doc);
    setShowTransferChoice(true);
  };
  const openSingleTransferModal = (doc, isJudicial) => {
    setSingleTransferTarget(doc);
    setSingleTransferDocType(isJudicial ? 'Judiciaire' : 'Administratif');
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
      showError(t('erreur_chargement'));
    }
  };
  const handleSingleTransfer = async () => {
    if (!singleTransferTarget || !singleTransferUserId) {
      showError(t('selection_requise'));
      return;
    }
    try {
      await axios.post('/api/transactions', {
        documentId: singleTransferTarget.idEntite,
        documentType: singleTransferDocType,
        destinationServiceId: null,
        destinationUserId: Number(singleTransferUserId),
        doitRevenir: singleTransferDoitRevenir,
        message: singleTransferMessage
      });
      showSuccess(t('transaction_envoyee'));
      setShowSingleTransferModal(false);
      fetchAllData();
    } catch (err) {
      showError(err.response?.data || t('erreur_transaction'));
    }
  };
  const handleTransferChoice = (mode) => {
    setShowTransferChoice(false);
    if (mode === 'single') openSingleTransferModal(transferChoiceDoc, false);
    else openTransferModal(transferChoiceDoc);
  };
  const openTransferModal = (doc) => {
    setTransferTarget(doc);
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
    if (!transferTarget || allUserIds.length === 0) {
      showError(t('selection_requise'));
      return;
    }
    try {
      for (let userId of allUserIds) {
        await axios.post('/api/transactions', {
          documentId: transferTarget.idEntite,
          documentType: transferTarget.type,
          destinationServiceId: null,
          destinationUserId: userId,
          doitRevenir: transferDoitRevenir,
          message: transferMessage
        });
      }
      showSuccess(t('transaction_envoyee'));
      setShowTransferModal(false);
      fetchAllData();
    } catch (err) {
      showError(err.response?.data?.message || t('erreur_transaction'));
    }
  };

  // --- Document consultation (modal) ---
// Dans Dashboard.js, remplacez la fonction handleConsult par celle-ci
const handleConsult = async (item) => {
  // Construire l'objet de requête pour l'API
  let id, type;
  if (item.documentId) {
    // Cas d'une transaction (notifications, demandes, etc.)
    id = item.documentId;
    type = item.documentType;
  } else {
    // Cas d'un document normal (tableau principal)
    id = item.idEntite;
    type = item.type;
  }

  try {
    const res = await axios.get(`/api/documents/${id}?type=${type}`);
    setCurrentDocument(res.data);
  } catch (err) {
    console.warn("Erreur API, utilisation fallback", err);
    // Construire un objet compatible avec DocumentModal à partir des infos disponibles
    const fallback = {
      id: id,
      sujet: item.documentSujet || item.sujet || "Document",
      dateCreation: item.dateEnvoi || item.dateCreation,
      source: item.sourceServiceNom || item.source,
      destinataire: item.destinationServiceNom || item.destinataire,
      description: item.message || item.description,
      etat: item.statut || item.etat,
      lienPdf: item.lienPdf || "",
      typeDocument: type,
      idService: item.destinationServiceId || item.idService,
      serviceNom: item.destinationServiceNom || item.serviceNom,
      numeroCourrier: item.numeroCourrier || "",
      numeroDossier: item.numeroDossierJudiciaire || "",
      retraits: item.retraits || [],
      // Propriétés optionnelles mais utiles pour DocumentModal
      idBureauOrdre: item.idBureauOrdre || "",
      direction: item.direction || "",
      typeRegistre: item.typeRegistre || "",
      typeCorrespondance: item.typeCorrespondance || "",
      estTransmissible: item.estTransmissible || false,
      emplacement: item.emplacement || "",
    };
    setCurrentDocument(fallback);
  }
  setShowDocModal(true);
};
  const closeModal = () => { setIsModalOpen(false); setModalDocument(null); };


  const isConsultantTransaction = (tx) => {
    if (!tx.destinationUserId) return false;
    const destUser = allUsers.find(u => u.id === tx.destinationUserId);
    return destUser?.role === 'Consultant';
  };

  // Pagination
  const filteredDocs = documents.filter(doc =>
    (doc.sujet || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.source || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.numeroDossierJudiciaire || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const idxLast = currentPage * rowsPerPage;
  const idxFirst = idxLast - rowsPerPage;
  const currentDocs = filteredDocs.slice(idxFirst, idxLast);
  const totalPages = Math.ceil(filteredDocs.length / rowsPerPage);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const stats = {
    pending: pending.length,
    accepted: completed.filter(tx => isAccepted(tx.statut)).length,
    rejected: completed.filter(tx => isRejected(tx.statut)).length,
    cancelled: completed.filter(tx => isCancelled(tx.statut)).length,
  };

  if (loading) return <div className="loading">{t('chargement')}</div>;

  return (
    <div className="dashboard-container">
      {/* Toasts */}
      {successMessage.visible && (
        <div className="toast-message success">
          <span>{successMessage.text}</span>
          <button onClick={() => setSuccessMessage({ text: '', visible: false })}>✕</button>
        </div>
      )}
      {errorMessage.visible && (
        <div className="toast-message error">
          <span>{errorMessage.text}</span>
          <button onClick={() => setErrorMessage({ text: '', visible: false })}>✕</button>
        </div>
      )}

      <div className="dashboard-header">
        <h1>{t('dashboard')}</h1>
        <p>{t('dashboard_subtitle')}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card pending"><div className="stat-label">{t('en_attente')}</div><div className="stat-value">{stats.pending}</div></div>
        <div className="stat-card accepted"><div className="stat-label">{t('acceptees')}</div><div className="stat-value">{stats.accepted}</div></div>
        <div className="stat-card rejected"><div className="stat-label">{t('refusees')}</div><div className="stat-value">{stats.rejected}</div></div>
        <div className="stat-card cancelled"><div className="stat-label">{t('annulees')}</div><div className="stat-value">{stats.cancelled}</div></div>
      </div>

      {/* Documents table */}
      <div className="section-title"><span>{t('mes_entites')}</span></div>
      <div className="filters" style={{ justifyContent: 'space-between' }}>
        <input type="text" placeholder={t('rechercher_document')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '250px' }} />
        <div className="rows-per-page">
          <span>{t('afficher')}</span>
          <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
            <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option>
          </select>
          <span>{t('lignes')}</span>
        </div>
      </div>
      <div className="data-table-wrapper">
        <table className="modern-table">
          <thead>
            <tr>
              <th>{t('titre')}</th>
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
              <tr><td colSpan="7">{t('aucun_document')}</td></tr>
            ) : (
              currentDocs.map(doc => {
                const pendingTx = pendingTransactions.find(tx => tx.documentId === doc.idEntite && tx.documentType === doc.type);
                const canTransfer = doc.estTransmissible === true && !pendingTx;
                const isJudicial = doc.type === 'Judiciaire';
                return (
                  <tr key={`${doc.idEntite}_${doc.type}`}>
                    <td>{doc.sujet || '-'}</td>
                    <td>{doc.numeroDossierJudiciaire || '-'}</td>
                    <td>{doc.type || '-'}</td>
                    <td>{formatDate(doc.dateCreation)}</td>
                    <td>{doc.source || '-'}</td>
                    <td>{doc.destinataire || '-'}</td>
                    <td className="action-icons">
                      <button onClick={() => handleConsult(doc)}>{t('consulter')}</button>
                      {pendingTx && <button onClick={() => handleCancelOutgoing(pendingTx.id)} style={{ color: 'red' }}>{t('annuler')}</button>}
                      {canTransfer && (
                        isJudicial ? (
                          <button onClick={() => openSingleTransferModal(doc, true)}>{t('transferer')}</button>
                        ) : (
                          <button onClick={() => openTransferChoice(doc)}>{t('transferer')}</button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>{t('precedent')}</button>
            <span>{t('page')} {currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>{t('suivant')}</button>
          </div>
        )}
      </div>

      {/* Cards for modals */}
      <div className="dashboard-section-card" onClick={() => setShowNotificationsModal(true)}>
        <div className="section-title-text"><span>🔔</span> {t('notifications')}</div>
        <div><span className="section-badge">{incoming.length}</span><span className="arrow-icon">→</span></div>
      </div>
      <div className="dashboard-section-card" onClick={() => setShowPendingModal(true)}>
        <div className="section-title-text"><span>⏳</span> {t('demandes_attente')}</div>
        <div><span className="section-badge">{pending.length}</span><span className="arrow-icon">→</span></div>
      </div>
      <div className="dashboard-section-card" onClick={() => setShowCompletedModal(true)}>
        <div className="section-title-text"><span>✅</span> {t('transactions_traitees')}</div>
        <div><span className="section-badge">{completed.length}</span><span className="arrow-icon">→</span></div>
      </div>
      <div className="dashboard-section-card" onClick={() => setShowReturnsModal(true)}>
        <div className="section-title-text"><span>🔄</span> {t('documents_retourner')}</div>
        <div><span className="section-badge">{pendingReturns.length}</span><span className="arrow-icon">→</span></div>
      </div>

      {/* ---------- MODALS ---------- */}

      {showNotificationsModal && (
        <div className="modal-overlay" onClick={() => setShowNotificationsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header"><h3>{t('notifications')}</h3><button className="btn-secondary" onClick={() => setShowNotificationsModal(false)}>{t('fermer')}</button></div>
            {incoming.length === 0 ? <p className="text-muted">{t('aucune_notification')}</p> : incoming.map(n => (
              <div key={n.id} className="notification-card">
                <div className="notification-header"><div className="notification-header-left"><span className="notification-title">{n.documentSujet}</span></div><span className="notification-badge">{t('en_attente')}</span></div>
                <div className="notification-identifiers">{n.numeroCourrier && <span className="identifier-tag">📨 {n.numeroCourrier}</span>}{n.numeroDossierJudiciaire && <span className="identifier-tag">⚖️ {n.numeroDossierJudiciaire}</span>}</div>
                <div className="notification-details"><div className="detail-row"><span className="detail-label">{t('de')} :</span> <span>{n.sourceServiceNom}</span></div>{n.message && <div className="detail-row"><span className="detail-label">{t('message')} :</span> <span>{n.message}</span></div>}</div>
                <textarea className="response-textarea" placeholder={t('votre_reponse')} value={incomingReply[n.id] || ''} onChange={e => setIncomingReply({ ...incomingReply, [n.id]: e.target.value })} rows="2" />
                <div className="notification-actions"><button className="btn-primary" onClick={() => handleIncomingRespond(n.id, true)}>{t('accepter')}</button><button className="btn-secondary" onClick={() => handleIncomingRespond(n.id, false)}>{t('refuser')}</button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPendingModal && (
        <div className="modal-overlay" onClick={() => setShowPendingModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header"><h3>{t('demandes_attente')}</h3><button className="btn-secondary" onClick={() => setShowPendingModal(false)}>{t('fermer')}</button></div>
            <div className="transaction-list">{pending.length === 0 ? <p className="text-muted">{t('aucune_demande')}</p> : pending.map(tx => (
              <div key={tx.id} className="transaction-item">
                <div className="transaction-header"><span className="transaction-title">{tx.documentSujet}</span><span className="transaction-badge">{t('en_attente')}</span></div>
                <div className="transaction-details"><span>{t('service_destinataire')} : {tx.destinationServiceNom}</span><span>{t('message')} : {tx.message || t('non_renseigne')}</span><span>{t('envoye_le')} : {formatDate(tx.dateEnvoi)}</span></div>
                <div className="transaction-actions"><button onClick={() => handleConsult({ idEntite: tx.documentId, type: tx.documentType })}>{t('consulter')}</button><button onClick={() => handleCancelOutgoing(tx.id)}>{t('annuler')}</button></div>
              </div>
            ))}</div>
          </div>
        </div>
      )}

      {showCompletedModal && (
        <div className="modal-overlay" onClick={() => setShowCompletedModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header"><h3>{t('transactions_traitees')}</h3><button className="btn-secondary" onClick={() => setShowCompletedModal(false)}>{t('fermer')}</button></div>
            <div className="transaction-list">{completed.length === 0 ? <p className="text-muted">{t('aucune_transaction')}</p> : completed.map(tx => (
              <div key={tx.id} className="transaction-item">
                <div className="transaction-header"><span className="transaction-title">{tx.documentSujet}</span><span className="transaction-badge">{translateStatus(tx.statut, t)}</span></div>
                <div className="transaction-details"><span>{t('service_destinataire')} : {tx.destinationServiceNom}</span><span>{t('message')} : {tx.message || t('non_renseigne')}</span><span>{t('traite_le')} : {formatDate(tx.dateReponse)}</span><span>{t('note')} : {tx.messageReponse || t('non_renseigne')}</span></div>
                <div className="transaction-actions"><button onClick={() => handleConsult({ idEntite: tx.documentId, type: tx.documentType })}>{t('consulter')}</button><button onClick={() => handleHide(tx.id)}>{t('masquer')}</button></div>
              </div>
            ))}</div>
          </div>
        </div>
      )}

      {showReturnsModal && (
        <div className="modal-overlay" onClick={() => setShowReturnsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header"><h3>{t('documents_retourner')}</h3><button className="btn-secondary" onClick={() => setShowReturnsModal(false)}>{t('fermer')}</button></div>
            <div className="transaction-list">
              {pendingReturns.length === 0 ? <p className="text-muted">{t('aucun_document_retour')}</p> : pendingReturns.map(tx => {
                const isConsultant = isConsultantTransaction(tx);
                return (
                  <div key={tx.id} className="transaction-item">
                    <div className="transaction-header"><span className="transaction-title">{tx.documentSujet}</span><span className="transaction-badge">{t('en_attente_retour')}</span></div>
                    <div className="transaction-details"><span>{t('service_destinataire')} : {tx.destinationServiceNom}</span><span>{t('message')} : {tx.message || t('non_renseigne')}</span><span>{t('envoye_le')} : {formatDate(tx.dateEnvoi)}</span></div>
                    <div className="transaction-actions">
                      <button onClick={() => handleConsult({ idEntite: tx.documentId, type: tx.documentType })}>{t('consulter')}</button>
                      {isConsultant && <button onClick={() => handleMarkReturned(tx.id)}>{t('marquer_retourne')}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showTransferChoice && (
        <div className="modal-overlay" onClick={() => setShowTransferChoice(false)}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="registry-panel-header"><h3>{t('transfer_choice_title')}</h3><button className="btn-secondary" onClick={() => setShowTransferChoice(false)}>{t('fermer')}</button></div>
            <div className="form-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
              <button className="btn-primary" onClick={() => handleTransferChoice('single')}>{t('transfer_to_one')}</button>
              <button className="btn-primary" onClick={() => handleTransferChoice('multi')}>{t('transfer_to_many')}</button>
            </div>
          </div>
        </div>
      )}

      {showSingleTransferModal && (
        <div className="modal-overlay" onClick={() => setShowSingleTransferModal(false)}>
          <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('transferer')} : {singleTransferTarget?.sujet}</h3>
              <button className="btn-secondary" onClick={() => setShowSingleTransferModal(false)}>{t('fermer')}</button>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label>{t('service_destinataire')} *</label>
                <select value={singleTransferServiceId} onChange={e => handleSingleServiceChange(e.target.value)}>
                  <option value="">--</option>
                  {services.filter(s => s.idService !== serviceId).map(s => (
                    <option key={s.idService} value={s.idService}>{s.nomService}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>{t('personne')} *</label>
                <select value={singleTransferUserId} onChange={e => setSingleTransferUserId(e.target.value)}>
                  <option value="">--</option>
                  {singleTransferUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.nomComplet}</option>
                  ))}
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
        </div>
      )}

      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal" style={{ maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('transferer')} : {transferTarget?.sujet}</h3>
              <button className="btn-secondary" onClick={() => setShowTransferModal(false)}>{t('fermer')}</button>
            </div>
            <div className="form-grid">
              <div className="form-field full-width">
                <label>{t('ajouter_personnes_service')}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select value={transferCurrentService} onChange={e => handleTransferServiceChange(e.target.value)} style={{ flex: 1 }}>
                    <option value="">-- {t('choisir_service')} --</option>
                    {services.filter(s => s.idService !== serviceId).map(s => (
                      <option key={s.idService} value={s.idService}>{s.nomService}</option>
                    ))}
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
                            {allUsers.filter(u => sel.userIds.includes(u.id)).map(u => (
                              <span key={u.id} style={{ background: 'var(--soft-line)', padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem' }}>{u.nomComplet}</span>
                            ))}
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
        </div>
      )}

      {showDocModal && currentDocument && (
        <DocumentModal document={currentDocument} onClose={() => setShowDocModal(false)} />
      )}
    </div>
  );
}

function translateStatus(value, t) {
  const val = String(value || '').toLowerCase();
  if (val.includes('accept')) return t('acceptees');
  if (val.includes('refus')) return t('refusees');
  if (val.includes('annul')) return t('annulees');
  return value || '-';
}

export default Dashboard;