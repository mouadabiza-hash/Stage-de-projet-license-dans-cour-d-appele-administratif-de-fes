// components/ConfirmModal.js
import React from 'react';
import { useTranslation } from 'react-i18next';

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText, cancelText }) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
        <div className="registry-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#ff9800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.2rem',
                fontWeight: 'bold',
              }}
            >
              ?
            </div>
            <h3 style={{ margin: 0 }}>{title || t('confirmation') || 'Confirmation'}</h3>
          </div>
          <button className="btn-secondary" onClick={onCancel}>✕</button>
        </div>

        <div style={{ padding: '1rem 1.375rem', color: '#0f2438', lineHeight: '1.6', textAlign: 'center' }}>
          <p style={{ fontSize: '1rem' }}>{message}</p>
        </div>

        <div className="form-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
          <button 
            className="btn-secondary" 
            onClick={onCancel}  // ← ICI : onCancel est appelé
          >
            {cancelText || t('annuler') || 'Annuler'}
          </button>
          <button
            className="btn-primary"
            onClick={onConfirm}
            style={{
              backgroundColor: '#dc2626',
              borderColor: '#dc2626',
            }}
          >
            {confirmText || t('confirmer') || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;