import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function GenericImportModal({ 
  isOpen, 
  onClose, 
  title, 
  endpoint, 
  requiredColumns = [], 
  onSuccess 
}) {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setError('');
    setSuccess('');
  };

  const handleImport = async () => {
    if (!file) {
      setError(t('selectionner_fichier'));
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { imported, errors } = res.data;
      if (imported > 0) {
        setSuccess(t('import_succes', { count: imported }));
        if (onSuccess) onSuccess();
      }
      if (errors && errors.length) {
        setError(errors.join(' | '));
      } else if (imported === 0 && (!errors || errors.length === 0)) {
        setError(t('aucune_ligne_importee'));
      }
      setFile(null);
      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 2000);
    } catch (err) {
      const msg = err.response?.data || err.message || t('erreur_import');
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="registry-panel-header">
          <h3>{title}</h3>
          <button className="btn-secondary" onClick={onClose}>{t('fermer')}</button>
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label>{t('fichier_excel')} (.xlsx)</label>
            <input type="file" accept=".xlsx" onChange={handleFileChange} />
          </div>
          {requiredColumns.length > 0 && (
            <div className="form-field">
              <small>{t('colonnes_requises')} : {requiredColumns.join(', ')}</small>
            </div>
          )}
        </div>
        {error && <div className="error-message" style={{ marginTop: '0.5rem' }}>{error}</div>}
        {success && <div className="success-message" style={{ marginTop: '0.5rem' }}>{success}</div>}
        <div className="form-actions">
          <button className="btn-primary" onClick={handleImport} disabled={loading}>
            {loading ? t('importing') : t('importer')}
          </button>
          <button className="btn-secondary" onClick={onClose}>{t('annuler')}</button>
        </div>
      </div>
    </div>
  );
}

export default GenericImportModal;