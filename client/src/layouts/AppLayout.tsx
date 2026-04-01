import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { useAppStore } from '../context/appStore';
import { cn } from '../utils/helpers';
import MobileNav from '../components/MobileNav';
import { useAuthStore } from '../context/authStore.ts';
import { AdminChatSidebar } from '../pages/calendar/admin/components/AdminChatSidebar.tsx';
import { usersService } from '../services/api';

export const AppLayout: React.FC = () => {
  const { sidebarCollapsed, darkMode, bootstrap } = useAppStore();
  const { user, updateUser, logout } = useAuthStore();

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

  useEffect(() => {
    if (!user) return;

    usersService.me()
      .then((res) => {
        const freshUser = res.data?.data ?? res.data;
        if (freshUser) updateUser(freshUser);
      })
      .catch(() => {
        logout();
      });
  }, [user?.id, updateUser, logout]);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <Sidebar />
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
      {user && <AdminChatSidebar />}
    </div>
  );
};

export default AppLayout;
