import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Clock, AlertTriangle, Filter, SortAsc } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn, formatDate, isDueDateOverdue } from '../../utils/helpers';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { TaskCard } from '../../components/TaskCard';
import { TaskModal } from '../../components/TaskModal';
import { EmptyState } from '../../components/ui';
import type { Task, TaskStatus } from '../../app/types';

const FILTERS: { value: TaskStatus | 'all' | 'overdue'; label: string; color?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In Progress', color: STATUS_CONFIG.in_progress.color },
  { value: 'todo', label: 'To Do', color: STATUS_CONFIG.todo.color },
  { value: 'in_review', label: 'In Review', color: STATUS_CONFIG.in_review.color },
  { value: 'overdue', label: 'Overdue', color: '#f43f5e' },
  { value: 'done', label: 'Completed', color: STATUS_CONFIG.done.color },
];

export const MyTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { tasks, quickTasks, projects } = useAppStore();
  const [filter, setFilter] = useState<typeof FILTERS[0]['value']>(() => {
    const incoming = searchParams.get('filter');
    return FILTERS.some((item) => item.value === incoming) ? incoming as typeof FILTERS[0]['value'] : 'all';
  });
 const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const myTasks = tasks.filter(t => t.assigneeIds.includes(user?.id || ''));
  const myQuickTasks = quickTasks.filter(t => (t.assigneeIds || []).includes(user?.id || ''));

  const filtered = myTasks.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return isDueDateOverdue(t.dueDate, t.status);
    return t.status === filter;
  });

  const sorted = [...filtered].sort((a, b) => {
    // Sort: overdue first, then by due date, then by priority
    const aOverdue = isDueDateOverdue(a.dueDate, a.status);
    const bOverdue = isDueDateOverdue(b.dueDate, b.status);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return 0;
  });

  const overdueCount = myTasks.filter(t => isDueDateOverdue(t.dueDate, t.status)).length
    + myQuickTasks.filter(t => isDueDateOverdue(t.dueDate, t.status)).length;
  const doneCount = myTasks.filter(t => t.status === 'done').length;

  React.useEffect(() => {
    const next = filter === 'all' ? null : filter;
    const current = searchParams.get('filter');
    if ((current || null) === next) return;
    const updatedParams = new URLSearchParams(searchParams);
    if (next) updatedParams.set('filter', next);
    else updatedParams.delete('filter');
    setSearchParams(updatedParams, { replace: true });
  }, [filter, searchParams, setSearchParams]);

  return (
    <div className="max-w-full mx-auto">
      <div className="page-header">
        <h1 className="page-title">My Tasks</h1>
        <p className="page-subtitle">
          {myTasks.length + myQuickTasks.length} items assigned · {doneCount} project tasks completed
          {overdueCount > 0 && <span className="text-rose-500 ml-2">· {overdueCount} overdue</span>}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setFilter('done')}
          className={cn(
            'card p-4 text-center transition-all border',
            filter === 'done'
              ? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-900/40 shadow-card-hover'
              : 'border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'
          )}
        >
          <CheckSquare size={20} className="mx-auto text-brand-600 mb-2" />
          <p className="font-display font-bold text-xl text-surface-900 dark:text-white">{doneCount}</p>
          <p className="text-xs text-surface-400">Project completed</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('in_progress')}
          className={cn(
            'card p-4 text-center transition-all border',
            filter === 'in_progress'
              ? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-900/40 shadow-card-hover'
              : 'border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'
          )}
        >
          <Clock size={20} className="mx-auto text-amber-500 mb-2" />
          <p className="font-display font-bold text-xl text-surface-900 dark:text-white">
            {myTasks.filter(t => t.status === 'in_progress').length + myQuickTasks.filter(t => t.status === 'in_progress').length}
          </p>
          <p className="text-xs text-surface-400">In progress</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('overdue')}
          className={cn(
            'card p-4 text-center transition-all border',
            filter === 'overdue'
              ? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-900/40 shadow-card-hover'
              : 'border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'
          )}
        >
          <AlertTriangle size={20} className={cn('mx-auto mb-2', overdueCount > 0 ? 'text-rose-500' : 'text-surface-300')} />
          <p className={cn('font-display font-bold text-xl', overdueCount > 0 ? 'text-rose-600' : 'text-surface-900 dark:text-white')}>{overdueCount}</p>
          <p className="text-xs text-surface-400">Overdue</p>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
              filter === f.value
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-300 dark:hover:border-surface-600 hover:text-surface-700 dark:hover:text-surface-300'
            )}
          >
            {f.color && filter !== f.value && (
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.color }} />
            )}
            {f.label}
            <span className={cn('font-bold', filter === f.value ? 'text-white/80' : 'text-surface-400')}>
              {f.value === 'all' ? myTasks.length
                : f.value === 'overdue' ? overdueCount
                : myTasks.filter(t => t.status === f.value).length}
            </span>
          </button>
        ))}
        <button className="btn-secondary btn-sm ml-auto text-xs"><SortAsc size={12} /> Sort</button>
      </div>

      {/* Project Tasks list */}
      {sorted.length === 0 && myQuickTasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={28} />}
          title={filter === 'all' ? 'No tasks assigned' : `No ${FILTERS.find(f => f.value === filter)?.label.toLowerCase()} tasks`}
          description={filter === 'all' ? "You don't have any tasks assigned to you yet" : "Try a different filter"}
        />
      ) : (
        <div className="space-y-6">
          {myQuickTasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300">Quick Tasks</h2>
                <span className="text-xs text-surface-400">{myQuickTasks.length} assigned</span>
              </div>
              <div className="space-y-2">
                {myQuickTasks.map((qt, i) => {
                  const isOverdue = isDueDateOverdue(qt.dueDate, qt.status);
                  const priority = PRIORITY_CONFIG[qt.priority];
                  const statusCfg = qt.status === 'todo' ? STATUS_CONFIG.todo : qt.status === 'in_progress' ? STATUS_CONFIG.in_progress : STATUS_CONFIG.done;
                  return (
                    <motion.div
                      key={qt.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <div className="card p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span className={cn('badge text-[10px]', priority.bg, priority.text)}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priority.color }} />
                                {priority.label}
                              </span>
                              <span className={cn('badge text-[10px]', statusCfg.bg, statusCfg.text)}>
                                {statusCfg.label}
                              </span>
                              <span className="badge-gray text-[10px]">Quick Task</span>
                              {isOverdue && (
                                <span className="badge text-[10px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300">
                                  Overdue
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{qt.title}</p>
                            {qt.description && (
                              <p className="text-xs text-surface-400 mt-1 line-clamp-2">{qt.description}</p>
                            )}
                          </div>
                          <div className="text-xs text-surface-400 flex-shrink-0">
                            {qt.dueDate ? formatDate(qt.dueDate, 'MMM d') : 'No due date'}
                          </div>
                        </div>
                        <div className="mt-3">
                          <button
                            className="btn-secondary btn-sm text-xs"
                            onClick={() => navigate(`/quick-tasks/${qt.id}`)}
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300">Project Tasks</h2>
              <span className="text-xs text-surface-400">{sorted.length} shown</span>
            </div>
            <div className="space-y-2">
              {sorted.map((task, i) => {
                const project = projects.find(p => p.id === task.projectId);
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {project && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: project.color }} />
                          <span className="text-[10px] text-surface-400 uppercase tracking-wider font-medium">{project.name}</span>
                        </div>
                      )}
                    </div>
                    <TaskCard task={task} onClick={() => setSelectedTaskId(task.id)} />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <TaskModal task={selectedTask} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  );
};

export default MyTasksPage;
