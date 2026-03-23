import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { AnimatePresence } from 'framer-motion';
import { ToastProvider } from './context/ToastProvider';

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AnimatePresence mode="wait">
        <RouterProvider router={router} />
      </AnimatePresence>
    </ToastProvider>
  );
};

export default App;
