import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DocumentModal from '../components/DocumentModal';

function Dashboard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
  const navigate = useNavigate();

  const [pending, setPending] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [pendingReturns, setPendingReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hiddenIds, setHiddenIds] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [currentDocument, setCurrentDocument] = useState(null);

  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);

  const [allJudicial, setAllJudicial] = useState([]);
  const [filteredJudicial, setFilteredJudicial] = useState([]);
  const [judicialSearch, setJudicialSearch] = useState('');
  const [judicialRowsPerPage, setJudicialRowsPerPage] = useState(5);
  const [judicialCurrentPage, setJudicialCurrentPage] = useState(1);

  useEffect(() => {
    const stored = localStorage.getItem('hiddenDashboardTransactions');
    if (stored) setHiddenIds(JSON.parse(stored));
  }, []);

  useEffect(() => {
    fetchData();
  }, [hiddenIds]);

  const fetchData = async () => {
    try {
      const [outgoingRes, returnsRes, judicialRes] = await Promise.all([
        axios.get('/api/transactions/outgoing'),
        axios.get('/api/transactions/pending-returns'),
        axios.get('/api/acteursjudiciaires')
      ]);
      const filtered = outgoingRes.data.filter(tx => !hiddenIds.includes(tx.id));
      setPending(filtered.filter(tx => isPending(tx.statut)));
      setCompleted(filtered.filter(tx => isAccepted(tx.statut) || isRejected(tx.statut)));
      setPendingReturns(returnsRes.data);
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
      const filtered = allJudicial.filter(doc =>
        (doc.sujet && doc.sujet.toLowerCase().includes(term)) ||
        (doc.tribunalSource && doc.tribunalSource.toLowerCase().includes(term)) ||
        (doc.numeroDossier && doc.numeroDossier.toLowerCase().includes(term))
      );
      setFilteredJudicial(filtered);
    }
    setJudicialCurrentPage(1);
  }, [judicialSearch, allJudicial]);

  const indexOfLast = judicialCurrentPage * judicialRowsPerPage;
  const indexOfFirst = indexOfLast - judicialRowsPerPage;
  const currentJudicial = filteredJudicial.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredJudicial.length / judicialRowsPerPage);

  const handleJudicialPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setJudicialCurrentPage(newPage);
  };

  // Fonction de consultation universelle et robuste
const handleConsult = async (doc) => {
  try {
    let response;
    const id = doc.id || doc.documentId;
    if (doc.documentType === 'EntiteDJ') {
      response = await axios.get(`/api/acteursjudiciaires/${id}`);
    } else if (doc.documentType === 'Administratif') {
      response = await axios.get(`/api/courriers/${id}`);
    } else {
      // fallback to the generic documents endpoint (works after fixing DocumentsController)
      response = await axios.get(`/api/documents/${id}?type=Judiciaire`);
    }
    setCurrentDocument(response.data);
    setShowDocModal(true);
  } catch (err) {
    alert(t('impossible_charger') + ' : ' + (err.response?.data || err.message));
  }
};

  const handleCancel = async (id) => {
    if (window.confirm(t('confirmation_annuler'))) {
      try {
        await axios.post(`/api/transactions/${id}/cancel`);
        fetchData();
      } catch (err) {
        alert(err.response?.data || t('erreur'));
      }
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
      try {
        await axios.post(`/api/transactions/${id}/mark-returned`);
        fetchData();
      } catch (err) {
        alert(err.response?.data || t('erreur'));
      }
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

  const ModalList = ({ isOpen, onClose, title, items, renderItem, emptyMessage }) => (
    isOpen && (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="registry-panel-header">
            <h3>{title}</h3>
            <button className="btn-secondary" onClick={onClose}>{t('fermer')}</button>
          </div>
          <div className="transaction-list">
            {items.length === 0 ? <p className="text-muted">{emptyMessage}</p> : items.map(renderItem)}
          </div>
        </div>
      </div>
    )
  );

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

      <div className="section-title"><span>{t('dossiers_judiciaires')}</span></div>
      <div className="filters" style={{ justifyContent: 'space-between' }}>
        <input type="text" placeholder={t('rechercher_judiciaire')} value={judicialSearch} onChange={(e) => setJudicialSearch(e.target.value)} style={{ width: '250px' }} />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span>{t('afficher')}</span>
          <select value={judicialRowsPerPage} onChange={(e) => { setJudicialRowsPerPage(Number(e.target.value)); setJudicialCurrentPage(1); }}>
            <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option>
          </select>
          <span>{t('lignes')}</span>
        </div>
      </div>
      <div className="data-table-wrapper">
        <table className="modern-table">
          <thead><tr><th>{t('titre')}</th><th>{t('tribunal_source')}</th><th>{t('numero_dossier')}</th><th>{t('date')}</th><th>{t('etat')}</th><th>{t('actions')}</th></tr></thead>
          <tbody>
            {currentJudicial.length === 0 ? <tr><td colSpan="6">{t('aucun_dossier_judiciaire')}</td></tr> :
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
              ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button onClick={() => handleJudicialPageChange(judicialCurrentPage - 1)} disabled={judicialCurrentPage === 1}>{t('precedent')}</button>
          <span>{t('page')} {judicialCurrentPage} \/ {totalPages}</span>
          <button onClick={() => handleJudicialPageChange(judicialCurrentPage + 1)} disabled={judicialCurrentPage === totalPages}>{t('suivant')}</button>
        </div>
      )}

      <div className="dashboard-section-card" onClick={() => setShowPendingModal(true)}>
        <div className="section-title-text"><span>⏳</span> {t('demandes_attente')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><span className="section-badge">{pending.length}</span><span className="arrow-icon">→</span></div>
      </div>
      <div className="dashboard-section-card" onClick={() => setShowCompletedModal(true)}>
        <div className="section-title-text"><span>✅</span> {t('transactions_traitees')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><span className="section-badge">{completed.length}</span><span className="arrow-icon">→</span></div>
      </div>
      <div className="dashboard-section-card" onClick={() => setShowReturnsModal(true)}>
        <div className="section-title-text"><span>🔄</span> {t('documents_retourner')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><span className="section-badge">{pendingReturns.length}</span><span className="arrow-icon">→</span></div>
      </div>

      <ModalList isOpen={showPendingModal} onClose={() => setShowPendingModal(false)} title={t('demandes_attente')} items={pending}
        renderItem={(tx) => (
          <TransactionItem key={tx.id} tx={tx} badge={t('en_attente')} locale={locale} t={t}
            actions={[
              <button key="consult" className="action-link view" onClick={() => handleConsult({ id: tx.documentId, documentType: tx.documentType })}>{t('consulter')}</button>,
              <button key="cancel" className="action-link cancel" onClick={() => handleCancel(tx.id)}>{t('annuler')}</button>
            ]}
          />
        )}
        emptyMessage={t('aucune_demande')}
      />

      <ModalList isOpen={showCompletedModal} onClose={() => setShowCompletedModal(false)} title={t('transactions_traitees')} items={completed}
        renderItem={(tx) => (
          <TransactionItem key={tx.id} tx={tx} badge={translateStatus(tx.statut, t)} locale={locale} t={t}
            note={tx.messageReponse || t('non_renseigne')} date={tx.dateReponse} dateLabel={t('traite_le')}
            actions={[
              <button key="consult" className="action-link view" onClick={() => handleConsult({ id: tx.documentId, documentType: tx.documentType })}>{t('consulter')}</button>,
              <button key="hide" className="action-link hide" onClick={() => handleHide(tx.id)}>{t('masquer')}</button>
            ]}
          />
        )}
        emptyMessage={t('aucune_transaction')}
      />

      <ModalList isOpen={showReturnsModal} onClose={() => setShowReturnsModal(false)} title={t('documents_retourner')} items={pendingReturns}
        renderItem={(tx) => (
          <TransactionItem key={tx.id} tx={tx} badge={t('en_attente_retour')} locale={locale} t={t}
            actions={[
              <button key="consult" className="action-link view" onClick={() => handleConsult({ id: tx.documentId, documentType: tx.documentType })}>{t('consulter')}</button>,
              <button key="return" className="action-link accept" onClick={() => handleMarkReturned(tx.id)}>{t('marquer_retourne')}</button>
            ]}
          />
        )}
        emptyMessage={t('aucun_document_retour')}
      />

      {showDocModal && <DocumentModal document={currentDocument} onClose={() => setShowDocModal(false)} />}
    </div>
  );
}

// Composants utilitaires inchangés
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