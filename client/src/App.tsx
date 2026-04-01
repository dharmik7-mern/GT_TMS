import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { AnimatePresence } from 'framer-motion';
import { ToastProvider } from './context/ToastProvider';
import { useSSO } from './hooks/useSSO';

/**
 * SSOBoot — thin wrapper that calls useSSO() once at startup.
 * Must be a child of ToastProvider so it can use context if needed.
 */
const SSOBoot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useSSO(); // silently checks /api/auth/me on mount
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <SSOBoot>
        <AnimatePresence mode="wait">
          <RouterProvider router={router} />
        </AnimatePresence>
      </SSOBoot>
    </ToastProvider>
  );
};

export default App;
