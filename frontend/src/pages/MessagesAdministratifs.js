import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function MessagesAdministratifs() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
  const [messages, setMessages] = useState([]);
  const [motCle, setMotCle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = setTimeout(fetchMessages, 250);
    return () => clearTimeout(timeout);
  }, [motCle]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const url = motCle.trim() ? `/api/courriers/search?motCle=${encodeURIComponent(motCle.trim())}` : '/api/courriers';
      const res = await axios.get(url);
      setMessages(res.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, t('erreur_chargement_messages_admin')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{t('messages_administratifs')}</h1>
      {error && <div className="error-message">{error}</div>}
      <div className="filters">
        <input type="text" value={motCle} onChange={e => setMotCle(e.target.value)} placeholder={t('rechercher_par_mot')} />
        <button className="btn-secondary" onClick={() => setMotCle('')}>{t('reinitialiser')}</button>
      </div>
      <div className="data-table-wrapper">
        <table className="modern-table">
          <thead><tr><th>{t('numero_bureau_ordre')}</th><th>{t('date')}</th><th>{t('source')}</th><th>{t('objet')}</th><th>{t('direction')}</th><th>{t('destinataire')}</th><th>{t('service')}</th><th>{t('etat')}</th><th>{t('observation')}</th><th>PDF</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="10">{t('chargement')}</td></tr>}
            {!loading && messages.length === 0 && <tr><td colSpan="10">{t('aucun_message_admin')}</td></tr>}
            {messages.map(item => (
              <tr key={item.id}>
                <td>{item.idBureauOrdre || '-'}</td><td>{formatDate(item.date, locale)}</td><td>{item.source || '-'}</td>
                <td>{item.sujet || '-'}</td><td>{item.direction || '-'}</td><td>{item.destinataire || '-'}</td>
                <td>{item.serviceNom || item.idService || '-'}</td><td>{item.etat || '-'}</td><td>{item.description || '-'}</td>
                <td>{item.lienPdf ? <a href={item.lienPdf} target="_blank" rel="noreferrer">PDF</a> : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function formatDate(v, l) { return v ? new Date(v).toLocaleDateString(l) : '-'; }
function getErrorMessage(err, fb) { return err.response?.data || err.message || fb; }
export default MessagesAdministratifs;