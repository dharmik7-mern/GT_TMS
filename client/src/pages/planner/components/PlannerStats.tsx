import React from 'react';
import { cn } from '../../../utils/helpers';

interface PlannerStatsProps {
  stats: {
    total: number;
    completed: number;
    completedToday: number;
    streak: number;
  } | null;
  onSelect?: (filter: 'all' | 'today') => void;
}

export const PlannerStats: React.FC<PlannerStatsProps> = ({ stats, onSelect }) => {
  if (!stats) return null;

  const total = stats.total || 0;
  const completed = stats.completed || 0;
  const openCount = total - completed;
  
  return (
    <div className="flex items-center gap-4 py-0.5 overflow-x-auto no-scrollbar whitespace-nowrap">
      <button type="button" onClick={() => onSelect?.('all')} className="flex items-center gap-2 group">
        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Active</span>
        <span className="text-xs font-bold text-surface-900 dark:text-white px-2 py-0.5 bg-brand-50/50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-md border border-brand-100/50 dark:border-brand-800/50 leading-none">{openCount}</span>
      </button>
      
      <div className="w-1.5 h-1.5 rounded-full bg-surface-100 dark:bg-surface-800" />
      
      <button type="button" onClick={() => onSelect?.('today')} className="flex items-center gap-2 group">
        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Done</span>
        <span className="text-xs font-bold text-green-600 dark:text-green-300 px-2 py-0.5 bg-green-50/50 dark:bg-green-900/20 rounded-md border border-green-100/50 dark:border-green-800/50 whitespace-nowrap leading-none">{stats.completedToday}</span>
      </button>

    </div>
  );
};
