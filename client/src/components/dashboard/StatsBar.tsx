import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/helpers';

export type StatBarItem = {
  key: string;
  label: string;
  value: number | string;
  change?: number | null;
  icon: React.ReactNode;
  color?: string;
  onClick?: () => void;
};

interface Props {
  items: StatBarItem[];
  loading?: boolean;
}

export const StatsBar: React.FC<Props> = ({ items, loading }) => {
  return (
    <div className="card border border-surface-100 dark:border-surface-800 p-4 sm:p-5 bg-white dark:bg-surface-900">
      <div className="flex flex-wrap lg:flex-nowrap overflow-x-auto gap-4 pb-1">
        {(loading ? Array.from({ length: 5 }) : items).map((item, idx) => {
          const skeleton = loading || !item;
          const change = item?.change ?? null;
          const baseColor = (item && item.color) || '#4a5568';
          const tileStyle = {
            backgroundColor: '#ffffff',
            borderColor: '#e5e7eb',
          };
          return (
            <motion.button
              key={skeleton ? `skeleton-${idx}` : item.key}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={item?.onClick}
              disabled={skeleton}
              className={cn(
                'group flex-1 min-w-[170px] max-w-[260px] flex items-start gap-3 rounded-2xl px-4 py-3 h-[116px] text-left',
                'bg-white dark:bg-surface-900 transition-all',
                skeleton && 'animate-pulse cursor-default select-none'
              )}
              style={tileStyle}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-surface-900 dark:text-white"
                style={{ backgroundColor: '#f1f3f6', color: baseColor }}
              >
                {skeleton ? null : item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] tracking-[0.16em] font-semibold text-surface-500 dark:text-surface-400 uppercase">
                  {skeleton ? 'Loading' : item.label}
                </p>
                <p className="text-2xl font-semibold text-surface-900 dark:text-white mt-1 truncate">
                  {skeleton ? '···' : item.value}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0 border',
                    change === null
                      ? 'text-surface-400 border-surface-200 dark:border-surface-700 bg-white/60 dark:bg-surface-900'
                      : change >= 0
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/40'
                      : 'text-rose-700 bg-rose-50 border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/40'
                  )}
                >
                  {change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default StatsBar;
