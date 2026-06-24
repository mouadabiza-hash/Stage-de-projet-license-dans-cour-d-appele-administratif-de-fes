import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import DocumentModal from '../components/DocumentModal';
import SearchableSelect from './SearchableSelect';

function ActeursJudiciaires() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
  const { user } = useAuth();
  const role = user?.role;

  const showBureauOrdre = role === 'Admin' || role === 'Greffier';
  const showNumeroDossier = role !== 'Greffier';

  const [allItems, setAllItems] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);

  const [search, setSearch] = useState({
    numeroDossier: '',
    numeroPremiereInstance: '',
    tribunalSource: '',
    sujet: '',
    etat: '',
    dateDebut: '',
    dateFin: ''
  });

  const [documentStates, setDocumentStates] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [currentDocument, setCurrentDocument] = useState(null);

  // Fetch document states
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const res = await axios.get('/api/ListItems?listName=DocumentState');
        setDocumentStates(res.data.sort((a, b) => a.displayOrder - b.displayOrder));
      } catch (err) {
        console.error('Failed to load document states', err);
      }
    };
    fetchStates();
  }, []);

  // Charger tous les éléments au montage
  useEffect(() => {
    fetchAllItems();
  }, []);

  // Filtrer quand la recherche change
  useEffect(() => {
    if (!initialLoad) {
      applyFilters();
    }
  }, [search]);

  const fetchAllItems = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/acteursjudiciaires/search');
      setAllItems(res.data);
      setItems(res.data);
      setInitialLoad(false);
    } catch (err) {
      setError(getErrorMessage(err, t('erreur_chargement')));
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allItems];

    // Filtrer par numéro de dossier
    if (search.numeroDossier.trim()) {
      const term = search.numeroDossier.trim().toLowerCase();
      filtered = filtered.filter(item => 
        item.numeroDossier && item.numeroDossier.toLowerCase().includes(term)
      );
    }

    // Filtrer par numéro de première instance
    if (search.numeroPremiereInstance.trim()) {
      const term = search.numeroPremiereInstance.trim().toLowerCase();
      filtered = filtered.filter(item => 
        item.numeroPremiereInstance && item.numeroPremiereInstance.toLowerCase().includes(term)
      );
    }

    // Filtrer par tribunal source
    if (search.tribunalSource.trim()) {
      const term = search.tribunalSource.trim().toLowerCase();
      filtered = filtered.filter(item => 
        item.tribunalSource && item.tribunalSource.toLowerCase().includes(term)
      );
    }

    // Filtrer par sujet
    if (search.sujet.trim()) {
      const term = search.sujet.trim().toLowerCase();
      filtered = filtered.filter(item => 
        item.sujet && item.sujet.toLowerCase().includes(term)
      );
    }

    // Filtrer par état
    if (search.etat.trim()) {
      filtered = filtered.filter(item => item.etatArchive === search.etat.trim());
    }

    // Filtrer par date
    if (search.dateDebut) {
      const debut = new Date(search.dateDebut);
      debut.setHours(0, 0, 0, 0);
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= debut;
      });
    }
    if (search.dateFin) {
      const fin = new Date(search.dateFin);
      fin.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate <= fin;
      });
    }

    setItems(filtered);
    
    if (filtered.length === 0 && Object.values(search).some(v => v)) {
      setError(t('aucun_element_judiciaire') || 'Aucun dossier trouvé pour cette recherche.');
    } else {
      setError('');
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
    setItems(allItems);
    setError('');
  };

  const getEtatDisplay = (etatCode) => {
    const state = documentStates.find(s => s.code === etatCode);
    if (!state) return etatCode || '-';
    return locale === 'ar' ? state.valueAr : state.valueFr;
  };

  const etatOptions = documentStates.map(state => ({
    value: state.code,
    label: locale === 'ar' ? state.valueAr : state.valueFr
  }));

  return (
    <div className="page-container" dir="rtl">
      <h1 className="page-title">{t('menu_acteurs_judiciaires') || 'السجل القضائي'}</h1>
      {error && <div className="error-message">{error}</div>}

      <div className="form-card" style={{ marginBottom: '1.5rem' }}>
        <h3>{t('recherche_avancee') || 'بحث متقدم'}</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>{t('numero_dossier') || 'رقم الملف'}</label>
            <input
              value={search.numeroDossier}
              onChange={e => setSearch({ ...search, numeroDossier: e.target.value })}
              placeholder="2026/15/3"
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label>{t('numero_premiere_instance') || 'الرقم الابتدائي'}</label>
            <input
              value={search.numeroPremiereInstance}
              onChange={e => setSearch({ ...search, numeroPremiereInstance: e.target.value })}
              placeholder="2026/7209/1"
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label>{t('tribunal_source') || 'المحكمة/المصدر'}</label>
            <input
              value={search.tribunalSource}
              onChange={e => setSearch({ ...search, tribunalSource: e.target.value })}
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label>{t('objet') || 'الموضوع'}</label>
            <input
              value={search.sujet}
              onChange={e => setSearch({ ...search, sujet: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label>{t('etat') || 'الحالة'}</label>
            <SearchableSelect
              name="etat"
              value={search.etat}
              onChange={e => setSearch({ ...search, etat: e.target.value })}
              options={etatOptions}
              placeholder={t('tous_etats') || 'الكل'}
            />
          </div>

          <div className="form-field">
            <label>{t('date_debut') || 'من تاريخ'}</label>
            <input
              type="date"
              value={search.dateDebut}
              onChange={e => setSearch({ ...search, dateDebut: e.target.value })}
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label>{t('date_fin') || 'إلى تاريخ'}</label>
            <input
              type="date"
              value={search.dateFin}
              onChange={e => setSearch({ ...search, dateFin: e.target.value })}
              className="form-input"
            />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn-primary" onClick={applyFilters}>{t('search') || 'بحث'}</button>
          <button className="btn-secondary" onClick={resetSearch}>{t('reinitialiser')}</button>
        </div>
      </div>

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
                <td>{getEtatDisplay(item.etatArchive)}</td>
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

function formatDate(v, l) {
  return v ? new Date(v).toLocaleDateString(l) : '-';
}

function getErrorMessage(err, fb) {
  return err.response?.data || err.message || fb;
}

export default ActeursJudiciaires;