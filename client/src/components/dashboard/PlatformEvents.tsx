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
  const rows: Array<PlatformEvent | null> = loading ? Array.from({ length: 4 }, () => null) : events;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card h-full border border-surface-100 bg-white p-4 dark:border-surface-800 dark:bg-surface-900 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display font-semibold text-surface-900 dark:text-white">Platform Events</h3>
        {!loading && events.length > 0 && (
          <span className="whitespace-nowrap text-[11px] font-medium text-surface-400">
            Latest {events.length}
          </span>
        )}
      </div>
      <div className="space-y-3 sm:space-y-4">
        {rows.map((event, idx) => (
          <div key={event?.id || `skeleton-${idx}`} className="flex items-start gap-2.5 sm:gap-3">
            <div
              className={cn(
                'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white sm:h-6 sm:w-6',
                event ? event.color : 'bg-surface-100 dark:bg-surface-800 animate-pulse'
              )}
            >
              {event?.icon || null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words text-xs leading-5 text-surface-700 dark:text-surface-300 sm:text-[13px]">
                {event?.description || 'Loading event...'}
              </p>
              <p className="mt-1 text-[10px] text-surface-400 sm:text-[11px]">{event?.time || '-'}</p>
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
