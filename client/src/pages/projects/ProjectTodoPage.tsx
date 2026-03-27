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
import { addDaysToDateKey, cn, formatDate } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { tasksService, timelineService } from '../../services/api';
import { STATUS_CONFIG, TASK_TYPE_CONFIG } from '../../app/constants';
import { SubtaskBar } from '../../components/SubtaskBar';
import { KanbanBoard } from '../../components/KanbanBoard';
import { Modal } from '../../components/Modal';
import { UserAvatar } from '../../components/UserAvatar';
import { EmptyState } from '../../components/ui';
import type { Task, TaskStatus, TaskType, TaskSubtask, TimelinePhase } from '../../app/types';

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
  blocked: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
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
  const [newTitle, setNewTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<TaskType>('operational');
  const [newStatus, setNewStatus] = useState<TaskStatus>('todo');
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDurationDays, setNewDurationDays] = useState(1);
  const [newPhaseId, setNewPhaseId] = useState('');
  const [timelinePhases, setTimelinePhases] = useState<TimelinePhase[]>([]);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [isCreatingPhase, setIsCreatingPhase] = useState(false);
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
  const [newTaskFiles, setNewTaskFiles] = useState<File[]>([]);
  const [subDraft, setSubDraft] = useState<Record<string, string>>({});

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

  const handleCreatePhase = async () => {
    const trimmedName = newPhaseName.trim();
    if (!trimmedName || !projectId) return;
    try {
      setIsCreatingPhase(true);
      const palette = ['#2563eb', '#0f766e', '#7c3aed', '#ea580c', '#dc2626', '#0891b2'];
      await timelineService.upsert(projectId, {
        phases: [
          ...timelinePhases.map(({ id, name, order, color }) => ({ id, name, order, color })),
          {
            name: trimmedName,
            order: timelinePhases.length,
            color: palette[timelinePhases.length % palette.length],
          },
        ],
      });
      const response = await timelineService.get(projectId);
      const phases = (response.data?.data?.phases || []).filter((phase: TimelinePhase) => phase.id !== 'ungrouped');
      setTimelinePhases(phases);
      const createdPhase = phases.find((phase: TimelinePhase) => phase.name === trimmedName);
      if (createdPhase) {
        setNewPhaseId(createdPhase.id);
      }
      setNewPhaseName('');
    } finally {
      setIsCreatingPhase(false);
    }
  };

  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'done'), [tasks]);

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
      await tasksService.addSubtask(taskId, { title });
      setSubDraft((d) => ({ ...d, [taskId]: '' }));
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

  const handleCreate = async () => {
    if (!projectId || !newTitle.trim()) return;
    try {
      const res = await tasksService.create({
        projectId,
        title: newTitle.trim(),
        taskType: newTaskType,
        status: newStatus,
        startDate: newStartDate,
        dueDate: addDaysToDateKey(newStartDate, newDurationDays - 1),
        durationDays: newDurationDays,
        phaseId: newPhaseId || undefined,
        assigneeIds: newAssigneeIds,
      });
      const created = res.data?.data ?? res.data;
      const createdId = created?.id || created?._id;

      if (createdId && newTaskFiles.length) {
        await tasksService.uploadAttachments(createdId, newTaskFiles);
      }
      setShowCreate(false);
      setNewTitle('');
      setNewStartDate(project?.startDate || new Date().toISOString().split('T')[0]);
      setNewDurationDays(1);
      setNewPhaseId('');
      setNewAssigneeIds([]);
      setNewTaskFiles([]);
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
                  {(task.labels || []).map((lb) => (
                    <span
                      key={lb}
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide',
                        LABEL_STYLES[lb] || 'bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-200'
                      )}
                    >
                      {lb}
                    </span>
                  ))}
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
              <td colSpan={6} className="bg-surface-50/90 dark:bg-surface-900/60 border-b border-surface-100 dark:border-surface-800 p-4">
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
                    <div className="flex gap-2 mt-3 max-w-xl">
                      <input
                        className="input input-sm flex-1 text-sm"
                        placeholder="New subtask…"
                        value={subDraft[task.id] || ''}
                        onChange={(e) => setSubDraft((d) => ({ ...d, [task.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && addSubtask(task.id)}
                      />
                      <button type="button" className="btn-secondary btn-sm" onClick={() => addSubtask(task.id)}>
                        Add
                      </button>
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
          <button type="button" className="btn-primary btn-md" onClick={() => setShowCreate(true)} disabled={!canEdit}>
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
            tasksOverride={tasks}
            onMoveTaskRemote={handleKanbanMove}
            onOpenTask={(t) => setExpandedId(t.id)}
            onAddTask={() => setShowCreate(true)}
          />
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New task" size="md">
        <div className="space-y-3 p-1">
          <div>
            <label className="text-xs font-semibold text-surface-500">Title</label>
            <input className="input w-full mt-1" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-surface-500">Type</label>
              <select
                className="input w-full mt-1"
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value as TaskType)}
              >
                {(Object.keys(TASK_TYPE_CONFIG) as TaskType[]).map((k) => (
                  <option key={k} value={k}>
                    {TASK_TYPE_CONFIG[k].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-surface-500">Status</label>
              <select
                className="input w-full mt-1"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
              >
                {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {STATUS_CONFIG[k].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-surface-500">Start date</label>
              <input className="input w-full mt-1" type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-surface-500">Duration (days)</label>
              <input className="input w-full mt-1" type="number" min={1} step={1} value={newDurationDays} onChange={(e) => setNewDurationDays(Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-surface-500">Phase</label>
              <select className="input w-full mt-1" value={newPhaseId} onChange={(e) => setNewPhaseId(e.target.value)}>
                <option value="">Ungrouped</option>
                {timelinePhases.map((phase) => (
                  <option key={phase.id} value={phase.id}>{phase.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-surface-500">Add phase</label>
              <div className="mt-1 flex gap-2">
                <input className="input w-full" value={newPhaseName} onChange={(e) => setNewPhaseName(e.target.value)} placeholder="Phase name" />
                <button type="button" className="btn-secondary btn-md whitespace-nowrap" onClick={() => void handleCreatePhase()} disabled={isCreatingPhase || !newPhaseName.trim()}>
                  {isCreatingPhase ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-surface-500">Assignees</label>
            <div className="mt-1 border border-surface-100 dark:border-surface-800 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
              {memberUsers.length ? (
                memberUsers.map((u) => {
                  const checked = newAssigneeIds.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setNewAssigneeIds((prev) => {
                              if (prev.includes(u.id)) return prev.filter((id) => id !== u.id);
                              return [...prev, u.id];
                            });
                          }}
                        />
                        <span className="truncate">{u.name}</span>
                      </div>
                      <span className="text-[10px] text-surface-400 flex-shrink-0">{u.role.replace('_', ' ')}</span>
                    </label>
                  );
                })
              ) : (
                <p className="text-xs text-surface-400">No members in this project.</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-500">Files</label>
            <input
              type="file"
              multiple
              className="input w-full mt-1"
              onChange={(e) => setNewTaskFiles(e.target.files ? Array.from(e.target.files) : [])}
            />
            {newTaskFiles.length ? (
              <div className="mt-2 space-y-1">
                {newTaskFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 text-xs text-surface-600 dark:text-surface-300">
                    <span className="truncate">{f.name}</span>
                    <button type="button" className="btn-ghost btn-sm p-1 text-rose-500" onClick={() => setNewTaskFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary btn-md" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary btn-md" onClick={handleCreate} disabled={!newTitle.trim()}>
              Create
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectTodoPage;
