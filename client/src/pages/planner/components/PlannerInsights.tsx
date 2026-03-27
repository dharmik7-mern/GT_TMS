import React from 'react';
import { X, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import type { PersonalTask } from '../../../app/types';

interface PlannerInsightsProps {
  tasks: PersonalTask[];
  onClose: () => void;
}

export const PlannerInsights: React.FC<PlannerInsightsProps> = ({ tasks, onClose }) => {
  const completed = tasks.filter(t => t.status === 'done').length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-950">
      <header className="p-6 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
        <h2 className="text-xs font-black uppercase tracking-widest text-surface-900 dark:text-white flex items-center gap-2">
          <TrendingUp size={14} className="text-brand-600" />
          Task Insights
        </h2>
        <button onClick={onClose} className="text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors">
          <X size={18} />
        </button>
      </header>

      <div className="p-6 space-y-8">
        <div className="space-y-4">
           <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Completion</span>
              <span className="text-xs font-black text-brand-600">{percent}%</span>
           </div>
           <div className="w-full h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-600 transition-all duration-500" 
                style={{ width: `${percent}%` }}
              />
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="p-4 bg-surface-50 dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-xl">
              <CheckCircle2 size={16} className="text-green-500 mb-2" />
              <div className="text-xl font-black text-surface-900 dark:text-white">{completed}</div>
              <div className="text-[9px] font-black text-surface-400 uppercase tracking-tight">Completed</div>
           </div>
           <div className="p-4 bg-surface-50 dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-xl">
              <Clock size={16} className="text-amber-500 mb-2" />
              <div className="text-xl font-black text-surface-900 dark:text-white">{total - completed}</div>
              <div className="text-[9px] font-black text-surface-400 uppercase tracking-tight">Active</div>
           </div>
        </div>
      </div>
    </div>
  );
};
