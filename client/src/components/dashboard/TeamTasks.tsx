import React from 'react';
import { cn } from '../../utils/helpers';

export type TeamTaskRow = {
  id: string;
  assignee: string;
  title: string;
  projectName?: string;
  type?: string;
  status: string;
  dueDate?: string;
};

interface Props {
  tasks: TeamTaskRow[];
  loading?: boolean;
  onRowClick?: (id: string) => void;
}

export const TeamTasks: React.FC<Props> = ({ tasks, loading, onRowClick }) => {
  const rows = loading ? Array.from({ length: 6 }) : tasks;
  return (
    <div className="card overflow-hidden flex flex-col h-full border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900">
      <div className="bg-surface-50 dark:bg-surface-950/50 px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
        <h3 className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-widest">Team Tasks Overview</h3>
        <span className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-950/30 px-2 py-0.5 rounded-full">
          {loading ? 'Loading…' : `${tasks.length} items`}
        </span>
      </div>
      <div className="overflow-x-auto max-h-[260px] overflow-y-auto scrollbar-hide">
        <table className="w-full text-xs text-left">
          <thead className="bg-surface-50 dark:bg-surface-900 text-surface-500 dark:text-surface-400 font-semibold tracking-wide uppercase text-[10px] sticky top-0 border-b border-surface-100 dark:border-surface-800">
            <tr>
              <th className="px-3 py-2 font-semibold">Employee</th>
              <th className="px-3 py-2 font-semibold">Task</th>
              <th className="px-3 py-2 font-semibold hidden sm:table-cell">Project</th>
              <th className="px-3 py-2 font-semibold hidden md:table-cell">Type</th>
              <th className="px-3 py-2 font-semibold text-center">Status</th>
              <th className="px-3 py-2 font-semibold text-right hidden lg:table-cell">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-50 dark:divide-surface-800">
            {rows.map((task, idx) => (
              <tr
                key={loading ? `skeleton-${idx}` : task.id}
                className={cn(
                  'transition-colors',
                  !loading && 'hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer',
                  loading && 'animate-pulse select-none'
                )}
                onClick={() => !loading && task.id && onRowClick?.(task.id)}
              >
                <td className="px-3 py-2.5 font-medium text-surface-800 dark:text-surface-200 whitespace-nowrap">
                  {loading ? '···' : task.assignee}
                </td>
                <td className="px-3 py-2.5 text-surface-800 dark:text-surface-200 font-medium truncate max-w-[140px] sm:max-w-[180px]">
                  {loading ? 'Loading...' : task.title}
                </td>
                <td className="px-3 py-2.5 text-surface-500 dark:text-surface-400 truncate max-w-[100px] hidden sm:table-cell">
                  {loading ? '—' : task.projectName || '—'}
                </td>
                <td className="px-3 py-2.5 text-surface-500 dark:text-surface-400 capitalize hidden md:table-cell">
                  {loading ? '—' : task.type || 'general'}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {loading ? (
                    <span className="inline-block h-2 w-12 bg-surface-100 dark:bg-surface-800 rounded" />
                  ) : (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wide border',
                        task.status === 'in_progress' &&
                          'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
                        (task.status === 'done' || task.status === 'completed') &&
                          'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
                        (task.status === 'todo' || task.status === 'pending' || task.status === 'backlog') &&
                          'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-300 border-surface-200 dark:border-surface-700'
                      )}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-surface-500 dark:text-surface-400 whitespace-nowrap hidden lg:table-cell">
                  {loading ? '—' : task.dueDate || '—'}
                </td>
              </tr>
            ))}
            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-surface-400">
                  No tasks in progress.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamTasks;
