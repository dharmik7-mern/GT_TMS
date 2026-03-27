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
  const rows: Array<StatBarItem | null> = loading ? Array.from({ length: 5 }, () => null) : items;

  return (
    <div className="card border border-surface-100 bg-white p-4 dark:border-surface-800 dark:bg-surface-900 sm:p-5">
      <div className="flex flex-wrap gap-4 overflow-x-auto pb-1 lg:flex-nowrap">
        {rows.map((item, idx) => {
          const change = item?.change ?? null;
          const baseColor = item?.color || '#4a5568';
          return (
            <motion.button
              key={item?.key || `skeleton-${idx}`}
              type="button"
              whileHover={item ? { y: -2 } : undefined}
              whileTap={item ? { scale: 0.99 } : undefined}
              onClick={item?.onClick}
              disabled={!item}
              className={cn(
                'group h-[116px] min-w-[170px] max-w-[260px] flex-1 rounded-2xl bg-white px-4 py-3 text-left transition-all dark:bg-surface-900',
                item ? 'flex items-start gap-3' : 'animate-pulse cursor-default select-none'
              )}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-surface-900 dark:text-white"
                style={{ backgroundColor: '#f1f3f6', color: baseColor }}
              >
                {item?.icon || null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-500 dark:text-surface-400">
                  {item?.label || 'Loading'}
                </p>
                <p className="mt-1 truncate text-2xl font-semibold text-surface-900 dark:text-white">
                  {item?.value ?? '...'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={cn(
                    'flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold',
                    change === null
                      ? 'border-surface-200 bg-white/60 text-surface-400 dark:border-surface-700 dark:bg-surface-900'
                      : change >= 0
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30'
                        : 'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30'
                  )}
                >
                  {change === null ? '-' : `${change > 0 ? '+' : ''}${change}%`}
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
