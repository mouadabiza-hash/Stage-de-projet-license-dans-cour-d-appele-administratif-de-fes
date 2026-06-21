import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';

function Profile() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const { showConfirm } = useModal();
  const [allUsers, setAllUsers] = useState([]);
  const [selectedSubstituteId, setSelectedSubstituteId] = useState('');
  const [substitutionHistory, setSubstitutionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Load all users except current
  useEffect(() => {
    if (!user?.id) return;
    axios
      .get('/api/utilisateurs')
      .then(res => setAllUsers(res.data.filter(u => u.id !== user.id)))
      .catch(err => setError(getErrorMessage(err, t('erreur_chargement'))));
  }, [user]);

  // Load substitution history for current user
  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      const res = await axios.get('/api/utilisateurs/substitution-history');
      setSubstitutionHistory(res.data);
    } catch (err) {
      console.error('Failed to load substitution history', err);
      setError(t('erreur_chargement_historique'));
    } finally {
      setLoadingHistory(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Set current selection whenever user changes
  useEffect(() => {
    const current = user?.substituteUserId;
    setSelectedSubstituteId(current != null ? String(current) : '');
  }, [user]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const payload = {
        substituteUserId: selectedSubstituteId ? Number(selectedSubstituteId) : null
      };
      await axios.put(`/api/utilisateurs/${user.id}`, payload);
      setSuccess(t('substitute_updated'));

      // Update localStorage and context
      if (selectedSubstituteId) {
        localStorage.setItem('substituteUserId', selectedSubstituteId);
      } else {
        localStorage.removeItem('substituteUserId');
      }
      setUser({
        ...user,
        substituteUserId: selectedSubstituteId ? Number(selectedSubstituteId) : null
      });
      // Refresh history after update
      await loadHistory();
    } catch (err) {
      setError(getErrorMessage(err, t('erreur_enregistrement')));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.put(`/api/utilisateurs/${user.id}`, { substituteUserId: null });
      setSuccess(t('substitute_cancelled'));
      localStorage.removeItem('substituteUserId');
      setUser({ ...user, substituteUserId: null });
      setSelectedSubstituteId('');
      // Refresh history after removal
      await loadHistory();
    } catch (err) {
      setError(getErrorMessage(err, t('erreur_enregistrement')));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHistory = async (historyId) => {
    const confirmed = await showConfirm(t('confirm_delete_history'), null, t('confirmation'), true);
    if (!confirmed) return;
    try {
      await axios.delete(`/api/utilisateurs/substitution-history/${historyId}`);
      await loadHistory();
      setSuccess(t('history_deleted'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, t('erreur_suppression')));
    }
  };

  const activeSub = substitutionHistory.find(h => h.isActive === true);
  const inactiveRecords = substitutionHistory.filter(h => !h.isActive);

  return (
    <div className="page-container">
      <h1 className="page-title">{t('my_profile')}</h1>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* My info card */}
      <div className="form-card">
        <h3>{t('my_information')}</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>{t('nom_complet')}</label>
            <input type="text" value={user?.nomComplet || ''} disabled />
          </div>
          <div className="form-field">
            <label>{t('login')}</label>
            <input type="text" value={user?.login || ''} disabled />
          </div>
          <div className="form-field">
            <label>{t('service')}</label>
            <input type="text" value={user?.nomService || ''} disabled />
          </div>
          <div className="form-field">
            <label>{t('role')}</label>
            <input type="text" value={user?.role || ''} disabled />
          </div>
        </div>
      </div>

      {/* Substitute management card */}
      <div className="form-card">
        <h3>{t('substitute_management')}</h3>

        {activeSub ? (
          <div className="current-substitute-info" style={{ marginBottom: '1.5rem' }}>
            <p><strong>{t('current_substitute')} :</strong> {activeSub.substituteName}</p>
            <p><strong>{t('date_assigned')} :</strong> {new Date(activeSub.dateAssigned).toLocaleString()}</p>
          </div>
        ) : (
          <p style={{ marginBottom: '1.5rem', color: 'var(--muted)' }}>{t('no_substitute_defined')}</p>
        )}

        <div className="form-grid">
          <div className="form-field full-width">
            <label>{t('choose_substitute')}</label>
            <select value={selectedSubstituteId} onChange={e => setSelectedSubstituteId(e.target.value)}>
              <option value="">-- {t('no_substitute')} --</option>
              {allUsers.map(u => (
                <option key={u.id} value={String(u.id)}>{u.nomComplet} ({u.login})</option>
              ))}
            </select>
            <small>{t('substitute_explanation')}</small>
          </div>
        </div>

        <div className="form-actions" style={{ justifyContent: 'space-between' }}>
          <div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </button>
            {selectedSubstituteId && (
              <button className="btn-secondary" onClick={handleCancel} disabled={saving} style={{ marginLeft: '1rem', color: 'var(--danger)' }}>
                {t('cancel_substitute')}
              </button>
            )}
          </div>
          <button className="btn-secondary" onClick={loadHistory}>🔄 {t('refresh')}</button>
        </div>
      </div>

      {/* Substitution history table */}
      <div className="form-card">
        <h3>{t('substitution_history')}</h3>
        {loadingHistory ? (
          <div className="loading">{t('chargement')}</div>
        ) : substitutionHistory.length === 0 ? (
          <p className="text-muted">{t('no_substitution_history')}</p>
        ) : (
          <div className="data-table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>{t('substitute_name')}</th>
                  <th>{t('date_assigned')}</th>
                  <th>{t('date_removed')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {/* Active record first */}
                {activeSub && (
                  <tr key={activeSub.id}>
                    <td>{activeSub.substituteName}</td>
                    <td>{new Date(activeSub.dateAssigned).toLocaleString()}</td>
                    <td>-</td>
                    <td><span className="status-badge active">{t('active')}</span></td>
                    <td className="action-icons">-</td>
                  </tr>
                )}
                {/* Inactive records */}
                {inactiveRecords.map(history => (
                  <tr key={history.id}>
                    <td>{history.substituteName}</td>
                    <td>{new Date(history.dateAssigned).toLocaleString()}</td>
                    <td>{history.dateRemoved ? new Date(history.dateRemoved).toLocaleString() : '-'}</td>
                    <td><span className="status-badge inactive">{t('inactive')}</span></td>
                    <td className="action-icons">
                      <button onClick={() => handleDeleteHistory(history.id)} className="btn-danger" title={t('supprimer')}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function getErrorMessage(error, fallback = 'Une erreur est survenue') {
  if (typeof error === 'string') return error;
  if (error?.response?.data) {
    const data = error.response.data;
    if (typeof data === 'string') return data;
    if (data.errors) return Object.values(data.errors).flat().join(' | ');
    if (data.title) return data.title;
  }
  if (error?.message) return error.message;
  return fallback;
}

export default Profile;