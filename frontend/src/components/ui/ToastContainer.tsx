import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastMessage } from '../../types';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={16} color="#10b981" />;
      case 'error':
        return <AlertCircle size={16} color="#ef4444" />;
      case 'warning':
        return <AlertTriangle size={16} color="#f59e0b" />;
      default:
        return <Info size={16} color="#3b82f6" />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container-root" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item ${toast.type} anim-slide-up`}>
            {getIcon(toast.type)}
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ marginLeft: 'auto', opacity: 0.6, display: 'grid', placeItems: 'center' }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
