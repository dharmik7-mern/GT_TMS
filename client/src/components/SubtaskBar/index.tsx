import React from 'react';
import { CheckSquare } from 'lucide-react';
import { cn } from '../../utils/helpers';

export interface SubtaskBarProps {
  completed: number;
  total: number;
  className?: string;
  /** Opens subtask editor / expanded row */
  onClick?: () => void;
}

/**
 * GW-style compact subtask progress (e.g. 1/3) with thin progress bar.
 */
export const SubtaskBar: React.FC<SubtaskBarProps> = ({ completed, total, className, onClick }) => {
  if (total <= 0) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 text-[11px] text-surface-400 hover:text-brand-600 transition-colors',
          className
        )}
      >
        <CheckSquare size={14} className="opacity-60" />
        <span>Add subtasks</span>
      </button>
    );
  }

  const pct = Math.min(100, Math.round((completed / total) * 100));

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex flex-col items-stretch gap-0.5 min-w-[72px] max-w-[120px] text-left rounded-lg px-1.5 py-1',
        'hover:bg-surface-100 dark:hover:bg-surface-800/80 transition-colors',
        className
      )}
      title={`${completed} of ${total} subtasks done`}
    >
      <span className="flex items-center gap-1 text-[11px] font-semibold text-surface-600 dark:text-surface-300">
        <CheckSquare size={12} className="text-brand-500 flex-shrink-0" />
        {completed}/{total}
      </span>
      <span className="h-1 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        <span
          className="block h-full rounded-full bg-brand-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
    </button>
  );
};

export default SubtaskBar;
