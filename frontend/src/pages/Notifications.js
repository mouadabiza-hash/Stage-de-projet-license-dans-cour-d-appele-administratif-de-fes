import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function Notifications() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [responseMsg, setResponseMsg] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/transactions/incoming');
      setNotifications(res.data);
      setError('');
      setSelectedIds([]);
      setSelectAll(false);
    } catch (err) {
      setError(t('erreur_chargement'));
    } finally { setLoading(false); }
  };

  const handleSelectAll = () => {
    if (selectAll) { setSelectedIds([]); }
    else { setSelectedIds(notifications.map(n => n.id)); }
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
    for (let id of selectedIds) {
      const msg = responseMsg[id] || '';
      try {
        await axios.post(`/api/transactions/${id}/respond`, { accepte, message: msg });
        ok++;
      } catch (err) { fail++; }
    }
    const actionLabel = accepte ? t('acceptees') : t('refusees');
    alert(`${ok} ${actionLabel}${fail > 0 ? ` (${fail} échecs)` : ''}`);
    setBulkLoading(false);
    fetchNotifications();
  };

  if (loading) return <div className="loading">{t('chargement')}</div>;

  return (
    <div className="page-container">
      <h1 className="page-title">{t('notifications')}</h1>
      {error && <div className="error-message">{error}</div>}

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-count">{selectedIds.length} {t('selected')}</span>
          <button className="btn-primary bulk-btn" onClick={() => handleBulkRespond(true)} disabled={bulkLoading}>
            {t('accepter')} ({selectedIds.length})
          </button>
          <button className="btn-secondary bulk-btn" onClick={() => handleBulkRespond(false)} disabled={bulkLoading}>
            {t('refuser')} ({selectedIds.length})
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <p className="text-muted">{t('aucune_notification')}</p>
      ) : (
        <>
          <div className="select-all-row">
            <label className="checkbox-field">
              <input type="checkbox" checked={selectAll} onChange={handleSelectAll} />
              {t('select_all') || 'Tout sélectionner'}
            </label>
          </div>

          <div className="notifications-list">
            {notifications.map(n => (
              <div key={n.id} className="notification-card">
                <div className="notification-header">
                  <div className="notification-header-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(n.id)}
                      onChange={() => handleSelectOne(n.id)}
                      className="notification-checkbox"
                    />
                    <span className="notification-title">{n.documentSujet}</span>
                  </div>
                  <span className="notification-badge">{t('en_attente')}</span>
                </div>

                {/* Extra identifiers row */}
                <div className="notification-identifiers">
                  {n.numeroCourrier && (
                    <span className="identifier-tag">
                      📨 {n.numeroCourrier}
                    </span>
                  )}
                  {n.numeroDossierJudiciaire && (
                    <span className="identifier-tag">
                       {n.numeroDossierJudiciaire}
                    </span>
                  )}
                </div>

                <div className="notification-details">
                  <div className="detail-row">
                    <span className="detail-label">{t('de')} :</span>
                    <span>{n.sourceServiceNom}</span>
                  </div>
                  {n.message && (
                    <div className="detail-row">
                      <span className="detail-label">{t('message')} :</span>
                      <span>{n.message}</span>
                    </div>
                  )}
                </div>

                <textarea
                  className="response-textarea"
                  placeholder={t('votre_reponse')}
                  value={responseMsg[n.id] || ''}
                  onChange={e => setResponseMsg({ ...responseMsg, [n.id]: e.target.value })}
                  rows="2"
                />

                <div className="notification-actions">
                  <button className="btn-primary" onClick={() => handleRespond(n.id, true)}>
                    {t('accepter')}
                  </button>
                  <button className="btn-secondary" onClick={() => handleRespond(n.id, false)}>
                    {t('refuser')}
                  </button>
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