import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function GestionListes() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [lists, setLists] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({ listName: '', code: '', valueFr: '', valueAr: '', displayOrder: 0, isActive: true });

  const listNames = [
    'EquipmentType', 'EquipmentEtat', 'JudicialType', 'TribunalType',
    'DocumentState', 'Direction', 'CorrespondanceType'
  ];

  useEffect(() => {
    fetchAllLists();
  }, []);

  const fetchAllLists = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ListItems/all');
      setLists(res.data);
      if (Object.keys(res.data).length > 0 && !activeTab) {
        const firstTab = listNames.find(name => res.data[name]) || listNames[0];
        setActiveTab(firstTab);
        setNewItem(prev => ({ ...prev, listName: firstTab }));
      }
      setError('');
    } catch (err) {
      setError(t('erreur_chargement'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    // Use active tab as listName if not already set
    const listName = newItem.listName || activeTab;
    const code = newItem.code?.toString().trim();
    const valueFr = newItem.valueFr?.trim();
    const valueAr = newItem.valueAr?.trim();
    if (!listName || !code || !valueFr || !valueAr) {
      setError(t('champs_obligatoires'));
      return;
    }
    try {
      await axios.post('/api/ListItems', {
        ...newItem,
        listName,
        code,
        valueFr,
        valueAr,
        displayOrder: parseInt(newItem.displayOrder) || 0,
        isActive: newItem.isActive
      });
      setSuccess(t('ajout_succes'));
      fetchAllLists();
      setNewItem({ listName: activeTab, code: '', valueFr: '', valueAr: '', displayOrder: 0, isActive: true });
    } catch (err) {
      setError(err.response?.data || t('erreur'));
    }
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    try {
      await axios.put(`/api/ListItems/${editingItem.id}`, editingItem);
      setSuccess(t('modification_succes'));
      fetchAllLists();
      setEditingItem(null);
    } catch (err) {
      setError(err.response?.data || t('erreur'));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('confirmation_supprimer'))) {
      try {
        await axios.delete(`/api/ListItems/${id}`);
        setSuccess(t('suppression_succes'));
        fetchAllLists();
      } catch (err) {
        setError(t('erreur_suppression'));
      }
    }
  };

  const currentItems = (lists[activeTab] || []).filter(item =>
    item.valueFr.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.valueAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toString().includes(searchTerm)
  );

  return (
    <div className="page-container">
      <h1 className="page-title">{t('gestion_listes')}</h1>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="registry-choice" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        {listNames.map(name => (
          <button
            key={name}
            className={`choice-pill ${activeTab === name ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(name);
              setSearchTerm('');
              setNewItem(prev => ({ ...prev, listName: name }));
            }}
          >
            {t(`list_${name}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">{t('chargement')}</div>
      ) : (
        <>
          <div className="filters" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder={t('rechercher')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '250px' }}
            />
            <button className="btn-secondary" onClick={() => setSearchTerm('')}>
              {t('reinitialiser')}
            </button>
          </div>

          <div className="data-table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>{t('code')}</th>
                  <th>{t('valeur_fr')}</th>
                  <th>{t('valeur_ar')}</th>
                  <th>{t('ordre')}</th>
                  <th>{t('actif')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map(item => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.valueFr}</td>
                    <td>{item.valueAr}</td>
                    <td>{item.displayOrder}</td>
                    <td>{item.isActive ? t('oui') : t('non')}</td>
                    <td className="action-icons">
                      <button className="action-btn" onClick={() => setEditingItem(item)}>✏️ {t('modifier')}</button>
                      <button className="action-btn action-btn-danger" onClick={() => handleDelete(item.id)}>🗑️ {t('supprimer')}</button>
                    </td>
                  </tr>
                ))}
                {currentItems.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>{t('aucun_element')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="form-card" style={{ marginTop: '1rem' }}>
            <h3>{t('ajouter_element')}</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>{t('code')} *</label>
                <input type="text" value={newItem.code} onChange={e => setNewItem({ ...newItem, code: e.target.value })} />
              </div>
              <div className="form-field">
                <label>{t('valeur_fr')} *</label>
                <input value={newItem.valueFr} onChange={e => setNewItem({ ...newItem, valueFr: e.target.value })} />
              </div>
              <div className="form-field">
                <label>{t('valeur_ar')} *</label>
                <input value={newItem.valueAr} onChange={e => setNewItem({ ...newItem, valueAr: e.target.value })} />
              </div>
              <div className="form-field">
                <label>{t('ordre')}</label>
                <input type="number" value={newItem.displayOrder} onChange={e => setNewItem({ ...newItem, displayOrder: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-field">
                <label className="checkbox-field">
                  <input type="checkbox" checked={newItem.isActive} onChange={e => setNewItem({ ...newItem, isActive: e.target.checked })} />
                  {t('actif')}
                </label>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-primary" onClick={handleCreate}>{t('ajouter')}</button>
            </div>
          </div>

          {editingItem && (
            <div className="modal-overlay" onClick={() => setEditingItem(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="registry-panel-header">
                  <h3>{t('modifier_element')}</h3>
                  <button className="btn-secondary" onClick={() => setEditingItem(null)}>{t('fermer')}</button>
                </div>
                <div className="form-grid">
                  <div className="form-field"><label>{t('code')}</label><input value={editingItem.code} disabled /></div>
                  <div className="form-field"><label>{t('valeur_fr')}</label><input value={editingItem.valueFr} onChange={e => setEditingItem({ ...editingItem, valueFr: e.target.value })} /></div>
                  <div className="form-field"><label>{t('valeur_ar')}</label><input value={editingItem.valueAr} onChange={e => setEditingItem({ ...editingItem, valueAr: e.target.value })} /></div>
                  <div className="form-field"><label>{t('ordre')}</label><input type="number" value={editingItem.displayOrder} onChange={e => setEditingItem({ ...editingItem, displayOrder: parseInt(e.target.value) || 0 })} /></div>
                  <div className="form-field"><label className="checkbox-field"><input type="checkbox" checked={editingItem.isActive} onChange={e => setEditingItem({ ...editingItem, isActive: e.target.checked })} /> {t('actif')}</label></div>
                </div>
                <div className="form-actions">
                  <button className="btn-primary" onClick={handleUpdate}>{t('enregistrer')}</button>
                  <button className="btn-secondary" onClick={() => setEditingItem(null)}>{t('annuler')}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default GestionListes;