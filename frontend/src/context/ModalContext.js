import React, { createContext, useState, useCallback } from 'react';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';

export const ModalContext = createContext();

export function ModalProvider({ children }) {
  const [alert, setAlert] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [confirm, setConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    isDangerous: false,
    onConfirm: null,
    onCancel: null,
  });

  const showAlert = useCallback((message, title = 'Information', type = 'info') => {
    setAlert({ isOpen: true, title, message, type });
  }, []);

  const closeAlert = useCallback(() => {
    setAlert({ ...alert, isOpen: false });
  }, [alert]);

  const showConfirm = useCallback((message, onConfirm, title = 'Confirmation', isDangerous = false) => {
    return new Promise((resolve) => {
      setConfirm({
        isOpen: true,
        title,
        message,
        isDangerous,
        onConfirm: () => {
          resolve(true);
          onConfirm?.();
          setConfirm((prev) => ({ ...prev, isOpen: false }));
        },
        onCancel: () => {
          resolve(false);
          setConfirm((prev) => ({ ...prev, isOpen: false }));
        },
      });
    });
  }, []);

  const closeConfirm = useCallback(() => {
    confirm.onCancel?.();
  }, [confirm]);

  return (
    <ModalContext.Provider value={{ showAlert, closeAlert, showConfirm, closeConfirm }}>
      {children}
      <AlertModal
        isOpen={alert.isOpen}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={closeAlert}
      />
      <ConfirmModal
        isOpen={confirm.isOpen}
        title={confirm.title}
        message={confirm.message}
        isDangerous={confirm.isDangerous}
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
    </ModalContext.Provider>
  );
}

export const useModal = () => React.useContext(ModalContext);
