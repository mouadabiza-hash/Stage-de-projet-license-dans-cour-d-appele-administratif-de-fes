import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function Notifications() {
  const { t } = useTranslation();
  const [notifications, setNotifications]   = useState([]);
  const [responseMsg, setResponseMsg]       = useState({});
  const [selectedIds, setSelectedIds]       = useState([]);
  const [selectAll, setSelectAll]           = useState(false);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [bulkLoading, setBulkLoading]       = useState(false);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/transactions/incoming');
      setNotifications(res.data);
      setError('');
      setSelectedIds([]);
      setSelectAll(false);
    } catch {
      setError(t('erreur_chargement'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) setSelectedIds([]);
    else setSelectedIds(notifications.map(n => n.id));
    setSelectAll(!selectAll);
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleRespond = async (id, accepte) => {
    const msg = responseMsg[id] || '';
    try {
      await axios.post(`/api/transactions/${id}/respond`, { accepte, message: msg });
      setNotifications(prev => prev.filter(n => n.id !== id));
      setSelectedIds(prev => prev.filter(i => i !== id));
    } catch (err) {
      setError(err.response?.data?.message || t('erreur_reponse'));
    }
  };

  const handleBulkRespond = async (accepte) => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    setError('');
    let ok = 0, fail = 0;
    for (const id of selectedIds) {
      const msg = responseMsg[id] || '';
      try {
        await axios.post(`/api/transactions/${id}/respond`, { accepte, message: msg });
        ok++;
      } catch { fail++; }
    }
    const label = accepte ? t('acceptees') : t('refusees');
    alert(`${ok} ${label}${fail > 0 ? ` (${fail} ${t('echecs')})` : ''}`);
    setBulkLoading(false);
    fetchNotifications();
  };

  if (loading) return <div className="loading">{t('chargement')}</div>;

  return (
    <div className="page-container">

      {/* ── Header ── */}
      <div className="notif-page-header">
        <h1 className="page-title">{t('notifications')}</h1>
        {notifications.length > 0 && (
          <span className="notif-count-badge">
            {notifications.length} {t('en_attente')}
          </span>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* ── Bulk action bar ── */}
      {selectedIds.length > 0 && (
        <div className="notif-bulk-bar">
          <span className="notif-bulk-count">
            {selectedIds.length} {t('selected')}
          </span>
          <div className="notif-bulk-spacer" />
          <button
            className="notif-btn notif-btn-accept"
            onClick={() => handleBulkRespond(true)}
            disabled={bulkLoading}
          >
            ✓ {t('accepter')} ({selectedIds.length})
          </button>
          <button
            className="notif-btn notif-btn-reject"
            onClick={() => handleBulkRespond(false)}
            disabled={bulkLoading}
          >
            ✕ {t('refuser')} ({selectedIds.length})
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <p className="text-muted">{t('aucune_notification')}</p>
      ) : (
        <>
          {/* ── Select-all ── */}
          <label className="notif-select-all">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={handleSelectAll}
            />
            {t('select_all') || 'Tout sélectionner'}
          </label>

          {/* ── Notification list ── */}
          <div className="notif-list">
            {notifications.map(n => (
              <div key={n.id} className="notif-card">

                {/* Coloured left accent */}
                <div className="notif-card-accent" />

                <div className="notif-card-body">

                  {/* Row 1 — checkbox / subject / badge */}
                  <div className="notif-row-top">
                    <input
                      type="checkbox"
                      className="notif-cb"
                      checked={selectedIds.includes(n.id)}
                      onChange={() => handleSelectOne(n.id)}
                    />
                    <span className="notif-subject">{n.documentSujet}</span>
                    <span className="notif-badge notif-badge-pending">
                      {t('en_attente')}
                    </span>
                  </div>

                  {/* Row 2 — identifier tags */}
                  {(n.numeroCourrier || n.numeroDossierJudiciaire) && (
                    <div className="notif-tags">
                      {n.numeroCourrier && (
                        <span className="notif-tag">
                          <span className="notif-tag-icon">✉</span>
                          {n.numeroCourrier}
                        </span>
                      )}
                      {n.numeroDossierJudiciaire && (
                        <span className="notif-tag">
                          <span className="notif-tag-icon">⚖</span>
                          {n.numeroDossierJudiciaire}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Row 3 — detail block */}
                  <div className="notif-details">
                    <div className="notif-detail-row">
                      <span className="notif-detail-lbl">{t('de')} :</span>
                      <span className="notif-detail-val">{n.sourceServiceNom}</span>
                    </div>
                    {n.message && (
                      <div className="notif-detail-row">
                        <span className="notif-detail-lbl">{t('message')} :</span>
                        <span className="notif-detail-val">{n.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Row 4 — reply textarea */}
                  <textarea
                    className="notif-textarea"
                    placeholder={t('votre_reponse')}
                    value={responseMsg[n.id] || ''}
                    onChange={e =>
                      setResponseMsg({ ...responseMsg, [n.id]: e.target.value })
                    }
                    rows={2}
                  />

                  {/* Row 5 — action buttons */}
                  <div className="notif-actions">
                    <button
                      className="notif-btn notif-btn-accept"
                      onClick={() => handleRespond(n.id, true)}
                    >
                      ✓ {t('accepter')}
                    </button>
                    <button
                      className="notif-btn notif-btn-reject"
                      onClick={() => handleRespond(n.id, false)}
                    >
                      ✕ {t('refuser')}
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Notifications;