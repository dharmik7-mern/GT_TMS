import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, Sun, Moon, User, Settings, LogOut, Menu } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { UserAvatar } from '../UserAvatar';
import { NotificationPanel } from '../NotificationPanel';
import { MessageCircle } from 'lucide-react';
import { useAdminChatStore } from '../../pages/calendar/admin/store/useAdminChatStore.ts';
import { tasksService } from '../../services/api';

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
  'mis-dashboard': 'MIS Dashboard',
  'mis-entry': 'MIS Entry',
  'mis-manager': 'Manager Reviews',
  'mis-reports': 'MIS Reports',
  'quick-tasks': 'Quick Tasks',
  'planner': 'Planner',
  'create': 'Create Project',
};

export const Topbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { darkMode, toggleDarkMode, sidebarCollapsed, unreadNotificationsCount, projects, tasks, users, toggleMobileSidebar } = useAppStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const { conversations, fetchConversations } = useAdminChatStore();
  const unread = unreadNotificationsCount();
  const hasUnreadChat = conversations.some(c => (c.unreadCount || 0) > 0);
  const searchRef = useRef<HTMLDivElement>(null);

  // Global unread polling for Chat Messenger
  useEffect(() => {
    if (user) {
      fetchConversations(); // initial load
      const interval = setInterval(() => {
        if (!useAdminChatStore.getState().isOpen) {
          fetchConversations();
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [user, fetchConversations]);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
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
        'fixed top-0 right-0 z-20 flex h-[60px] items-center gap-1 bg-surface-50/80 px-4 backdrop-blur-xl transition-all duration-250 dark:bg-surface-950/80',
        sidebarCollapsed ? 'md:left-16' : 'md:left-[260px]'
      )}
    >
      {/* Page Title - Always Uppercase */}
      <button
        type="button"
        onClick={toggleMobileSidebar}
        className="btn-ghost btn-sm h-10 w-10 rounded-2xl border border-surface-200 bg-white/80 md:hidden dark:border-surface-700 dark:bg-surface-900/80"
        aria-label="Open navigation menu"
      >
        <Menu size={18} />
      </button>
      <div className="flex-1 min-w-0 mr-4">
        <h1 className="text-xs sm:text-sm font-bold tracking-[0.2em] text-surface-900 dark:text-white uppercase">
          {breadcrumbs[breadcrumbs.length - 1]?.label || ''}
        </h1>
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setSearchOpen((prev) => !prev)}
          className="btn-ghost btn-sm w-9 h-9 rounded-xl flex-shrink-0 md:hidden"
        >
          <Search size={17} />
        </button>

        <div className="relative hidden md:block">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-100 dark:border-surface-700 text-surface-400 text-sm transition-colors w-72">
            <Search size={14} className="text-surface-400" />
            <input
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects, tasks, people..."
              className="bg-transparent outline-none text-sm text-surface-800 dark:text-white placeholder:text-surface-400 w-full"
            />
          </div>
        </div>

        {searchOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-lg z-30 hidden md:block">
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
        {searchOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 md:hidden">
            <div className="rounded-2xl border border-surface-200 bg-white p-2 shadow-lg dark:border-surface-700 dark:bg-surface-900">
              <div className="flex items-center gap-2 rounded-xl bg-surface-50 px-3 py-2 dark:bg-surface-800">
                <Search size={14} className="text-surface-400" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search projects, tasks, people..."
                  className="w-full bg-transparent text-sm text-surface-800 outline-none placeholder:text-surface-400 dark:text-white"
                />
              </div>
              <div className="mt-2 max-h-64 overflow-y-auto">
                {searchResults.length > 0 ? searchResults.map(result => (
                  <button
                    key={`mobile-${result.type}-${result.id}`}
                    onClick={() => { navigate(result.path); setSearchOpen(false); setSearchQuery(''); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-800"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: result.color }}>
                      {result.label[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-surface-800 dark:text-surface-200">{result.label}</div>
                      <div className="text-[11px] text-surface-500">{result.sub}</div>
                    </div>
                  </button>
                )) : searchQuery.length > 0 ? (
                  <div className="px-3 py-2 text-sm text-surface-500">No results for "{searchQuery}"</div>
                ) : (
                  <div className="px-3 py-2 text-sm text-surface-500">Search your projects, tasks, and users</div>
                )}
              </div>
            </div>
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

      {/* Messenger Toggle */}
      {user && (
        <button
          onClick={() => useAdminChatStore.getState().toggleSidebar()}
          className="btn-ghost btn-sm w-9 h-9 rounded-xl flex-shrink-0 relative group"
          title="Messenger"
        >
          <MessageCircle size={17} className="group-hover:text-brand-500 transition-colors" />
          {hasUnreadChat && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-rose rounded-full ring-2 ring-white dark:ring-surface-900" />
          )}
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
        <div ref={profileRef} className="relative flex-shrink-0">
          <button

            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
            aria-label="Open profile menu"
          >
            <UserAvatar name={user.name} avatar={user.avatar} color={user.color} size="sm" isOnline />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-lg dark:border-surface-800 dark:bg-surface-900"
              >
                <div className="border-b border-surface-100 px-4 py-3 dark:border-surface-800">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-surface-400">{user.email}</p>
                </div>

                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/settings');
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-surface-700 transition-colors hover:bg-surface-50 dark:text-surface-200 dark:hover:bg-surface-800"
                  >
                    <User size={15} />
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/settings');
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-surface-700 transition-colors hover:bg-surface-50 dark:text-surface-200 dark:hover:bg-surface-800"
                  >
                    <Settings size={15} />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/notifications');
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-surface-700 transition-colors hover:bg-surface-50 dark:text-surface-200 dark:hover:bg-surface-800"
                  >
                    <Bell size={15} />
                    Notifications
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await tasksService.getOverdue({ suppressErrorToast: true });
                        const count = Number(res?.data?.count || 0);
                        if (count > 0) {
                          window.alert(`You have ${count} overdue task${count === 1 ? '' : 's'}. Please update them before logout.`);
                          setProfileOpen(false);
                          navigate('/tasks?filter=overdue');
                          return;
                        }
                      } catch {
                        // ignore
                      }
                      logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  >
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
