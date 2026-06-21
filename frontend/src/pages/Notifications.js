import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useModal } from '../context/ModalContext';

function Notifications() {
  const { t } = useTranslation();
  const { showAlert } = useModal();
  const [notifications, setNotifications] = useState([]);
  const [responseMsg, setResponseMsg] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedSubIds, setSelectedSubIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectAllSub, setSelectAllSub] = useState(false);
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
      setSelectedSubIds([]);
      setSelectAll(false);
      setSelectAllSub(false);
    } catch {
      setError(t('erreur_chargement'));
    } finally {
      setLoading(false);
    }
  };

  const ownNotifs = notifications.filter(n => !n.isSubstitute);
  const subNotifs = notifications.filter(n => n.isSubstitute);

  const handleSelectAllOwn = () => {
    if (selectAll) setSelectedIds([]);
    else setSelectedIds(ownNotifs.map(n => n.id));
    setSelectAll(!selectAll);
  };

  const handleSelectAllSub = () => {
    if (selectAllSub) setSelectedSubIds([]);
    else setSelectedSubIds(subNotifs.map(n => n.id));
    setSelectAllSub(!selectAllSub);
  };

  const handleSelectOwn = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
    setSelectAll(false);
  };

  const handleSelectSub = (id) => {
    setSelectedSubIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
    setSelectAllSub(false);
  };

  const handleRespond = async (id, accepte, isSub) => {
    const msg = responseMsg[id] || '';
    try {
      await axios.post(`/api/transactions/${id}/respond`, { accepte, message: msg });
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (isSub) {
        setSelectedSubIds(prev => prev.filter(i => i !== id));
      } else {
        setSelectedIds(prev => prev.filter(i => i !== id));
      }
    } catch (err) {
      setError(err.response?.data?.message || t('erreur_reponse'));
    }
  };

  const handleBulkRespond = async (accepte, isSub) => {
    const ids = isSub ? selectedSubIds : selectedIds;
    if (ids.length === 0) return;
    setBulkLoading(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      const msg = responseMsg[id] || '';
      try {
        await axios.post(`/api/transactions/${id}/respond`, { accepte, message: msg });
        ok++;
      } catch { fail++; }
    }
    const label = accepte ? t('acceptees') : t('refusees');
    showAlert(`${ok} ${label}${fail > 0 ? ` (${fail} ${t('echecs')})` : ''}`, accepte ? t('succes') : t('attention'));
    setBulkLoading(false);
    fetchNotifications();
  };

  if (loading) return <div className="loading">{t('chargement')}</div>;

  return (
    <div className="page-container">

      {/* Header */}
      <div className="notif-page-header">
        <h1 className="page-title">{t('notifications')}</h1>
        {notifications.length > 0 && (
          <span className="notif-count-badge">
            {notifications.length} {t('en_attente')}
          </span>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* ===== MES NOTIFICATIONS ===== */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>
          {t('mes_notifications')} ({ownNotifs.length})
        </h2>

        {selectedIds.length > 0 && (
          <div className="notif-bulk-bar">
            <span className="notif-bulk-count">{selectedIds.length} {t('selected')}</span>
            <div className="notif-bulk-spacer" />
            <button className="notif-btn notif-btn-accept" onClick={() => handleBulkRespond(true, false)} disabled={bulkLoading}>
              ✓ {t('accepter')} ({selectedIds.length})
            </button>
            <button className="notif-btn notif-btn-reject" onClick={() => handleBulkRespond(false, false)} disabled={bulkLoading}>
              ✕ {t('refuser')} ({selectedIds.length})
            </button>
          </div>
        )}

        {ownNotifs.length === 0 ? (
          <p className="text-muted">{t('aucune_notification')}</p>
        ) : (
          <>
            <label className="notif-select-all">
              <input type="checkbox" checked={selectAll} onChange={handleSelectAllOwn} />
              {t('select_all') || 'Tout sélectionner'}
            </label>

            <div className="notif-list">
              {ownNotifs.map(n => (
                <div key={n.id} className="notif-card">
                  <div className="notif-card-accent" />
                  <div className="notif-card-body">
                    <div className="notif-row-top">
                      <input type="checkbox" className="notif-cb" checked={selectedIds.includes(n.id)} onChange={() => handleSelectOwn(n.id)} />
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
                    <textarea
                      className="notif-textarea"
                      placeholder={t('votre_reponse')}
                      value={responseMsg[n.id] || ''}
                      onChange={e => setResponseMsg({ ...responseMsg, [n.id]: e.target.value })}
                      rows={2}
                    />
                    <div className="notif-actions">
                      <button className="notif-btn notif-btn-accept" onClick={() => handleRespond(n.id, true, false)}>
                        ✓ {t('accepter')}
                      </button>
                      <button className="notif-btn notif-btn-reject" onClick={() => handleRespond(n.id, false, false)}>
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

      {/* ===== NOTIFICATIONS DE SUBSTITUTION (only if any) ===== */}
      {subNotifs.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>
            {t('notifications_substitution')} ({subNotifs.length})
          </h2>

          {selectedSubIds.length > 0 && (
            <div className="notif-bulk-bar">
              <span className="notif-bulk-count">{selectedSubIds.length} {t('selected')}</span>
              <div className="notif-bulk-spacer" />
              <button className="notif-btn notif-btn-accept" onClick={() => handleBulkRespond(true, true)} disabled={bulkLoading}>
                ✓ {t('accepter')} ({selectedSubIds.length})
              </button>
              <button className="notif-btn notif-btn-reject" onClick={() => handleBulkRespond(false, true)} disabled={bulkLoading}>
                ✕ {t('refuser')} ({selectedSubIds.length})
              </button>
            </div>
          )}

          <>
            <label className="notif-select-all">
              <input type="checkbox" checked={selectAllSub} onChange={handleSelectAllSub} />
              {t('select_all') || 'Tout sélectionner'}
            </label>

            <div className="notif-list">
              {subNotifs.map(n => (
                <div key={n.id} className="notif-card">
                  <div className="notif-card-accent" />
                  <div className="notif-card-body">
                    <div className="notif-row-top">
                      <input type="checkbox" className="notif-cb" checked={selectedSubIds.includes(n.id)} onChange={() => handleSelectSub(n.id)} />
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
                    <textarea
                      className="notif-textarea"
                      placeholder={t('votre_reponse')}
                      value={responseMsg[n.id] || ''}
                      onChange={e => setResponseMsg({ ...responseMsg, [n.id]: e.target.value })}
                      rows={2}
                    />
                    <div className="notif-actions">
                      <button className="notif-btn notif-btn-accept" onClick={() => handleRespond(n.id, true, true)}>
                        ✓ {t('accepter')}
                      </button>
                      <button className="notif-btn notif-btn-reject" onClick={() => handleRespond(n.id, false, true)}>
                        ✕ {t('refuser')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        </div>
      )}
    </div>
  );
}

export default Notifications;