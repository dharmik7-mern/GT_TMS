import React, { createContext, useContext, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toast } from '../components/ui';
import { subscribeToToasts, type ToastPayload } from './toastBus';
import { useToast } from '../hooks';

interface ToastContextValue {
  pushToast: (toast: ToastPayload) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => subscribeToToasts(addToast), [addToast]);

  return (
    <ToastContext.Provider value={{ pushToast: addToast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex max-w-[calc(100vw-2rem)] flex-col gap-3">
        <AnimatePresence>
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <Toast
                id={toast.id}
                title={toast.title}
                message={toast.message}
                type={toast.type}
                onRemove={removeToast}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return context;
}
