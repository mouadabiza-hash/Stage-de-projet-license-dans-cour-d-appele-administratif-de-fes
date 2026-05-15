import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DocumentModal from '../components/DocumentModal';

function Dashboard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
  const navigate = useNavigate();

  const [pending, setPending] = useState([]);            // outgoing pending
  const [completed, setCompleted] = useState([]);
  const [pendingReturns, setPendingReturns] = useState([]);
  const [incoming, setIncoming] = useState([]);          // incoming pending
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hiddenIds, setHiddenIds] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [currentDocument, setCurrentDocument] = useState(null);

  // modal states
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const [allJudicial, setAllJudicial] = useState([]);
  const [filteredJudicial, setFilteredJudicial] = useState([]);
  const [judicialSearch, setJudicialSearch] = useState('');
  const [judicialRowsPerPage, setJudicialRowsPerPage] = useState(10);
  const [judicialCurrentPage, setJudicialCurrentPage] = useState(1);

  // response text for each notification
  const [incomingReply, setIncomingReply] = useState({});

  useEffect(() => {
    const stored = localStorage.getItem('hiddenDashboardTransactions');
    if (stored) setHiddenIds(JSON.parse(stored));
  }, []);

  useEffect(() => { fetchData(); }, [hiddenIds]);

  const fetchData = async () => {
    try {
      const [outgoingRes, returnsRes, incomingRes, judicialRes] = await Promise.all([
        axios.get('/api/transactions/outgoing'),
        axios.get('/api/transactions/pending-returns'),
        axios.get('/api/transactions/incoming'),
        axios.get('/api/acteursjudiciaires')
      ]);
      const filtered = outgoingRes.data.filter(tx => !hiddenIds.includes(tx.id));
      setPending(filtered.filter(tx => isPending(tx.statut)));
      setCompleted(filtered.filter(tx => isAccepted(tx.statut) || isRejected(tx.statut)));
      setPendingReturns(returnsRes.data);
      setIncoming(incomingRes.data);
      const sorted = judicialRes.data
        .map(item => ({ ...item, documentType: 'EntiteDJ' }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setAllJudicial(sorted);
      setFilteredJudicial(sorted);
      setError('');
    } catch (err) {
      setError(t('erreur_chargement_donnees'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!judicialSearch.trim()) {
      setFilteredJudicial(allJudicial);
    } else {
      const term = judicialSearch.trim().toLowerCase();
      setFilteredJudicial(allJudicial.filter(doc =>
        (doc.sujet && doc.sujet.toLowerCase().includes(term)) ||
        (doc.tribunalSource && doc.tribunalSource.toLowerCase().includes(term)) ||
        (doc.numeroDossier && doc.numeroDossier.toLowerCase().includes(term))
      ));
    }
    setJudicialCurrentPage(1);
  }, [judicialSearch, allJudicial]);

  const indexOfLast = judicialCurrentPage * judicialRowsPerPage;
  const indexOfFirst = indexOfLast - judicialRowsPerPage;
  const currentJudicial = filteredJudicial.slice(indexOfFirst, indexOfLast);
  const totalJudicialPages = Math.ceil(filteredJudicial.length / judicialRowsPerPage);
  const handleJudicialPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalJudicialPages) setJudicialCurrentPage(newPage);
  };

  const handleConsult = async (doc) => {
    try {
      const id = doc.id || doc.documentId;
      let response;
      if (doc.documentType === 'EntiteDJ') response = await axios.get(`/api/acteursjudiciaires/${id}`);
      else if (doc.documentType === 'Administratif') response = await axios.get(`/api/courriers/${id}`);
      else response = await axios.get(`/api/acteursjudiciaires/${id}`);
      setCurrentDocument(response.data);
      setShowDocModal(true);
    } catch (err) {
      alert(t('impossible_charger') + ' : ' + (err.response?.data || err.message));
    }
  };

  const handleCancelOutgoing = async (id) => {
    if (window.confirm(t('confirmation_annuler'))) {
      await axios.post(`/api/transactions/${id}/cancel`);
      fetchData();
    }
  };

  const handleHide = (id) => {
    if (window.confirm(t('confirmation_masquer'))) {
      const newHidden = [...hiddenIds, id];
      setHiddenIds(newHidden);
      localStorage.setItem('hiddenDashboardTransactions', JSON.stringify(newHidden));
    }
  };

  const handleMarkReturned = async (id) => {
    if (window.confirm(t('confirmation_retour'))) {
      await axios.post(`/api/transactions/${id}/mark-returned`);
      fetchData();
    }
  };

  const handleIncomingRespond = async (id, accepte) => {
    const message = incomingReply[id] || '';
    try {
      await axios.post(`/api/transactions/${id}/respond`, { accepte, message });
      setIncoming(prev => prev.filter(n => n.id !== id));
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || t('erreur_reponse'));
    }
  };

  const stats = {
    pending: pending.length,
    accepted: completed.filter(tx => isAccepted(tx.statut)).length,
    rejected: completed.filter(tx => isRejected(tx.statut)).length,
    cancelled: completed.filter(tx => isCancelled(tx.statut)).length,
  };

  if (loading) return <div className="loading">{t('chargement')}</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>{t('dashboard')}</h1>
        <p>{t('dashboard_subtitle')}</p>
      </div>

      <div className="quick-link-card" onClick={() => navigate('/mes-entites')}>
        <div className="quick-link-icon">📄</div>
        <div className="quick-link-info">
          <div className="quick-link-label">{t('mes_entites')}</div>
          <div className="quick-link-description">{t('quick_link_desc')}</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card pending"><div className="stat-label">{t('en_attente')}</div><div className="stat-value">{stats.pending}</div></div>
        <div className="stat-card accepted"><div className="stat-label">{t('acceptees')}</div><div className="stat-value">{stats.accepted}</div></div>
        <div className="stat-card rejected"><div className="stat-label">{t('refusees')}</div><div className="stat-value">{stats.rejected}</div></div>
        <div className="stat-card cancelled"><div className="stat-label">{t('annulees')}</div><div className="stat-value">{stats.cancelled}</div></div>
      </div>

      {/* Judicial files table */}
      <div className="section-title"><span>{t('dossiers_judiciaires')}</span></div>
      <div className="filters" style={{ justifyContent: 'space-between' }}>
        <input type="text" placeholder={t('rechercher_judiciaire')} value={judicialSearch} onChange={(e) => setJudicialSearch(e.target.value)} style={{ width: '250px' }} />
        <div className="rows-per-page">
          <span>{t('afficher')}</span>
          <select value={judicialRowsPerPage} onChange={(e) => { setJudicialRowsPerPage(Number(e.target.value)); setJudicialCurrentPage(1); }}>
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
              <th>{t('tribunal_source')}</th>
              <th>{t('numero_dossier')}</th>
              <th>{t('date')}</th>
              <th>{t('etat')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {currentJudicial.length === 0 ? (
              <tr><td colSpan="6">{t('aucun_dossier_judiciaire')}</td></tr>
            ) : (
              currentJudicial.map(doc => (
                <tr key={doc.id}>
                  <td>{doc.sujet || '-'}</td>
                  <td>{doc.tribunalSource || '-'}</td>
                  <td>{doc.numeroDossier || '-'}</td>
                  <td>{formatDate(doc.date, locale)}</td>
                  <td>{formatEtat(doc.etatArchive)}</td>
                  <td className="action-icons">
                    <button className="btn-primary" onClick={() => handleConsult(doc)}>{t('consulter')}</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {totalJudicialPages > 1 && (
          <div className="pagination">
            <button onClick={() => handleJudicialPageChange(judicialCurrentPage - 1)} disabled={judicialCurrentPage === 1}>{t('precedent')}</button>
            <span>{t('page')} {judicialCurrentPage} / {totalJudicialPages}</span>
            <button onClick={() => handleJudicialPageChange(judicialCurrentPage + 1)} disabled={judicialCurrentPage === totalJudicialPages}>{t('suivant')}</button>
          </div>
        )}
      </div>

      {/* ========== CLICKABLE CARDS ========== */}

      {/* Incoming notifications card */}
      <div className="dashboard-section-card" onClick={() => setShowNotificationsModal(true)}>
        <div className="section-title-text"><span>🔔</span> {t('notifications')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="section-badge">{incoming.length}</span>
          <span className="arrow-icon">→</span>
        </div>
      </div>

      {/* Outgoing pending modal */}
      <div className="dashboard-section-card" onClick={() => setShowPendingModal(true)}>
        <div className="section-title-text"><span>⏳</span> {t('demandes_attente')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><span className="section-badge">{pending.length}</span><span className="arrow-icon">→</span></div>
      </div>

      {/* Completed modal */}
      <div className="dashboard-section-card" onClick={() => setShowCompletedModal(true)}>
        <div className="section-title-text"><span>✅</span> {t('transactions_traitees')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><span className="section-badge">{completed.length}</span><span className="arrow-icon">→</span></div>
      </div>

      {/* Pending returns modal */}
      <div className="dashboard-section-card" onClick={() => setShowReturnsModal(true)}>
        <div className="section-title-text"><span>🔄</span> {t('documents_retourner')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><span className="section-badge">{pendingReturns.length}</span><span className="arrow-icon">→</span></div>
      </div>

      {/* ---------- MODALS ---------- */}

      {/* Notifications modal (incoming requests) */}
      {showNotificationsModal && (
        <div className="modal-overlay" onClick={() => setShowNotificationsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('notifications')}</h3>
              <button className="btn-secondary" onClick={() => setShowNotificationsModal(false)}>{t('fermer')}</button>
            </div>
            {incoming.length === 0 ? (
              <p className="text-muted">{t('aucune_notification')}</p>
            ) : (
              <div className="notifications-list">
                {incoming.map(n => (
                  <div key={n.id} className="notification-card">
                    <div className="notification-header">
                      <div className="notification-header-left">
                        <span className="notification-title">{n.documentSujet}</span>
                      </div>
                      <span className="notification-badge">{t('en_attente')}</span>
                    </div>
                    <div className="notification-identifiers">
                      {n.numeroCourrier && <span className="identifier-tag">📨 {n.numeroCourrier}</span>}
                      {n.numeroDossierJudiciaire && <span className="identifier-tag">⚖️ {n.numeroDossierJudiciaire}</span>}
                    </div>
                    <div className="notification-details">
                      <div className="detail-row"><span className="detail-label">{t('de')} :</span> <span>{n.sourceServiceNom}</span></div>
                      {n.message && <div className="detail-row"><span className="detail-label">{t('message')} :</span> <span>{n.message}</span></div>}
                    </div>
                    <textarea
                      className="response-textarea"
                      placeholder={t('votre_reponse')}
                      value={incomingReply[n.id] || ''}
                      onChange={e => setIncomingReply({ ...incomingReply, [n.id]: e.target.value })}
                      rows="2"
                    />
                    <div className="notification-actions">
                      <button className="btn-primary" onClick={() => handleIncomingRespond(n.id, true)}>{t('accepter')}</button>
                      <button className="btn-secondary" onClick={() => handleIncomingRespond(n.id, false)}>{t('refuser')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Outgoing pending modal (unchanged) */}
      {showPendingModal && (
        <div className="modal-overlay" onClick={() => setShowPendingModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('demandes_attente')}</h3>
              <button className="btn-secondary" onClick={() => setShowPendingModal(false)}>{t('fermer')}</button>
            </div>
            <div className="transaction-list">
              {pending.length === 0 ? <p className="text-muted">{t('aucune_demande')}</p> : pending.map(tx => (
                <TransactionItem key={tx.id} tx={tx} badge={t('en_attente')} locale={locale} t={t}
                  actions={[
                    <button key="consult" onClick={() => handleConsult({ id: tx.documentId, documentType: tx.documentType })}>{t('consulter')}</button>,
                    <button key="cancel" onClick={() => handleCancelOutgoing(tx.id)}>{t('annuler')}</button>
                  ]}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Completed modal (unchanged) */}
      {showCompletedModal && (
        <div className="modal-overlay" onClick={() => setShowCompletedModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('transactions_traitees')}</h3>
              <button className="btn-secondary" onClick={() => setShowCompletedModal(false)}>{t('fermer')}</button>
            </div>
            <div className="transaction-list">
              {completed.length === 0 ? <p className="text-muted">{t('aucune_transaction')}</p> : completed.map(tx => (
                <TransactionItem key={tx.id} tx={tx} badge={translateStatus(tx.statut, t)} locale={locale} t={t}
                  note={tx.messageReponse || t('non_renseigne')} date={tx.dateReponse} dateLabel={t('traite_le')}
                  actions={[
                    <button key="consult" onClick={() => handleConsult({ id: tx.documentId, documentType: tx.documentType })}>{t('consulter')}</button>,
                    <button key="hide" onClick={() => handleHide(tx.id)}>{t('masquer')}</button>
                  ]}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pending returns modal (unchanged) */}
      {showReturnsModal && (
        <div className="modal-overlay" onClick={() => setShowReturnsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('documents_retourner')}</h3>
              <button className="btn-secondary" onClick={() => setShowReturnsModal(false)}>{t('fermer')}</button>
            </div>
            <div className="transaction-list">
              {pendingReturns.length === 0 ? <p className="text-muted">{t('aucun_document_retour')}</p> : pendingReturns.map(tx => (
                <TransactionItem key={tx.id} tx={tx} badge={t('en_attente_retour')} locale={locale} t={t}
                  actions={[
                    <button key="consult" onClick={() => handleConsult({ id: tx.documentId, documentType: tx.documentType })}>{t('consulter')}</button>,
                    <button key="return" onClick={() => handleMarkReturned(tx.id)}>{t('marquer_retourne')}</button>
                  ]}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {showDocModal && <DocumentModal document={currentDocument} onClose={() => setShowDocModal(false)} />}
    </div>
  );
}

function TransactionItem({ tx, badge, locale, t, actions, note, date, dateLabel }) {
  return (
    <div className="transaction-item">
      <div className="transaction-header"><span className="transaction-title">{tx.documentSujet}</span><span className="transaction-badge">{badge}</span></div>
      <div className="transaction-details">
        <span>{t('service_destinataire')} : {tx.destinationServiceNom}</span>
        <span>{note ? `${t('note')} : ${note}` : `${t('message')} : ${tx.message || t('non_renseigne')}`}</span>
        <span>{dateLabel || t('envoye_le')} : {formatDate(date || tx.dateEnvoi, locale)}</span>
      </div>
      <div className="transaction-actions">{actions}</div>
    </div>
  );
}

function formatDate(value, locale) { if (!value) return '-'; return new Date(value).toLocaleDateString(locale); }
function formatEtat(etat) { if (etat === "En cours") return "قيد المعالجة"; if (etat === "Traite") return "تمت المعالجة"; if (etat === "Archive") return "مؤرشف"; return "جديد"; }
function normalizeStatus(value) { return String(value || '').toLowerCase(); }
function isPending(value) { return normalizeStatus(value).includes('attente'); }
function isAccepted(value) { return normalizeStatus(value).includes('accept'); }
function isRejected(value) { return normalizeStatus(value).includes('refus'); }
function isCancelled(value) { return normalizeStatus(value).includes('annul'); }
function translateStatus(value, t) {
  if (isAccepted(value)) return t('acceptees');
  if (isRejected(value)) return t('refusees');
  if (isCancelled(value)) return t('annulees');
  if (isPending(value)) return t('en_attente');
  return value || '-';
}

export default Dashboard;