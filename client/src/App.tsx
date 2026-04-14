import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { AnimatePresence } from 'framer-motion';
import { ToastProvider } from './context/ToastProvider';
import { AuthProvider } from './context/AuthContext';

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <AnimatePresence mode="wait">
          <RouterProvider router={router} />
        </AnimatePresence>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
