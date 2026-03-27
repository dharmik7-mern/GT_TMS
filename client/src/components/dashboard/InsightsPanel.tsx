import React from 'react';
import { motion } from 'framer-motion';

export type Insight = {
  key: string;
  label: string;
  value: number | string;
  helper?: string;
};

interface Props {
  data: Insight[];
  loading?: boolean;
}

export const InsightsPanel: React.FC<Props> = ({ data, loading }) => {
  const rows: Array<Insight | null> = loading ? Array.from({ length: 3 }, () => null) : data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card border border-surface-100 bg-white p-4 dark:border-surface-800 dark:bg-surface-900 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold text-surface-900 dark:text-white">Quick Insights</h3>
        <span className="text-[11px] text-surface-400">Today</span>
      </div>
      <div className="space-y-3">
        {rows.map((item, idx) => (
          <div key={item?.key || `skeleton-${idx}`} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                {item?.label || '...'}
              </p>
              <p className="text-[11px] text-surface-400">{item?.helper || (loading ? 'Loading' : '-')}</p>
            </div>
            <div className="text-xl font-bold text-surface-900 dark:text-white">
              {item?.value ?? '-'}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default InsightsPanel;
