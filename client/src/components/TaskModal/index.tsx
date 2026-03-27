import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, ChevronDown, Clock, Edit3, Flag, Paperclip, Plus, Send, Tag, Trash2, Users, X } from 'lucide-react';
import { cn, formatDate, formatRelativeTime, generateId } from '../../utils/helpers';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { UserAvatar } from '../UserAvatar';
import { Modal } from '../Modal';
import type { Activity, Comment, Priority, Task, TaskStatus, User } from '../../app/types';
import { tasksService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';

interface TaskModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

type ChecklistItem = { id: string; text: string; done: boolean };
type TimelineItem = { id: string; createdAt: string; actorId?: string; title: string; detail?: string };

function parseChecklist(value?: string) {
  const lines = String(value || '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [{ id: generateId(), text: '', done: false }] as ChecklistItem[];
  return lines.map((line) => ({
    id: generateId(),
    done: /^\[(x|X)\]\s*/.test(line),
    text: line.replace(/^\[(x|X|\s)\]\s*/, '').replace(/^-+\s*/, ''),
  }));
}

function serializeChecklist(items: ChecklistItem[]) {
  return items.filter((item) => item.text.trim()).map((item) => `[${item.done ? 'x' : ' '}] ${item.text.trim()}`).join('\n');
}

function summarizeChecklist(value?: string) {
  return String(value || '').split('\n').map((line) => line.replace(/^\[(x|X|\s)\]\s*/, '').trim()).filter(Boolean).join(' | ');
}

function buildTaskTimeline(task: Task, comments: Comment[]) {
  const items: TimelineItem[] = [];
  const seen = new Set<string>();
  const push = (item: TimelineItem) => {
    const key = `${item.createdAt}:${item.actorId || ''}:${item.title}:${item.detail || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  (task.activityHistory || []).forEach((activity: Activity) => {
    let title = activity.description;
    let detail = '';
    if (activity.type === 'task_created') title = 'Created task';
    if (activity.type === 'task_status_changed') {
      title = 'Changed task status';
      const metadata = (activity.metadata || {}) as Record<string, unknown>;
      if (typeof metadata.from === 'string' && typeof metadata.to === 'string') detail = `${metadata.from} -> ${metadata.to}`;
    }
    if (activity.type === 'task_review_approved') title = 'Approved the task';
    if (activity.type === 'task_review_changes_requested') title = 'Requested changes on the task';
    push({ id: `log-${activity.id}`, createdAt: activity.createdAt, actorId: activity.userId, title, detail });
  });

  comments.forEach((comment) => {
    push({ id: `comment-${comment.id}`, createdAt: comment.createdAt, actorId: comment.authorId, title: 'Added a comment', detail: comment.content });
  });

  if (task.completionReview?.completedAt) {
    push({
      id: 'completion',
      createdAt: task.completionReview.completedAt,
      actorId: task.completionReview.completedBy,
      title: 'Marked the task as completed',
      detail: summarizeChecklist(task.completionReview.completionRemark),
    });
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const TaskModal: React.FC<TaskModalProps> = ({ task, open, onClose }) => {
  const { tasks, updateTask, deleteTask, projects, users, bootstrap } = useAppStore();
  const { user } = useAuthStore();
  const activeTask = task ? tasks.find((item) => item.id === task.id) || task : null;
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [editingTitle, setEditingTitle] = useState(false);
  const [comments, setComments] = useState<Comment[]>(activeTask?.comments || []);
  const [newComment, setNewComment] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [completionChecklist, setCompletionChecklist] = useState<ChecklistItem[]>(parseChecklist(activeTask?.completionReview?.completionRemark));
  const [reviewChecklist, setReviewChecklist] = useState<ChecklistItem[]>(parseChecklist(activeTask?.completionReview?.reviewRemark));
  const [rating, setRating] = useState(activeTask?.completionReview?.rating || 0);
  const [isUploading, setIsUploading] = useState(false);
  const assigneeRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { register, handleSubmit, reset } = useForm<{ title: string }>();

  const currentTask = activeTask;
  const project = projects.find((item) => item.id === currentTask?.projectId);
  const assignees = users.filter((item) => currentTask?.assigneeIds.includes(item.id));
  const reporter = users.find((item) => item.id === currentTask?.reporterId);
  const canManageTask = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
  const canReview = Boolean(
    user && (
      canManageTask ||
      currentTask?.reporterId === user.id ||
      project?.reportingPersonIds?.includes(user.id)
    )
  );
  const completionReview = currentTask?.completionReview;
  const priority = currentTask ? PRIORITY_CONFIG[currentTask.priority] : PRIORITY_CONFIG.medium;
  const statusCfg = currentTask ? STATUS_CONFIG[currentTask.status] || STATUS_CONFIG.todo : STATUS_CONFIG.todo;
  const isOverdue = Boolean(currentTask?.dueDate && new Date(currentTask.dueDate) < new Date() && currentTask.status !== 'done');
  const assignableUsers = useMemo(() => {
    const memberIds = new Set(project?.members || []);
    return users.filter((item) => memberIds.has(item.id));
  }, [project?.members, users]);
  const filteredAssignableUsers = useMemo(() => {
    const query = assigneeQuery.trim().toLowerCase();
    if (!query) return assignableUsers;
    return assignableUsers.filter((item) => [item.name, item.email, item.jobTitle, item.department].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
  }, [assignableUsers, assigneeQuery]);
  const activityItems = currentTask ? buildTaskTimeline(currentTask, comments) : [];

  useEffect(() => {
    if (!currentTask) return;
    reset({ title: currentTask.title });
    setComments(currentTask.comments || []);
    setCompletionChecklist(parseChecklist(currentTask.completionReview?.completionRemark));
    setReviewChecklist(parseChecklist(currentTask.completionReview?.reviewRemark));
    setRating(currentTask.completionReview?.rating || 0);
  }, [currentTask, reset]);

  useEffect(() => {
    if (!assigneeOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (assigneeRef.current?.contains(event.target as Node)) return;
      setAssigneeOpen(false);
      setAssigneeQuery('');
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [assigneeOpen]);

  useEffect(() => {
    if (!open) {
      setActiveTab('details');
      setEditingTitle(false);
      setNewComment('');
      setSubtaskTitle('');
      setAssigneeOpen(false);
      setAssigneeQuery('');
    }
  }, [open]);

  if (!currentTask) return null;

  const syncTask = async (request: () => Promise<any>, errorTitle: string, successMessage?: string) => {
    try {
      const response = await request();
      updateTask(currentTask.id, response.data.data ?? response.data);
      await bootstrap();
      if (successMessage) emitSuccessToast(successMessage);
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || error?.response?.data?.message || 'Task update failed.';
      emitErrorToast(message, errorTitle);
    }
  };

  const updateChecklistItem = (
    setter: React.Dispatch<React.SetStateAction<ChecklistItem[]>>,
    id: string,
    updates: Partial<ChecklistItem>
  ) => {
    setter((items) => items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const addChecklistItem = (setter: React.Dispatch<React.SetStateAction<ChecklistItem[]>>) => {
    setter((items) => [...items, { id: generateId(), text: '', done: false }]);
  };

  const removeChecklistItem = (setter: React.Dispatch<React.SetStateAction<ChecklistItem[]>>, id: string) => {
    setter((items) => {
      const next = items.filter((item) => item.id !== id);
      return next.length ? next : [{ id: generateId(), text: '', done: false }];
    });
  };

  const completionRemark = serializeChecklist(completionChecklist);
  const reviewRemark = serializeChecklist(reviewChecklist);

  const handleReview = async (action: 'approve' | 'changes_requested') => {
    await syncTask(
      () =>
        tasksService.review(currentTask.id, {
          action,
          rating: action === 'approve' ? rating : undefined,
          reviewRemark: reviewRemark.trim() || undefined,
        }),
      'Review failed',
      action === 'approve' ? 'Task approved.' : 'Changes requested.'
    );
  };

  const addComment = () => {
    if (!newComment.trim() || !user) return;
    setComments((prev) => [...prev, {
      id: generateId(),
      content: newComment.trim(),
      authorId: user.id,
      taskId: currentTask.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }]);
    setNewComment('');
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" showClose={false}>
      <div className="flex h-full max-h-[85vh] flex-col lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-surface-100 p-4 dark:border-surface-800 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-1.5 text-xs text-surface-400">
                  <span className="h-3 w-3 rounded" style={{ backgroundColor: project?.color }} />
                  <span>{project?.name || 'Project task'}</span>
                  <span>/</span>
                  <span className={cn('rounded-md px-1.5 py-0.5 font-medium', statusCfg.bg, statusCfg.text)}>{statusCfg.label}</span>
                </div>
                {editingTitle && canManageTask ? (
                  <form onSubmit={handleSubmit(async (data) => { await syncTask(() => tasksService.update(currentTask.id, { title: data.title }), 'Title update failed'); setEditingTitle(false); })}>
                    <input {...register('title')} autoFocus className="input h-auto py-1 text-xl font-display font-semibold" onBlur={() => setEditingTitle(false)} />
                  </form>
                ) : (
                  <h2 className={cn('font-display text-xl font-semibold text-surface-900 dark:text-white', canManageTask && 'cursor-pointer hover:text-brand-700 dark:hover:text-brand-300')} onClick={() => canManageTask && setEditingTitle(true)}>
                    {currentTask.title}{canManageTask && <Edit3 size={14} className="ml-2 inline text-surface-400" />}
                  </h2>
                )}
              </div>
              <div className="flex items-center gap-1">
                {canManageTask && <button onClick={() => { void (async () => { try { await tasksService.delete(currentTask.id); deleteTask(currentTask.id); await bootstrap(); emitSuccessToast('Task deleted successfully.', 'Task Deleted'); onClose(); } catch (error: any) { emitErrorToast(error?.response?.data?.message || 'Task could not be deleted.', 'Delete failed'); } })(); }} className="btn-ghost h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={15} /></button>}
                <button onClick={onClose} className="btn-ghost h-8 w-8"><X size={15} /></button>
              </div>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-surface-100 px-4 pt-3 dark:border-surface-800 sm:px-6">
            {(['details', 'activity'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={cn('rounded-t-lg border-b-2 -mb-px px-3 py-2 text-sm font-medium capitalize', activeTab === tab ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-surface-500')}>
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {activeTab === 'details' ? (
              <div className="space-y-5">
                <div>
                  <label className="label">Description</label>
                  <textarea key={`desc-${currentTask.id}`} defaultValue={currentTask.description} onBlur={(event) => { void syncTask(() => tasksService.update(currentTask.id, { description: event.target.value }), 'Description update failed'); }} className="input h-auto min-h-[88px] resize-none py-2" rows={3} placeholder="Add a description..." />
                </div>
                {(currentTask.status === 'done' || completionReview?.completedAt) && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="label mb-0">Completion Remark</label>
                      <button
                        type="button"
                        onClick={() => { void syncTask(() => tasksService.update(currentTask.id, { completionRemark }), 'Completion remark update failed', 'Completion remark saved.'); }}
                        className="btn-secondary btn-sm"
                      >
                        Save Remark
                      </button>
                    </div>
                    <div className="space-y-2">
                      {completionChecklist.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 dark:border-surface-700 dark:bg-surface-900">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={(event) => updateChecklistItem(setCompletionChecklist, item.id, { done: event.target.checked })}
                            className="rounded"
                          />
                          <input
                            value={item.text}
                            onChange={(event) => updateChecklistItem(setCompletionChecklist, item.id, { text: event.target.value })}
                            onBlur={() => { void syncTask(() => tasksService.update(currentTask.id, { completionRemark }), 'Completion remark update failed'); }}
                            placeholder="Add completion checklist item..."
                            className="flex-1 bg-transparent text-sm outline-none"
                          />
                          <button type="button" onClick={() => removeChecklistItem(setCompletionChecklist, item.id)} className="btn-ghost h-8 w-8 text-surface-400">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addChecklistItem(setCompletionChecklist)} className="btn-ghost btn-sm text-xs">
                        <Plus size={12} />
                        Add Item
                      </button>
                    </div>
                  </div>
                )}
                {(currentTask.status === 'done' || completionReview?.reviewedAt || completionReview?.reviewRemark) && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="label mb-0">Review</label>
                      <span
                        className={cn(
                          'badge text-[10px]',
                          completionReview?.reviewStatus === 'approved'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300'
                            : completionReview?.reviewStatus === 'changes_requested'
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300'
                              : 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-300'
                        )}
                      >
                        {(completionReview?.reviewStatus || 'pending').replace('_', ' ')}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {reviewChecklist.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 dark:border-surface-700 dark:bg-surface-900">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={(event) => updateChecklistItem(setReviewChecklist, item.id, { done: event.target.checked })}
                            className="rounded"
                          />
                          <input
                            value={item.text}
                            onChange={(event) => updateChecklistItem(setReviewChecklist, item.id, { text: event.target.value })}
                            placeholder="Add review checklist item..."
                            className="flex-1 bg-transparent text-sm outline-none"
                          />
                          <button type="button" onClick={() => removeChecklistItem(setReviewChecklist, item.id)} className="btn-ghost h-8 w-8 text-surface-400">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addChecklistItem(setReviewChecklist)} className="btn-ghost btn-sm text-xs">
                        <Plus size={12} />
                        Add Item
                      </button>
                    </div>
                    {canReview && currentTask.status === 'done' && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="label">Rating</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setRating(value)}
                                className={cn(
                                  'flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-medium transition-all',
                                  rating >= value
                                    ? 'border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-500 dark:bg-amber-950/30 dark:text-amber-300'
                                    : 'border-surface-200 text-surface-500 hover:border-surface-300 dark:border-surface-700'
                                )}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </div>
                        {completionReview?.rating ? <p className="text-xs text-surface-400">Current rating: {completionReview.rating}/5</p> : null}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { void handleReview('approve'); }} className="btn-primary btn-sm" disabled={rating < 1}>Approve</button>
                          <button type="button" onClick={() => { void handleReview('changes_requested'); }} className="btn-secondary btn-sm">Request Changes</button>
                        </div>
                      </div>
                    )}
                    {!canReview && (
                      <p className="mt-3 text-xs text-surface-400">
                        Only the reporter, assigned reporting person, or management can submit the review.
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="label mb-0">Subtasks</label>
                    <span className="text-xs text-surface-400">{(currentTask.subtasks || []).filter((item) => item.isCompleted).length}/{(currentTask.subtasks || []).length} done</span>
                  </div>
                  {canManageTask && (
                    <div className="mb-3 flex items-center gap-2">
                      <input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void syncTask(() => tasksService.addSubtask(currentTask.id, { title: subtaskTitle.trim() }), 'Subtask failed', 'Subtask added successfully.'); setSubtaskTitle(''); } }} className="input h-9 text-sm" placeholder="Add a subtask..." />
                      <button type="button" onClick={() => { void syncTask(() => tasksService.addSubtask(currentTask.id, { title: subtaskTitle.trim() }), 'Subtask failed', 'Subtask added successfully.'); setSubtaskTitle(''); }} disabled={!subtaskTitle.trim()} className="btn-secondary btn-sm">Add</button>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {(currentTask.subtasks || []).map((subtask) => (
                      <div key={subtask.id} className="flex items-center gap-2 rounded-xl border border-surface-100 bg-surface-50 p-2.5 dark:border-surface-700 dark:bg-surface-800">
                        <input type="checkbox" checked={subtask.isCompleted} onChange={() => { void syncTask(() => tasksService.patchSubtask(currentTask.id, subtask.id, { isCompleted: !subtask.isCompleted }), 'Subtask update failed'); }} className="rounded" />
                        <span className={cn('flex-1 text-sm', subtask.isCompleted && 'line-through text-surface-400')}>{subtask.title}</span>
                      </div>
                    ))}
                    {(!currentTask.subtasks || currentTask.subtasks.length === 0) && <p className="text-sm italic text-surface-400">No subtasks yet</p>}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="label mb-0">Attachments</label>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { const files = event.target.files; if (!files?.length) return; setIsUploading(true); void syncTask(() => tasksService.uploadAttachments(currentTask.id, Array.from(files)), 'Upload failed', 'Files uploaded successfully.').finally(() => { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }); }} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="btn-ghost btn-sm text-xs"><Paperclip size={12} />{isUploading ? 'Uploading...' : 'Upload'}</button>
                  </div>
                  {(currentTask.attachments || []).length > 0 && <div className="mb-4 space-y-2">{(currentTask.attachments || []).map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-surface-100 bg-white p-2 text-xs dark:border-surface-700 dark:bg-surface-800"><span className="truncate">{attachment.name}</span><span className="text-[10px] text-surface-400">View</span></a>)}</div>}
                  <div onClick={() => fileInputRef.current?.click()} className={cn('cursor-pointer rounded-xl border-2 border-dashed border-surface-200 p-6 text-center hover:border-brand-400 dark:border-surface-700', isUploading && 'pointer-events-none opacity-50')}>
                    <Paperclip size={20} className="mx-auto mb-2 text-surface-300" />
                    <p className="text-xs text-surface-400">{isUploading ? 'Uploading files...' : 'Drop files here or click to upload'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {activityItems.map((item) => {
                  const author = item.actorId ? users.find((candidate): candidate is User => candidate.id === item.actorId) : null;
                  return <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3"><UserAvatar name={author?.name || 'System'} color={author?.color} size="sm" /><div className="flex-1"><div className="mb-1 flex items-center gap-2"><span className="text-sm font-medium text-surface-800 dark:text-surface-200">{author?.name || 'System'}</span><span className="text-xs text-surface-400">{formatRelativeTime(item.createdAt)}</span></div><div className="rounded-xl bg-surface-50 p-3 text-sm text-surface-700 dark:bg-surface-800 dark:text-surface-300"><p>{item.title}</p>{item.detail ? <p className="mt-1 whitespace-pre-wrap text-xs text-surface-500 dark:text-surface-400">{item.detail}</p> : null}</div></div></motion.div>;
                })}
                {user && <div className="flex gap-3"><UserAvatar name={user.name} color={user.color} size="sm" /><div className="relative flex-1"><textarea value={newComment} onChange={(event) => setNewComment(event.target.value)} className="input h-auto resize-none py-2 pr-10" rows={2} placeholder="Add a comment..." /><button onClick={addComment} disabled={!newComment.trim()} className="btn-primary btn-sm absolute bottom-2 right-2 h-7 w-7 p-0"><Send size={12} /></button></div></div>}
              </div>
            )}
          </div>
        </div>

        <div className="w-full flex-shrink-0 overflow-y-auto border-t border-surface-100 bg-surface-50/50 p-4 dark:border-surface-800 dark:bg-surface-950/30 lg:w-64 lg:border-l lg:border-t-0 sm:p-5">
          <div className="space-y-4">
            <div><label className="label">Status</label><div className="relative"><select value={currentTask.status} onChange={(event) => { void syncTask(() => tasksService.update(currentTask.id, { status: event.target.value as TaskStatus }), 'Status update failed'); }} className="input appearance-none pr-8">{Object.entries(STATUS_CONFIG).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" /></div></div>
            <div><label className="label">Priority</label><div className="flex flex-wrap gap-1.5">{(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG.low][]).map(([key, config]) => <button key={key} type="button" onClick={() => { void syncTask(() => tasksService.update(currentTask.id, { priority: key }), 'Priority update failed'); }} className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium', currentTask.priority === key ? `${config.bg} ${config.text} border-current` : 'border-surface-200 text-surface-500 dark:border-surface-700')}><Flag size={10} style={{ color: config.color }} />{config.label}</button>)}</div></div>
            <div><label className="label">Assignees</label><div ref={assigneeRef} className="relative space-y-1.5">{assignees.map((item) => <div key={item.id} className="flex items-center gap-2 py-1"><UserAvatar name={item.name} color={item.color} size="xs" /><span className="text-xs text-surface-700 dark:text-surface-300">{item.name}</span></div>)}{assignees.length === 0 && <p className="text-xs text-surface-400">Unassigned</p>}{canManageTask && <button type="button" onClick={() => setAssigneeOpen((prev) => !prev)} className="btn-ghost btn-sm mt-1 text-xs"><Users size={12} />Assign</button>}{assigneeOpen && <div className="mt-2 rounded-2xl border border-surface-200 bg-white p-3 shadow-lg dark:border-surface-700 dark:bg-surface-900"><input value={assigneeQuery} onChange={(event) => setAssigneeQuery(event.target.value)} className="input mb-2 h-9 text-sm" placeholder="Search assignees..." /><div className="max-h-48 space-y-1 overflow-y-auto">{filteredAssignableUsers.map((candidate) => <label key={candidate.id} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface-50 dark:hover:bg-surface-800"><input type="checkbox" checked={currentTask.assigneeIds.includes(candidate.id)} onChange={() => { const next = currentTask.assigneeIds.includes(candidate.id) ? currentTask.assigneeIds.filter((id) => id !== candidate.id) : [...currentTask.assigneeIds, candidate.id]; void syncTask(() => tasksService.update(currentTask.id, { assigneeIds: next }), 'Assignee update failed'); }} className="rounded" /><UserAvatar name={candidate.name} color={candidate.color} size="xs" /><div className="min-w-0 flex-1"><p className="truncate text-xs text-surface-700 dark:text-surface-200">{candidate.name}</p><p className="truncate text-[10px] text-surface-400">{candidate.jobTitle || candidate.email}</p></div></label>)}{filteredAssignableUsers.length === 0 && <p className="px-2 py-3 text-xs text-surface-400">No team members match this search.</p>}</div></div>}</div></div>
            {reporter && <div><label className="label">Reporter</label><div className="flex items-center gap-2"><UserAvatar name={reporter.name} color={reporter.color} size="xs" /><span className="text-xs text-surface-700 dark:text-surface-300">{reporter.name}</span></div></div>}
            <div><label className="label">Due Date</label><div className={cn('flex items-center gap-2 text-sm', isOverdue ? 'text-rose-500' : 'text-surface-600 dark:text-surface-400')}><Calendar size={14} />{currentTask.dueDate ? <span>{formatDate(currentTask.dueDate)}{isOverdue && <AlertTriangle size={12} className="ml-1 inline" />}</span> : <span className="text-surface-400">No due date</span>}</div></div>
            {currentTask.estimatedHours ? <div><label className="label">Time Estimate</label><div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400"><Clock size={14} /><span>{currentTask.estimatedHours}h estimated</span></div></div> : null}
            <div><label className="label">Labels</label><div className="flex flex-wrap gap-1.5">{(currentTask.labels || []).map((label) => <span key={label} className="badge-gray text-[11px]"><Tag size={9} />{label}</span>)}{(!currentTask.labels || currentTask.labels.length === 0) && <p className="text-xs text-surface-400">No labels</p>}</div></div>
            <div className="border-t border-surface-100 pt-2 text-[11px] text-surface-400 dark:border-surface-800"><p>Created {formatRelativeTime(currentTask.createdAt)}</p><p>Updated {formatRelativeTime(currentTask.updatedAt)}</p>{completionReview?.completedAt && <p>Completed {formatRelativeTime(completionReview.completedAt)}</p>}{completionReview?.reviewedAt && <p>Reviewed {formatRelativeTime(completionReview.reviewedAt)}</p>}{completionReview?.rating ? <p>Rating {completionReview.rating}/5</p> : null}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TaskModal;
