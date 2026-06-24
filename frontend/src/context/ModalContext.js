// ModalContext.js
import React, { createContext, useContext, useState } from 'react';

const ModalContext = createContext();

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};

export const ModalProvider = ({ children }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmer',
    cancelText: 'Annuler',
    onConfirm: null,
    onCancel: null,
  });

  // 🔥 VERSION CORRIGÉE DE showConfirm
  const showConfirm = (message, onConfirm, title = 'Confirmation', showCancel = true) => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        title,
        message,
        confirmText: 'Confirmer',
        cancelText: showCancel ? 'Annuler' : '',
        onConfirm: () => {
          if (onConfirm) onConfirm();
          resolve(true);
          closeModal();
        },
        onCancel: () => {
          resolve(false);
          closeModal();
        },
      });
    });
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const ModalComponent = () => {
    if (!modalState.isOpen) return null;
    
    return (
      <div className="modal-overlay" onClick={closeModal}>
        <div className="modal" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
          <div className="registry-panel-header">
            <h3>{modalState.title}</h3>
            <button className="btn-secondary" onClick={closeModal}>Fermer</button>
          </div>
          <div style={{ padding: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>{modalState.message}</p>
          </div>
          <div className="form-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
            <button className="btn-primary" onClick={modalState.onConfirm}>
              {modalState.confirmText}
            </button>
            {modalState.cancelText && (
              <button className="btn-secondary" onClick={closeModal}>
                {modalState.cancelText}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <ModalContext.Provider value={{ showConfirm, ModalComponent }}>
      {children}
    </ModalContext.Provider>
  );
};