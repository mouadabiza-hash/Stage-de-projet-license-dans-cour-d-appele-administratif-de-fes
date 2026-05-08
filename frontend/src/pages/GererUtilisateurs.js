import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function GererUtilisateurs() {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [services, setServices] = useState([]);
    const [form, setForm] = useState({ nomComplet: '', login: '', password: '', idService: '' });
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filterService, setFilterService] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [mapping, setMapping] = useState({ nom: '', login: '', serviceId: '' });
    const [showMapping, setShowMapping] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [newPassword, setNewPassword] = useState('');

    const fetchUsers = async () => {
        try {
            let url = '/api/utilisateurs';
            if (search) url += `?search=${search}`;
            if (filterService) url += `?serviceId=${filterService}`;
            const res = await axios.get(url);
            setUsers(res.data);
        } catch (err) {
            setError(t('erreur_chargement_utilisateurs'));
        }
    };

    const fetchServices = async () => {
        try {
            const res = await axios.get('/api/services');
            setServices(res.data);
        } catch (err) {}
    };

    useEffect(() => {
        fetchUsers();
        fetchServices();
    }, [search, filterService]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.nomComplet.trim() || !form.login.trim() || !form.idService) {
            setError(t('erreur_champs_utilisateur'));
            return;
        }
        try {
            if (editingId) {
                const payload = {
                    nomComplet: form.nomComplet,
                    login: form.login,
                    idService: parseInt(form.idService),
                };
                if (form.password) payload.password = form.password;
                await axios.put(`/api/utilisateurs/${editingId}`, payload);
            } else {
                if (!form.password) {
                    setError(t('erreur_mot_de_passe_requis'));
                    return;
                }
                await axios.post('/api/utilisateurs', {
                    nomComplet: form.nomComplet,
                    login: form.login,
                    password: form.password,
                    idService: parseInt(form.idService),
                });
            }
            resetForm();
            fetchUsers();
        } catch (err) {
            setError(err.response?.data || t('erreur_enregistrement'));
        }
    };

    const handleEdit = (u) => {
        setEditingId(u.id);
        setForm({
            nomComplet: u.nomComplet,
            login: u.login,
            password: '',
            idService: u.idService,
        });
    };

    const handleDelete = async (id) => {
        if (window.confirm(t('confirmation_supprimer_utilisateur'))) {
            try {
                await axios.delete(`/api/utilisateurs/${id}`);
                fetchUsers();
                setSelectedIds(selectedIds.filter(i => i !== id));
            } catch (err) {
                setError(t('erreur_suppression'));
            }
        }
    };

    const changePassword = async () => {
        if (!newPassword.trim()) {
            alert(t('mot_de_passe_vide'));
            return;
        }
        try {
            await axios.put(`/api/utilisateurs/${selectedUserId}`, { password: newPassword });
            alert(t('mot_de_passe_modifie'));
            setShowPasswordModal(false);
            setNewPassword('');
            setSelectedUserId(null);
        } catch (err) {
            setError(t('erreur_changement_mot_de_passe'));
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setForm({ nomComplet: '', login: '', password: '', idService: '' });
        setError('');
    };

    const exportToExcel = () => {
        fetch('/api/utilisateurs/export/excel', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'utilisateurs.xlsx';
                a.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(console.error);
    };

    const downloadTemplate = () => {
        fetch('/api/utilisateurs/template', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'modele_utilisateurs.xlsx';
                a.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(console.error);
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImportFile(file);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await axios.post('/api/utilisateurs/import/preview', formData);
            setHeaders(res.data);
            setShowMapping(true);
            setMapping({ nom: '', login: '', serviceId: '' });
        } catch (err) {
            setError(t('erreur_lecture_fichier'));
        }
    };

    const executeImport = async () => {
        if (!importFile) return;
        const formData = new FormData();
        formData.append('file', importFile);
        const params = new URLSearchParams({
            colNom: mapping.nom,
            colLogin: mapping.login,
            colServiceId: mapping.serviceId,
        });
        try {
            const res = await axios.post(`/api/utilisateurs/import/execute?${params.toString()}`, formData);
            const data = res.data;
            if (data.errors && data.errors.length > 0) {
                alert(`${data.imported} ${t('utilisateurs_importes')}\n${t('details_erreurs')} :\n${data.errors.join('\n')}`);
            } else {
                alert(`${data.imported} ${t('utilisateurs_importes_succes')}`);
            }
            if (data.imported > 0) fetchUsers();
            setShowMapping(false);
            setImportFile(null);
            setMapping({ nom: '', login: '', serviceId: '' });
        } catch (err) {
            setError(t('erreur_import'));
        }
    };

    const handleSelectAll = () => {
        setSelectAll(!selectAll);
        setSelectedIds(selectAll ? [] : users.map(u => u.id));
    };
    const handleSelectOne = (id) => {
        setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
    };

    return (
        <div className="page-container" dir="rtl">
            <h1 className="page-title">{t('gerer_utilisateurs')}</h1>
            {error && <div className="error-message">{error}</div>}
            <div className="filters">
                <input
                    type="text"
                    placeholder={t('rechercher_utilisateur')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <select value={filterService} onChange={e => setFilterService(e.target.value)}>
                    <option value="">{t('tous_services')}</option>
                    {services.map(s => (
                        <option key={s.idService} value={s.idService}>
                            {s.nomService}
                        </option>
                    ))}
                </select>
                <button className="btn-secondary" onClick={() => { setSearch(''); setFilterService(''); }}>
                    {t('reinitialiser')}
                </button>
                <button className="btn-primary" onClick={exportToExcel}>{t('exporter_excel')}</button>
                <button className="btn-secondary" onClick={downloadTemplate}>📥 {t('telecharger_modele')}</button>
                <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                    📂 {t('importer_excel')}
                    <input type="file" accept=".xlsx" onChange={handleFileSelect} style={{ display: 'none' }} />
                </label>
            </div>

            {showMapping && (
                <div className="mapping-panel" style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ccc', background: '#f9f9f9', borderRadius: '1rem' }}>
                    <h4>{t('associer_colonnes')}</h4>
                    <div className="form-grid">
                        <div className="form-field">
                            <label>{t('colonne_nom_complet')} *</label>
                            <select value={mapping.nom} onChange={e => setMapping({ ...mapping, nom: e.target.value })}>
                                <option value="">-- {t('choisir')} --</option>
                                {headers.map(h => <option key={h}>{h}</option>)}
                            </select>
                        </div>
                        <div className="form-field">
                            <label>{t('colonne_login')} *</label>
                            <select value={mapping.login} onChange={e => setMapping({ ...mapping, login: e.target.value })}>
                                <option value="">-- {t('choisir')} --</option>
                                {headers.map(h => <option key={h}>{h}</option>)}
                            </select>
                        </div>
                        <div className="form-field">
                            <label>{t('colonne_service_id')} *</label>
                            <select value={mapping.serviceId} onChange={e => setMapping({ ...mapping, serviceId: e.target.value })}>
                                <option value="">-- {t('choisir')} --</option>
                                {headers.map(h => <option key={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-actions">
                        <button className="btn-primary" onClick={executeImport}>{t('importer')}</button>
                        <button className="btn-secondary" onClick={() => setShowMapping(false)}>{t('annuler')}</button>
                    </div>
                </div>
            )}

            <div className="form-card">
                <h3>{editingId ? t('modifier_utilisateur') : t('ajouter_utilisateur')}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-field">
                            <label>{t('nom_complet')} *</label>
                            <input
                                type="text"
                                value={form.nomComplet}
                                onChange={e => setForm({ ...form, nomComplet: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-field">
                            <label>{t('login')} *</label>
                            <input
                                type="text"
                                value={form.login}
                                onChange={e => setForm({ ...form, login: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-field">
                            <label>{t('mot_de_passe')} {!editingId && '*'}</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                required={!editingId}
                                placeholder={editingId ? t('laisser_vide') : ""}
                            />
                        </div>
                        <div className="form-field">
                            <label>{t('service')} *</label>
                            <select
                                value={form.idService}
                                onChange={e => setForm({ ...form, idService: e.target.value })}
                                required
                            >
                                <option value="">{t('selectionner_service')}</option>
                                {services.map(s => (
                                    <option key={s.idService} value={s.idService}>
                                        {s.nomService}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn-primary">
                            {editingId ? t('mettre_a_jour') : t('ajouter')}
                        </button>
                        {editingId && (
                            <button type="button" className="btn-secondary" onClick={resetForm}>
                                {t('annuler')}
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div className="data-table-wrapper">
                <table className="modern-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" checked={selectAll} onChange={handleSelectAll} /></th>
                            <th>ID</th>
                            <th>{t('nom_complet')}</th>
                            <th>{t('login')}</th>
                            <th>{t('service')}</th>
                            <th>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id}>
                                <td><input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => handleSelectOne(u.id)} /></td>
                                <td>{u.id}</td>
                                <td>{u.nomComplet}</td>
                                <td>{u.login}</td>
                                <td>{u.nomService || `${t('service')} #${u.idService}`}</td>
                                <td className="action-icons">
                                    <button onClick={() => handleEdit(u)}>✏️</button>
                                    <button onClick={() => handleDelete(u.id)}>🗑️</button>
                                    <button onClick={() => { setSelectedUserId(u.id); setShowPasswordModal(true); }} style={{ color: 'blue' }}>🔑</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showPasswordModal && (
                <div className="modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', padding: '2rem', borderRadius: '1rem', zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                    <h3>{t('changer_mot_de_passe')}</h3>
                    <input
                        type="password"
                        placeholder={t('nouveau_mot_de_passe')}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', margin: '1rem 0' }}
                    />
                    <div className="form-actions" style={{ marginTop: '1rem' }}>
                        <button className="btn-primary" onClick={changePassword}>{t('valider')}</button>
                        <button className="btn-secondary" onClick={() => { setShowPasswordModal(false); setNewPassword(''); }}>{t('annuler')}</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GererUtilisateurs;