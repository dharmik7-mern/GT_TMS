import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, CheckCheck, X, MessageSquare, AlertCircle, UserPlus, FolderOpen } from 'lucide-react';
import { cn, formatRelativeTime } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { UserAvatar } from '../UserAvatar';
import type { Notification } from '../../app/types';

interface NotificationPanelProps {
  onClose: () => void;
}

const NOTIF_ICONS = {
  task_assigned: { icon: UserPlus, color: 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400' },
  comment_added: { icon: MessageSquare, color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400' },
  deadline_approaching: { icon: AlertCircle, color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400' },
  project_update: { icon: FolderOpen, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' },
  mention: { icon: Bell, color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400' },
};

const NotifItem: React.FC<{ notif: Notification }> = ({ notif }) => {
  const { users, markNotificationRead } = useAppStore();
  const { icon: Icon, color } = NOTIF_ICONS[notif.type];
  const sender = users[Math.floor(Math.random() * Math.max(users.length, 1))];

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors cursor-pointer relative',
        !notif.isRead && 'bg-brand-50/40 dark:bg-brand-950/20'
      )}
      onClick={() => markNotificationRead(notif.id)}
    >
      {!notif.isRead && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-brand-600 rounded-full" />
      )}
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', !notif.isRead ? 'font-semibold text-surface-900 dark:text-white' : 'text-surface-700 dark:text-surface-300')}>
          {notif.title}
        </p>
        <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">{notif.message}</p>
        <p className="text-[11px] text-surface-400 mt-1">{formatRelativeTime(notif.createdAt)}</p>
      </div>
      {sender && <UserAvatar name={sender.name} color={sender.color} size="xs" className="flex-shrink-0 mt-0.5" />}
    </div>
  );
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const { notifications, markAllNotificationsRead } = useAppStore();
  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-surface-900 rounded-2xl shadow-modal border border-surface-100 dark:border-surface-800 overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-800">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-semibold text-surface-900 dark:text-white text-sm">Notifications</h3>
          {unread > 0 && (
            <span className="w-5 h-5 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread > 0 && (
            <button
              onClick={markAllNotificationsRead}
              className="btn-ghost btn-sm text-xs gap-1"
              title="Mark all as read"
            >
              <CheckCheck size={13} />
              <span className="hidden sm:inline">All read</span>
            </button>
          )}
          <button onClick={onClose} className="btn-ghost btn-sm w-7 h-7">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-surface-50 dark:divide-surface-800">
        {notifications.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
              <Bell size={18} className="text-surface-400" />
            </div>
            <p className="text-sm text-surface-400">No notifications yet</p>
          </div>
        ) : (
          notifications.map(notif => <NotifItem key={notif.id} notif={notif} />)
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-surface-100 dark:border-surface-800">
        <button
          onClick={() => { onClose(); }}
          className="w-full text-center text-xs text-brand-600 dark:text-brand-400 font-medium hover:text-brand-700 transition-colors py-0.5"
        >
          View all notifications →
        </button>
      </div>
    </motion.div>
  );
};

export default NotificationPanel;
