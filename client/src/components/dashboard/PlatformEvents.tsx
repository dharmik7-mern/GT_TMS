import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/helpers';

export type PlatformEvent = {
  id: string;
  description: string;
  time: string;
  icon: React.ReactNode;
  color: string;
};

interface Props {
  events: PlatformEvent[];
  loading?: boolean;
}

export const PlatformEvents: React.FC<Props> = ({ events, loading }) => {
  const rows = loading ? Array.from({ length: 4 }) : events;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 sm:p-5 h-full border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-display font-semibold text-surface-900 dark:text-white">Platform Events</h3>
        {!loading && events.length > 0 && (
          <span className="text-[11px] font-medium text-surface-400 whitespace-nowrap">
            Latest {events.length}
          </span>
        )}
      </div>
      <div className="space-y-3 sm:space-y-4">
        {rows.map((event, idx) => (
          <div key={loading ? `skeleton-${idx}` : event.id} className="flex items-start gap-2.5 sm:gap-3">
            <div
              className={cn(
                'w-7 h-7 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-white flex-shrink-0 mt-0.5',
                loading ? 'bg-surface-100 dark:bg-surface-800 animate-pulse' : event.color
              )}
            >
              {!loading && event.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-[13px] leading-5 text-surface-700 dark:text-surface-300 break-words">
                {loading ? 'Loading event…' : event.description}
              </p>
              <p className="text-[10px] sm:text-[11px] text-surface-400 mt-1">{loading ? '—' : event.time}</p>
            </div>
          </div>
        ))}
        {!loading && events.length === 0 && (
          <p className="text-sm text-surface-400">No recent platform events found.</p>
        )}
      </div>
    </motion.div>
  );
};

export default PlatformEvents;
