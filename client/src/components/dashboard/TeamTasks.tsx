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
  const rows: Array<TeamTaskRow | null> = loading ? Array.from({ length: 6 }, () => null) : tasks;

  return (
    <div className="card flex h-full flex-col overflow-hidden border border-surface-100 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div className="flex items-center justify-between border-b border-surface-100 bg-surface-50 px-4 py-3 dark:border-surface-800 dark:bg-surface-950/50">
        <h3 className="text-xs font-bold uppercase tracking-widest text-surface-700 dark:text-surface-300">Team Tasks Overview</h3>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600 dark:bg-brand-950/30 dark:text-brand-400">
          {loading ? 'Loading...' : `${tasks.length} items`}
        </span>
      </div>
      <div className="scrollbar-hide max-h-[260px] overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 border-b border-surface-100 bg-surface-50 text-[10px] font-semibold uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Employee</th>
              <th className="px-3 py-2 font-semibold">Task</th>
              <th className="hidden px-3 py-2 font-semibold sm:table-cell">Project</th>
              <th className="hidden px-3 py-2 font-semibold md:table-cell">Type</th>
              <th className="px-3 py-2 text-center font-semibold">Status</th>
              <th className="hidden px-3 py-2 text-right font-semibold lg:table-cell">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-50 dark:divide-surface-800">
            {rows.map((task, idx) => (
              <tr
                key={task?.id || `skeleton-${idx}`}
                className={cn(
                  'transition-colors',
                  task ? 'cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50' : 'animate-pulse select-none'
                )}
                onClick={() => task?.id && onRowClick?.(task.id)}
              >
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-surface-800 dark:text-surface-200">
                  {task?.assignee || '...'}
                </td>
                <td className="max-w-[140px] truncate px-3 py-2.5 font-medium text-surface-800 dark:text-surface-200 sm:max-w-[180px]">
                  {task?.title || 'Loading...'}
                </td>
                <td className="hidden max-w-[100px] truncate px-3 py-2.5 text-surface-500 dark:text-surface-400 sm:table-cell">
                  {task?.projectName || '-'}
                </td>
                <td className="hidden px-3 py-2.5 capitalize text-surface-500 dark:text-surface-400 md:table-cell">
                  {task?.type || (task ? 'general' : '-')}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {task ? (
                    <span
                      className={cn(
                        'rounded-[4px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        task.status === 'in_progress' &&
                          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400',
                        (task.status === 'done' || task.status === 'completed') &&
                          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400',
                        (task.status === 'todo' || task.status === 'pending' || task.status === 'backlog') &&
                          'border-surface-200 bg-surface-100 text-surface-500 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300'
                      )}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="inline-block h-2 w-12 rounded bg-surface-100 dark:bg-surface-800" />
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-right text-surface-500 dark:text-surface-400 lg:table-cell">
                  {task?.dueDate || '-'}
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
