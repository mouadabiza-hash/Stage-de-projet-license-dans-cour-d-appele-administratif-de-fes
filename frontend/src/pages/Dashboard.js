import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import DocumentModal from '../components/DocumentModal';

// ── Reusable HiddenPopup ──────────────────────────────────────────────────────
function HiddenPopup({ items, searchValue, onSearchChange, onRestore, onClose, t, formatDate }) {
  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 1100 }}
      onClick={onClose}
    >
      <div
        className="modal"
        style={{ maxWidth: '520px', maxHeight: '75vh', overflowY: 'auto', zIndex: 1101 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="registry-panel-header" style={{ borderBottom: '2px solid #ff9800', marginBottom: '1rem' }}>
          <h3 style={{ color: '#ff9800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🔒 {t('transactions_masquees')} <span style={{ background: '#ff9800', color: '#fff', borderRadius: '12px', padding: '0 8px', fontSize: '0.85rem' }}>{items.length}</span>
          </h3>
          <button className="btn-secondary" onClick={onClose}>{t('fermer')}</button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder={t('chercher')}
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '0.95rem', marginBottom: '1rem', boxSizing: 'border-box' }}
          autoFocus
        />

        {/* List */}
        {items.filter(item =>
          (item.documentSujet || '').toLowerCase().includes(searchValue.toLowerCase())
        ).length === 0 ? (
          <p className="text-muted" style={{ textAlign: 'center', padding: '2rem 0' }}>{t('aucune_masquee')}</p>
        ) : (
          <div className="transaction-list">
            {items
              .filter(item => (item.documentSujet || '').toLowerCase().includes(searchValue.toLowerCase()))
              .map(item => (
                <div key={item.id} className="transaction-item" style={{ borderLeft: '3px solid #ff9800' }}>
                  <div className="transaction-header">
                    <span className="transaction-title">{item.documentSujet || 'Document'}</span>
                    <span className="transaction-badge" style={{ backgroundColor: '#fff3e0', color: '#e65100' }}>{t('masquee')}</span>
                  </div>
                  <div className="transaction-details">
                    {item.sourceServiceNom && <span>{t('de')} : {item.sourceServiceNom}</span>}
                    {item.destinationServiceNom && <span>{t('service_destinataire')} : {item.destinationServiceNom}</span>}
                    {item.message && <span>{t('message')} : {item.message}</span>}
                    {item.dateEnvoi && <span>{t('envoye_le')} : {formatDate(item.dateEnvoi)}</span>}
                    {item.dateReponse && <span>{t('date_reponse')} : {formatDate(item.dateReponse)}</span>}
                    {item.messageReponse && <span>{t('reponse')} : {item.messageReponse}</span>}
                  </div>
                  <div className="transaction-actions">
                    <button
                      className="btn-primary"
                      style={{ background: '#ff9800', borderColor: '#ff9800' }}
                      onClick={() => onRestore(item.id)}
                    >
                      🔓 {t('restaurer')}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm, ConfirmModalComponent } = useConfirm();
  const serviceId = user?.idService;

  const [pending, setPending] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [pendingReturns, setPendingReturns] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hiddenIds, setHiddenIds] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [currentDocument, setCurrentDocument] = useState(null);
  const [pendingTransactions, setPendingTransactions] = useState([]);

  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [incomingReply, setIncomingReply] = useState({});

  // ── Hidden-popup state (one per section) ──────────────────────────────────
  const [showHiddenPopup, setShowHiddenPopup] = useState(null); // 'notifications'|'pending'|'completed'|'returns'
  const [hiddenSearches, setHiddenSearches] = useState({ notifications: '', pending: '', completed: '', returns: '' });

  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Transfer states
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

  const [hiddenItemsDetails, setHiddenItemsDetails] = useState([]);

  // Toast messages
  const [successMessage, setSuccessMessage] = useState({ text: '', visible: false });
  const [errorMessage, setErrorMessage] = useState({ text: '', visible: false });

  const showSuccess = (text) => {
    showToast(text, 'success');
  };
  const showError = (text) => {
    showToast(text, 'error');
  };

  useEffect(() => {
    const stored = localStorage.getItem('hiddenDashboardTransactions');
    if (stored) setHiddenIds(JSON.parse(stored));
  }, []);

  useEffect(() => { fetchAllData(); }, [hiddenIds]);
  useEffect(() => { fetchHiddenDetails(); }, [hiddenIds]);

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
      const safeArray = (arr) => Array.isArray(arr) ? arr : [];
      const currentHidden = JSON.parse(localStorage.getItem('hiddenDashboardTransactions') || '[]');
      const notHidden = (arr) => safeArray(arr).filter(tx => tx && tx.id && !currentHidden.includes(tx.id));

      setPending(notHidden(pendingRes.data));
      const filtered = notHidden(outgoingRes.data);
      setCompleted(filtered.filter(tx => tx && tx.statut && (isAccepted(tx.statut) || isRejected(tx.statut))));
      setPendingReturns(notHidden(returnsRes.data));
      setIncoming(notHidden(incomingRes.data));
      setAllUsers(safeArray(usersRes.data));
      setServices(safeArray(servicesRes.data));
      setPendingTransactions(safeArray(pendingTxRes.data));
      const myDocs = safeArray(docsRes.data).filter(doc => doc && doc.idService === serviceId && !doc.isSubstitute);
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
    const confirmed = await confirm(
      t('confirmation_annuler'),
      { title: t('attention'), confirmText: t('annuler') }
    );
    if (confirmed) {
      await axios.post(`/api/transactions/${id}/cancel`);
      fetchAllData();
      showSuccess(t('transaction_annulee'));
    }
  };

  const handleHide = async (id) => {
    const confirmed = await confirm(
      t('confirmation_masquer'),
      { title: t('attention'), confirmText: t('masquer') }
    );
    if (confirmed) {
      const newHidden = [...hiddenIds, id];
      setHiddenIds(newHidden);
      localStorage.setItem('hiddenDashboardTransactions', JSON.stringify(newHidden));
      showSuccess(t('transaction_masquee'));
    }
  };

  const handleMarkReturned = async (id) => {
    const confirmed = await confirm(
      t('confirmation_retour'),
      { title: t('attention'), confirmText: t('marquer_retourne') }
    );
    if (confirmed) {
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

  const handleHideTransaction = (id) => {
    // Resolve type and item data BEFORE any state updates (arrays are still intact here)
    let type = 'pending';
    let item = pending.find(tx => tx.id === id);
    if (item) {
      type = 'pending';
    } else {
      item = incoming.find(n => n.id === id);
      if (item) {
        type = 'notifications';
      } else {
        item = pendingReturns.find(tx => tx.id === id);
        if (item) {
          type = 'returns';
        } else {
          item = completed.find(tx => tx.id === id);
          if (item) type = 'completed';
        }
      }
    }

    // Now update hiddenIds and localStorage
    const newHidden = [...hiddenIds, id];
    setHiddenIds(newHidden);
    localStorage.setItem('hiddenDashboardTransactions', JSON.stringify(newHidden));

    // Remove from all visible lists
    setPending(prev => prev.filter(tx => tx.id !== id));
    setCompleted(prev => prev.filter(tx => tx.id !== id));
    setPendingReturns(prev => prev.filter(tx => tx.id !== id));
    setIncoming(prev => prev.filter(n => n.id !== id));

    // Add to hidden details with the correctly resolved type
    setHiddenItemsDetails(prev => {
      if (prev.find(d => d.id === id)) return prev; // already there
      return [...prev, { ...item, id, documentSujet: item?.documentSujet || 'Document', type }];
    });

    showSuccess(t('transaction_masquee'));
  };

  // ── Restore ───────────────────────────────────────────────────────────────
  const fetchHiddenDetails = async () => {
    if (hiddenIds.length === 0) { setHiddenItemsDetails([]); return; }
    try {
      const [pendingRes, completedRes, returnsRes, incomingRes] = await Promise.all([
        axios.get('/api/transactions/pending'),
        axios.get('/api/transactions/completed'),
        axios.get('/api/transactions/pending-returns'),
        axios.get('/api/transactions/incoming-accepted')
      ]);
      const allByType = {
        pending: pendingRes.data.map(tx => ({ ...tx, type: 'pending' })),
        completed: completedRes.data.map(tx => ({ ...tx, type: 'completed' })),
        returns: returnsRes.data.map(tx => ({ ...tx, type: 'returns' })),
        notifications: incomingRes.data.map(tx => ({ ...tx, type: 'notifications' }))
      };
      const details = hiddenIds.map(id => {
        for (const [, items] of Object.entries(allByType)) {
          const tx = items.find(t => t.id === id);
          if (tx) return { ...tx, type: tx.type };
        }
        return { id, documentSujet: `Transaction ${id}`, type: 'pending' };
      });
      setHiddenItemsDetails(details);
    } catch (err) {
      console.error('Erreur chargement détails masqués', err);
    }
  };

  const handleRestore = (id) => {
    const newHidden = hiddenIds.filter(hid => hid !== id);
    setHiddenIds(newHidden);
    localStorage.setItem('hiddenDashboardTransactions', JSON.stringify(newHidden));
    setHiddenItemsDetails(prev => prev.filter(d => d.id !== id));
    fetchAllData();
    showSuccess(t('transaction_restauree'));
  };

  const handleRestoreAll = () => {
    setHiddenIds([]);
    localStorage.removeItem('hiddenDashboardTransactions');
    setHiddenItemsDetails([]);
    fetchAllData();
    showSuccess(t('toutes_restaurees'));
  };

  // ── Hidden popup helpers ──────────────────────────────────────────────────
  const openHiddenPopup = (type, e) => {
    e.stopPropagation();
    setShowHiddenPopup(type);
  };
  const closeHiddenPopup = () => {
    setShowHiddenPopup(null);
    setHiddenSearches(prev => ({ ...prev, [showHiddenPopup]: '' }));
  };

  // Badge button rendered in modal headers
  const HiddenBadgeButton = ({ type }) => {
    const count = hiddenItemsDetails.filter(i => i.type === type).length;
    if (count === 0) return null;
    return (
      <button
        onClick={(e) => openHiddenPopup(type, e)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          background: '#fff3e0', color: '#e65100', border: '1.5px solid #ff9800',
          borderRadius: '20px', padding: '0.3rem 0.75rem', fontSize: '0.82rem',
          fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#ffe0b2'}
        onMouseLeave={e => e.currentTarget.style.background = '#fff3e0'}
      >
        🔒 {t('masquees')} <span style={{ background: '#ff9800', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '0.78rem' }}>{count}</span>
      </button>
    );
  };

  // ---------- TRANSFER ----------
  const openTransferChoice = (doc) => { setTransferChoiceDoc(doc); setShowTransferChoice(true); };
  const openSingleTransferModal = (doc, isJudicial) => {
    setSingleTransferTarget(doc);
    setSingleTransferDocType(isJudicial ? 'Judiciaire' : 'Administratif');
    setSingleTransferServiceId(''); setSingleTransferUsers([]); setSingleTransferUserId('');
    setSingleTransferDoitRevenir(false); setSingleTransferMessage('');
    setShowSingleTransferModal(true);
  };
  const handleSingleServiceChange = async (value) => {
    setSingleTransferServiceId(value); setSingleTransferUsers([]); setSingleTransferUserId('');
    if (!value) return;
    try { const res = await axios.get(`/api/utilisateurs?serviceId=${value}`); setSingleTransferUsers(res.data); }
    catch (err) { showError(t('erreur_chargement')); }
  };
  const handleSingleTransfer = async () => {
    if (!singleTransferTarget || !singleTransferUserId) { showError(t('selection_requise')); return; }
    const payload = { documentId: singleTransferTarget.idEntite, documentType: singleTransferDocType, destinationServiceId: null, destinationUserId: Number(singleTransferUserId), doitRevenir: singleTransferDoitRevenir, message: singleTransferMessage };
    try { await axios.post('/api/transactions', payload); showSuccess(t('transaction_envoyee')); setShowSingleTransferModal(false); fetchAllData(); }
    catch (err) { showError(err.response?.data || t('erreur_transaction')); }
  };
  const handleTransferChoice = (mode) => {
    setShowTransferChoice(false);
    if (mode === 'single') openSingleTransferModal(transferChoiceDoc, false);
    else openTransferModal(transferChoiceDoc);
  };
  const openTransferModal = (doc) => {
    setTransferTarget(doc); setTransferSelections([]); setTransferCurrentService('');
    setTransferCurrentUserIds([]); setTransferMessage(''); setTransferDoitRevenir(false);
    setShowTransferModal(true);
  };
  const handleTransferServiceChange = (svcId) => { setTransferCurrentService(svcId); setTransferCurrentUserIds([]); };
  const toggleCurrentUser = (userId) => { setTransferCurrentUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]); };
  const addCurrentSelection = () => {
    if (!transferCurrentService || transferCurrentUserIds.length === 0) return;
    setTransferSelections(prev => {
      const existing = prev.find(s => s.serviceId === transferCurrentService);
      if (existing) return prev.map(s => s.serviceId === transferCurrentService ? { ...s, userIds: [...new Set([...s.userIds, ...transferCurrentUserIds])] } : s);
      return [...prev, { serviceId: transferCurrentService, userIds: [...transferCurrentUserIds] }];
    });
    setTransferCurrentService(''); setTransferCurrentUserIds([]);
  };
  const removeSelection = (serviceId) => { setTransferSelections(prev => prev.filter(s => s.serviceId !== serviceId)); };
  const handleMultiTransfer = async () => {
    const allUserIds = transferSelections.flatMap(s => s.userIds);
    if (!transferTarget || allUserIds.length === 0) { showError(t('selection_requise')); return; }
    try {
      for (let userId of allUserIds) {
        await axios.post('/api/transactions', { documentId: transferTarget.idEntite, documentType: transferTarget.type, destinationServiceId: null, destinationUserId: userId, doitRevenir: transferDoitRevenir, message: transferMessage });
      }
      showSuccess(t('transaction_envoyee')); setShowTransferModal(false); fetchAllData();
    } catch (err) { showError(err.response?.data?.message || t('erreur_transaction')); }
  };

  // ---------- DOCUMENT CONSULTATION ----------
  const handleConsult = async (item) => {
    const buildFallback = (src, isTransaction) => {
      if (isTransaction) {
        return { id: src.documentId, idBureauOrdre: src.numeroCourrier || '', date: src.dateEnvoi, sujet: src.documentSujet || '', source: src.sourceServiceNom || '', destinataire: src.destinationServiceNom || '', description: src.message || '', etat: src.statut || '', lienPdf: src.lienPdf || '', typeDocument: src.documentType || '', serviceNom: src.destinationServiceNom || '', numeroDossier: src.numeroDossierJudiciaire || '', direction: '', typeRegistre: '', typeCorrespondance: '', estTransmissible: false, emplacement: src.emplacement || src.destinationServiceNom || '', numeroDeCourrier: src.numeroCourrier || '', retraits: [] };
      } else {
        return { id: src.idEntite, idBureauOrdre: src.idBureauOrdre || '', date: src.dateCreation, sujet: src.sujet || '', source: src.source || '', destinataire: src.destinataire || '', description: src.description || '', etat: src.etat || '', lienPdf: src.lienPdf || '', typeDocument: src.type || '', serviceNom: src.serviceNom || '', numeroDossier: src.numeroDossierJudiciaire || '', direction: src.direction || '', typeRegistre: src.typeRegistre || '', typeCorrespondance: src.typeCorrespondance || '', estTransmissible: src.estTransmissible || false, emplacement: src.emplacement || '', numeroDeCourrier: src.numeroCourrier || '', retraits: src.retraits || [] };
      }
    };
    const isTransaction = item.hasOwnProperty('documentId');
    const fallback = buildFallback(item, isTransaction);
    try {
      const id = isTransaction ? item.documentId : item.idEntite;
      const type = isTransaction ? item.documentType : item.type;
      const res = await axios.get(`/api/documents/${id}?type=${type}`);
      setCurrentDocument(res.data);
    } catch (err) {
      console.warn('Erreur API, utilisation fallback', err);
      setCurrentDocument(fallback);
    }
    setShowDocModal(true);
  };

  const isConsultantTransaction = (tx) => {
    if (!tx.destinationUserId) return false;
    const destUser = allUsers.find(u => u.id === tx.destinationUserId);
    return destUser?.role === 'Consultant';
  };

  // Pagination
  const filteredDocs = (Array.isArray(documents) ? documents : []).filter(doc => {
    if (!doc) return false;
    const searchStr = (searchTerm || '').toLowerCase();
    return (
      (String(doc.sujet || '')).toLowerCase().includes(searchStr) ||
      (String(doc.type || '')).toLowerCase().includes(searchStr) ||
      (String(doc.source || '')).toLowerCase().includes(searchStr) ||
      (String(doc.numeroDossierJudiciaire || '')).toLowerCase().includes(searchStr)
    );
  });
  const idxLast = currentPage * rowsPerPage;
  const idxFirst = idxLast - rowsPerPage;
  const currentDocs = filteredDocs.slice(idxFirst, idxLast);
  const totalPages = Math.ceil(filteredDocs.length / rowsPerPage);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const stats = {
    pending: Array.isArray(pending) ? pending.length : 0,
    accepted: (Array.isArray(completed) ? completed : []).filter(tx => tx && isAccepted(tx.statut)).length,
    rejected: (Array.isArray(completed) ? completed : []).filter(tx => tx && isRejected(tx.statut)).length,
    cancelled: (Array.isArray(completed) ? completed : []).filter(tx => tx && isCancelled(tx.statut)).length,
  };

  if (loading) return <div className="loading">{t('chargement')}</div>;

  return (
    <div className="dashboard-container">
      <ConfirmModalComponent />
      
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
        <div><h1>{t('dashboard')}</h1><p>{t('dashboard_subtitle')}</p></div>
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
              <th>{t('titre')}</th><th>{t('numero_dossier_judiciaire')}</th><th>{t('type')}</th>
              <th>{t('date')}</th><th>{t('source')}</th><th>{t('destinataire')}</th><th>{t('actions')}</th>
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
                    <td>{doc.sujet || '-'}</td><td>{doc.numeroDossierJudiciaire || '-'}</td>
                    <td>{doc.type || '-'}</td><td>{formatDate(doc.dateCreation)}</td>
                    <td>{doc.source || '-'}</td><td>{doc.destinataire || '-'}</td>
                    <td className="action-icons">
                      <button onClick={() => handleConsult(doc)}>{t('consulter')}</button>
                      {pendingTx && <button onClick={() => handleCancelOutgoing(pendingTx.id)} style={{ color: 'red' }}>{t('annuler')}</button>}
                      {canTransfer && (
                        isJudicial
                          ? <button onClick={() => openSingleTransferModal(doc, true)}>{t('transferer')}</button>
                          : <button onClick={() => openTransferChoice(doc)}>{t('transferer')}</button>
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

      {/* Dashboard cards */}
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
          <div className="modal" style={{ maxWidth: '900px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('notifications')}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* 🔒 Masquées button */}
                <HiddenBadgeButton type="notifications" />
                <button className="btn-secondary" onClick={() => setShowNotificationsModal(false)}>{t('fermer')}</button>
              </div>
            </div>

            {/* Own notifications */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {t('mes_notifications')}
                <span className="notif-count-badge">{incoming.filter(n => !n.isSubstitute).length}</span>
              </h4>
              {incoming.filter(n => !n.isSubstitute).length === 0 ? (
                <p className="text-muted">{t('aucune_notification')}</p>
              ) : (
                <div className="notif-list">
                  {incoming.filter(n => !n.isSubstitute).map(n => (
                    <div key={n.id} className="notif-card">
                      <div className="notif-card-accent" />
                      <div className="notif-card-body">
                        <div className="notif-row-top">
                          <span className="notif-subject">{n.documentSujet}</span>
                          <span className="notif-badge notif-badge-pending">{t('en_attente')}</span>
                        </div>
                        {(n.numeroCourrier || n.numeroDossierJudiciaire) && (
                          <div className="notif-tags">
                            {n.numeroCourrier && <span className="notif-tag">✉ {n.numeroCourrier}</span>}
                            {n.numeroDossierJudiciaire && <span className="notif-tag">⚖ {n.numeroDossierJudiciaire}</span>}
                          </div>
                        )}
                        <div className="notif-details">
                          <div className="notif-detail-row"><span className="notif-detail-lbl">{t('de')} :</span><span className="notif-detail-val">{n.sourceServiceNom}</span></div>
                          {n.message && <div className="notif-detail-row"><span className="notif-detail-lbl">{t('message')} :</span><span className="notif-detail-val">{n.message}</span></div>}
                        </div>
                        <textarea className="notif-textarea" placeholder={t('votre_reponse')} value={incomingReply[n.id] || ''} onChange={e => setIncomingReply({ ...incomingReply, [n.id]: e.target.value })} rows={2} />
                        <div className="notif-actions">
                          <button className="notif-btn notif-btn-accept" onClick={() => handleIncomingRespond(n.id, true)}>✓ {t('accepter')}</button>
                          <button className="notif-btn notif-btn-reject" onClick={() => handleIncomingRespond(n.id, false)}>✕ {t('refuser')}</button>
                          <button className="notif-btn" onClick={() => handleHideTransaction(n.id)} style={{ backgroundColor: '#666' }}>🔒 {t('masquer')}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Substitute notifications */}
            {incoming.filter(n => n.isSubstitute).length > 0 && (
              <div>
                <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {t('notifications_substitution')}
                  <span className="notif-count-badge">{incoming.filter(n => n.isSubstitute).length}</span>
                </h4>
                <div className="notif-list">
                  {incoming.filter(n => n.isSubstitute).map(n => (
                    <div key={n.id} className="notif-card">
                      <div className="notif-card-accent" />
                      <div className="notif-card-body">
                        <div className="notif-row-top">
                          <span className="notif-subject">{n.documentSujet}</span>
                          <span className="notif-badge notif-badge-pending">{t('en_attente')}</span>
                        </div>
                        {(n.numeroCourrier || n.numeroDossierJudiciaire) && (
                          <div className="notif-tags">
                            {n.numeroCourrier && <span className="notif-tag">✉ {n.numeroCourrier}</span>}
                            {n.numeroDossierJudiciaire && <span className="notif-tag">⚖ {n.numeroDossierJudiciaire}</span>}
                          </div>
                        )}
                        <div className="notif-details">
                          <div className="notif-detail-row"><span className="notif-detail-lbl">{t('de')} :</span><span className="notif-detail-val">{n.sourceServiceNom}</span></div>
                          {n.message && <div className="notif-detail-row"><span className="notif-detail-lbl">{t('message')} :</span><span className="notif-detail-val">{n.message}</span></div>}
                        </div>
                        <textarea className="notif-textarea" placeholder={t('votre_reponse')} value={incomingReply[n.id] || ''} onChange={e => setIncomingReply({ ...incomingReply, [n.id]: e.target.value })} rows={2} />
                        <div className="notif-actions">
                          <button className="notif-btn notif-btn-accept" onClick={() => handleIncomingRespond(n.id, true)}>✓ {t('accepter')}</button>
                          <button className="notif-btn notif-btn-reject" onClick={() => handleIncomingRespond(n.id, false)}>✕ {t('refuser')}</button>
                          <button className="notif-btn" onClick={() => handleHideTransaction(n.id)} style={{ backgroundColor: '#666' }}>🔒 {t('masquer')}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Outgoing Modal */}
      {showPendingModal && (
        <div className="modal-overlay" onClick={() => setShowPendingModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="registry-panel-header">
              <h3>{t('demandes_attente')}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <HiddenBadgeButton type="pending" />
                <button className="btn-secondary" onClick={() => setShowPendingModal(false)}>{t('fermer')}</button>
              </div>
            </div>
            <div className="transaction-list">
              {pending.length === 0 ? <p className="text-muted">{t('aucune_demande')}</p> : pending.map(tx => (
                <div key={tx.id} className="transaction-item">
                  <div className="transaction-header"><span className="transaction-title">{tx.documentSujet}</span><span className="transaction-badge">{t('en_attente')}</span></div>
                  <div className="transaction-details">
                    <span>{t('service_destinataire')} : {tx.destinationServiceNom}</span>
                    <span>{t('message')} : {tx.message || t('non_renseigne')}</span>
                    <span>{t('envoye_le')} : {formatDate(tx.dateEnvoi)}</span>
                  </div>
                  <div className="transaction-actions">
                    <button onClick={() => handleConsult(tx)}>{t('consulter')}</button>
                    <button onClick={() => handleCancelOutgoing(tx.id)}>{t('annuler')}</button>
                    <button className="btn-hide" onClick={() => handleHideTransaction(tx.id)}>🔒 {t('masquer')}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Completed Transactions Modal */}
      {showCompletedModal && (
        <div className="modal-overlay" onClick={() => setShowCompletedModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="registry-panel-header">
              <h3>{t('transactions_traitees')}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <HiddenBadgeButton type="completed" />
                <button className="btn-secondary" onClick={() => setShowCompletedModal(false)}>{t('fermer')}</button>
              </div>
            </div>
            <div className="transaction-list">
              {completed.length === 0 ? <p className="text-muted">{t('aucune_transaction')}</p> : completed.map(tx => (
                <div key={tx.id} className="transaction-item">
                  <div className="transaction-header"><span className="transaction-title">{tx.documentSujet}</span><span className="transaction-badge">{translateStatus(tx.statut, t)}</span></div>
                  <div className="transaction-details">
                    <span>{t('service_destinataire')} : {tx.destinationServiceNom}</span>
                    <span>{t('message')} : {tx.message || t('non_renseigne')}</span>
                    <span>{t('traite_le')} : {formatDate(tx.dateReponse)}</span>
                    <span>{t('note')} : {tx.messageReponse || t('non_renseigne')}</span>
                  </div>
                  <div className="transaction-actions">
                    <button onClick={() => handleConsult(tx)}>{t('consulter')}</button>
                    <button className="btn-hide" onClick={() => handleHideTransaction(tx.id)}>🔒 {t('masquer')}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pending Returns Modal */}
      {showReturnsModal && (
        <div className="modal-overlay" onClick={() => setShowReturnsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="registry-panel-header">
              <h3>{t('documents_retourner')}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <HiddenBadgeButton type="returns" />
                <button className="btn-secondary" onClick={() => setShowReturnsModal(false)}>{t('fermer')}</button>
              </div>
            </div>
            <div className="transaction-list">
              {pendingReturns.length === 0 ? <p className="text-muted">{t('aucun_document_retour')}</p> : pendingReturns.map(tx => {
                const isConsultant = isConsultantTransaction(tx);
                return (
                  <div key={tx.id} className="transaction-item">
                    <div className="transaction-header"><span className="transaction-title">{tx.documentSujet}</span><span className="transaction-badge">{t('en_attente_retour')}</span></div>
                    <div className="transaction-details">
                      <span>{t('service_destinataire')} : {tx.destinationServiceNom}</span>
                      <span>{t('message')} : {tx.message || t('non_renseigne')}</span>
                      <span>{t('envoye_le')} : {formatDate(tx.dateEnvoi)}</span>
                    </div>
                    <div className="transaction-actions">
                      <button onClick={() => handleConsult(tx)}>{t('consulter')}</button>
                      {isConsultant && <button onClick={() => handleMarkReturned(tx.id)}>{t('marquer_retourne')}</button>}
                      <button className="btn-hide" onClick={() => handleHideTransaction(tx.id)}>🔒 {t('masquer')}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Hidden Popup (renders on top of all modals) ── */}
      {showHiddenPopup && (
        <HiddenPopup
          items={hiddenItemsDetails.filter(i => i.type === showHiddenPopup)}
          searchValue={hiddenSearches[showHiddenPopup]}
          onSearchChange={(val) => setHiddenSearches(prev => ({ ...prev, [showHiddenPopup]: val }))}
          onRestore={(id) => { handleRestore(id); }}
          onClose={closeHiddenPopup}
          t={t}
          formatDate={formatDate}
        />
      )}

      {/* Transfer Choice Modal */}
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

      {/* Single Transfer Modal */}
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

      {/* Multi Transfer Modal */}
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