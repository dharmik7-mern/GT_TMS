import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Calendar, Bell, Settings } from 'lucide-react';
import { cn } from '../utils/helpers';
import { useAppStore } from '../context/appStore';

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { path: '/projects', icon: FolderKanban, label: 'Projects' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/notifications', icon: Bell, label: 'Alerts' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

const MobileNav: React.FC = () => {
  const { unreadNotificationsCount } = useAppStore();
  const unread = unreadNotificationsCount();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-surface-900/95 backdrop-blur-md border-t border-surface-100 dark:border-surface-800 z-30 md:hidden">
      <div className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all min-w-[50px]',
              isActive
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-surface-400 dark:text-surface-500'
            )}
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'relative w-6 h-6 flex items-center justify-center rounded-xl transition-all',
                  isActive && 'bg-brand-50 dark:bg-brand-950/50'
                )}>
                  <Icon size={18} />
                  {label === 'Alerts' && unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
                  )}
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNav;
