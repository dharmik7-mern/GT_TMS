import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from '../components/Sidebar';
import { MobileSidebar } from '../components/MobileSidebar';
import { Topbar } from '../components/Topbar';
import { useAppStore } from '../context/appStore';
import { cn } from '../utils/helpers';
import MobileNav from '../components/MobileNav';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const { sidebarCollapsed, darkMode, bootstrap } = useAppStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    bootstrap().catch(() => {});
  }, [bootstrap]);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <Sidebar />
      <MobileSidebar />
      <Topbar />
      <main
        className={cn(
          'transition-all duration-250 pt-[60px] min-h-screen ml-0',
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-[260px]'
        )}
      >
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-6 max-md:p-4 max-md:pb-24"
        >
          <Outlet />
        </motion.div>
      </main>
      <MobileNav />
    </div>
  );
};

export default AppLayout;
