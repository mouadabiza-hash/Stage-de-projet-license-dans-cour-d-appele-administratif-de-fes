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

  // Data
  const [pending, setPending] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [pendingReturns, setPendingReturns] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Full lists (unfiltered) for restore modal details
  const [fullIncoming, setFullIncoming] = useState([]);
  const [fullPending, setFullPending] = useState([]);
  const [fullCompleted, setFullCompleted] = useState([]);
  const [fullReturns, setFullReturns] = useState([]);

  // Hidden storage per category
  const [hiddenIncoming, setHiddenIncoming] = useState([]);
  const [hiddenPending, setHiddenPending] = useState([]);
  const [hiddenCompleted, setHiddenCompleted] = useState([]);
  const [hiddenReturns, setHiddenReturns] = useState([]);

  // Restore modal state
  const [restoreCategory, setRestoreCategory] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [hiddenItemsDetails, setHiddenItemsDetails] = useState([]);

  // Other states
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [incomingReply, setIncomingReply] = useState({});

  // Transfer states (unchanged)
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

  // Document modal state
  const [showDocModal, setShowDocModal] = useState(false);
  const [currentDocument, setCurrentDocument] = useState(null);

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

  // Load hidden arrays from localStorage
  useEffect(() => {
    const storedIncoming = localStorage.getItem('hiddenDashboardIncoming');
    if (storedIncoming) setHiddenIncoming(JSON.parse(storedIncoming));
    const storedPending = localStorage.getItem('hiddenDashboardPending');
    if (storedPending) setHiddenPending(JSON.parse(storedPending));
    const storedCompleted = localStorage.getItem('hiddenDashboardCompleted');
    if (storedCompleted) setHiddenCompleted(JSON.parse(storedCompleted));
    const storedReturns = localStorage.getItem('hiddenDashboardReturns');
    if (storedReturns) setHiddenReturns(JSON.parse(storedReturns));
  }, []);

  // Fetch all data
  useEffect(() => {
    fetchAllData();
  }, [hiddenIncoming, hiddenPending, hiddenCompleted, hiddenReturns]);

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

      // Store full lists for restore details
      setFullIncoming(incomingRes.data);
      setFullPending(pendingRes.data);
      setFullCompleted(outgoingRes.data);
      setFullReturns(returnsRes.data);

      // Filter each category with its own hidden list
      setPending(pendingRes.data.filter(tx => !hiddenPending.includes(tx.id)));
      setPendingReturns(returnsRes.data.filter(tx => !hiddenReturns.includes(tx.id)));
      setIncoming(incomingRes.data.filter(tx => !hiddenIncoming.includes(tx.id)));

      const filteredOutgoing = outgoingRes.data.filter(tx => !hiddenCompleted.includes(tx.id));
      setCompleted(filteredOutgoing.filter(tx => isAccepted(tx.statut) || isRejected(tx.statut)));

      setAllUsers(usersRes.data);
      setServices(servicesRes.data);
      setPendingTransactions(pendingTxRes.data);

      const myDocs = docsRes.data.filter(doc => doc.idService === serviceId && !doc.isSubstitute);
      setDocuments(myDocs);
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
  const formatDate = (value) => (value ? new Date(value).toLocaleDateString(locale) : '-');

  // Hide transaction (no confirmation)
  const handleHideTransaction = (id, category) => {
    let newHidden;
    switch (category) {
      case 'incoming':
        newHidden = [...hiddenIncoming, id];
        setHiddenIncoming(newHidden);
        localStorage.setItem('hiddenDashboardIncoming', JSON.stringify(newHidden));
        setIncoming(prev => prev.filter(tx => tx.id !== id));
        break;
      case 'pending':
        newHidden = [...hiddenPending, id];
        setHiddenPending(newHidden);
        localStorage.setItem('hiddenDashboardPending', JSON.stringify(newHidden));
        setPending(prev => prev.filter(tx => tx.id !== id));
        break;
      case 'completed':
        newHidden = [...hiddenCompleted, id];
        setHiddenCompleted(newHidden);
        localStorage.setItem('hiddenDashboardCompleted', JSON.stringify(newHidden));
        setCompleted(prev => prev.filter(tx => tx.id !== id));
        break;
      case 'returns':
        newHidden = [...hiddenReturns, id];
        setHiddenReturns(newHidden);
        localStorage.setItem('hiddenDashboardReturns', JSON.stringify(newHidden));
        setPendingReturns(prev => prev.filter(tx => tx.id !== id));
        break;
      default:
        return;
    }
    showSuccess(t('transaction_masquee'));
  };

  // Restore a single hidden item
  const handleRestore = (id, category) => {
    switch (category) {
      case 'incoming':
        setHiddenIncoming(prev => prev.filter(h => h !== id));
        localStorage.setItem('hiddenDashboardIncoming', JSON.stringify(hiddenIncoming.filter(h => h !== id)));
        break;
      case 'pending':
        setHiddenPending(prev => prev.filter(h => h !== id));
        localStorage.setItem('hiddenDashboardPending', JSON.stringify(hiddenPending.filter(h => h !== id)));
        break;
      case 'completed':
        setHiddenCompleted(prev => prev.filter(h => h !== id));
        localStorage.setItem('hiddenDashboardCompleted', JSON.stringify(hiddenCompleted.filter(h => h !== id)));
        break;
      case 'returns':
        setHiddenReturns(prev => prev.filter(h => h !== id));
        localStorage.setItem('hiddenDashboardReturns', JSON.stringify(hiddenReturns.filter(h => h !== id)));
        break;
      default:
        return;
    }
    fetchAllData();
    showSuccess(t('transaction_restauree'));
  };

  // Restore all in a category
  const handleRestoreAll = (category) => {
    switch (category) {
      case 'incoming':
        setHiddenIncoming([]);
        localStorage.removeItem('hiddenDashboardIncoming');
        break;
      case 'pending':
        setHiddenPending([]);
        localStorage.removeItem('hiddenDashboardPending');
        break;
      case 'completed':
        setHiddenCompleted([]);
        localStorage.removeItem('hiddenDashboardCompleted');
        break;
      case 'returns':
        setHiddenReturns([]);
        localStorage.removeItem('hiddenDashboardReturns');
        break;
      default:
        return;
    }
    fetchAllData();
    showSuccess(t('toutes_restaurees'));
  };

  // Open restore modal for a specific category with details
  const openRestoreModal = (category) => {
    let fullList = [];
    let hiddenIds = [];
    switch (category) {
      case 'incoming':
        fullList = fullIncoming;
        hiddenIds = hiddenIncoming;
        break;
      case 'pending':
        fullList = fullPending;
        hiddenIds = hiddenPending;
        break;
      case 'completed':
        fullList = fullCompleted;
        hiddenIds = hiddenCompleted;
        break;
      case 'returns':
        fullList = fullReturns;
        hiddenIds = hiddenReturns;
        break;
      default:
        return;
    }
    const details = hiddenIds.map(id => {
      const item = fullList.find(i => i.id === id);
      if (item) {
        return {
          id,
          title: item.documentSujet || item.sujet || 'Document',
          date: item.dateEnvoi || item.dateCreation || item.date,
          service: item.destinationServiceNom || item.sourceServiceNom || item.serviceNom || '-',
          status: item.statut || item.etat || '-'
        };
      }
      return { id, title: `Transaction ${id}`, date: '-', service: '-', status: '-' };
    });
    setHiddenItemsDetails(details);
    setRestoreCategory(category);
    setShowRestoreModal(true);
  };

  // Other handlers
  const handleCancelOutgoing = async (id) => {
    if (window.confirm(t('confirmation_annuler'))) {
      await axios.post(`/api/transactions/${id}/cancel`);
      fetchAllData();
      showSuccess(t('transaction_annulee'));
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

  // Transfer functions (keep as you have them, unchanged)
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
        message: singleTransferMessage,
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
        return prev.map(s =>
          s.serviceId === transferCurrentService
            ? { ...s, userIds: [...new Set([...s.userIds, ...transferCurrentUserIds])] }
            : s
        );
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
          message: transferMessage,
        });
      }
      showSuccess(t('transaction_envoyee'));
      setShowTransferModal(false);
      fetchAllData();
    } catch (err) {
      showError(err.response?.data?.message || t('erreur_transaction'));
    }
  };

  const handleConsult = async (item) => {
    const buildDocumentData = (src, isTransaction) => {
      if (isTransaction) {
        return {
          id: src.documentId,
          numeroCourrier: src.numeroCourrier || '',
          date: src.dateEnvoi,
          sujet: src.documentSujet || '',
          source: src.sourceServiceNom || '',
          destinataire: src.destinationServiceNom || '',
          message: src.message || '',
          description: src.message || '',
          statut: src.statut || '',
          etat: src.statut || '',
          lienPdf: src.lienPdf || '',
          typeDocument: src.documentType || '',
          type: src.documentType || '',
          serviceNom: src.destinationServiceNom || '',
          numeroDossierJudiciaire: src.numeroDossierJudiciaire || '',
          numeroDossier: src.numeroDossierJudiciaire || '',
          direction: src.direction || '',
          typeRegistre: src.typeRegistre || '',
          typeCorrespondance: src.typeCorrespondance || '',
          estTransmissible: src.estTransmissible || false,
          emplacement: src.emplacement || src.destinationServiceNom || '',
          retraits: src.retraits || [],
          destinationServiceName: src.destinationServiceNom,
          destinationUserName: src.destinationUserName,
          dateEnvoi: src.dateEnvoi,
          messageReponse: src.messageReponse,
        };
      }
      return {
        id: src.idEntite,
        idBureauOrdre: src.idBureauOrdre || '',
        date: src.dateCreation,
        sujet: src.sujet || '',
        source: src.source || '',
        destinataire: src.destinataire || '',
        description: src.description || '',
        etat: src.etat || '',
        lienPdf: src.lienPdf || '',
        typeDocument: src.type || '',
        type: src.type || '',
        serviceNom: src.serviceNom || '',
        numeroDossierJudiciaire: src.numeroDossierJudiciaire || '',
        numeroDossier: src.numeroDossierJudiciaire || '',
        direction: src.direction || '',
        typeRegistre: src.typeRegistre || '',
        typeCorrespondance: src.typeCorrespondance || '',
        estTransmissible: src.estTransmissible || false,
        emplacement: src.emplacement || '',
        numeroCourrier: src.numeroCourrier || '',
        retraits: src.retraits || [],
      };
    };

    const isTransaction = item.hasOwnProperty('documentId');
    const fallbackData = buildDocumentData(item, isTransaction);

    try {
      const id = isTransaction ? item.documentId : item.idEntite;
      const type = isTransaction ? item.documentType : item.type;
      const res = await axios.get(`/api/documents/${id}?type=${type}`);
      setCurrentDocument(res.data);
    } catch (err) {
      console.warn('Utilisation des données locales', err);
      setCurrentDocument(fallbackData);
    }
    setShowDocModal(true);
  };

  const isConsultantTransaction = (tx) => {
    if (!tx.destinationUserId) return false;
    const destUser = allUsers.find(u => u.id === tx.destinationUserId);
    return destUser?.role === 'Consultant';
  };

  // Pagination for documents table
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
      <style>
        {`
          .btn-restore {
            background: #164d7d;
            color: white;
            border: none;
            padding: 0.4rem 1rem;
            border-radius: 8px;
            font-weight: bold;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-restore:hover {
            background: #0b3b66;
            transform: translateY(-1px);
          }
        `}
      </style>

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

      {/* Mes entités table */}
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

      {/* ========== MODALS ========== */}

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <div className="modal-overlay" onClick={() => setShowNotificationsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('notifications')}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-restore" onClick={() => openRestoreModal('incoming')}>
                  🔓 {t('restaurer_masquees')} ({hiddenIncoming.length})
                </button>
                <button className="btn-secondary" onClick={() => setShowNotificationsModal(false)}>{t('fermer')}</button>
              </div>
            </div>
            {incoming.length === 0 ? <p className="text-muted">{t('aucune_notification')}</p> : incoming.map(n => (
              <div key={n.id} className="notification-card">
                <div className="notification-header"><div className="notification-header-left"><span className="notification-title">{n.documentSujet}</span></div><span className="notification-badge">{t('en_attente')}</span></div>
                <div className="notification-identifiers">{n.numeroCourrier && <span className="identifier-tag">📨 {n.numeroCourrier}</span>}{n.numeroDossierJudiciaire && <span className="identifier-tag">⚖️ {n.numeroDossierJudiciaire}</span>}{n.documentType && <span className="identifier-tag">📄 {n.documentType}</span>}</div>
                <div className="notification-details">
                  <div className="detail-row"><span className="detail-label">{t('de')} :</span> <span>{n.sourceServiceNom}</span></div>
                  <div className="detail-row"><span className="detail-label">{t('type')} :</span> <span>{n.documentType || '-'}</span></div>
                  {n.dateEnvoi && <div className="detail-row"><span className="detail-label">{t('envoye_le')} :</span> <span>{formatDate(n.dateEnvoi)}</span></div>}
                  {n.message && <div className="detail-row"><span className="detail-label">{t('message')} :</span> <span style={{ whiteSpace: 'pre-wrap' }}>{n.message}</span></div>}
                </div>
                <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#f8f9fc', borderRadius: '6px', borderLeft: '3px solid #164d7d' }}>
                  <button onClick={() => handleConsult(n)} className="btn-secondary" style={{ width: '100%', marginBottom: '0.5rem' }}>👁️ {t('consulter_details')}</button>
                </div>
                <textarea className="response-textarea" placeholder={t('votre_reponse')} value={incomingReply[n.id] || ''} onChange={e => setIncomingReply({ ...incomingReply, [n.id]: e.target.value })} rows="2" />
                <div className="notification-actions">
                  <button className="btn-primary" onClick={() => handleIncomingRespond(n.id, true)}>{t('accepter')}</button>
                  <button className="btn-secondary" onClick={() => handleIncomingRespond(n.id, false)}>{t('refuser')}</button>
                  <button className="btn-secondary" onClick={() => handleHideTransaction(n.id, 'incoming')}>{t('masquer')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Outgoing Modal */}
      {showPendingModal && (
        <div className="modal-overlay" onClick={() => setShowPendingModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('demandes_attente')}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-restore" onClick={() => openRestoreModal('pending')}>
                  🔓 {t('restaurer_masquees')} ({hiddenPending.length})
                </button>
                <button className="btn-secondary" onClick={() => setShowPendingModal(false)}>{t('fermer')}</button>
              </div>
            </div>
            <div className="transaction-list">{pending.length === 0 ? <p className="text-muted">{t('aucune_demande')}</p> : pending.map(tx => (
              <div key={tx.id} className="transaction-item">
                <div className="transaction-header"><span className="transaction-title">{tx.documentSujet}</span><span className="transaction-badge">{t('en_attente')}</span></div>
                <div className="transaction-details"><span>{t('service_destinataire')} : {tx.destinationServiceNom}</span><span>{t('message')} : {tx.message || t('non_renseigne')}</span><span>{t('envoye_le')} : {formatDate(tx.dateEnvoi)}</span></div>
                <div className="transaction-actions">
                  <button onClick={() => handleConsult(tx)}>{t('consulter')}</button>
                  <button onClick={() => handleCancelOutgoing(tx.id)}>{t('annuler')}</button>
                  <button onClick={() => handleHideTransaction(tx.id, 'pending')}>{t('masquer')}</button>
                </div>
              </div>
            ))}</div>
          </div>
        </div>
      )}

      {/* Completed Transactions Modal */}
      {showCompletedModal && (
        <div className="modal-overlay" onClick={() => setShowCompletedModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('transactions_traitees')}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-restore" onClick={() => openRestoreModal('completed')}>
                  🔓 {t('restaurer_masquees')} ({hiddenCompleted.length})
                </button>
                <button className="btn-secondary" onClick={() => setShowCompletedModal(false)}>{t('fermer')}</button>
              </div>
            </div>
            <div className="transaction-list">{completed.length === 0 ? <p className="text-muted">{t('aucune_transaction')}</p> : completed.map(tx => (
              <div key={tx.id} className="transaction-item">
                <div className="transaction-header"><span className="transaction-title">{tx.documentSujet}</span><span className="transaction-badge">{translateStatus(tx.statut, t)}</span></div>
                <div className="transaction-details"><span>{t('service_destinataire')} : {tx.destinationServiceNom}</span><span>{t('message')} : {tx.message || t('non_renseigne')}</span><span>{t('traite_le')} : {formatDate(tx.dateReponse)}</span><span>{t('note')} : {tx.messageReponse || t('non_renseigne')}</span></div>
                <div className="transaction-actions">
                  <button onClick={() => handleConsult(tx)}>{t('consulter')}</button>
                  <button onClick={() => handleHideTransaction(tx.id, 'completed')}>{t('masquer')}</button>
                </div>
              </div>
            ))}</div>
          </div>
        </div>
      )}

      {/* Pending Returns Modal */}
      {showReturnsModal && (
        <div className="modal-overlay" onClick={() => setShowReturnsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('documents_retourner')}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-restore" onClick={() => openRestoreModal('returns')}>
                  🔓 {t('restaurer_masquees')} ({hiddenReturns.length})
                </button>
                <button className="btn-secondary" onClick={() => setShowReturnsModal(false)}>{t('fermer')}</button>
              </div>
            </div>
            <div className="transaction-list">
              {pendingReturns.length === 0 ? <p className="text-muted">{t('aucun_document_retour')}</p> : pendingReturns.map(tx => {
                const isConsultant = isConsultantTransaction(tx);
                return (
                  <div key={tx.id} className="transaction-item">
                    <div className="transaction-header"><span className="transaction-title">{tx.documentSujet}</span><span className="transaction-badge">{t('en_attente_retour')}</span></div>
                    <div className="transaction-details"><span>{t('service_destinataire')} : {tx.destinationServiceNom}</span><span>{t('message')} : {tx.message || t('non_renseigne')}</span><span>{t('envoye_le')} : {formatDate(tx.dateEnvoi)}</span></div>
                    <div className="transaction-actions">
                      <button onClick={() => handleConsult(tx)}>{t('consulter')}</button>
                      {isConsultant && <button onClick={() => handleMarkReturned(tx.id)}>{t('marquer_retourne')}</button>}
                      <button onClick={() => handleHideTransaction(tx.id, 'returns')}>{t('masquer')}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal (detailed table) */}
      {showRestoreModal && restoreCategory && (
        <div className="modal-overlay" onClick={() => setShowRestoreModal(false)}>
          <div className="modal" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('transactions_masquees')} - {t(restoreCategory)}</h3>
              <button className="btn-secondary" onClick={() => setShowRestoreModal(false)}>{t('fermer')}</button>
            </div>
            {hiddenItemsDetails.length === 0 ? (
              <p className="text-muted">{t('aucune_masquee')}</p>
            ) : (
              <>
                <div className="data-table-wrapper">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>{t('titre')}</th>
                        <th>{t('date')}</th>
                        <th>{t('service')}</th>
                        <th>{t('statut')}</th>
                        <th>{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hiddenItemsDetails.map(item => (
                        <tr key={item.id}>
                          <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>{item.title}</td>
                          <td>{formatDate(item.date)}</td>
                          <td>{item.service}</td>
                          <td>{item.status}</td>
                          <td className="action-icons">
                            <button className="btn-primary" onClick={() => { handleRestore(item.id, restoreCategory); setShowRestoreModal(false); }}>
                              {t('restaurer')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                   </table>
                </div>
                <div className="form-actions" style={{ marginTop: '1rem' }}>
                  <button className="btn-primary" onClick={() => { handleRestoreAll(restoreCategory); setShowRestoreModal(false); }}>
                    {t('restaurer_tout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Transfer modals (unchanged) */}
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
            <div className="registry-panel-header"><h3>{t('transferer')} : {singleTransferTarget?.sujet}</h3><button className="btn-secondary" onClick={() => setShowSingleTransferModal(false)}>{t('fermer')}</button></div>
            <div className="form-grid">
              <div className="form-field"><label>{t('service_destinataire')} *</label><select value={singleTransferServiceId} onChange={e => handleSingleServiceChange(e.target.value)}><option value="">--</option>{services.filter(s => s.idService !== serviceId).map(s => (<option key={s.idService} value={s.idService}>{s.nomService}</option>))}</select></div>
              <div className="form-field"><label>{t('personne')} *</label><select value={singleTransferUserId} onChange={e => setSingleTransferUserId(e.target.value)}><option value="">--</option>{singleTransferUsers.map(u => (<option key={u.id} value={u.id}>{u.nomComplet}</option>))}</select></div>
              <div className="form-field full-width"><label className="checkbox-field"><input type="checkbox" checked={singleTransferDoitRevenir} onChange={e => setSingleTransferDoitRevenir(e.target.checked)} /> {t('doit_revenir')}</label></div>
              <div className="form-field full-width"><label>{t('message')}</label><textarea value={singleTransferMessage} onChange={e => setSingleTransferMessage(e.target.value)} rows="3" /></div>
            </div>
            <div className="form-actions"><button className="btn-primary" onClick={handleSingleTransfer}>{t('envoyer')}</button><button className="btn-secondary" onClick={() => setShowSingleTransferModal(false)}>{t('annuler')}</button></div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal" style={{ maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header"><h3>{t('transferer')} : {transferTarget?.sujet}</h3><button className="btn-secondary" onClick={() => setShowTransferModal(false)}>{t('fermer')}</button></div>
            <div className="form-grid">
              <div className="form-field full-width"><label>{t('ajouter_personnes_service')}</label><div style={{ display: 'flex', gap: '0.5rem' }}><select value={transferCurrentService} onChange={e => handleTransferServiceChange(e.target.value)} style={{ flex: 1 }}><option value="">-- {t('choisir_service')} --</option>{services.filter(s => s.idService !== serviceId).map(s => (<option key={s.idService} value={s.idService}>{s.nomService}</option>))}</select><button className="btn-secondary" onClick={addCurrentSelection} disabled={!transferCurrentService || transferCurrentUserIds.length === 0}>{t('ajouter')}</button></div></div>
              {transferCurrentService && (<div className="form-field full-width"><label>{t('choisir_personnes')}</label><div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>{allUsers.filter(u => u.idService === Number(transferCurrentService)).map(u => (<label key={u.id} className="transfer-user-label"><input type="checkbox" checked={transferCurrentUserIds.includes(u.id)} onChange={() => toggleCurrentUser(u.id)} /><span>{u.nomComplet}</span></label>))}</div></div>)}
              {transferSelections.length > 0 && (<div className="form-field full-width"><label>{t('personnes_selectionnees')}</label><div style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>{transferSelections.map(sel => { const svc = services.find(s => s.idService === Number(sel.serviceId)); const svcName = svc ? svc.nomService : `Service #${sel.serviceId}`; return (<div key={sel.serviceId} style={{ marginBottom: '0.5rem', background: '#f9fbfd', padding: '0.5rem', borderRadius: '6px' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{svcName}</strong><button className="btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => removeSelection(sel.serviceId)}>✕</button></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>{allUsers.filter(u => sel.userIds.includes(u.id)).map(u => (<span key={u.id} style={{ background: 'var(--soft-line)', padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem' }}>{u.nomComplet}</span>))}</div></div>);})}</div></div>)}
              <div className="form-field full-width"><label className="checkbox-field"><input type="checkbox" checked={transferDoitRevenir} onChange={e => setTransferDoitRevenir(e.target.checked)} /> {t('doit_revenir')}</label></div>
              <div className="form-field full-width"><label>{t('message')}</label><textarea value={transferMessage} onChange={e => setTransferMessage(e.target.value)} rows="3" /></div>
            </div>
            <div className="form-actions"><button className="btn-primary" onClick={handleMultiTransfer} disabled={transferSelections.flatMap(s => s.userIds).length === 0}>{t('envoyer')} ({transferSelections.flatMap(s => s.userIds).length})</button><button className="btn-secondary" onClick={() => setShowTransferModal(false)}>{t('annuler')}</button></div>
          </div>
        </div>
      )}

      {/* Document Modal */}
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