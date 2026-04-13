import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Check, CheckCircle2, Clock3, Eye, FolderKanban, ListFilter, MoreHorizontal, Plus, RotateCcw, Star, User, X, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '../../components/ui';
import { UserAvatar } from '../../components/UserAvatar';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';
import type { Task, TaskCreationRequest } from '../../app/types';
import { cn, formatDate } from '../../utils/helpers';
import { tasksService } from '../../services/api';
import api from '../../services/api';

type RequestStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type RequestType = 'creation' | 'extension' | 'completion';

const REQUEST_STATUS_META = {
  pending: { label: 'Pending', badge: 'badge-amber', icon: Clock3 },
  approved: { label: 'Approved', badge: 'badge-green', icon: CheckCircle2 },
  rejected: { label: 'Rejected', badge: 'badge-rose', icon: XCircle },
} as const;

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-rose-100 text-rose-600 dark:bg-rose-950/30',
  high: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30',
  medium: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30',
  low: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30',
};

// ─── Revert Notes Modal ───────────────────────────────────────────────────────
const RevertNotesModal: React.FC<{
  task: Task;
  onClose: () => void;
  onSubmit: (taskId: string, note: string) => Promise<void>;
  isProcessing: boolean;
}> = ({ task, onClose, onSubmit, isProcessing }) => {
  const [note, setNote] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-surface-900 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-surface-200 dark:border-surface-800 bg-gradient-to-r from-amber-50 to-rose-50 dark:from-amber-950/30 dark:to-rose-950/20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Revert Task</p>
            <h2 className="text-base font-bold text-surface-900 dark:text-white mt-0.5 line-clamp-1">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/60 dark:hover:bg-surface-800 transition-colors text-surface-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-7 space-y-5">
          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">What happens next?</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/70 leading-relaxed">
              This task will be moved back to <strong>In Progress</strong> and the assigned employee will receive your revert note as feedback to act on.
            </p>
          </div>

          <div>
            <label className="label mb-2 flex items-center gap-1">
              Revert Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              autoFocus
              placeholder="Explain what needs to be corrected or improved before resubmitting..."
              rows={4}
              className="input resize-none w-full"
            />
            <p className="text-[11px] text-surface-400 mt-1">{note.trim().length}/500 characters</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-surface-100 dark:border-surface-800 flex gap-3 bg-surface-50/50 dark:bg-surface-800/30">
          <button
            onClick={onClose}
            className="px-5 h-11 rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-300 text-sm font-bold hover:bg-surface-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(task.id, note.trim())}
            disabled={isProcessing || !note.trim()}
            className="flex-1 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white h-11 rounded-2xl font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            {isProcessing ? <Clock3 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
            Send Revert Request
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Completion Review Modal (View + Approve) ─────────────────────────────────
const CompletionReviewModal: React.FC<{
  task: Task;
  onClose: () => void;
  onSubmit: (taskId: string, action: 'approve' | 'changes_requested', rating: number, remark: string) => Promise<void>;
  isProcessing: boolean;
  mode?: 'review';
}> = ({ task, onClose, onSubmit, isProcessing }) => {
  const { users, projects } = useAppStore();
  const [rating, setRating] = useState(0);
  const [remark, setRemark] = useState('');
  const [hoveredStar, setHoveredStar] = useState(0);

  const assignees = useMemo(
    () => task.assigneeIds.map(id => users.find(u => u.id === id)).filter(Boolean) as any[],
    [task.assigneeIds, users]
  );
  const project = projects.find(p => p.id === (typeof task.projectId === 'string' ? task.projectId : (task.projectId as any)?._id));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-surface-900 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-surface-200 dark:border-surface-800 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500">Completion Review</p>
            <h2 className="text-lg font-bold text-surface-900 dark:text-white mt-0.5 line-clamp-1">{task.title}</h2>
            {project && <p className="text-xs text-surface-500 mt-0.5">{project.name}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/60 dark:hover:bg-surface-800 transition-colors text-surface-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-7 space-y-6">
          {/* Assignees */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400 mb-2">Submitted By</p>
            <div className="flex flex-wrap gap-2">
              {assignees.map(a => (
                <div key={a.id} className="flex items-center gap-2 bg-surface-50 dark:bg-surface-800 rounded-xl px-3 py-1.5 border border-surface-100 dark:border-surface-700">
                  <UserAvatar name={a.name} color={a.color} size="xs" />
                  <span className="text-xs font-bold text-surface-700 dark:text-surface-300">{a.name}</span>
                </div>
              ))}
              {!assignees.length && <span className="text-sm text-surface-400">No assignees</span>}
            </div>
          </div>

          {/* Completion note if any */}
          {(task as any).completionReview?.note && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400 mb-2">Completion Note</p>
              <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 text-sm text-blue-900 dark:text-blue-200 leading-relaxed italic">
                "{(task as any).completionReview.note}"
              </div>
            </div>
          )}

          {/* Star Rating */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400 mb-3">Rating <span className="text-surface-300">(optional)</span></p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setRating(prev => prev === star ? 0 : star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={28}
                    className={cn(
                      'transition-colors',
                      star <= (hoveredStar || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-surface-100 text-surface-200 dark:fill-surface-700 dark:text-surface-700'
                    )}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 self-center text-sm font-black text-amber-500">{rating}/5</span>
              )}
            </div>
          </div>

          {/* Review Remark */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400 mb-2">Review Remark <span className="text-surface-300">(optional)</span></p>
            <textarea
              value={remark}
              onChange={e => setRemark(e.target.value)}
              placeholder="Add feedback or remarks for the team member..."
              rows={3}
              className="input resize-none w-full"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-surface-100 dark:border-surface-800 flex gap-3 bg-surface-50/50 dark:bg-surface-800/30">
          <button
            onClick={() => onSubmit(task.id, 'approve', rating, remark)}
            disabled={isProcessing}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white h-12 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {isProcessing ? <Clock3 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Approve Completion
          </button>
          <button
            onClick={() => onSubmit(task.id, 'changes_requested', rating, remark)}
            disabled={isProcessing}
            className="flex-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 h-12 rounded-2xl font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center justify-center gap-2"
          >
            <XCircle size={16} />
            Request Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Completion Review Tab ────────────────────────────────────────────────────
const CompletionReviewTab: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const { users, projects } = useAppStore();
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [revertTask, setRevertTask] = useState<Task | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');

  const isPrivileged = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await tasksService.getCompletionReviews(projectId);
      const items: any[] = res.data?.data ?? [];
      // Normalize
      setTasks(items.map((t: any) => ({
        ...t,
        id: t.id || t._id,
        projectId: typeof t.projectId === 'object' && t.projectId !== null
          ? String(t.projectId._id || t.projectId.id || t.projectId)
          : String(t.projectId || ''),
        assigneeIds: Array.isArray(t.assigneeIds)
          ? t.assigneeIds.map((a: any) => typeof a === 'object' && a !== null ? String(a._id || a.id || a) : String(a)).filter(Boolean)
          : [],
      })));
    } catch {
      emitErrorToast('Could not load completion reviews.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchTasks(); }, [projectId]);

  const handleReview = async (taskId: string, action: 'approve' | 'changes_requested', rating: number, remark: string) => {
    try {
      setProcessingId(taskId);
      await tasksService.review(taskId, {
        action,
        ...(rating > 0 ? { rating } : {}),
        ...(remark.trim() ? { reviewRemark: remark.trim() } : {}),
      });
      emitSuccessToast(
        action === 'approve' ? 'Task completion approved!' : 'Changes requested from the team member.',
        action === 'approve' ? 'Approved' : 'Changes Requested'
      );
      setSelectedTask(null);
      await fetchTasks();
    } catch (err: any) {
      emitErrorToast(err?.response?.data?.error?.message || 'Review failed.', 'Review Error');
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tasks.filter(t => {
      if (!projectId && projectFilter !== 'all' && t.projectId !== projectFilter) return false;
      if (!q) return true;
      const assigneeNames = t.assigneeIds.map(id => users.find(u => u.id === id)?.name || '').join(' ');
      const proj = projects.find(p => p.id === t.projectId)?.name || '';
      return [t.title, assigneeNames, proj].join(' ').toLowerCase().includes(q);
    });
  }, [tasks, search, projectFilter, projectId, users, projects]);

  if (loading) {
    return <div className="card p-10 text-center text-sm text-surface-400">Loading completion reviews...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Awaiting Review', value: tasks.length, icon: <Clock3 size={16} />, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
          { label: 'Urgent', value: tasks.filter(t => t.priority === 'urgent').length, icon: <XCircle size={16} />, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30' },
          { label: 'High', value: tasks.filter(t => t.priority === 'high').length, icon: <Star size={16} />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
          { label: 'Total Projects', value: new Set(tasks.map(t => t.projectId)).size, icon: <FolderKanban size={16} />, color: 'text-brand-600 bg-brand-50 dark:bg-brand-950/30' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400">{s.label}</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-white leading-none mt-1">{s.value}</p>
              </div>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', s.color)}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-2xl p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 group">
            <ListFilter size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-brand-500 transition-colors" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks by name, assignee, project..."
              className="w-full bg-surface-50/50 dark:bg-surface-800/30 border border-surface-100 dark:border-surface-800 focus:border-brand-500/50 rounded-xl pl-11 pr-4 py-2 text-[13px] transition-all focus:outline-none focus:ring-4 focus:ring-brand-500/10 placeholder:text-surface-400 font-medium"
            />
          </div>
          {!projectId && (
            <div className="flex items-center bg-surface-50/50 dark:bg-surface-800/30 rounded-xl px-1 border border-surface-100 dark:border-surface-800 max-w-[200px]">
              <select
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="bg-transparent border-none py-2 px-3 text-[13px] font-bold text-surface-600 dark:text-surface-300 focus:ring-0 cursor-pointer outline-none truncate"
              >
                <option value="all">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={28} />}
          title="No completion reviews pending"
          description="All submitted tasks have been reviewed, or no tasks are waiting for completion approval."
        />
      ) : (
        <div className="bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-surface-50/50 dark:bg-surface-800/50 text-surface-400 font-semibold border-b border-surface-100 dark:border-surface-800">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider min-w-[240px]">Task</th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-center">Priority</th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider">Assignees</th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-center">Due Date</th>
                  {!projectId && <th className="px-4 py-4 font-bold uppercase tracking-wider">Project</th>}
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800/70">
                {filtered.map(task => {
                  const assignees = task.assigneeIds.map(id => users.find(u => u.id === id)).filter(Boolean) as any[];
                  const proj = projects.find(p => p.id === task.projectId);
                  const isProcessing = processingId === task.id;

                  return (
                    <tr
                      key={task.id}
                      className="group hover:bg-violet-50/40 dark:hover:bg-violet-950/10 transition-colors cursor-pointer"
                      onClick={() => setSelectedTask(task)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-bold text-surface-900 dark:text-white group-hover:text-violet-600 transition-colors truncate max-w-[280px]">
                            {task.title}
                          </span>
                          <span className="text-[10px] text-surface-400 font-medium">
                            Due {task.dueDate ? formatDate(task.dueDate) : '---'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low)}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-1.5">
                            {assignees.slice(0, 3).map(a => (
                              <UserAvatar key={a.id} name={a.name} color={a.color} size="xs" className="ring-2 ring-white dark:ring-surface-900" />
                            ))}
                          </div>
                          {assignees.length > 0 && (
                            <span className="text-[11px] font-bold text-surface-600 dark:text-surface-300 ml-1">
                              {assignees[0]?.name}{assignees.length > 1 ? ` +${assignees.length - 1}` : ''}
                            </span>
                          )}
                          {!assignees.length && <span className="text-[11px] text-surface-400 italic">Unassigned</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-[11px] font-bold text-surface-600 dark:text-surface-400">
                          {task.dueDate ? formatDate(task.dueDate) : '---'}
                        </span>
                      </td>
                      {!projectId && (
                        <td className="px-4 py-4">
                          {proj ? (
                            <span className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded font-black tracking-widest uppercase">
                              {proj.name}
                            </span>
                          ) : <span className="text-surface-400">—</span>}
                        </td>
                      )}
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {/* View button — always visible */}
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedTask(task); }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                            title="View details"
                          >
                            <Eye size={14} />
                          </button>
                          {/* Revert — only privileged */}
                          {isPrivileged && (
                            <button
                              onClick={e => { e.stopPropagation(); setRevertTask(task); }}
                              disabled={isProcessing}
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                              title="Revert — request changes from employee"
                            >
                              {isProcessing ? <Clock3 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View / Review Modal */}
      <AnimatePresence>
        {selectedTask && (
          <CompletionReviewModal
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onSubmit={handleReview}
            isProcessing={processingId === selectedTask.id}
          />
        )}
      </AnimatePresence>

      {/* Revert Notes Modal */}
      <AnimatePresence>
        {revertTask && (
          <RevertNotesModal
            task={revertTask}
            onClose={() => setRevertTask(null)}
            onSubmit={async (taskId, note) => {
              await handleReview(taskId, 'changes_requested', 0, note);
              setRevertTask(null);
            }}
            isProcessing={processingId === revertTask.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const TaskRequestsPage: React.FC = () => {
  const { id: projectId } = useParams<{ id?: string }>();
  const { projects, users, bootstrap } = useAppStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<TaskCreationRequest[]>([]);
  const [allRequests, setAllRequests] = useState<TaskCreationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<TaskCreationRequest | null>(null);
  const [requestType, setRequestType] = useState<RequestType>('creation');
  const [extensionRequests, setExtensionRequests] = useState<any[]>([]);
  const [allExtensionRequests, setAllExtensionRequests] = useState<any[]>([]);
  const itemsPerPage = 10;

  const isProjectView = Boolean(projectId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const creationResponse = await tasksService.getRequests({
          ...(projectId ? { projectId } : {}),
        });
        setAllRequests(creationResponse.data?.data ?? creationResponse.data ?? []);

        const extensionResponse = await api.get('/extension-requests');
        const extRows = extensionResponse.data?.data ?? extensionResponse.data ?? [];
        setAllExtensionRequests(extRows);
      } catch (error: any) {
        emitErrorToast('Requests could not be loaded.', 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const currentRequests = useMemo(() => {
    return requestType === 'creation'
      ? allRequests
      : allExtensionRequests.map(r => ({
          ...r,
          id: (r as any)._id || r.id,
          title: r.tasks && r.tasks[0] ? r.tasks[0].title : 'Extension Request',
          projectId: r.tasks && r.tasks[0] ? r.tasks[0].projectId : undefined,
          priority: '---',
          requestStatus: r.status,
          requestedBy: r.userId,
          createdAt: r.createdAt,
          startDate: r.tasks && r.tasks[0] ? r.tasks[0].originalDueDate : undefined,
          dueDate: r.requestedDueDate,
          description: r.reason,
          isExtension: true
        }));
  }, [requestType, allRequests, allExtensionRequests]);

  useEffect(() => {
    setRequests(
      statusFilter === 'all'
        ? currentRequests
        : currentRequests.filter((request) => request.requestStatus === statusFilter)
    );
  }, [currentRequests, statusFilter]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) => {
      if (!isProjectView && projectFilter !== 'all' && request.projectId !== projectFilter) return false;
      if (priorityFilter !== 'all' && request.priority.toLowerCase() !== priorityFilter) return false;
      if (!query) return true;

      const requesterName = users.find((member) => member.id === request.requestedBy)?.name || '';
      const reviewerNames = users
        .filter((member) => (request as any).requestedToIds?.includes(member.id))
        .map((member) => member.name)
        .join(' ');
      const assigneeNames = users
        .filter((member) => (request as any).assigneeIds?.includes(member.id))
        .map((member) => member.name)
        .join(' ');
      const projectName = projects.find((item) => item.id === request.projectId)?.name || '';

      return [request.title, request.description || '', requesterName, reviewerNames, assigneeNames, projectName]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [isProjectView, projectFilter, priorityFilter, projects, requests, search, users]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = useMemo(() => {
    return filteredRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredRequests, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, projectFilter, priorityFilter, search]);

  const summary = useMemo(() => {
    const activeList = requestType === 'creation' ? allRequests : allExtensionRequests;
    const statusKey = requestType === 'creation' ? 'requestStatus' : 'status';
    return {
      all: activeList.length,
      pending: activeList.filter((r) => r[statusKey] === 'pending').length,
      approved: activeList.filter((r) => r[statusKey] === 'approved').length,
      rejected: activeList.filter((r) => r[statusKey] === 'rejected').length,
    };
  }, [requestType, allRequests, allExtensionRequests]);

  const handleReview = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      setProcessingRequestId(requestId);
      const reviewNote = action === 'reject' ? window.prompt('Add rejection note (optional):') || '' : '';

      if (requestType === 'creation') {
        const response = await tasksService.reviewRequest(requestId, { action, reviewNote });
        const result = response.data?.data ?? response.data;
        if (result?.request) {
          setAllRequests((prev) => prev.map((request) => (request.id === requestId ? result.request : request)));
        }
      } else {
        const { extensionRequestsService } = await import('../../services/api');
        if (action === 'approve') {
          await extensionRequestsService.approve(requestId, reviewNote || undefined);
        } else {
          await extensionRequestsService.reject(requestId, reviewNote || 'Rejected by manager');
        }
        const extensionResponse = await api.get('/extension-requests');
        setAllExtensionRequests(extensionResponse.data?.data ?? extensionResponse.data ?? []);
      }

      await bootstrap();
      emitSuccessToast(
        action === 'approve' ? 'Request approved successfully.' : 'Request rejected successfully.',
        action === 'approve' ? 'Approved' : 'Rejected'
      );
    } catch (error: any) {
      emitErrorToast(
        error?.response?.data?.error?.message || error?.response?.data?.message || 'Task request action failed.',
        'Task Requests'
      );
    } finally {
      setProcessingRequestId(null);
    }
  };

  const canReviewRequest = (request: any) => {
    const privileged = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
    if (requestType === 'creation') {
      return privileged || (request.requestedToIds && request.requestedToIds.includes(user?.id || ''));
    }
    return privileged || request.reviewerId === user?.id;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {isProjectView && (
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-surface-400 transition-colors hover:text-surface-600 dark:hover:text-surface-300 mb-2"
        >
          <ArrowLeft size={14} />
          Back to project
        </Link>
      )}

      {/* Tab switcher */}
      <div className="flex items-center gap-4 bg-white dark:bg-surface-900 p-1.5 rounded-2xl border border-surface-100 dark:border-surface-800 shadow-sm w-fit">
        {[
          { value: 'creation' as RequestType, label: 'Task Creation' },
          { value: 'extension' as RequestType, label: 'Due Date Extensions' },
          { value: 'completion' as RequestType, label: 'Completion Review' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setRequestType(tab.value)}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              requestType === tab.value
                ? tab.value === 'completion'
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                  : "bg-brand-600 text-white shadow-lg shadow-brand-500/20"
                : "text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Completion Review Tab */}
      {requestType === 'completion' ? (
        <CompletionReviewTab projectId={projectId} />
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-2xl p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1 group">
                <ListFilter size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-brand-500 transition-colors" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search task requests by name, requester, project..."
                  className="w-full bg-surface-50/50 dark:bg-surface-800/30 border border-surface-100 dark:border-surface-800 focus:border-brand-500/50 focus:bg-white dark:focus:bg-surface-800 rounded-xl pl-11 pr-4 py-2 text-[13px] transition-all focus:outline-none focus:ring-4 focus:ring-brand-500/10 placeholder:text-surface-400 dark:placeholder:text-surface-500 font-medium"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-surface-50/50 dark:bg-surface-800/30 rounded-xl px-1 border border-surface-100 dark:border-surface-800 focus-within:border-brand-500/50 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as RequestStatusFilter)}
                    className="bg-transparent border-none py-2 px-3 text-[13px] font-bold text-surface-600 dark:text-surface-300 focus:ring-0 cursor-pointer hover:text-brand-600 transition-colors outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                {!isProjectView && (
                  <div className="flex items-center bg-surface-50/50 dark:bg-surface-800/30 rounded-xl px-1 border border-surface-100 dark:border-surface-800 focus-within:border-brand-500/50 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all max-w-[200px]">
                    <select
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      className="bg-transparent border-none py-2 px-3 text-[13px] font-bold text-surface-600 dark:text-surface-300 focus:ring-0 cursor-pointer hover:text-brand-600 transition-colors truncate outline-none"
                    >
                      <option value="all">All Projects</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex items-center bg-surface-50/50 dark:bg-surface-800/30 rounded-xl px-1 border border-surface-100 dark:border-surface-800">
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-transparent border-none py-2 px-3 text-[13px] font-bold text-surface-600 dark:text-surface-300 focus:ring-0 cursor-pointer outline-none"
                  >
                    <option value="all">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={cn(
                  'group rounded-xl border p-4 text-left transition-all duration-200',
                  statusFilter === key
                    ? 'border-brand-500 bg-white shadow-sm ring-1 ring-brand-500/10'
                    : 'border-surface-100 bg-white dark:border-surface-800 dark:bg-surface-900 hover:border-surface-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className={cn("text-[10px] font-bold uppercase tracking-[0.15em]", statusFilter === key ? "text-brand-600" : "text-surface-400")}>
                      {key === 'all' ? 'All Tasks' : key.charAt(0).toUpperCase() + key.slice(1)}
                    </p>
                    <p className="text-2xl font-bold text-surface-900 dark:text-white leading-none">{summary[key]}</p>
                  </div>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", statusFilter === key ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40" : "bg-surface-50 dark:bg-surface-800 text-surface-400")}>
                    {key === 'all' ? <FolderKanban size={16} /> : key === 'pending' ? <Clock3 size={16} /> : key === 'approved' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="card p-10 text-center text-sm text-surface-400">Loading task requests...</div>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={<FolderKanban size={28} />}
              title="No task requests found"
              description={isProjectView ? 'This project has no matching requests.' : 'No requests matched the current filters.'}
            />
          ) : (
            <div className="space-y-4">
              <div className="bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-surface-50/50 dark:bg-surface-800/50 text-surface-400 dark:text-surface-500 font-semibold border-b border-surface-100 dark:border-surface-800">
                      <tr>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider min-w-[240px]">Task Name</th>
                        <th className="px-4 py-4 font-bold uppercase tracking-wider text-center">Status</th>
                        <th className="px-4 py-4 font-bold uppercase tracking-wider text-center">Priority</th>
                        <th className="px-4 py-4 font-bold uppercase tracking-wider text-center">Due Date</th>
                        <th className="px-4 py-4 font-bold uppercase tracking-wider">Requested By</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-800/70">
                      {paginatedRequests.map((request) => {
                        const linkedProject = projects.find((item) => item.id === request.projectId);
                        const requester = users.find((u) => u.id === request.requestedBy) || (typeof request.requestedBy === 'object' ? request.requestedBy : null);
                        const meta = REQUEST_STATUS_META[request.requestStatus];
                        const StatusIcon = meta.icon;
                        const canReview = canReviewRequest(request);
                        const isProcessing = processingRequestId === request.id;

                        return (
                          <tr
                            key={request.id}
                            className="group hover:bg-surface-50/50 dark:hover:bg-surface-800/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[13px] font-bold text-surface-900 dark:text-white group-hover:text-brand-600 transition-colors truncate max-w-[300px]">
                                  {request.title}
                                </span>
                                <div className="flex items-center gap-2">
                                  {!isProjectView && linkedProject && (
                                    <span className="text-[10px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded font-black tracking-widest uppercase truncate max-w-[120px]">
                                      {linkedProject.name}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-surface-400 font-medium">Created {formatDate(request.createdAt)}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex justify-center">
                                <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border border-transparent', meta.badge)}>
                                  <StatusIcon size={12} />
                                  {meta.label}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex justify-center">
                                <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', PRIORITY_COLORS[request.priority] || PRIORITY_COLORS.low)}>
                                  {request.priority}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-[11px] font-bold text-surface-600 dark:text-surface-400">
                                {request.dueDate ? formatDate(request.dueDate) : '---'}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <UserAvatar name={requester?.name || 'User'} color={requester?.color} size="xs" />
                                <span className="text-[11px] font-bold text-surface-700 dark:text-surface-300 truncate max-w-[100px]">
                                  {requester?.name || 'Unknown'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                {/* View — always visible */}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setSelectedRequest(request); }}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                                  title="View details"
                                >
                                  <Eye size={14} />
                                </button>
                                {/* Approve / Reject — only for pending + privileged */}
                                {request.requestStatus === 'pending' && canReview && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); void handleReview(request.id, 'approve'); }}
                                      disabled={isProcessing}
                                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                                      title="Approve"
                                    >
                                      {isProcessing ? <Clock3 size={14} className="animate-spin" /> : <Check size={14} />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); void handleReview(request.id, 'reject'); }}
                                      disabled={isProcessing}
                                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                                      title="Reject"
                                    >
                                      <X size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredRequests.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {selectedRequest && (
          <RequestDetailOverlay
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
            onReview={handleReview}
            isProcessing={processingRequestId === selectedRequest.id}
            canReview={canReviewRequest(selectedRequest)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const RequestDetailOverlay: React.FC<{
  request: TaskCreationRequest;
  onClose: () => void;
  onReview: (id: string, action: 'approve' | 'reject') => Promise<void>;
  isProcessing: boolean;
  canReview: boolean;
}> = ({ request, onClose, onReview, isProcessing, canReview }) => {
  const { users, projects } = useAppStore();
  const linkedProject = projects.find((p) => p.id === request.projectId);
  const requester = (request as any).requesterObject || users.find((m) => m.id === request.requestedBy) || (typeof request.requestedBy === 'object' ? request.requestedBy : null);
  const reviewers = users.filter((m) => (request as any).requestedToIds?.includes(m.id));
  const assignees = users.filter((m) => (request as any).assigneeIds?.includes(m.id));
  const meta = REQUEST_STATUS_META[request.requestStatus as keyof typeof REQUEST_STATUS_META];
  const StatusIcon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-[2px] md:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        className="h-[92vh] w-full max-w-[650px] rounded-t-[1.5rem] bg-white shadow-2xl flex flex-col md:h-full md:rounded-none dark:bg-surface-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-8 py-5 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-2 text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest">
            <span>{linkedProject?.name || 'Project'}</span>
            <span>/</span>
            <span className="text-surface-500">Task Request</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors text-surface-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn('badge text-[10px] font-bold uppercase tracking-wider', meta.badge)}>
                <StatusIcon size={12} />
                {meta.label}
              </span>
              <span className="badge badge-blue text-[10px] font-bold uppercase tracking-wider">{request.priority}</span>
            </div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-white leading-tight">{request.title}</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 pt-4 border-t border-surface-100 dark:border-surface-800">
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Requested By</p>
              <div className="flex items-center gap-3">
                <UserAvatar name={requester?.name || 'Unknown'} color={requester?.color} size="sm" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-surface-900 dark:text-white">{requester?.name || 'Unknown'}</span>
                  <span className="text-xs text-surface-400">{requester?.email}</span>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Assignees</p>
              <div className="flex -space-x-2">
                {assignees.map((a) => <UserAvatar key={a.id} name={a.name} color={a.color} size="sm" className="border-2 border-white dark:border-surface-900" />)}
                {!assignees.length && <span className="text-sm text-surface-400">No assignee selected</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Timeline</p>
              <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300 font-bold">
                <Calendar size={14} className="text-surface-400" />
                <span>{request.startDate ? formatDate(request.startDate) : '---'}</span>
                <span className="text-surface-300">to</span>
                <span>{request.dueDate ? formatDate(request.dueDate) : '---'}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Status Info</p>
              <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300 font-bold">
                <Clock3 size={14} className="text-surface-400" />
                <span>Created on {formatDate(request.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Description</p>
            <div className="prose prose-sm dark:prose-invert max-w-none bg-surface-50 dark:bg-surface-800/40 p-5 rounded-2xl border border-surface-100 dark:border-surface-800">
              {request.description ? (
                <p className="whitespace-pre-wrap text-surface-700 dark:text-surface-300 leading-relaxed font-medium">{request.description}</p>
              ) : (
                <p className="italic text-surface-400">No description provided for this request.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Reviewers</p>
            <div className="flex flex-wrap gap-2">
              {reviewers.map((r) => (
                <div key={r.id} className="flex items-center gap-2 bg-surface-50 dark:bg-surface-800 px-3 py-1.5 rounded-full border border-surface-100 dark:border-surface-700">
                  <UserAvatar name={r.name} color={r.color} size="xs" />
                  <span className="text-xs font-bold text-surface-600 dark:text-surface-300">{r.name}</span>
                </div>
              ))}
            </div>
          </div>

          {request.reviewNote && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Review History</p>
              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 p-5 rounded-2xl">
                <div className="flex items-start gap-3">
                  <Clock3 size={16} className="mt-1 text-amber-500" />
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Rejection Note</p>
                    <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-300/80 italic leading-relaxed">"{request.reviewNote}"</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {request.requestStatus === 'pending' && canReview && (
          <div className="p-8 border-t border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30 flex gap-4">
            <button
              onClick={() => onReview(request.id, 'approve')}
              disabled={isProcessing}
              className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white h-12 rounded-xl font-bold transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2"
            >
              {isProcessing ? <Clock3 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Approve Request
            </button>
            <button
              onClick={() => onReview(request.id, 'reject')}
              disabled={isProcessing}
              className="flex-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 h-12 rounded-xl font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center justify-center gap-2"
            >
              <XCircle size={18} />
              Reject Request
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const PaginationControls = ({
  currentPage, totalPages, totalItems, itemsPerPage, onPageChange,
}: {
  currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number; onPageChange: (page: number) => void;
}) => {
  if (totalItems <= itemsPerPage) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(page =>
    totalPages <= 5 || page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
  );
  return (
    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-100 dark:border-surface-800 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-sm">
      <span className="text-[11px] font-bold uppercase tracking-widest text-surface-400">
        Showing {Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(totalItems, currentPage * itemsPerPage)} of {totalItems}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-xl border border-surface-100 bg-white px-4 py-2 text-[11px] font-bold text-surface-500 transition-colors hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-800 dark:bg-surface-900">Prev</button>
        {pages.map((page, index) => {
          const prevPage = pages[index - 1];
          const showGap = prevPage && page - prevPage > 1;
          return (
            <React.Fragment key={page}>
              {showGap ? <span className="px-1 text-xs font-bold text-surface-300">...</span> : null}
              <button type="button" onClick={() => onPageChange(page)} className={cn('h-9 min-w-9 rounded-xl px-2 text-xs font-bold transition-all', currentPage === page ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' : 'border border-surface-100 bg-white text-surface-500 hover:bg-surface-50 dark:border-surface-800 dark:bg-surface-900')}>
                {page}
              </button>
            </React.Fragment>
          );
        })}
        <button type="button" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="rounded-xl border border-surface-100 bg-white px-4 py-2 text-[11px] font-bold text-surface-500 transition-colors hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-800 dark:bg-surface-900">Next</button>
      </div>
    </div>
  );
};

export default TaskRequestsPage;
