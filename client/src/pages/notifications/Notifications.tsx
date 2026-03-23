import React from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, MessageSquare, UserPlus, AlertCircle, FolderOpen, Filter } from 'lucide-react';
import { cn, formatRelativeTime } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { UserAvatar } from '../../components/UserAvatar';
import { EmptyState } from '../../components/ui';
import type { Notification } from '../../app/types';

const NOTIF_ICONS = {
  task_assigned: { icon: UserPlus, color: 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400' },
  comment_added: { icon: MessageSquare, color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400' },
  deadline_approaching: { icon: AlertCircle, color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400' },
  project_update: { icon: FolderOpen, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' },
  mention: { icon: Bell, color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400' },
};

export const NotificationsPage: React.FC = () => {
  const { notifications, users, markNotificationRead, markAllNotificationsRead } = useAppStore();
  const unread = notifications.filter(n => !n.isRead).length;

  const grouped = notifications.reduce((acc, n) => {
    const date = new Date(n.createdAt).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(n);
    return acc;
  }, {} as Record<string, Notification[]>);

  const groupedEntries = Object.entries(grouped).sort((a, b) =>
    new Date(b[0]).getTime() - new Date(a[0]).getTime()
  );

  return (
    <div className="max-w-full mx-auto">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            Notifications
            {unread > 0 && (
              <span className="w-6 h-6 bg-brand-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unread}
              </span>
            )}
          </h1>
          <p className="page-subtitle">Stay up to date with your workspace activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn-sm">
            <Filter size={13} /> Filter
          </button>
          {unread > 0 && (
            <button onClick={markAllNotificationsRead} className="btn-ghost btn-sm">
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} />}
          title="All caught up!"
          description="No notifications to show. We'll notify you when something happens."
        />
      ) : (
        <div className="space-y-6">
          {groupedEntries.map(([dateStr, notifs]) => {
            const date = new Date(dateStr);
            const isToday = new Date().toDateString() === dateStr;
            const isYesterday = new Date(Date.now() - 86400000).toDateString() === dateStr;
            const label = isToday ? 'Today' : isYesterday ? 'Yesterday' : date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

            return (
              <div key={dateStr}>
                <p className="section-title mb-3">{label}</p>
                <div className="card overflow-hidden divide-y divide-surface-50 dark:divide-surface-800">
                  {notifs.map((notif, i) => {
                    const { icon: Icon, color } = NOTIF_ICONS[notif.type];
                    const sender = users[i % Math.max(users.length, 1)];

                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => markNotificationRead(notif.id)}
                        className={cn(
                          'flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50',
                          !notif.isRead && 'bg-brand-50/40 dark:bg-brand-950/15'
                        )}
                      >
                        {/* Unread indicator */}
                        <div className="flex-shrink-0 pt-1">
                          {!notif.isRead ? (
                            <span className="w-2 h-2 bg-brand-600 rounded-full block" />
                          ) : (
                            <span className="w-2 h-2 rounded-full block" />
                          )}
                        </div>

                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
                          <Icon size={16} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm', !notif.isRead ? 'font-semibold text-surface-900 dark:text-white' : 'text-surface-700 dark:text-surface-300')}>
                            {notif.title}
                          </p>
                          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5 leading-relaxed">{notif.message}</p>
                          <p className="text-xs text-surface-400 mt-1.5">{formatRelativeTime(notif.createdAt)}</p>
                        </div>

                        {sender && <UserAvatar name={sender.name} color={sender.color} size="sm" className="flex-shrink-0 mt-0.5" />}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
