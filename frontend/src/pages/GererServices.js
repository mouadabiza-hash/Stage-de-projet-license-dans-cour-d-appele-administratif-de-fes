import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../hooks/usePermissions';
import SearchableSelect from './SearchableSelect';

function GererServices() {
  const { t } = useTranslation();
  const perms = usePermissions();

  if (!perms.canViewServices) {
    return <div className="error-message">{t('access_denied') || 'Accès refusé'}</div>;
  }

  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ idService: '', nomService: '', description: '', etage: '' });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterEtage, setFilterEtage] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ id: '', nom: '', description: '', etage: '' });
  const [showMapping, setShowMapping] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const headerOptions = headers.map(h => ({ value: h, label: h }));

  const fetchServices = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterEtage) params.etage = filterEtage;
      const res = await axios.get('/api/services', { params });
      setServices(res.data);
    } catch (err) { setError(t('erreur_chargement')); }
  };

  useEffect(() => { fetchServices(); }, [search, filterEtage]);
  useEffect(() => { setCurrentPage(1); }, [search, filterEtage, services.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!perms.canManageServices) return;
    const idNum = parseInt(form.idService, 10);
    if (isNaN(idNum) || idNum <= 0) { setError(t('erreur_id_positif')); return; }
    if (!form.nomService.trim()) { setError(t('erreur_nom_requis')); return; }
    try {
      if (editingId) {
        await axios.put(`/api/services/${editingId}`, {
          idService: idNum,
          nomService: form.nomService,
          description: form.description,
          etage: form.etage || null
        });
      } else {
        await axios.post('/api/services', {
          idService: idNum,
          nomService: form.nomService,
          description: form.description,
          etage: form.etage || null
        });
      }
      resetForm();
      fetchServices();
    } catch (err) { setError(err.response?.data || t('erreur')); }
  };

  const handleEdit = (s) => {
    if (!perms.canManageServices) return;
    setEditingId(s.idService);
    setForm({ idService: String(s.idService), nomService: s.nomService, description: s.description || '', etage: s.etage || '' });
  };
  const handleDelete = async (id) => {
    if (!perms.canManageServices) return;
    if (window.confirm(t('confirmation_supprimer'))) {
      try { await axios.delete(`/api/services/${id}`); fetchServices(); }
      catch (err) { setError(err.response?.data); }
    }
  };
  const exportToExcel = () => {
    if (!perms.canExport) return;
    fetch('/api/services/export/excel', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'services.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(console.error);
  };
  const handleFileSelect = async (e) => {
    if (!perms.canManageServices) return;
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/api/services/import/preview', formData);
      setHeaders(res.data);
      setShowMapping(true);
    } catch (err) { setError(t('erreur_lecture_fichier')); }
  };
  const executeImport = async () => {
    if (!perms.canManageServices || !importFile) return;
    const formData = new FormData();
    formData.append('file', importFile);
    const params = new URLSearchParams({
      colId: mapping.id,
      colNom: mapping.nom,
      colDescription: mapping.description,
      colEtage: mapping.etage
    });
    try {
      const res = await axios.post(`/api/services/import/execute?${params.toString()}`, formData);
      const data = res.data;
      if (data.errors && data.errors.length) {
        alert(`${data.message}\n\n${t('details_erreurs')} :\n${data.errors.join('\n')}`);
      } else { alert(data.message); }
      if (data.imported > 0) fetchServices();
      setShowMapping(false);
      setImportFile(null);
      setMapping({ id: '', nom: '', description: '', etage: '' });
    } catch (err) { setError(t('erreur_import')); }
  };
  const downloadTemplate = () => {
    if (!perms.canManageServices) return;
    fetch('/api/services/template-excel', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modele_import_services.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      });
  };
  const resetForm = () => {
    setEditingId(null);
    setForm({ idService: '', nomService: '', description: '', etage: '' });
    setError('');
  };
  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    setSelectedIds(selectAll ? [] : services.map(s => s.idService));
  };
  const handleSelectOne = (id) => {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
  };

  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const currentServices = services.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(services.length / rowsPerPage);
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  return (
    <div className="page-container">  {/* ← plus de dir="rtl" fixe */}
      <h1 className="page-title">{t('gerer_services')}</h1>
      {error && <div className="error-message">{error}</div>}
      <div className="filters">
        <input type="text" placeholder={t('rechercher_service')} value={search} onChange={e => setSearch(e.target.value)} className="form-input" />
        <input type="text" placeholder={t('filtrer_etage')} value={filterEtage} onChange={e => setFilterEtage(e.target.value)} className="form-input" />
        <button className="btn-secondary" onClick={() => { setSearch(''); setFilterEtage(''); }}>{t('reinitialiser')}</button>
        {perms.canExport && <button className="btn-primary" onClick={exportToExcel}>{t('exporter_excel')}</button>}
        {perms.canManageServices && (
          <>
            <label className="btn-secondary" style={{ cursor: 'pointer' }}>
              📂 {t('importer_excel')}
              <input type="file" accept=".xlsx" onChange={handleFileSelect} style={{ display: 'none' }} />
            </label>
            <button className="btn-secondary" onClick={downloadTemplate}>📥 {t('telecharger_modele')}</button>
          </>
        )}
      </div>

      {showMapping && perms.canManageServices && (
        <div className="mapping-panel">
          <h4>{t('associer_colonnes')}</h4>
          <div className="form-grid">
            <div className="form-field">
              <label>{t('colonne_id')} *</label>
              <SearchableSelect
                name="id"
                value={mapping.id}
                onChange={e => setMapping({ ...mapping, id: e.target.value })}
                options={headerOptions}
                placeholder={`-- ${t('choisir')} --`}
              />
            </div>
            <div className="form-field">
              <label>{t('colonne_nom')} *</label>
              <SearchableSelect
                name="nom"
                value={mapping.nom}
                onChange={e => setMapping({ ...mapping, nom: e.target.value })}
                options={headerOptions}
                placeholder={`-- ${t('choisir')} --`}
              />
            </div>
            <div className="form-field">
              <label>{t('colonne_description')}</label>
              <SearchableSelect
                name="description"
                value={mapping.description}
                onChange={e => setMapping({ ...mapping, description: e.target.value })}
                options={headerOptions}
                placeholder={`-- ${t('choisir')} --`}
              />
            </div>
            <div className="form-field">
              <label>{t('colonne_etage')}</label>
              <SearchableSelect
                name="etage"
                value={mapping.etage}
                onChange={e => setMapping({ ...mapping, etage: e.target.value })}
                options={headerOptions}
                placeholder={`-- ${t('choisir')} --`}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={executeImport}>{t('importer')}</button>
            <button className="btn-secondary" onClick={() => setShowMapping(false)}>{t('annuler')}</button>
          </div>
        </div>
      )}

      {perms.canManageServices && (
        <div className="form-card">
          <h3>{editingId ? t('modifier_service') : t('ajouter_service')}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>{t('id')} *</label>
                <input type="number" value={form.idService} onChange={e => setForm({ ...form, idService: e.target.value })} required disabled={!!editingId} className="form-input" />
              </div>
              <div className="form-field">
                <label>{t('nom')} *</label>
                <input value={form.nomService} onChange={e => setForm({ ...form, nomService: e.target.value })} required className="form-input" />
              </div>
              <div className="form-field">
                <label>{t('description')}</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="form-input" />
              </div>
              <div className="form-field">
                <label>{t('etage')}</label>
                <input value={form.etage} onChange={e => setForm({ ...form, etage: e.target.value })} className="form-input" />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">{editingId ? t('modifier') : t('ajouter')}</button>
              {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>{t('annuler')}</button>}
            </div>
          </form>
        </div>
      )}

      <div className="data-table-wrapper">
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <div className="rows-per-page">
            <span>{t('afficher')}</span>
            <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="form-input" style={{ width: 'auto' }}>
              <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option>
            </select>
            <span>{t('lignes')}</span>
          </div>
        </div>
        <table className="modern-table">
          <thead>
            <tr>
              {perms.canManageServices && <th><input type="checkbox" checked={selectAll} onChange={handleSelectAll} /></th>}
              <th>{t('id')}</th>
              <th>{t('nom')}</th>
              <th>{t('description')}</th>
              <th>{t('etage')}</th>
              {perms.canManageServices && <th>{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {currentServices.map(s => (
              <tr key={s.idService}>
                {perms.canManageServices && <td><input type="checkbox" checked={selectedIds.includes(s.idService)} onChange={() => handleSelectOne(s.idService)} /></td>}
                <td>{s.idService}</td>
                <td>{s.nomService}</td>
                <td>{s.description || '—'}</td>
                <td>{s.etage || '—'}</td>
                {perms.canManageServices && (
                  <td className="action-icons">
                    <button onClick={() => handleEdit(s)}>✏️</button>
                    <button onClick={() => handleDelete(s.idService)}>🗑️</button>
                  </td>
                )}
              </tr>
            ))}
            {currentServices.length === 0 && <tr><td colSpan={perms.canManageServices ? 6 : 5} style={{ textAlign: 'center' }}>{t('aucun_service')}</td></tr>}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>{t('precedent')}</button>
            <span>{t('page')} {currentPage} / {totalPages}</span>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>{t('suivant')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GererServices;