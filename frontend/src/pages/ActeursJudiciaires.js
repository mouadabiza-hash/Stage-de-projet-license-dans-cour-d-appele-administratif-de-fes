import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function ActeursJudiciaires() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
  const [items, setItems] = useState([]);
  const [motCle, setMotCle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = setTimeout(fetchItems, 250);
    return () => clearTimeout(timeout);
  }, [motCle]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const url = motCle.trim()
        ? `/api/acteursjudiciaires/search?motCle=${encodeURIComponent(motCle.trim())}`
        : '/api/acteursjudiciaires';
      const res = await axios.get(url);
      setItems(res.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, t('erreur_chargement')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{t('menu_acteurs_judiciaires')}</h1>
      {error && <div className="error-message">{error}</div>}
      <div className="filters">
        <input type="text" value={motCle} onChange={e => setMotCle(e.target.value)} placeholder={t('rechercher_par_mot')} />
        <button className="btn-secondary" onClick={() => setMotCle('')}>{t('reinitialiser')}</button>
      </div>
      <div className="data-table-wrapper">
        <table className="modern-table">
          <thead>
            <tr><th>{t('date')}</th><th>{t('tribunal_source')}</th><th>{t('numero_dossier')}</th><th>{t('objet')}</th>
              <th>{t('direction')}</th><th>{t('destinataire')}</th><th>{t('service')}</th><th>{t('transmissible')}</th>
              <th>{t('etat')}</th><th>{t('emplacement')}</th><th>{t('retraits')}</th><th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="12">{t('chargement')}</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan="12">{t('aucun_element_judiciaire')}</td></tr>}
            {items.map(item => (
              <tr key={item.id}>
                <td>{formatDate(item.date, locale)}</td><td>{item.tribunalSource || '-'}</td><td>{item.numeroDossier || '-'}</td>
                <td>{item.sujet || '-'}</td><td>{item.direction || '-'}</td><td>{item.destinataire || '-'}</td>
                <td>{item.serviceNom || item.idService || '-'}</td><td>{item.estTransmissible ? t('oui') : t('non')}</td>
                <td>{item.etatArchive || '-'}</td><td>{item.emplacement || '-'}</td><td>{item.retraitsCount ?? 0}</td>
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
export default ActeursJudiciaires;