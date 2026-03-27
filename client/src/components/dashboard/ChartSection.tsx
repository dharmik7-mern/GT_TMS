import React, { Suspense } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';

type Point = { day: string; completed: number; added: number };

interface Props {
  data: Point[];
  title?: string;
  loading?: boolean;
}

const ChartSkeleton = () => (
  <div className="h-[160px] w-full animate-pulse rounded-2xl bg-surface-50 dark:bg-surface-800/60" />
);

const ChartBody: React.FC<Props> = ({ data, title, loading }) => {
  if (loading) return <ChartSkeleton />;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 sm:p-5 h-full border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-surface-900 dark:text-white">{title || 'Task Activity'}</h3>
          <p className="text-xs text-surface-400">Last 7 days</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-surface-500">
            <span className="w-3 h-1 bg-brand-500 rounded-full inline-block" />
            Completed
          </span>
          <span className="flex items-center gap-1.5 text-surface-500">
            <span className="w-3 h-1 bg-surface-300 dark:bg-surface-600 rounded-full inline-block" />
            Added
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3366ff" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#3366ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8896b8' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8896b8' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--tw-bg-opacity, #fff)',
              border: '1px solid #e4e8f2',
              borderRadius: '12px',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          />
          <Area type="monotone" dataKey="completed" stroke="#3366ff" strokeWidth={2} fill="url(#colorCompleted)" />
          <Area type="monotone" dataKey="added" stroke="#d6ddf2" strokeWidth={1.5} fill="none" strokeDasharray="4 4" />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

const ChartSection: React.FC<Props> = (props) => {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ChartBody {...props} />
    </Suspense>
  );
};

export default ChartSection;
