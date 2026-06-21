import React from 'react';
import { useTranslation } from 'react-i18next';

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText, cancelText, isDangerous = false }) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div className="registry-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: isDangerous ? '#ff1744' : '#ff9800',
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
            <h3 style={{ margin: 0 }}>{title || t('confirmation')}</h3>
          </div>
          <button className="btn-secondary" onClick={onCancel}></button>
        </div>

        <div style={{ padding: '1rem 1.375rem', color: '#0f2438', lineHeight: '1.6' }}>
          {message}
        </div>

        <div className="form-actions" style={{ justifyContent: 'flex-end', gap: '0.625rem' }}>
          <button className="btn-secondary" onClick={onCancel}>
            {cancelText || t('annuler')}
          </button>
          <button
            className="btn-primary"
            onClick={onConfirm}
            style={{
              backgroundColor: isDangerous ? '#ff1744' : undefined,
              borderColor: isDangerous ? '#ff1744' : undefined,
            }}
          >
            {confirmText || t('confirmer')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
