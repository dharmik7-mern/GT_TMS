import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Zap, User, Calendar, CheckCircle2 } from 'lucide-react';
import { cn, formatDate } from '../../utils/helpers';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { EmptyState, Tabs, TabsContent } from '../../components/ui';
import { QuickTaskModal } from '../../components/QuickTaskModal';
import type { QuickTask, QuickTaskStatus } from '../../app/types';
import { useNavigate, useSearchParams } from 'react-router-dom';

type ScopeFilter = 'assigned_to_me' | 'created_by_me' | 'all';
type StatusFilter = QuickTaskStatus | 'all' | 'overdue';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: STATUS_CONFIG.todo.label },
  { value: 'in_progress', label: STATUS_CONFIG.in_progress.label },
  { value: 'done', label: STATUS_CONFIG.done.label },
  { value: 'overdue', label: 'Overdue' },
];

function isOverdue(task: QuickTask) {
  return !!task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
}

export const QuickTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user } = useAuthStore();
  const { quickTasks, users } = useAppStore();

  const [scope, setScope] = useState<ScopeFilter>('assigned_to_me');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<QuickTask | null>(null);
  const [modalOpen, setModalOpen] = useState(params.get('new') === '1');

  const filtered = useMemo(() => {
    const uid = user?.id ?? '';
    return quickTasks
      .filter(t => {
        if (scope === 'assigned_to_me') return (t.assigneeIds || []).includes(uid);
        if (scope === 'created_by_me') return t.reporterId === uid;
        return true;
      })
      .filter(t => {
        if (status === 'all') return true;
        if (status === 'overdue') return isOverdue(t);
        return t.status === status;
      })
      .filter(t => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aO = isOverdue(a);
        const bO = isOverdue(b);
        if (aO && !bO) return -1;
        if (!aO && bO) return 1;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [quickTasks, scope, status, query, user?.id]);

  const counts = useMemo(() => {
    const uid = user?.id ?? '';
    const base = quickTasks.filter(t => {
      if (scope === 'assigned_to_me') return (t.assigneeIds || []).includes(uid);
      if (scope === 'created_by_me') return t.reporterId === uid;
      return true;
    });
    return {
      total: base.length,
      todo: base.filter(t => t.status === 'todo').length,
      in_progress: base.filter(t => t.status === 'in_progress').length,
      done: base.filter(t => t.status === 'done').length,
      overdue: base.filter(isOverdue).length,
    };
  }, [quickTasks, scope, user?.id]);

  const openNew = () => {
    setSelected(null);
    setModalOpen(true);
    params.set('new', '1');
    setParams(params, { replace: true });
  };

  const closeModal = () => {
    setModalOpen(false);
    params.delete('new');
    setParams(params, { replace: true });
  };

  const scopeTabs = [
    { value: 'created_by_me', label: 'Created by me' },
    { value: 'assigned_to_me', label: 'Assigned to me' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="max-w-full mx-auto">
      <div className="page-header">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Zap size={18} className="text-brand-600" />
              Quick Tasks
            </h1>
            <p className="page-subtitle">
              Individual assignments without linking a project
            </p>
          </div>
          <button className="btn-primary btn-sm hidden md:flex" onClick={openNew}>
            <Plus size={16} />
            New Quick Task
          </button>
        </div>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as ScopeFilter)} items={scopeTabs} variant="pill" className="mb-5">
        <TabsContent value={scope} className="mt-4">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input pl-10"
                placeholder="Search quick tasks..."
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_FILTERS.map(f => {
                const badge =
                  f.value === 'all' ? counts.total :
                  f.value === 'todo' ? counts.todo :
                  f.value === 'in_progress' ? counts.in_progress :
                  f.value === 'done' ? counts.done :
                  counts.overdue;

                return (
                  <button
                    key={f.value}
                    onClick={() => setStatus(f.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                      status === f.value
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-300 dark:hover:border-surface-600 hover:text-surface-700 dark:hover:text-surface-300'
                    )}
                  >
                    {f.label}
                    <span className={cn('ml-2 font-bold', status === f.value ? 'text-white/80' : 'text-surface-400')}>
                      {badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={28} />}
              title="No quick tasks found"
              description="Try changing filters or create a new quick task"
              // action={<button className="btn-primary btn-sm hidden md:flex" onClick={openNew}><Plus size={16} /> New Quick Task</button>}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((t, i) => {
                const assigneeIds = t.assigneeIds || [];
                const assignees = assigneeIds
                  .map((id) => users.find((u) => u.id === id))
                  .filter((u): u is (typeof users)[number] => Boolean(u));
                const reporter = users.find(u => u.id === t.reporterId);
                const priority = PRIORITY_CONFIG[t.priority];
                const statusCfg =
                  t.status === 'todo' ? STATUS_CONFIG.todo :
                  t.status === 'in_progress' ? STATUS_CONFIG.in_progress :
                  STATUS_CONFIG.done;

                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => navigate(`/quick-tasks/${t.id}`)}
                    className={cn(
                      'card p-4 cursor-pointer hover:shadow-card-hover transition-shadow',
                      isOverdue(t) && 'border-rose-200 dark:border-rose-900/50'
                    )}
                  >
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
                          {isOverdue(t) && (
                            <span className="badge text-[10px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300">
                              Overdue
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="text-xs text-surface-400 mt-1 line-clamp-2">
                            {t.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-surface-400 flex-shrink-0">
                        <div className="hidden sm:flex items-center gap-1.5">
                          <User size={12} />
                          <span className="max-w-[140px] truncate">
                            {assignees.length ? assignees.map((a) => a.name).slice(0, 2).join(', ') + (assignees.length > 2 ? ` +${assignees.length - 2}` : '') : 'Unassigned'}
                          </span>
                        </div>
                        <div className="hidden md:flex items-center gap-1.5">
                          <Calendar size={12} />
                          <span>{t.dueDate ? formatDate(t.dueDate, 'MMM d') : 'No due date'}</span>
                        </div>
                        <div className="hidden lg:block">
                          <span className="text-[11px] text-surface-400">
                            Created by {reporter?.name ?? '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <QuickTaskModal
        open={modalOpen}
        onClose={closeModal}
        task={selected}
      />
    </div>
  );
};

export default QuickTasksPage;

