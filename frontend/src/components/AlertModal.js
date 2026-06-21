import React from 'react';
import { useTranslation } from 'react-i18next';

function AlertModal({ isOpen, title, message, onClose, type = 'info' }) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const getIconColor = () => {
    switch (type) {
      case 'error':
        return '#ff1744';
      case 'success':
        return '#00c853';
      case 'warning':
        return '#ff9800';
      default:
        return '#1f4a7a';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div className="registry-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: getIconColor(),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.2rem',
                fontWeight: 'bold',
              }}
            >
              {type === 'error' && '!'}
              {type === 'success' && '✓'}
              {type === 'warning' && '⚠'}
              {type === 'info' && 'i'}
            </div>
            <h3 style={{ margin: 0 }}>{title || t('information')}</h3>
          </div>
          <button className="btn-secondary" onClick={onClose}></button>
        </div>

        <div style={{ padding: '1rem 1.375rem', color: '#0f2438', lineHeight: '1.6' }}>
          {message}
        </div>

        <div className="form-actions">
          <button className="btn-primary" onClick={onClose}>
            {t('ok') || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertModal;
