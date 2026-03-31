import React from 'react';
import { Calendar, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { User } from '../../app/types';
import { cn } from '../../utils/helpers';
import type { TimelineRow } from './utils';

interface SidebarProps {
  rows: TimelineRow[];
  totalHeight: number;
  viewportHeight: number;
  scrollTop: number;
  containerClassName?: string;
  users: User[];
  selectedDependencyFrom: string;
  onSelectDependencyFrom: (taskId: string) => void;
  collapsedPhaseIds: Set<string>;
  onTogglePhase: (phaseId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  rows,
  totalHeight,
  viewportHeight,
  scrollTop,
  containerClassName,
  users,
  selectedDependencyFrom,
  onSelectDependencyFrom,
  collapsedPhaseIds,
  onTogglePhase,
}) => {
  const userMap = new Map(users.map((user) => [user.id, user]));
  const contentHeight = Math.max(0, viewportHeight - 56);

  return (
    <div className={`relative overflow-hidden border-r border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-950 ${containerClassName || 'h-[72vh]'}`}>
      <div className="sticky top-0 z-20 flex h-16 items-center border-b border-surface-200 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-500 dark:border-surface-800">
        Timeline Outline
      </div>
      <div className="relative overflow-hidden" style={{ height: contentHeight }}>
        {rows.map((row) => (
          <div
            key={row.id}
            className={row.kind === 'phase'
              ? 'absolute inset-x-0 flex items-center border-b border-surface-200 bg-surface-50 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-surface-500 dark:border-surface-800 dark:bg-surface-900/70'
              : 'absolute inset-x-0 border-b border-surface-100 px-4 py-2 dark:border-surface-900'}
            style={{ top: row.top - scrollTop, height: row.height }}
          >
            {row.kind === 'phase' ? (
              <button
                type="button"
                className="group flex w-full items-center gap-3 text-left"
                onClick={() => onTogglePhase(row.phase.id)}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-surface-100 dark:bg-surface-800 text-surface-500 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600">
                  {collapsedPhaseIds.has(row.phase.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </div>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.phase.color || '#64748b' }} />
                <span className="flex-1 truncate font-bold text-surface-700 dark:text-surface-300">{row.phase.name}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[9px] font-bold text-surface-400 border border-surface-100 dark:bg-surface-900 dark:border-surface-800">
                  {row.phase.tasks.length}
                </span>
              </button>
            ) : (
              <div className="flex w-full items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-surface-800 dark:text-surface-200">
                    {row.task.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-surface-400">
                    <span className="bg-rose-50/50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 px-1 rounded-sm uppercase tracking-wider text-[8px] font-bold border border-rose-100/50 dark:border-rose-800/30">
                      Created: {new Date(row.task.createdAt || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="bg-surface-50 dark:bg-surface-900 px-1 rounded uppercase tracking-wider text-[8px] border border-surface-100/50 dark:border-surface-800/50">{row.task.type}</span>
                    <div className="flex items-center gap-1.5 opacity-80 text-[10px] font-bold text-surface-500">
                      <Calendar size={12} className="text-surface-400" />
                      <span>{row.task.startDate}</span>
                      <span className="opacity-40 select-none">→</span>
                      <span>{row.task.endDate}</span>
                    </div>
                  </div>
                </div>
                <div className="flex -space-x-1.5 flex-shrink-0">
                  {row.task.assigneeIds.map((assigneeId) => {
                    const user = userMap.get(assigneeId);
                    return (
                      <div
                        key={assigneeId}
                        className="h-6 w-6 rounded-full border-2 border-white dark:border-surface-950 flex items-center justify-center bg-surface-200 text-[9px] font-bold text-white ring-1 ring-black/5"
                        style={{ backgroundColor: user?.color || '#64748b' }}
                        title={user?.name || assigneeId}
                      >
                        {(user?.name || 'U').slice(0, 1).toUpperCase()}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => onSelectDependencyFrom(row.task.id)}
                    className={cn(
                      "ml-3 h-6 w-6 flex items-center justify-center rounded-lg transition-all",
                      selectedDependencyFrom === row.task.id
                        ? "bg-brand-600 text-white rotate-45"
                        : "bg-surface-100 text-surface-400 hover:bg-brand-50 hover:text-brand-600 dark:bg-surface-900"
                    )}
                    title="Link dependency"
                  >
                    <Plus size={14} className={selectedDependencyFrom === row.task.id ? "-rotate-45" : ""} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {totalHeight > 0 ? <div aria-hidden="true" style={{ height: totalHeight }} /> : null}
      </div>
    </div>
  );
};

export default Sidebar;
