// hooks/useConfirm.js
import { useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';

export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    onConfirm: null,
    onCancel: null,
  });

  const confirm = (message, options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        title: options.title || 'Confirmation',
        confirmText: options.confirmText || 'Confirmer',
        cancelText: options.cancelText || 'Annuler',
        onConfirm: () => {
          resolve(true);
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        },
        onCancel: () => {
          resolve(false);
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        },
      });
    });
  };

  const ConfirmModalComponent = () => (
    <ConfirmModal
      isOpen={confirmState.isOpen}
      onClose={() => {
        // 🔥 Appeler onCancel quand on ferme par le overlay ou le bouton X
        if (confirmState.onCancel) {
          confirmState.onCancel();
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }}
      onConfirm={() => {
        if (confirmState.onConfirm) {
          confirmState.onConfirm();
        }
      }}
      onCancel={() => {
        // 🔥 Appeler onCancel quand on clique sur Annuler
        if (confirmState.onCancel) {
          confirmState.onCancel();
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }}
      title={confirmState.title}
      message={confirmState.message}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
    />
  );

  return { confirm, ConfirmModalComponent };
};