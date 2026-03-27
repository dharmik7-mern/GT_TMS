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
  const rows = loading ? Array.from({ length: 3 }) : data;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 sm:p-5 border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-surface-900 dark:text-white">Quick Insights</h3>
        <span className="text-[11px] text-surface-400">Today</span>
      </div>
      <div className="space-y-3">
        {rows.map((item, idx) => (
          <div key={loading ? `skeleton-${idx}` : item.key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                {loading ? '···' : item.label}
              </p>
              <p className="text-[11px] text-surface-400">{loading ? 'Loading' : item.helper || '—'}</p>
            </div>
            <div className="text-xl font-bold text-surface-900 dark:text-white">
              {loading ? '—' : item.value}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default InsightsPanel;
