import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Clock, AlertTriangle, Filter, SortAsc, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { ExtensionRequestModal } from '../../components/ExtensionRequestModal';
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
  const { tasks, quickTasks, projects, bootstrap } = useAppStore();
  const [filter, setFilter] = useState<typeof FILTERS[0]['value']>(() => {
    const incoming = searchParams.get('filter');
    return FILTERS.some((item) => item.value === incoming) ? incoming as typeof FILTERS[0]['value'] : 'all';
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isBulkExtensionOpen, setIsBulkExtensionOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const notificationTaskId = searchParams.get('taskId');
  const notificationTab = searchParams.get('tab') === 'activity' ? 'activity' : 'details';

  const myTasks = tasks.filter(t => {
    if (!t.assigneeIds.includes(user?.id || '')) return false;
    const p = projects.find(proj => proj.id === t.projectId);
    return p ? p.status !== 'archived' : true;
  });
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

  React.useEffect(() => {
    if (!selectedTaskId) {
      setSelectedTask(null);
      return;
    }

    const targetTask = myTasks.find((task) => task.id === selectedTaskId) || null;
    setSelectedTask(targetTask);
  }, [myTasks, selectedTaskId]);

  React.useEffect(() => {
    if (!notificationTaskId) return;
    const targetTask = myTasks.find((task) => task.id === notificationTaskId);
    if (!targetTask) return;
    setSelectedTaskId(targetTask.id);
  }, [myTasks, notificationTaskId]);

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

      <AnimatePresence>
        {selectedTaskIds.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 min-w-[320px]"
          >
            <div className="bg-surface-900 border border-surface-800 text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-6 ring-4 ring-brand-500/10">
              <div className="flex items-center gap-3 ml-2">
                 <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-sm">
                   {selectedTaskIds.length}
                 </div>
                 <div>
                   <p className="text-xs font-bold leading-tight underline decoration-brand-500 underline-offset-4">Tasks Selected</p>
                   <p className="text-[10px] text-surface-400 font-medium">Ready for bulk action</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsBulkExtensionOpen(true)}
                  className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-2 shadow-lg shadow-brand-500/20"
                >
                  <Clock size={14} />
                  Request Extension
                </button>
                <button 
                  onClick={() => setSelectedTaskIds([])}
                  className="p-2 hover:bg-surface-800 rounded-xl text-surface-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <div className="flex items-center gap-3">
                      {(filter === 'overdue' || filter === 'all') && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTaskIds(prev => 
                              prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id]
                            );
                          }}
                          className={cn(
                            "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center cursor-pointer flex-shrink-0 mt-2",
                            selectedTaskIds.includes(task.id) 
                              ? "bg-brand-500 border-brand-500 text-white" 
                              : "border-surface-200 dark:border-surface-700 hover:border-brand-500/50"
                          )}
                        >
                          {selectedTaskIds.includes(task.id) && <CheckSquare size={12} />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <TaskCard task={task} onClick={() => setSelectedTaskId(task.id)} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <TaskModal
        task={selectedTask}
        open={!!selectedTaskId}
        initialTab={notificationTab}
        onClose={() => {
          setSelectedTaskId(null);
          setSelectedTask(null);
          if (notificationTaskId) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('taskId');
            nextParams.delete('tab');
            setSearchParams(nextParams, { replace: true });
          }
        }}
      />

      <ExtensionRequestModal
        open={isBulkExtensionOpen}
        onClose={() => setIsBulkExtensionOpen(false)}
        taskIds={selectedTaskIds}
        taskTitles={tasks.filter(t => selectedTaskIds.includes(t.id)).map(t => t.title)}
        onSubmitted={() => {
          setSelectedTaskIds([]);
          bootstrap();
        }}
      />
    </div>
  );
};

export default MyTasksPage;
