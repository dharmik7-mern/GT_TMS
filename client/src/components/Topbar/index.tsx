import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, Sun, Moon, Plus, Command, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { UserAvatar } from '../UserAvatar';
import { NotificationPanel } from '../NotificationPanel';
import { MessageCircle } from 'lucide-react';
import { useAdminChatStore } from '../../pages/calendar/admin/store/useAdminChatStore.ts';

const BREADCRUMB_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  calendar: 'Calendar',
  teams: 'Teams',
  reports: 'Reports',
  notifications: 'Notifications',
  settings: 'Settings',
  admin: 'Admin',
  workspaces: 'Workspaces',
  users: 'Users',
  permissions: 'Permissions',
  billing: 'Billing',
  'my-tasks': 'My Tasks',
};

export const Topbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { darkMode, toggleDarkMode, sidebarCollapsed, unreadNotificationsCount, projects, tasks, users } = useAppStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);

  const unread = unreadNotificationsCount();
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const segments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => {
    const path = '/' + segments.slice(0, i + 1).join('/');
    // Check if it's a project ID
    const project = projects.find(p => p.id === seg);
    const label = project ? project.name : (BREADCRUMB_MAP[seg] || seg);
    return { label, path };
  });

  // Search results
  const searchResults = searchQuery.length > 1 ? [
    ...projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3).map(p => ({ type: 'project', id: p.id, label: p.name, sub: 'Project', color: p.color, path: `/projects/${p.id}` })),
    ...tasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 4).map(t => ({ type: 'task', id: t.id, label: t.title, sub: 'Task', color: '#3366ff', path: `/projects/${t.projectId}` })),
    ...users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3).map(u => ({ type: 'user', id: u.id, label: u.name, sub: u.jobTitle || 'User', color: u.color || '#3366ff', path: `/admin/users` })),
  ] : [];

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-[60px] bg-white/90 dark:bg-surface-900/90 backdrop-blur-md border-b border-surface-100 dark:border-surface-800 z-20 flex items-center px-4 gap-3 transition-all duration-250',
        sidebarCollapsed ? 'md:left-16' : 'md:left-[260px]',
        'left-0'
      )}
    >
      {/* Breadcrumbs - Simplified on mobile */}
      <nav className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0 mr-2 sm:mr-4 overflow-hidden">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.path}>
            {i > 0 && <ChevronRight size={14} className="text-surface-300 flex-shrink-0 hidden sm:block" />}
            <button
              onClick={() => navigate(crumb.path)}
              className={cn(
                'text-sm font-medium truncate transition-colors',
                i === breadcrumbs.length - 1
                  ? 'text-surface-900 dark:text-white'
                  : 'text-surface-400 hover:text-surface-700 dark:text-surface-500 dark:hover:text-surface-300 hidden sm:block'
              )}
            >
              {crumb.label}
            </button>
          </React.Fragment>
        ))}
      </nav>

      {/* Search */}
      <div ref={searchRef} className="relative hidden md:block">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-100 dark:border-surface-700 text-surface-400 text-sm transition-colors w-72">
          <Search size={14} className="text-surface-400" />
          <input
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search projects, tasks, people..."
            className="bg-transparent outline-none text-sm text-surface-800 dark:text-white placeholder:text-surface-400 w-full"
          />
          {/* <kbd className="hidden lg:flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-surface-200 dark:bg-surface-700 rounded font-mono text-surface-500">
            <Command size={9} /> 
          </kbd> */}
        </div>
        {searchOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-lg z-30">
            <div className="py-2 border-b border-surface-100 dark:border-surface-800 text-xs text-surface-400 px-3">Search results</div>
            {searchResults.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                {searchResults.map(result => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => { navigate(result.path); setSearchOpen(false); setSearchQuery(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors flex items-center gap-2"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: result.color }}>
                      {result.label[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-surface-800 dark:text-surface-200 truncate">{result.label}</div>
                      <div className="text-[11px] text-surface-500">{result.sub}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500">{result.type}</span>
                  </button>
                ))}
              </div>
            ) : searchQuery.length > 0 ? (
              <div className="p-3 text-sm text-surface-500">No results for "{searchQuery}"</div>
            ) : (
              <div className="p-3 text-sm text-surface-500">Search your projects, tasks, and users</div>
            )}
          </div>
        )}
      </div>


      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        className="btn-ghost btn-sm w-9 h-9 rounded-xl flex-shrink-0"
      >
        {darkMode ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      {/* Admin Chat Toggle */}
      {user?.role === 'admin' && (
        <button
          onClick={() => useAdminChatStore.getState().toggleSidebar()}
          className="btn-ghost btn-sm w-9 h-9 rounded-xl flex-shrink-0 relative group"
          title="Quick Messages"
        >
          <MessageCircle size={17} className="group-hover:text-brand-500 transition-colors" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full ring-2 ring-white dark:ring-surface-900 animate-pulse" />
        </button>
      )}

      {/* Notifications */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          className="relative btn-ghost btn-sm w-9 h-9 rounded-xl"
        >
          <Bell size={17} />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-rose rounded-full ring-2 ring-white dark:ring-surface-900" />
          )}
        </button>
        <AnimatePresence>
          {notifOpen && (
            <NotificationPanel onClose={() => setNotifOpen(false)} />
          )}
        </AnimatePresence>
      </div>

      {/* Profile */}
      {user && (
        <button
          onClick={() => navigate('/settings')}
          className="flex-shrink-0 hover:opacity-80 transition-opacity"
        >
          <UserAvatar name={user.name} color={user.color} size="sm" isOnline />
        </button>
      )}

      {/* Search Modal */}
      {/* <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-4 top-[60px] z-50 w-[360px] bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-xl"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-100 dark:border-surface-800">
              <Search size={16} className="text-surface-400" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search projects, tasks, people..."
                className="flex-1 bg-transparent text-surface-900 dark:text-white placeholder:text-surface-400 outline-none text-sm"
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 text-xs px-2 py-1 rounded-md">ESC</button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map(result => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => { navigate(result.path); setSearchOpen(false); setSearchQuery(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: result.color }}>
                      {result.label[0]}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{result.label}</p>
                      <p className="text-xs text-surface-400">{result.sub}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500 capitalize">{result.type}</span>
                  </button>
                ))
              ) : searchQuery.length > 0 ? (
                <div className="p-4 text-center text-xs text-surface-400">No results for "{searchQuery}"</div>
              ) : (
                <div className="p-3 text-xs text-surface-500">Type to search projects, tasks, and users</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence> */}
    </header>
  );
};

export default Topbar;
