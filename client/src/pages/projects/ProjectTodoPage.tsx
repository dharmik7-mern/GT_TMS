import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  LayoutGrid,
  Table2,
  Search,
  Filter,
  MessageSquare,
  Paperclip,
  Calendar as CalendarIcon,
  Rocket,
  Circle,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn, formatDate } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { tasksService, timelineService } from '../../services/api';
import { STATUS_CONFIG, TASK_TYPE_CONFIG } from '../../app/constants';
import { SubtaskBar } from '../../components/SubtaskBar';
import { KanbanBoard } from '../../components/KanbanBoard';
import { UserAvatar } from '../../components/UserAvatar';
import { EmptyState } from '../../components/ui';
import type { Task, TaskStatus, TaskType, TaskSubtask, TimelinePhase } from '../../app/types';
import { ProjectTaskCreateModal, type ProjectTaskCreateValues } from '../../components/ProjectTaskCreateModal';

function mapApiTask(x: Record<string, unknown>): Task {
  const subs = (Array.isArray(x.subtasks) ? x.subtasks : []) as TaskSubtask[];
  const completed = subs.filter((s) => s.isCompleted).length;
  return {
    id: String(x.id),
    title: String(x.title || ''),
    description: x.description ? String(x.description) : undefined,
    status: (x.status as TaskStatus) || 'todo',
    taskType: (x.taskType as TaskType) || 'operational',
    priority: (x.priority as Task['priority']) || 'medium',
    projectId: String(x.projectId || ''),
    assigneeIds: Array.isArray(x.assigneeIds) ? (x.assigneeIds as string[]) : [],
    reporterId: String(x.reporterId || ''),
    subcategoryId: x.subcategoryId ? String(x.subcategoryId) : undefined,
    labels: Array.isArray(x.labels) ? (x.labels as string[]) : [],
    order: typeof x.order === 'number' ? x.order : 0,
    dueDate: x.dueDate ? String(x.dueDate) : undefined,
    startDate: x.startDate ? String(x.startDate) : undefined,
    comments: Array.isArray(x.comments) ? (x.comments as Task['comments']) : undefined,
    attachments: Array.isArray(x.attachments) ? (x.attachments as Task['attachments']) : undefined,
    createdAt: String(x.createdAt || ''),
    updatedAt: String(x.updatedAt || ''),
    subtasks: subs,
    subtaskCompleted: typeof x.subtaskCompleted === 'number' ? (x.subtaskCompleted as number) : completed,
    subtaskTotal: typeof x.subtaskTotal === 'number' ? (x.subtaskTotal as number) : subs.length,
  };
}

function StatusCell({ status, onChange, disabled }: { status: TaskStatus; onChange: (s: TaskStatus) => void; disabled?: boolean }) {
  const Icon =
    status === 'done'
      ? CheckCircle2
      : status === 'in_progress'
        ? Rocket
        : status === 'scheduled'
          ? CalendarIcon
          : Circle;

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <Icon size={16} className="text-surface-500 flex-shrink-0" />
      <select
        disabled={disabled}
        value={status}
        onChange={(e) => onChange(e.target.value as TaskStatus)}
        className="text-xs font-medium bg-transparent border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1 max-w-[120px] text-surface-800 dark:text-surface-200"
      >
        {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((k) => (
          <option key={k} value={k}>
            {STATUS_CONFIG[k].label}
          </option>
        ))}
      </select>
    </div>
  );
}

const LABEL_STYLES: Record<string, string> = {
  ASAP: 'bg-brand-600 text-white',
  Feedback: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
};

export const ProjectTodoPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, users, bootstrap } = useAppStore();
  const { user } = useAuthStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [activeOpen, setActiveOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [timelinePhases, setTimelinePhases] = useState<TimelinePhase[]>([]);
  const [subDraft, setSubDraft] = useState<Record<string, string>>({});
  const [subDraftAssignees, setSubDraftAssignees] = useState<Record<string, string[]>>({});

  const project = projects.find((p) => p.id === projectId);
  const memberUsers = useMemo(
    () => users.filter((u) => project?.members.includes(u.id)),
    [users, project]
  );

  const canDelete = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
  const canEdit = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
  const canModifySubtasks = Boolean(user);

  const loadTasks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await tasksService.getAll(projectId);
      const raw = res.data?.data ?? res.data;
      const list = Array.isArray(raw) ? raw : [];
      setTasks(list.map((t: Record<string, unknown>) => mapApiTask(t)));
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e ? String((e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message) : 'Failed to load tasks';
      setErr(msg || 'Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      try {
        const response = await timelineService.get(projectId);
        setTimelinePhases((response.data?.data?.phases || []).filter((phase: TimelinePhase) => phase.id !== 'ungrouped'));
      } catch {
        setTimelinePhases([]);
      }
    })();
  }, [projectId]);

  useEffect(() => {
    if (selectedCategoryId === 'all') return;
    if ((project?.subcategories || []).some((category) => category.id === selectedCategoryId)) return;
    setSelectedCategoryId('all');
  }, [project?.subcategories, selectedCategoryId]);

  const handleCreatePhase = async (newPhase: { id: string; name: string; order: number; color: string }) => {
    if (!projectId) return;
    await timelineService.upsert(projectId, {
      phases: [
        ...timelinePhases.map(({ id, name, order, color }) => ({ id, name, order, color })),
        newPhase,
      ],
    });
    const response = await timelineService.get(projectId);
    const phases = (response.data?.data?.phases || []).filter((phase: TimelinePhase) => phase.id !== 'ungrouped');
    setTimelinePhases(phases);
    return phases.find((phase: TimelinePhase) => phase.name === newPhase.name)?.id;
  };

  const filteredTasks = useMemo(
    () => selectedCategoryId === 'all' ? tasks : tasks.filter((task) => task.subcategoryId === selectedCategoryId),
    [selectedCategoryId, tasks]
  );
  const activeTasks = useMemo(() => filteredTasks.filter((t) => t.status !== 'done'), [filteredTasks]);
  const completedTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'done'), [filteredTasks]);

  const updateLocalTask = (id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    updateLocalTask(taskId, { status });
    try {
      await tasksService.move(taskId, status);
      await loadTasks();
    } catch {
      await loadTasks();
    }
  };

  const handleKanbanMove = async (taskId: string, status: TaskStatus) => {
    await tasksService.move(taskId, status);
    await loadTasks();
  };

  const toggleSubtask = async (task: Task, sub: TaskSubtask) => {
    try {
      await tasksService.patchSubtask(task.id, sub.id, { isCompleted: !sub.isCompleted });
      await loadTasks();
    } catch {
      await loadTasks();
    }
  };

  const addSubtask = async (taskId: string) => {
    const title = (subDraft[taskId] || '').trim();
    if (!title) return;
    try {
      const assigneeId = (subDraftAssignees[taskId] || [])[0] || undefined;
      await tasksService.addSubtask(taskId, { title, assigneeId });
      setSubDraft((d) => ({ ...d, [taskId]: '' }));
      setSubDraftAssignees((d) => ({ ...d, [taskId]: [] }));
      await loadTasks();
    } catch {
      await loadTasks();
    }
  };

  const removeSubtask = async (taskId: string, subId: string) => {
    try {
      await tasksService.deleteSubtask(taskId, subId);
      await loadTasks();
    } catch {
      await loadTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!canDelete) return;
    try {
      await tasksService.delete(taskId);
      await loadTasks();
      await bootstrap();
    } catch {
      await loadTasks();
    }
  };

  const handleCreate = async (values: ProjectTaskCreateValues) => {
    if (!projectId) return;
    try {
      const res = await tasksService.create({
        projectId,
        title: values.title.trim(),
        description: values.description || undefined,
        taskType: values.taskType,
        priority: values.priority,
        status: values.status,
        startDate: values.startDate,
        dueDate: values.dueDate,
        durationDays: values.durationDays,
        phaseId: values.phaseId || undefined,
        assigneeIds: values.assigneeIds,
        subcategoryId: values.subcategoryId || undefined,
        estimatedHours: values.estimatedHours || undefined,
        labels: values.labels,
        tags: values.tags,
      });
      const created = res.data?.data ?? res.data;
      const createdId = created?.id || created?._id;

      if (createdId && values.files.length) {
        await tasksService.uploadAttachments(createdId, values.files);
      }
      setShowCreate(false);
      await loadTasks();
      await bootstrap();
    } catch {
      /* keep modal open */
    }
  };

  if (!projectId) {
    return <EmptyState icon={<Table2 size={28} />} title="Missing project" description="" />;
  }

  if (!project) {
    return (
      <EmptyState
        icon={<Table2 size={28} />}
        title="Project not found"
        description="Open To-do from a project in the sidebar."
        action={
          <button type="button" onClick={() => navigate('/projects')} className="btn-secondary btn-md">
            <ArrowLeft size={14} /> Projects
          </button>
        }
      />
    );
  }

  const renderTaskRow = (task: Task) => {
    const assignee = users.find((u) => task.assigneeIds[0] === u.id);
    const typeCfg = TASK_TYPE_CONFIG[task.taskType || 'operational'];
    const category = project.subcategories?.find((item) => item.id === task.subcategoryId);
    const commentsCount = task.comments?.length ?? 0;
    const attachCount = task.attachments?.length ?? 0;
    const done = task.subtaskCompleted ?? 0;
    const total = task.subtaskTotal ?? task.subtasks?.length ?? 0;
    const expanded = expandedId === task.id;

    return (
      <React.Fragment key={task.id}>
        <tr className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50/80 dark:hover:bg-surface-900/40">
          <td className="py-3 px-3 align-top">
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="mt-0.5 text-surface-400 hover:text-surface-600"
                onClick={() => setExpandedId(expanded ? null : task.id)}
              >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-surface-900 dark:text-white text-sm leading-snug">{task.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <SubtaskBar
                    completed={done}
                    total={total}
                    onClick={() => setExpandedId(expanded ? null : task.id)}
                  />
                  {commentsCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-surface-500">
                      <MessageSquare size={12} /> {commentsCount}
                    </span>
                  )}
                  {attachCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-surface-500">
                      <Paperclip size={12} /> {attachCount}
                    </span>
                  )}
                  {(task.labels || []).map((lb) => {
                    const labelId = typeof lb === 'object' ? lb.id : lb;
                    const labelName = typeof lb === 'object' ? lb.name : lb;
                    return (
                      <span
                        key={labelId}
                        className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide',
                          LABEL_STYLES[labelName] || 'bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-200'
                        )}
                      >
                        {labelName}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </td>
          <td className="py-3 px-2 align-middle">
            <StatusCell status={task.status} onChange={(s) => handleStatusChange(task.id, s)} disabled={!canEdit} />
          </td>
          <td className="py-3 px-2 align-middle">
            <div className="flex items-center gap-2 text-xs font-medium text-surface-700 dark:text-surface-300">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: typeCfg.dot }} />
              {typeCfg.label}
            </div>
          </td>
          <td className="py-3 px-2 align-middle text-sm text-surface-600 dark:text-surface-400">
            {task.dueDate ? formatDate(task.dueDate, 'd MMM yyyy') : <CalendarIcon size={16} className="text-surface-400" />}
          </td>
          <td className="py-3 px-2 align-middle">
            {category ? (
              <span className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ backgroundColor: `${category.color || '#6366f1'}20`, color: category.color || '#6366f1' }}>
                {category.name}
              </span>
            ) : (
              <span className="text-xs text-surface-400">Uncategorized</span>
            )}
          </td>
          <td className="py-3 px-2 align-middle">
            {assignee ? (
              <div className="flex items-center gap-2">
                <UserAvatar name={assignee.name} color={assignee.color} size="sm" />
                <span className="text-xs font-medium text-surface-800 dark:text-surface-200 truncate max-w-[100px]">
                  {assignee.name}
                </span>
              </div>
            ) : (
              <span className="text-xs text-surface-400">—</span>
            )}
          </td>
          <td className="py-3 px-2 align-middle text-right">
            {canDelete && (
              <button
                type="button"
                className="p-1.5 rounded-lg text-surface-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={() => handleDeleteTask(task.id)}
                title="Delete task"
              >
                <Trash2 size={16} />
              </button>
            )}
          </td>
        </tr>
        <AnimatePresence>
          {expanded && (
            <tr key={`${task.id}-exp`}>
              <td colSpan={7} className="bg-surface-50/90 dark:bg-surface-900/60 border-b border-surface-100 dark:border-surface-800 p-4">
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }}>
                  <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Subtasks</p>
                  <ul className="space-y-2 max-w-xl">
                    {(task.subtasks || []).map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={s.isCompleted}
                          onChange={() => toggleSubtask(task, s)}
                          className="rounded border-surface-300"
                          disabled={!canModifySubtasks}
                        />
                        <span className={cn(s.isCompleted && 'line-through text-surface-400')}>{s.title}</span>
                        {s.assigneeId && (
                          <div className="flex items-center gap-1 ml-auto">
                            {(() => {
                              const assignee = users.find((u) => u.id === s.assigneeId);
                              return (
                                <div key={s.assigneeId} title={assignee?.name} className="text-[10px]">
                                  <UserAvatar name={assignee?.name || '?'} color={assignee?.color} size="xs" />
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        {canModifySubtasks && (
                          <button
                            type="button"
                            className="ml-auto text-xs text-rose-500 hover:underline"
                            onClick={() => removeSubtask(task.id, s.id)}
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canModifySubtasks && (
                    <div className="flex gap-2 mt-3 max-w-xl flex-col">
                      <div className="flex gap-2">
                        <input
                          className="input input-sm flex-1 text-sm"
                          placeholder="New subtask…"
                          value={subDraft[task.id] || ''}
                          onChange={(e) => setSubDraft((d) => ({ ...d, [task.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addSubtask(task.id)}
                        />
                        <button type="button" className="btn-secondary btn-sm whitespace-nowrap" onClick={() => addSubtask(task.id)}>
                          Add
                        </button>
                      </div>
                      <div className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Assign to (optional):</div>
                      <div className="border border-surface-100 dark:border-surface-800 rounded-lg p-2 max-h-40 overflow-y-auto space-y-2">
                        {memberUsers.length ? (
                          memberUsers.map((u) => {
                            const checked = (subDraftAssignees[task.id] || []).includes(u.id);
                            return (
                              <label key={u.id} className="flex items-center gap-2 text-[11px]">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSubDraftAssignees((prev) => {
                                      const current = prev[task.id] || [];
                                      if (current.includes(u.id)) {
                                        return { ...prev, [task.id]: current.filter((id) => id !== u.id) };
                                      }
                                      return { ...prev, [task.id]: [...current, u.id] };
                                    });
                                  }}
                                />
                                <span>{u.name}</span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="text-[11px] text-surface-400">No members</p>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </td>
            </tr>
          )}
        </AnimatePresence>
      </React.Fragment>
    );
  };

  const tableSection = (title: string, open: boolean, setOpen: (v: boolean) => void, list: Task[]) => (
    <div className="rounded-2xl border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-sm overflow-hidden mb-4">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 text-left font-display font-semibold text-surface-900 dark:text-white hover:bg-surface-50 dark:hover:bg-surface-800/50"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        {title}{' '}
        <span className="text-surface-400 font-normal">({list.length})</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-surface-400 border-t border-surface-100 dark:border-surface-800">
                  <th className="py-2 px-3 font-semibold">Task name</th>
                  <th className="py-2 px-2 font-semibold">Status</th>
                  <th className="py-2 px-2 font-semibold">Type</th>
                  <th className="py-2 px-2 font-semibold">Due date</th>
                  <th className="py-2 px-2 font-semibold">Category</th>
                  <th className="py-2 px-2 font-semibold">Responsible</th>
                  <th className="py-2 px-2 font-semibold w-12" />
                </tr>
              </thead>
              <tbody>{list.map(renderTaskRow)}</tbody>
            </table>
            {list.length === 0 && (
              <p className="px-4 py-6 text-sm text-surface-500 text-center">No tasks in this section.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto">
      <button
        type="button"
        onClick={() => navigate(`/projects/${project.id}`)}
        className="flex items-center gap-1 text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 mb-3"
      >
        <ArrowLeft size={14} />
        Project overview
      </button>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: project.color }}
          >
            {project.name[0]}
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-surface-900 dark:text-white">To-do</h1>
            <p className="text-sm text-surface-500">{project.name}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary btn-md" onClick={() => { setDefaultStatus('todo'); setShowCreate(true); }} disabled={!canEdit}>
            <Plus size={16} /> Add new
          </button>
          <div className="flex rounded-xl border border-surface-200 dark:border-surface-700 p-0.5 bg-surface-50 dark:bg-surface-800/50">
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                view === 'table' ? 'bg-white dark:bg-surface-900 shadow-sm text-brand-700' : 'text-surface-500'
              )}
              onClick={() => setView('table')}
            >
              <Table2 size={14} /> Table view
            </button>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                view === 'kanban' ? 'bg-white dark:bg-surface-900 shadow-sm text-brand-700' : 'text-surface-500'
              )}
              onClick={() => setView('kanban')}
            >
              <LayoutGrid size={14} /> Kanban board
            </button>
          </div>
          <button type="button" className="btn-ghost btn-md text-surface-500" title="Search">
            <Search size={18} />
          </button>
          <button type="button" className="btn-ghost btn-md text-surface-500" title="Filter">
            <Filter size={18} />
          </button>
        </div>
      </div>

      {project.subcategories?.length ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={cn(
              'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
              selectedCategoryId === 'all'
                ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/50 dark:bg-brand-950/30 dark:text-brand-300'
                : 'border-surface-200 text-surface-500 dark:border-surface-800 dark:text-surface-400'
            )}
          >
            All tasks
          </button>
          {project.subcategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategoryId(category.id)}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
                selectedCategoryId === category.id
                  ? 'text-surface-900 dark:text-white border-transparent'
                  : 'border-surface-200 text-surface-500 dark:border-surface-800 dark:text-surface-400'
              )}
              style={selectedCategoryId === category.id ? { backgroundColor: `${category.color || '#6366f1'}20`, borderColor: category.color || '#6366f1' } : undefined}
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      {err && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 px-4 py-2 text-sm">
          {err}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-32 bg-surface-100 dark:bg-surface-800 rounded-2xl" />
          <div className="h-48 bg-surface-100 dark:bg-surface-800 rounded-2xl" />
        </div>
      ) : view === 'table' ? (
        <>
          {tableSection('Active tasks', activeOpen, setActiveOpen, activeTasks)}
          {tableSection('Completed tasks', completedOpen, setCompletedOpen, completedTasks)}
        </>
      ) : (
        <div className="rounded-2xl border border-surface-100 dark:border-surface-800 p-4 bg-white dark:bg-surface-900">
          <KanbanBoard
            projectId={project.id}
            tasksOverride={filteredTasks}
            onMoveTaskRemote={handleKanbanMove}
            onOpenTask={(t) => setExpandedId(t.id)}
            onAddTask={(status) => {
              setDefaultStatus(status);
              setShowCreate(true);
            }}
          />
        </div>
      )}

      <ProjectTaskCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        project={project}
        members={memberUsers}
        phases={timelinePhases}
        defaultStatus={defaultStatus}
        submitLabel="Create Task"
        title="New Task"
        onCreatePhase={handleCreatePhase}
      />
    </div>
  );
};

export default ProjectTodoPage;
