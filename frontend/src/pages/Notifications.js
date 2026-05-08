import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function Notifications() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [responseMsg, setResponseMsg] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/transactions/incoming');
      setNotifications(res.data);
    } catch (err) {
      setError(t('erreur_chargement'));
    } finally { setLoading(false); }
  };

  const handleRespond = async (id, accepte) => {
    const message = responseMsg[id] || '';
    try {
      await axios.post(`/api/transactions/${id}/respond`, { accepte, message });
      setNotifications(prev => prev.filter(n => n.id !== id));
      alert(accepte ? t('acceptees') : t('refusees'));
    } catch (err) {
      setError(err.response?.data?.message || t('erreur_reponse'));
    }
  };

  if (loading) return <div className="loading">{t('chargement')}</div>;
  return (
    <div className="page-container">
      <h1 className="page-title">{t('notifications')}</h1>
      {error && <div className="error-message">{error}</div>}
      {notifications.length === 0 ? <p className="text-muted">{t('aucune_notification')}</p> : (
        <div className="notifications-list">
          {notifications.map(n => (
            <div key={n.id} className="notification-card">
              <div className="notification-header"><span className="notification-title">{n.documentSujet}</span><span className="notification-badge">{t('en_attente')}</span></div>
              <div className="notification-details"><div><span>{t('de')} :</span> <span>{n.sourceServiceNom}</span></div><div><span>{t('message')} :</span> <span>{n.message || t('non_renseigne')}</span></div></div>
              <textarea className="response-textarea" placeholder={t('votre_reponse')} value={responseMsg[n.id] || ''} onChange={e => setResponseMsg({ ...responseMsg, [n.id]: e.target.value })} rows="2" />
              <div className="notification-actions"><button className="btn-primary" onClick={() => handleRespond(n.id, true)}>{t('accepter')}</button><button className="btn-secondary" onClick={() => handleRespond(n.id, false)}>{t('refuser')}</button></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default Notifications;