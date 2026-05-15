import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../hooks/usePermissions';

function GererEquipements() {
    const { t } = useTranslation();
    const perms = usePermissions();

    // Everyone can view equipment; only permitted roles can manage
    if (!perms.canViewEquipments) {
        return <div className="error-message">{t('access_denied') || 'Accès refusé'}</div>;
    }

    const [equipements, setEquipements] = useState([]);
    const [services, setServices] = useState([]);
    const [form, setForm] = useState({ serial: '', type: '', etat: '', idService: '' });
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterEtat, setFilterEtat] = useState('');
    const [onlyDecharge, setOnlyDecharge] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [mapping, setMapping] = useState({ serie: '', type: '', etat: '', serviceId: '' });
    const [showMapping, setShowMapping] = useState(false);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchEquipements = async () => {
        try {
            const params = {};
            if (search) params.search = search;
            if (filterType) params.type = filterType;
            if (filterEtat) params.etat = filterEtat;
            if (onlyDecharge) params.decharge = true;
            const res = await axios.get('/api/equipements', { params });
            setEquipements(res.data);
        } catch (err) { setError(t('erreur_chargement')); }
    };
    const fetchServices = async () => {
        try { const res = await axios.get('/api/services'); setServices(res.data); } catch (err) { }
    };
    useEffect(() => { fetchEquipements(); fetchServices(); }, [search, filterType, filterEtat, onlyDecharge]);
    useEffect(() => { setCurrentPage(1); }, [search, filterType, filterEtat, onlyDecharge, equipements.length]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!perms.canManageEquipments) return;
        const serialNum = parseInt(form.serial, 10);
        const typeNum = parseInt(form.type, 10);
        const etatNum = parseInt(form.etat, 10);
        const serviceId = parseInt(form.idService, 10);
        if (isNaN(serialNum) || isNaN(typeNum) || isNaN(etatNum) || isNaN(serviceId)) {
            setError(t('erreur_champs'));
            return;
        }
        const payload = { serial: serialNum, type: typeNum, etat: etatNum, idService: serviceId };
        if (editingId) payload.id = editingId;
        try {
            if (editingId) {
                await axios.put(`/api/equipements/${editingId}`, payload);
            } else {
                await axios.post('/api/equipements', payload);
            }
            resetForm();
            fetchEquipements();
        } catch (err) {
            setError(err.response?.data || t('erreur'));
        }
    };

    const handleEdit = (eq) => {
        if (!perms.canManageEquipments) return;
        setEditingId(eq.id);
        setForm({ serial: eq.serial, type: eq.type, etat: eq.etat, idService: eq.idService });
    };
    const handleDelete = async (id) => {
        if (!perms.canManageEquipments) return;
        if (window.confirm(t('confirmation_supprimer'))) {
            await axios.delete(`/api/equipements/${id}`);
            fetchEquipements();
        }
    };
    const handleCharger = async (id) => {
        if (!perms.canManageEquipments) return;
        await axios.post(`/api/equipements/${id}/charger`);
        fetchEquipements();
    };
    const handleDecharger = async (id) => {
        if (!perms.canManageEquipments) return;
        // Ask for the discharge date
        const dateStr = prompt(
            t('enter_decharge_date') || 'تاريخ التفريغ (YYYY-MM-DD)',
            new Date().toISOString().slice(0, 10)
        );
        if (!dateStr) return; // cancelled
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            alert(t('invalid_date') || 'تاريخ غير صالح');
            return;
        }
        try {
            await axios.post(`/api/equipements/${id}/decharger`, { dateDechargement: date.toISOString() });
            fetchEquipements();
        } catch (err) {
            setError(t('erreur'));
        }
    };
    const resetForm = () => {
        setEditingId(null);
        setForm({ serial: '', type: '', etat: '', idService: '' });
        setError('');
    };
    const exportToExcel = () => {
        if (!perms.canExport) return;
        fetch('/api/equipements/export/excel', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'equipements.xlsx';
                a.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(console.error);
    };
    const handleFileSelect = async (e) => {
        if (!perms.canManageEquipments) return;
        const file = e.target.files[0];
        if (!file) return;
        setImportFile(file);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await axios.post('/api/equipements/import/preview', formData);
            setHeaders(res.data);
            setShowMapping(true);
        } catch (err) {
            setError(t('erreur_lecture_fichier'));
        }
    };
    const executeImport = async () => {
        if (!perms.canManageEquipments || !importFile) return;
        const formData = new FormData();
        formData.append('file', importFile);
        const params = new URLSearchParams({
            colSerie: mapping.serie,
            colType: mapping.type,
            colEtat: mapping.etat,
            colServiceId: mapping.serviceId
        });
        try {
            const res = await axios.post(`/api/equipements/import/execute?${params.toString()}`, formData);
            const data = res.data;
            if (data.details && data.details.length > 0) {
                alert(`${data.message}\n\n${t('details_erreurs')} :\n${data.details.join('\n')}`);
            } else {
                alert(data.message);
            }
            if (data.imported > 0) fetchEquipements();
            setShowMapping(false);
            setImportFile(null);
            setMapping({ serie: '', type: '', etat: '', serviceId: '' });
        } catch (err) {
            setError(t('erreur_import'));
        }
    };
    const downloadTemplate = () => {
        if (!perms.canManageEquipments) return;
        fetch('/api/equipements/template-excel', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'modele_import_equipements.xlsx';
                a.click();
                window.URL.revokeObjectURL(url);
            });
    };
    const handleSelectAll = () => {
        setSelectAll(!selectAll);
        setSelectedIds(selectAll ? [] : equipements.map(e => e.id));
    };
    const handleSelectOne = (id) => {
        setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
    };

    // ---------- Extended type map (10 types) ----------
    const typeMap = {
        1: t('type_ordinateur'),
        2: t('type_imprimante'),
        3: t('type_scanner'),
        4: t('type_photocopieur'),
        5: t('type_serveur'),
        6: t('type_switch'),
        7: t('type_routeur'),
        8: t('type_onduleur'),
        9: t('type_telephone'),
        10: t('type_videoprojecteur'),
    };

    const etatMap = {
        1: t('etat_neuf'),
        2: t('etat_bon'),
        3: t('etat_reparer'),
        4: t('etat_hors_service')
    };

    const indexOfLast = currentPage * rowsPerPage;
    const indexOfFirst = indexOfLast - rowsPerPage;
    const currentEquipements = equipements.slice(indexOfFirst, indexOfLast);
    const totalPages = Math.ceil(equipements.length / rowsPerPage);
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
    };

    return (
        <div className="page-container" dir="rtl">
            <h1 className="page-title">{t('gerer_equipements')}</h1>
            {error && <div className="error-message">{error}</div>}
            <div className="filters">
                <input type="text" placeholder={t('rechercher_equipement')} value={search} onChange={e => setSearch(e.target.value)} />
                <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="">{t('tous_types')}</option>
                    {Object.entries(typeMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={filterEtat} onChange={e => setFilterEtat(e.target.value)}>
                    <option value="">{t('tous_etats')}</option>
                    {Object.entries(etatMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <label><input type="checkbox" checked={onlyDecharge} onChange={e => setOnlyDecharge(e.target.checked)} /> {t('uniquement_decharges')}</label>
                <button className="btn-secondary" onClick={() => { setSearch(''); setFilterType(''); setFilterEtat(''); setOnlyDecharge(false); }}>{t('reinitialiser')}</button>
                {perms.canExport && <button className="btn-primary" onClick={exportToExcel}>{t('exporter_excel')}</button>}
                {perms.canManageEquipments && (
                    <>
                        <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                            📂 {t('importer_excel')}
                            <input type="file" accept=".xlsx" onChange={handleFileSelect} style={{ display: 'none' }} />
                        </label>
                        <button className="btn-secondary" onClick={downloadTemplate}>📥 {t('telecharger_modele')}</button>
                    </>
                )}
            </div>

            {showMapping && perms.canManageEquipments && (
                <div className="mapping-panel">
                    <h4>{t('associer_colonnes')}</h4>
                    <div className="form-grid">
                        <div className="form-field"><label>{t('colonne_serie')} *</label><select value={mapping.serie} onChange={e => setMapping({ ...mapping, serie: e.target.value })}><option value="">-- {t('choisir')} --</option>{headers.map(h => <option key={h}>{h}</option>)}</select></div>
                        <div className="form-field"><label>{t('colonne_type')} *</label><select value={mapping.type} onChange={e => setMapping({ ...mapping, type: e.target.value })}><option value="">-- {t('choisir')} --</option>{headers.map(h => <option key={h}>{h}</option>)}</select></div>
                        <div className="form-field"><label>{t('colonne_etat')} *</label><select value={mapping.etat} onChange={e => setMapping({ ...mapping, etat: e.target.value })}><option value="">-- {t('choisir')} --</option>{headers.map(h => <option key={h}>{h}</option>)}</select></div>
                        <div className="form-field"><label>{t('colonne_service_id')} *</label><select value={mapping.serviceId} onChange={e => setMapping({ ...mapping, serviceId: e.target.value })}><option value="">-- {t('choisir')} --</option>{headers.map(h => <option key={h}>{h}</option>)}</select></div>
                    </div>
                    <div className="form-actions"><button className="btn-primary" onClick={executeImport}>{t('importer')}</button><button className="btn-secondary" onClick={() => setShowMapping(false)}>{t('annuler')}</button></div>
                </div>
            )}

            {perms.canManageEquipments && (
                <div className="form-card">
                    <h3>{editingId ? t('modifier_equipement') : t('ajouter_equipement')}</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-grid">
                            <div className="form-field"><label>{t('serie')} *</label><input type="number" value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} required /></div>
                            <div className="form-field">
                                <label>{t('type')} *</label>
                                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} required>
                                    <option value="">{t('type')}</option>
                                    {Object.entries(typeMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div className="form-field"><label>{t('etat')} *</label><select value={form.etat} onChange={e => setForm({ ...form, etat: e.target.value })} required><option value="">{t('etat')}</option>{Object.entries(etatMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                            <div className="form-field"><label>{t('service')} *</label><select value={form.idService} onChange={e => setForm({ ...form, idService: e.target.value })} required><option value="">{t('service')}</option>{services.map(s => <option key={s.idService} value={s.idService}>{s.nomService}</option>)}</select></div>
                        </div>
                        <div className="form-actions"><button type="submit" className="btn-primary">{editingId ? t('modifier') : t('ajouter')}</button>{editingId && <button type="button" className="btn-secondary" onClick={resetForm}>{t('annuler')}</button>}</div>
                    </form>
                </div>
            )}

            <div className="data-table-wrapper">
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div className="rows-per-page">
                        <span>{t('afficher')}</span>
                        <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                            <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option>
                        </select>
                        <span>{t('lignes')}</span>
                    </div>
                </div>
                <table className="modern-table">
                    <thead>
                        <tr>
                            {perms.canManageEquipments && <th><input type="checkbox" checked={selectAll} onChange={handleSelectAll} /></th>}
                            <th>ID</th>
                            <th>{t('serie')}</th>
                            <th>{t('type')}</th>
                            <th>{t('etat')}</th>
                            <th>{t('service_id')}</th>
                            <th>{t('charge')}</th>
                            <th>{t('date_decharge')}</th>
                            {perms.canManageEquipments && <th>{t('actions')}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {currentEquipements.map(eq => (
                            <tr key={eq.id}>
                                {perms.canManageEquipments && <td><input type="checkbox" checked={selectedIds.includes(eq.id)} onChange={() => handleSelectOne(eq.id)} /></td>}
                                <td>{eq.id}</td>
                                <td>{eq.serial}</td>
                                <td>{typeMap[eq.type] || eq.type}</td>
                                <td>{etatMap[eq.etat] || eq.etat}</td>
                                <td>{eq.serviceNom || eq.idService}</td>
                                <td className={eq.estCharge ? 'status-charge' : 'status-decharge'}>{eq.estCharge ? t('charge') : t('decharge')}</td>
                                <td>{eq.dateDechargement ? new Date(eq.dateDechargement).toLocaleString() : '—'}</td>
                                {perms.canManageEquipments && (
                                <td className="action-icons">
                                        <button onClick={() => handleEdit(eq)}>✏️</button>
                                        {!eq.estCharge && <button onClick={() => handleCharger(eq.id)} style={{ color: 'green' }}>{t('charger')}</button>}
                                        {eq.estCharge && <button onClick={() => handleDecharger(eq.id)} style={{ color: 'orange' }}>{t('decharger')}</button>}
                                        <button onClick={() => handleDelete(eq.id)}>🗑️</button>
                                </td>
                                )}
                            </tr>
                        ))}
                        {currentEquipements.length === 0 && <tr><td colSpan={perms.canManageEquipments ? 9 : 8} style={{ textAlign: 'center' }}>{t('aucun_equipement')}</td></tr>}
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

export default GererEquipements;