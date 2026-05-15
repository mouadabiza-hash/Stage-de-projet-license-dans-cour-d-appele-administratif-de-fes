import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

function Profile() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [selectedSubstituteId, setSelectedSubstituteId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Load all users except the current one
  useEffect(() => {
    if (!user?.id) return;
    axios
      .get('/api/utilisateurs')
      .then(res => setAllUsers(res.data.filter(u => u.id !== user.id)))
      .catch(err => setError(getErrorMessage(err, t('erreur_chargement'))));
  }, [user]);

  // Set current selection whenever user changes
  useEffect(() => {
    const current = user?.substituteUserId;
    setSelectedSubstituteId(current != null ? String(current) : '');
  }, [user]);

  // Find the selected substitute user object
  const substituteUser = allUsers.find(u => String(u.id) === selectedSubstituteId);

  // ---------- SAVE ----------
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
    } catch (err) {
      setError(getErrorMessage(err, t('erreur_enregistrement')));
    } finally {
      setSaving(false);
    }
  };

  // ---------- CANCEL (clear and save immediately) ----------
  const handleCancel = async () => {
    setSelectedSubstituteId('');
    // We need to wait for state update, so we call save with empty value directly
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await axios.put(`/api/utilisateurs/${user.id}`, { substituteUserId: null });
      setSuccess(t('substitute_cancelled') || 'Remplaçant annulé.');
      localStorage.removeItem('substituteUserId');
      setUser({ ...user, substituteUserId: null });
    } catch (err) {
      setError(getErrorMessage(err, t('erreur_enregistrement')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container" dir="rtl">
      <h1 className="page-title">{t('my_profile') || 'Mon profil'}</h1>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* ========== MY INFO CARD ========== */}
      <div className="form-card">
        <h3>{t('my_information') || 'Mes informations'}</h3>
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
            <label>{t('role') || 'Rôle'}</label>
            <input type="text" value={user?.role || ''} disabled />
          </div>
        </div>
      </div>

      {/* ========== SUBSTITUTE CARD ========== */}
      <div className="form-card">
        <h3>{t('substitute_management') || 'Gestion du remplaçant'}</h3>

        {/* Current substitute info */}
        {substituteUser ? (
          <div className="current-substitute-info" style={{ marginBottom: '1.5rem' }}>
            <p>
              <strong>{t('current_substitute') || 'Remplaçant actuel'} :</strong>{' '}
              {substituteUser.nomComplet} ({substituteUser.login})
            </p>
            <p>
              <strong>{t('service')} :</strong> {substituteUser.nomService || `#${substituteUser.idService}`}
            </p>
          </div>
        ) : (
          <p style={{ marginBottom: '1.5rem', color: 'var(--muted)' }}>
            {t('no_substitute_defined') || 'Aucun remplaçant défini.'}
          </p>
        )}

        <div className="form-grid">
          <div className="form-field full-width">
            <label>{t('choose_substitute') || 'Choisir un remplaçant'}</label>
            <select value={selectedSubstituteId} onChange={e => setSelectedSubstituteId(e.target.value)}>
              <option value="">-- {t('no_substitute') || 'Aucun'} --</option>
              {allUsers.map(u => (
                <option key={u.id} value={String(u.id)}>
                  {u.nomComplet} ({u.login})
                </option>
              ))}
            </select>
            <small>
              {t('substitute_explanation') ||
               'Ce collègue pourra traiter vos courriers et notifications en votre absence.'}
            </small>
          </div>
        </div>

        <div className="form-actions" style={{ justifyContent: 'space-between' }}>
          <div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : t('save') || 'Enregistrer'}
            </button>
            {selectedSubstituteId && (
              <button
                className="btn-secondary"
                onClick={handleCancel}
                disabled={saving}
                style={{ marginLeft: '1rem', color: 'var(--danger)' }}
              >
                {t('cancel_substitute') || 'Annuler le remplaçant'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Helper -----
function getErrorMessage(error, fallback = 'Une erreur est survenue') {
  if (typeof error === 'string') return error;
  if (error?.response?.data) {
    const data = error.response.data;
    if (typeof data === 'string') return data;
    if (data.errors) {
      const messages = Object.values(data.errors).flat();
      return messages.join(' | ');
    }
    if (data.title) return data.title;
  }
  if (error?.message) return error.message;
  return fallback;
}

export default Profile;