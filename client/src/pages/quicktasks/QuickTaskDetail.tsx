import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Flag, Trash2, Zap, MessageSquare, Send } from 'lucide-react';
import { cn, formatDate } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { EmptyState } from '../../components/ui';
import { QuickTaskModal } from '../../components/QuickTaskModal';
import { quickTasksService } from '../../services/api';
import type { Priority, QuickTaskStatus } from '../../app/types';

export const QuickTaskDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuthStore();
  const { users, quickTasks, updateQuickTask, deleteQuickTask, setQuickTaskStatus, bootstrap } = useAppStore();
  const task = quickTasks.find(t => t.id === id);

  const [editOpen, setEditOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [completionRemark, setCompletionRemark] = useState(task?.completionReview?.completionRemark || '');
  const [reviewRemark, setReviewRemark] = useState(task?.completionReview?.reviewRemark || '');

  if (!task) {
    return (
      <div className="max-w-3xl mx-auto">
        <EmptyState
          icon={<Zap size={28} />}
          title="Quick task not found"
          description="It may have been deleted."
          action={<Link to="/quick-tasks" className="btn-primary">Back to Quick Tasks</Link>}
        />
      </div>
    );
  }

  const assignees = (task.assigneeIds || [])
    .map((assigneeId) => users.find((u) => u.id === assigneeId))
    .filter(Boolean) as typeof users;
  const reporter = users.find(u => u.id === task.reporterId);
  const priority = PRIORITY_CONFIG[task.priority];
  const statusCfg =
    task.status === 'todo' ? STATUS_CONFIG.todo :
    task.status === 'in_progress' ? STATUS_CONFIG.in_progress :
    STATUS_CONFIG.done;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
  const canEdit = Boolean(user);
  const isAssignee = Boolean(user && task.assigneeIds.includes(user.id));
  const isReporter = Boolean(user && task.reporterId === user.id);
  const roleOk = Boolean(user && ['admin', 'super_admin', 'manager', 'team_leader'].includes(user.role || ''));
  const canComment = Boolean(user && (isAssignee || isReporter || roleOk));
  const canReview = Boolean(user && (isReporter || roleOk));

  const syncQuickTask = async (updates: Record<string, unknown>) => {
    try {
      const response = await quickTasksService.update(task.id, updates);
      updateQuickTask(task.id, response.data.data ?? response.data);
      await bootstrap();
    } catch {
      // keep page open
    }
  };

  const onChangeStatus = (status: QuickTaskStatus) => { void syncQuickTask({ status }); };
  const onChangePriority = (p: Priority) => { void syncQuickTask({ priority: p }); };
  const onChangeDueDate = (dueDate: string) => { void syncQuickTask({ dueDate: dueDate || undefined }); };

  const onDelete = () => {
    deleteQuickTask(task.id);
    navigate('/quick-tasks');
  };

  const handleAddComment = async () => {
    if (!canComment) return;
    const content = commentText.trim();
    if (!content) return;
    try {
      await quickTasksService.addComment(task.id, { content });
      await bootstrap();
      setCommentText('');
    } catch {}
  };

  const saveCompletionRemark = async () => {
    try {
      await syncQuickTask({ completionRemark });
    } catch {}
  };

  const handleReview = async (action: 'approve' | 'changes_requested') => {
    try {
      await quickTasksService.review(task.id, {
        action,
        reviewRemark: reviewRemark.trim() || undefined,
      });
      await bootstrap();
    } catch {}
  };

  return (
    <div className="max-w-full mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
            <ArrowLeft size={16} />
            Back
          </button>
          <Link to="/quick-tasks" className="text-sm text-surface-400 hover:text-surface-600">
            Quick Tasks
          </Link>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={cn('badge text-[10px]', priority.bg, priority.text)}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priority.color }} />
                {priority.label}
              </span>
              <span className={cn('badge text-[10px]', statusCfg.bg, statusCfg.text)}>{statusCfg.label}</span>
              <span className={cn(
                'badge text-[10px]',
                task.completionReview?.reviewStatus === 'approved'
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : task.completionReview?.reviewStatus === 'changes_requested'
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300'
                    : 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-300'
              )}>
                {(task.completionReview?.reviewStatus || 'pending').replace('_', ' ')}
              </span>
              {isOverdue && <span className="badge text-[10px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300">Overdue</span>}
            </div>

            <h1 className="page-title">{task.title}</h1>
            {task.description && <p className="page-subtitle whitespace-pre-line">{task.description}</p>}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="btn-secondary" onClick={() => setEditOpen(true)} disabled={!canEdit}>Edit</button>
            <button className="btn-ghost text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={onDelete} disabled={!canEdit}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-3">Details</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {(['todo', 'in_progress', 'done'] as QuickTaskStatus[]).map(status => (
                    <button
                      key={status}
                      onClick={() => onChangeStatus(status)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                        task.status === status
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-300 dark:hover:border-surface-600 hover:text-surface-700 dark:hover:text-surface-300'
                      )}
                      disabled={!canEdit}
                    >
                      {status === 'todo' ? STATUS_CONFIG.todo.label : status === 'in_progress' ? STATUS_CONFIG.in_progress.label : STATUS_CONFIG.done.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Priority</label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG.low][]).map(([p, cfg]) => (
                    <button
                      key={p}
                      onClick={() => onChangePriority(p)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                        task.priority === p
                          ? `${cfg.bg} ${cfg.text} border-current`
                          : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-300 dark:hover:border-surface-600'
                      )}
                      disabled={!canEdit}
                    >
                      <Flag size={10} style={{ color: cfg.color }} />
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Assignees</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {assignees.length ? assignees.slice(0, 3).map((u) => (
                      <span key={u.id} className="badge text-[11px] bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-200">{u.name}</span>
                    )) : <span className="text-xs text-surface-400">Unassigned</span>}
                    {assignees.length > 3 && <span className="text-xs text-surface-400">+{assignees.length - 3} more</span>}
                  </div>
                  <p className="text-xs text-surface-400 mt-1">Update assignees in the Edit modal.</p>
                </div>

                <div>
                  <label className="label">Due date</label>
                  <div className="relative">
                    <input type="date" value={task.dueDate ?? ''} onChange={(e) => onChangeDueDate(e.target.value)} className="input pr-10" disabled={!canEdit} />
                    <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {(task.status === 'done' || task.completionReview?.completedAt) && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-3">Completion Remark</h3>
              <textarea
                value={completionRemark}
                onChange={(e) => setCompletionRemark(e.target.value)}
                onBlur={() => void saveCompletionRemark()}
                placeholder="Add completion notes..."
                className="input h-auto min-h-[100px] py-2 resize-none"
                rows={4}
              />
            </div>
          )}

          {(task.status === 'done' || task.completionReview?.reviewedAt || task.completionReview?.reviewRemark) && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-surface-900 dark:text-white">Review</h3>
                <span className={cn(
                  'badge text-[10px]',
                  task.completionReview?.reviewStatus === 'approved'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : task.completionReview?.reviewStatus === 'changes_requested'
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300'
                      : 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-300'
                )}>
                  {(task.completionReview?.reviewStatus || 'pending').replace('_', ' ')}
                </span>
              </div>
              <textarea
                value={reviewRemark}
                onChange={(e) => setReviewRemark(e.target.value)}
                placeholder="Add reviewer remarks..."
                className="input h-auto min-h-[100px] py-2 resize-none"
                rows={4}
              />
              {canReview && task.status === 'done' && (
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => void handleReview('approve')} className="btn-primary btn-sm">Approve</button>
                  <button type="button" onClick={() => void handleReview('changes_requested')} className="btn-secondary btn-sm">Request Changes</button>
                </div>
              )}
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-2">Activity</h3>
            <p className="text-sm text-surface-400">Created {task.createdAt ? formatDate(task.createdAt) : '-'} · Updated {task.updatedAt ? formatDate(task.updatedAt) : '-'}</p>
            {task.completionReview?.completedAt && <p className="text-sm text-surface-400 mt-1">Completed {formatDate(task.completionReview.completedAt)}</p>}
            {task.completionReview?.reviewedAt && <p className="text-sm text-surface-400 mt-1">Reviewed {formatDate(task.completionReview.reviewedAt)}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-3">People</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-surface-400">Assignees</span>
                <span className="text-surface-700 dark:text-surface-300 font-medium truncate">
                  {assignees.length ? `${assignees.map((u) => u.name).slice(0, 3).join(', ')}${assignees.length > 3 ? ` +${assignees.length - 3}` : ''}` : 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-surface-400">Reporter</span>
                <span className="text-surface-700 dark:text-surface-300 font-medium truncate">{reporter?.name ?? '-'}</span>
              </div>
            </div>
          </div>

          <div className={cn('card p-5', isOverdue && 'border-rose-200 dark:border-rose-900/50')}>
            <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-3">Dates</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-surface-400">Due</span>
                <span className={cn('font-medium', isOverdue ? 'text-rose-600 dark:text-rose-300' : 'text-surface-700 dark:text-surface-300')}>
                  {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                </span>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
              <MessageSquare size={16} />
              Comments
            </h3>
            <div className="space-y-3 mb-4">
              {task.comments?.length ? task.comments.map((comment) => {
                const author = users.find((u) => u.id === comment.authorId);
                return (
                  <div key={comment.id} className="bg-white dark:bg-surface-800 p-3 rounded-xl border border-surface-100 dark:border-surface-700">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs font-semibold text-surface-900 dark:text-white truncate">{author?.name ?? 'Unknown'}</span>
                      <span className="text-[10px] text-surface-400">{comment.createdAt ? formatDate(comment.createdAt) : '-'}</span>
                    </div>
                    <p className="text-xs text-surface-600 dark:text-surface-300 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                );
              }) : <p className="text-xs text-surface-400">No comments yet.</p>}
            </div>
            {canComment ? (
              <div className="flex gap-3">
                <div className="flex-1">
                  <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..." className="input h-auto py-2 pr-10 resize-none" rows={2} />
                </div>
                <button onClick={handleAddComment} disabled={!commentText.trim()} className="btn-primary btn-sm w-9 h-9 p-0 flex items-center justify-center disabled:opacity-50" title="Send">
                  <Send size={16} />
                </button>
              </div>
            ) : <p className="text-xs text-surface-400 mt-1">Only assignees and the reporter can comment.</p>}
          </div>

          {task.attachments?.length ? (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-3">Files</h3>
              <div className="space-y-2">
                {task.attachments.map((att) => (
                  <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 text-xs hover:border-brand-500 transition-colors">
                    <span className="w-6 h-6 rounded bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400">F</span>
                    <span className="truncate flex-1">{att.name}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <QuickTaskModal open={editOpen} onClose={() => setEditOpen(false)} task={task} />
    </div>
  );
};

export default QuickTaskDetailPage;
