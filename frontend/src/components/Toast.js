import React, { useEffect } from 'react';

function Toast({ message, type = 'success', duration = 5000, onClose }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className={`toast-message ${type}`}>
      <span>{getIcon()} {message}</span>
      <button onClick={onClose}>✕</button>
    </div>
  );
}

export default Toast;