import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import DocumentModal from '../components/DocumentModal';

function ActeursJudiciaires() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
  const { user } = useAuth();
  const role = user?.role;

  // Column visibility
  const showBureauOrdre = role === 'Admin' || role === 'Greffier';
  const showNumeroDossier = role !== 'Greffier';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState({
    numeroDossier: '',
    numeroPremiereInstance: '',
    tribunalSource: '',
    sujet: '',
    etat: '',
    dateDebut: '',
    dateFin: ''
  });

  // Document consultation
  const [showDocModal, setShowDocModal] = useState(false);
  const [currentDocument, setCurrentDocument] = useState(null);

  useEffect(() => {
    fetchItems();
  }, [search]);

  const buildQuery = () => {
    const parts = [];
    if (search.numeroDossier) parts.push(search.numeroDossier);
    if (search.numeroPremiereInstance) parts.push(search.numeroPremiereInstance);
    if (search.tribunalSource) parts.push(search.tribunalSource);
    if (search.sujet) parts.push(search.sujet);
    if (search.etat) parts.push(search.etat);
    return parts.join(' ');
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const motCle = buildQuery();
      const url = motCle
        ? `/api/acteursjudiciaires/search?motCle=${encodeURIComponent(motCle)}`
        : '/api/acteursjudiciaires/search'; // search without keyword returns all now

      const res = await axios.get(url);
      let data = res.data;

      // Frontend date filtering
      if (search.dateDebut || search.dateFin) {
        const debut = search.dateDebut ? new Date(search.dateDebut) : null;
        const fin = search.dateFin ? new Date(search.dateFin) : null;
        data = data.filter(item => {
          const itemDate = new Date(item.date);
          if (debut && itemDate < debut) return false;
          if (fin && itemDate > new Date(fin).setHours(23,59,59,999)) return false;
          return true;
        });
      }

      setItems(data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, t('erreur_chargement')));
    } finally {
      setLoading(false);
    }
  };

  const handleConsult = async (doc) => {
    try {
      const res = await axios.get(`/api/acteursjudiciaires/${doc.id}`);
      setCurrentDocument(res.data);
    } catch (err) {
      setCurrentDocument(doc);
    }
    setShowDocModal(true);
  };

  const resetSearch = () => {
    setSearch({
      numeroDossier: '',
      numeroPremiereInstance: '',
      tribunalSource: '',
      sujet: '',
      etat: '',
      dateDebut: '',
      dateFin: ''
    });
  };

  return (
    <div className="page-container" dir="rtl">
      <h1 className="page-title">{t('menu_acteurs_judiciaires') || 'السجل القضائي'}</h1>
      {error && <div className="error-message">{error}</div>}

      {/* Advanced search panel */}
      <div className="form-card" style={{ marginBottom: '1.5rem' }}>
          <h3>{t('recherche_avancee') || 'بحث متقدم'}</h3>
        
      
          <div className="form-grid">
            <div className="form-field">
              <label>{t('numero_dossier') || 'رقم الاستئنافي'}</label>
              <input value={search.numeroDossier} onChange={e => setSearch({...search, numeroDossier: e.target.value})} placeholder="2026/15/3" />
            </div>
            <div className="form-field">
              <label>{t('numero_premiere_instance') || 'الرقم الابتدائي'}</label>
              <input value={search.numeroPremiereInstance} onChange={e => setSearch({...search, numeroPremiereInstance: e.target.value})} placeholder="2026/12" />
            </div>
            <div className="form-field">
              <label>{t('tribunal_source') || 'المحكمة/المصدر'}</label>
              <input value={search.tribunalSource} onChange={e => setSearch({...search, tribunalSource: e.target.value})} />
            </div>
            <div className="form-field">
              <label>{t('objet') || 'الموضوع'}</label>
              <input value={search.sujet} onChange={e => setSearch({...search, sujet: e.target.value})} />
            </div>
            <div className="form-field">
              <label>{t('etat') || 'الحالة'}</label>
              <select value={search.etat} onChange={e => setSearch({...search, etat: e.target.value})}>
                <option value="">{t('tous_etats') || 'الكل'}</option>
                <option value="Nouveau">{t('nouveau') || 'جديد'}</option>
                <option value="En cours">{t('en_cours') || 'قيد المعالجة'}</option>
                <option value="Traite">{t('traite') || 'تمت المعالجة'}</option>
                <option value="Archive">{t('archive') || 'مؤرشف'}</option>
              </select>
            </div>
            <div className="form-field">
              <label>{t('date_debut') || 'من تاريخ'}</label>
              <input type="date" value={search.dateDebut} onChange={e => setSearch({...search, dateDebut: e.target.value})} />
            </div>
            <div className="form-field">
              <label>{t('date_fin') || 'إلى تاريخ'}</label>
              <input type="date" value={search.dateFin} onChange={e => setSearch({...search, dateFin: e.target.value})} />
            </div>
          </div>
        
        <div className="form-actions">
          <button className="btn-primary" onClick={fetchItems}>{t('search') || 'بحث'}</button>
          <button className="btn-secondary" onClick={resetSearch}>{t('reinitialiser')}</button>
        </div>
      </div>

      {/* Results table */}
      <div className="data-table-wrapper">
        <table className="modern-table">
          <thead>
            <tr>
              <th>{t('date')}</th>
              <th>{t('tribunal_source')}</th>
              {showBureauOrdre && <th>{t('numero_bureau_ordre') || 'رقم مكتب الضبط'}</th>}
              {showNumeroDossier && <th>{t('numero_dossier') || 'رقم الاستئنافي'}</th>}
              <th>{t('numero_premiere_instance') || 'الرقم الابتدائي'}</th>
              <th>{t('objet')}</th>
              <th>{t('direction')}</th>
              <th>{t('service')}</th>
              <th>{t('etat')}</th>
              <th>{t('emplacement')}</th>
              <th>{t('retraits')}</th>
              <th>PDF</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="12">{t('chargement')}</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan="12">{t('aucun_element_judiciaire')}</td></tr>}
            {items.map(item => (
              <tr key={item.id}>
                <td>{formatDate(item.date, locale)}</td>
                <td>{item.tribunalSource || '-'}</td>
                {showBureauOrdre && <td>{item.idBureauOrdre || '-'}</td>}
                {showNumeroDossier && <td>{item.numeroDossier || '-'}</td>}
                <td>{item.numeroPremiereInstance || '-'}</td>
                <td>{item.sujet || '-'}</td>
                <td>{item.direction || '-'}</td>
                <td>{item.serviceNom || item.idService || '-'}</td>
                <td>{item.etatArchive || '-'}</td>
                <td>{item.emplacement || '-'}</td>
                <td>{item.retraitsCount ?? 0}</td>
                <td>{item.lienPdf ? <a href={item.lienPdf} target="_blank" rel="noreferrer">PDF</a> : '-'}</td>
                <td className="action-icons">
                  <button onClick={() => handleConsult(item)}>{t('consulter')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDocModal && <DocumentModal document={currentDocument} onClose={() => setShowDocModal(false)} />}
    </div>
  );
}

function formatDate(v, l) { return v ? new Date(v).toLocaleDateString(l) : '-'; }
function getErrorMessage(err, fb) { return err.response?.data || err.message || fb; }

export default ActeursJudiciaires;