import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  ChevronDown,
  FolderKanban,
  Hash,
  LayoutDashboard,
  ListTodo,
  Settings,
  Sparkles,
  UserCircle,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '../utils/helpers';
import { useAuthStore } from '../context/authStore';
import { useAppStore } from '../context/appStore';
import type { Role } from '../app/types';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  path: string;
  roles?: Role[];
  subItems?: { label: string; path: string; roles?: Role[] }[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'My Planner', icon: Sparkles, path: '/planner' },
  { label: 'Projects', icon: FolderKanban, path: '/projects' },
  { label: 'All Tasks', icon: ListTodo, path: '/tasks' },
  { label: 'Task Requests', icon: Hash, path: '/task-requests' },
  { label: 'Calendar', icon: Calendar, path: '/calendar' },
  { label: 'Teams', icon: Users, path: '/teams', roles: ['super_admin', 'admin', 'manager', 'team_leader'] },
  // { label: 'Report Management', icon: BarChart3, path: '/reports-management', roles: ['super_admin', 'admin', 'manager', 'team_leader'] },
  {
    label: 'MIS',
    icon: BarChart3,
    path: '#',
    subItems: [
      { label: 'Entry', path: '/mis-entry' },
      { label: 'Reviews', path: '/mis-manager', roles: ['super_admin', 'admin', 'manager', 'team_leader'] },
      { label: 'Reports', path: '/mis-reports', roles: ['super_admin', 'admin', 'manager'] },
    ],
  },
  { label: 'Activity Logs', icon: Activity, path: '/logs', roles: ['super_admin', 'admin', 'manager', 'team_leader'] },
];

const SUPER_ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'My Planner', icon: Sparkles, path: '/planner' },
  { label: 'Projects', icon: FolderKanban, path: '/projects' },
  { label: 'All Tasks', icon: ListTodo, path: '/tasks' },
  { label: 'Task Requests', icon: Hash, path: '/task-requests' },
  { label: 'Calendar', icon: Calendar, path: '/calendar' },
  { label: 'Teams', icon: Users, path: '/teams' },
  // { label: 'Report Management', icon: BarChart3, path: '/reports-management' },
  {
    label: 'MIS',
    icon: BarChart3,
    path: '#',
    subItems: [
      { label: 'Entry', path: '/mis-entry' },
      { label: 'Reviews', path: '/mis-manager' },
      { label: 'Reports', path: '/mis-reports' },
    ],
  },
  { label: 'Activity Logs', icon: Activity, path: '/logs' },
];

const PLATFORM_ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'My Planner', icon: Sparkles, path: '/planner' },
  { label: 'All Tasks', icon: ListTodo, path: '/tasks' },
  { label: 'Task Requests', icon: Hash, path: '/task-requests' },
  { label: 'Companies', icon: Building2, path: '/companies' },
  { label: 'Users List', icon: UserCircle, path: '/users' },
  // { label: 'Report Management', icon: Activity, path: '/reports-management' },
  { label: 'Reports & Analytics', icon: BarChart3, path: '/reports' },
  {
    label: 'MIS',
    icon: Zap,
    path: '#',
    subItems: [
      { label: 'Entry', path: '/mis-entry' },
      { label: 'Reviews', path: '/mis-manager' },
      { label: 'Reports', path: '/mis-reports' },
    ],
  },
  { label: 'Settings', icon: Settings, path: '/settings' },
  { label: 'System Logs', icon: Activity, path: '/logs' },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Workspaces', icon: Building2, path: '/admin/workspaces', roles: ['super_admin'] },
  { label: 'Users', icon: UserCircle, path: '/admin/users', roles: ['super_admin', 'admin'] },
  { label: 'Permissions', icon: Settings, path: '/admin/permissions', roles: ['super_admin', 'admin'] },
];

export const MobileSidebar: React.FC = () => {
  const { user } = useAuthStore();
  const { mobileSidebarOpen, closeMobileSidebar, unreadNotificationsCount, workspaces } = useAppStore();
  const location = useLocation();
  const [misExpanded, setMisExpanded] = useState(location.pathname.startsWith('/mis'));

  useEffect(() => {
    closeMobileSidebar();
  }, [closeMobileSidebar, location.pathname]);

  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    document.body.style.overflow = '';
    return undefined;
  }, [mobileSidebarOpen]);

  const unread = unreadNotificationsCount();
  const workspace = workspaces[0];

  const navItems = useMemo(() => (
    user?.role === 'super_admin'
      ? PLATFORM_ADMIN_NAV
      : user?.role === 'admin'
        ? SUPER_ADMIN_NAV
        : NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)))
  ), [user]);

  if (!user) return null;

  return (
    <AnimatePresence>
      {mobileSidebarOpen ? (
        <>
          <motion.button
            type="button"
            aria-label="Close mobile sidebar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeMobileSidebar}
            className="fixed inset-0 z-40 bg-surface-950/55 backdrop-blur-[2px] md:hidden"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[340px] flex-col overflow-hidden border-r border-surface-200 bg-white shadow-2xl dark:border-surface-800 dark:bg-surface-950 md:hidden"
          >
            <div className="border-b border-surface-100 bg-gradient-to-br from-brand-600 via-brand-500 to-sky-500 px-5 py-5 text-white dark:border-surface-800">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/16 backdrop-blur">
                  <img src="/1.png" alt="Workspace" className="h-9 w-9 object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">Workspace</p>
                  <p className="truncate text-base font-semibold">{workspace?.name || 'Gitakshmi PMS'}</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const subItemActive = item.subItems?.some((sub) => location.pathname === sub.path);
                const isMisOpen = item.label === 'MIS' && misExpanded;
                const isActive = item.path !== '#' && location.pathname.startsWith(item.path);

                return (
                  <div key={item.label}>
                    {!item.subItems ? (
                      <div
                        className={cn(
                          'rounded-2xl transition-all',
                          isActive
                            ? 'bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-950/40 dark:text-brand-300'
                            : 'text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-900'
                        )}
                      >
                        <NavLink to={item.path} className="flex w-full items-center gap-3" onClick={closeMobileSidebar}>
                          <div className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium">
                            <Icon size={18} className="shrink-0" />
                            <span className="flex-1">{item.label}</span>
                            {item.label === 'Notifications' && unread > 0 ? (
                              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {unread > 9 ? '9+' : unread}
                              </span>
                            ) : null}
                          </div>
                        </NavLink>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMisExpanded((prev) => !prev)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all',
                          subItemActive
                            ? 'bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-950/40 dark:text-brand-300'
                            : 'text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-900'
                        )}
                      >
                        <Icon size={18} className="shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        <ChevronDown size={15} className={cn('transition-transform', isMisOpen && 'rotate-180')} />
                      </button>
                    )}

                    {item.subItems ? (
                      <AnimatePresence initial={false}>
                        {isMisOpen ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-1 space-y-1 overflow-hidden pl-4"
                          >
                            {item.subItems
                              .filter((sub) => !sub.roles || sub.roles.includes(user.role))
                              .map((sub) => (
                                <NavLink
                                  key={sub.path}
                                  to={sub.path}
                                  onClick={closeMobileSidebar}
                                  className={({ isActive: subActive }) => cn(
                                    'flex items-center rounded-xl px-4 py-2.5 text-sm transition-colors',
                                    subActive
                                      ? 'bg-surface-100 font-medium text-surface-900 dark:bg-surface-900 dark:text-white'
                                      : 'text-surface-500 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-surface-900'
                                  )}
                                >
                                  {sub.label}
                                </NavLink>
                              ))}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    ) : null}
                  </div>
                );
              })}

              {user.role === 'admin' ? (
                <div className="pt-4">
                  <p className="px-4 pb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-surface-400">Administration</p>
                  <div className="space-y-1">
                    {ADMIN_NAV.filter((item) => !item.roles || item.roles.includes(user.role)).map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={closeMobileSidebar}
                          className={({ isActive }) => cn(
                            'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
                            isActive
                              ? 'bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-950/40 dark:text-brand-300'
                              : 'text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-900'
                          )}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {user.role !== 'super_admin' ? (
                <div className="pt-4">
                  <p className="px-4 pb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-surface-400">Quick Access</p>
                  <NavLink
                    to="/quick-tasks"
                    onClick={closeMobileSidebar}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-950/40 dark:text-brand-300'
                        : 'text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-900'
                    )}
                  >
                    <Zap size={18} className="shrink-0" />
                    <span>Quick Tasks</span>
                  </NavLink>
                </div>
              ) : null}
            </nav>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
};

export default MobileSidebar;
