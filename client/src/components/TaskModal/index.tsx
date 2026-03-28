import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, Flag, Tag, Users, Paperclip,
  Plus, Edit3, Trash2,
  ChevronDown, X, Send, AlertTriangle, ListTodo, UserPlus
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime, generateId, isDueDateOverdue } from '../../utils/helpers';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { UserAvatar } from '../UserAvatar';
import { Modal } from '../Modal';
import { ReassignRequestModal } from '../ReassignRequestModal';
import type { Activity, Task, Priority, TaskStatus, Comment, User } from '../../app/types';
import { tasksService, reassignService } from '../../services/api';
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
  
  const currentTask = useMemo(() => {
    if (!task) return null;
    return tasks.find((item) => item.id === task.id) || task;
  }, [task, tasks]);

  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [editingTitle, setEditingTitle] = useState(false);
  const [comments, setComments] = useState<Comment[]>(currentTask?.comments || []);
  const [newComment, setNewComment] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [completionChecklist, setCompletionChecklist] = useState<ChecklistItem[]>(parseChecklist(currentTask?.completionReview?.completionRemark));
  const [reviewChecklist, setReviewChecklist] = useState<ChecklistItem[]>(parseChecklist(currentTask?.completionReview?.reviewRemark));
  const [rating, setRating] = useState(currentTask?.completionReview?.rating || 0);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [isEditingAssignee, setIsEditingAssignee] = useState(false);
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [pendingReassign, setPendingReassign] = useState<any>(null);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const assigneeRef = React.useRef<HTMLDivElement>(null);
  const { register, handleSubmit, reset } = useForm<{ title: string }>();

  useEffect(() => {
    if (currentTask?.id) {
       (async () => {
         try {
           const res = await reassignService.getStatus(currentTask.id);
           setPendingReassign(res.data.data);
         } catch { /* noop */ }
       })();
    }
  }, [currentTask?.id]);

  useEffect(() => {
    if (!currentTask) return;
    reset({ title: currentTask.title });
    setComments(currentTask.comments || []);
    setCompletionChecklist(parseChecklist(currentTask.completionReview?.completionRemark));
    setReviewChecklist(parseChecklist(currentTask.completionReview?.reviewRemark));
    setRating(currentTask.completionReview?.rating || 0);
  }, [currentTask, reset]);

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

  if (!currentTask) return null;

  const project = projects.find(p => p.id === currentTask.projectId);
  const canManageTask = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
  const assignees = users.filter(u => currentTask.assigneeIds.includes(u.id));
  const reporter = users.find(u => u.id === currentTask.reporterId);
  const priority = PRIORITY_CONFIG[currentTask.priority] || PRIORITY_CONFIG.medium;
  const statusCfg = STATUS_CONFIG[currentTask.status] || STATUS_CONFIG.todo;
  const isOverdue = isDueDateOverdue(currentTask.dueDate, currentTask.status);
  const completionReview = currentTask.completionReview;
  const activityItems = buildTaskTimeline(currentTask, comments);
  const isReadOnly = !!(currentTask.isReassignPending || pendingReassign) && !canManageTask;

  const canReview = Boolean(
    user && (
      canManageTask ||
      currentTask.reporterId === user.id ||
      project?.reportingPersonIds?.includes(user.id)
    )
  );

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

  const persistTaskUpdate = async (updates: Partial<Task>, errorTitle = 'Task update failed') => {
    await syncTask(() => tasksService.update(currentTask.id, updates), errorTitle);
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

        <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-surface-100 dark:border-surface-800 p-4 sm:p-5 flex flex-col gap-4 flex-shrink-0 bg-surface-50/50 dark:bg-surface-950/30 overflow-y-auto">
          <div>
            <label className="label">Status</label>
            <div className="relative">
              <select
                  disabled={isReadOnly}
                  value={currentTask.status}
                  onChange={(e) => persistTaskUpdate({ status: e.target.value as TaskStatus }, 'Status update failed')}
                  className={cn(
                    'bg-white dark:bg-surface-800 border rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 outline-none transition-all w-full flex items-center justify-between',
                    statusCfg.bg,
                    statusCfg.text,
                    isReadOnly && 'opacity-50 cursor-not-allowed'
                  )}
                >
                {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Priority</label>
              {!isEditingPriority && canManageTask && (
                <button 
                  onClick={() => setIsEditingPriority(true)}
                  disabled={isReadOnly}
                  className="p-1 rounded-md text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800 transition-colors"
                >
                  <Edit3 size={13} />
                </button>
              )}
            </div>
            
            <motion.div layout className="flex gap-1.5 flex-wrap">
              {isEditingPriority ? (
                (Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG.low][]).map(([key, cfg]) => (
                  <button 
                    key={key} 
                    onClick={async () => { 
                      await persistTaskUpdate({ priority: key }, 'Priority update failed'); 
                      setIsEditingPriority(false);
                    }} 
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border', 
                      currentTask.priority === key 
                        ? `${cfg.bg} ${cfg.text} border-current ring-1 ring-current/20` 
                        : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-300 bg-white dark:bg-surface-900'
                    )}
                  >
                    <Flag size={10} style={{ color: cfg.color }} />
                    {cfg.label}
                  </button>
                ))
              ) : (
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                  priority.bg, priority.text, 'border-current/30 shadow-sm shadow-black/5'
                )}>
                  <Flag size={11} style={{ color: priority.color }} fill="currentColor" />
                  <span className="uppercase tracking-wider">{priority.label}</span>
                </div>
              )}
            </motion.div>
          </div>

          <div>
            <label className="label">Assignees</label>
            <div className="space-y-1.5">
              {assignees.map(u => (
                <div key={u.id} className="flex items-center gap-2 py-1">
                  <UserAvatar name={u.name} color={u.color} size="xs" />
                  <span className="text-xs text-surface-700 dark:text-surface-300">{u.name}</span>
                </div>
              ))}
              {assignees.length === 0 && <p className="text-xs text-surface-400">Unassigned</p>}
              
              <div className="relative">
                {canManageTask && (
                  <button 
                    onClick={() => setIsEditingAssignee(!isEditingAssignee)}
                    className="btn-ghost btn-sm text-xs mt-1"
                  >
                    <Users size={12} />
                    {currentTask.assigneeIds.length > 0 ? 'Change' : 'Assign'}
                  </button>
                )}

                {!canManageTask && (
                  <div className="pt-1">
                    {(currentTask.isReassignPending || pendingReassign) ? (
                      <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded-lg border border-amber-100 dark:border-amber-900/40 mt-1">
                        <Clock size={12} />
                         <span>
                           Reassigning to {users.find(u => u.id === currentTask.requestedAssigneeId)?.name || (pendingReassign ? users.find(u => u.id === pendingReassign.requestedAssigneeId)?.name : '...')}
                         </span>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsReassigning(true)}
                        className="btn-ghost btn-sm text-[11px] mt-1 text-brand-600 hover:text-brand-700"
                      >
                        <UserPlus size={12} />
                        Request Reassign
                      </button>
                    )}
                  </div>
                )}

                {isEditingAssignee && (
                  <div className="absolute left-0 top-full mt-2 z-30 w-56 p-1 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="max-h-48 overflow-y-auto">
                      {(project ? users.filter(u => project.members.includes(u.id)) : users).map(u => (
                        <button
                          key={u.id}
                          onClick={async () => {
                            const current = currentTask.assigneeIds;
                            const next = current.includes(u.id) 
                              ? current.filter(id => id !== u.id)
                              : [...current, u.id];
                            await persistTaskUpdate({ assigneeIds: next }, 'Assignee update failed');
                            setIsEditingAssignee(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left",
                            currentTask.assigneeIds.includes(u.id)
                              ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                              : "text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800"
                          )}
                        >
                          <UserAvatar name={u.name} color={u.color} size="xs" />
                          <span className="truncate flex-1">{u.name}</span>
                          {currentTask.assigneeIds.includes(u.id) && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {reporter && (
            <div>
              <label className="label">Reporter</label>
              <div className="flex items-center gap-2">
                <UserAvatar name={reporter.name} color={reporter.color} size="xs" />
                <span className="text-xs text-surface-700 dark:text-surface-300">{reporter.name}</span>
              </div>
            </div>
          )}

          <div>
            <label className="label">Due Date</label>
            <div className={cn('flex items-center gap-2 text-sm', isOverdue ? 'text-rose-500' : 'text-surface-600 dark:text-surface-400')}>
              <Calendar size={14} />
              {currentTask.dueDate ? (
                <span>{formatDate(currentTask.dueDate)}{isOverdue && <AlertTriangle size={12} className="inline ml-1" />}</span>
              ) : (
                <span className="text-surface-400">No due date</span>
              )}
            </div>
          </div>

          {currentTask.estimatedHours && (
            <div>
              <label className="label">Time Estimate</label>
              <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                <Clock size={14} />
                <span>{currentTask.estimatedHours}h estimated</span>
              </div>
            </div>
          )}

          <div>
            <label className="label">Labels</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {(currentTask.labels || []).map(label => (
                <span key={label} className="badge-gray text-[11px] group relative">
                  <Tag size={9} />
                  {label}
                  {canManageTask && (
                    <button 
                      onClick={async () => {
                        const next = (currentTask.labels || []).filter(l => l !== label);
                        await persistTaskUpdate({ labels: next }, 'Label removal failed');
                      }}
                      className="absolute -right-1 -top-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={8} strokeWidth={3} />
                    </button>
                  )}
                </span>
              ))}
              {(!currentTask.labels || currentTask.labels.length === 0) && !isAddingLabel && <p className="text-xs text-surface-400">No labels</p>}
              
              {isAddingLabel ? (
                <div className="relative">
                  <input
                    autoFocus
                    value={labelInput}
                    onChange={e => setLabelInput(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter') {
                        const trimmed = labelInput.trim();
                        if (trimmed && !(currentTask.labels || []).includes(trimmed)) {
                          const next = [...(currentTask.labels || []), trimmed];
                          await persistTaskUpdate({ labels: next }, 'Label addition failed');
                        }
                        setIsAddingLabel(false);
                        setLabelInput('');
                      }
                      if (e.key === 'Escape') {
                        setIsAddingLabel(false);
                        setLabelInput('');
                      }
                    }}
                    onBlur={() => {
                      // Small delay to allow clicking on predefined labels if I add them later
                      setTimeout(() => {
                        setIsAddingLabel(false);
                        setLabelInput('');
                      }, 150);
                    }}
                    className="input h-6 text-[10px] w-24 py-0 px-2 min-h-0 border-brand-500/50 focus:ring-1 focus:ring-brand-500/30"
                    placeholder="New label..."
                  />
                  <div className="absolute left-0 top-full mt-1 z-40 w-32 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-xl p-1">
                    {['ASAP', 'Feedback', 'Blocked', 'Follow-up'].filter(l => !(currentTask.labels || []).includes(l)).map(l => (
                      <button
                        key={l}
                        type="button"
                        onMouseDown={e => e.preventDefault()} // prevent blur
                        onClick={async () => {
                          const next = [...(currentTask.labels || []), l];
                          await persistTaskUpdate({ labels: next }, 'Label addition failed');
                          setIsAddingLabel(false);
                        }}
                        className="w-full text-left px-2 py-1.5 text-[10px] font-bold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700 rounded-md transition-colors"
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                canManageTask && (
                  <button 
                    type="button"
                    onClick={() => {
                        setIsAddingLabel(true);
                    }}
                    className="badge text-[11px] bg-surface-100 dark:bg-surface-800 text-surface-500 hover:bg-surface-200 transition-colors flex items-center justify-center p-1 min-w-[20px]"
                  >
                    <Plus size={10} strokeWidth={3} />
                  </button>
                )
              )}
            </div>
          </div>

          <div className="text-[11px] text-surface-400 pt-2 border-t border-surface-100 dark:border-surface-800">
            <p>Created {formatRelativeTime(currentTask.createdAt)}</p>
            <p>Updated {formatRelativeTime(currentTask.updatedAt)}</p>
            {completionReview?.completedAt && <p>Completed {formatRelativeTime(completionReview.completedAt)}</p>}
            {completionReview?.reviewedAt && <p>Reviewed {formatRelativeTime(completionReview.reviewedAt)}</p>}
            {completionReview?.rating ? <p>Rating {completionReview.rating}/5</p> : null}
          </div>
        </div>
      </div>
      <ReassignRequestModal 
        open={isReassigning}
        onClose={() => setIsReassigning(false)}
        taskId={currentTask.id}
        taskTitle={currentTask.title}
        onSubmitted={() => {
           bootstrap();
           (async () => {
             const res = await reassignService.getStatus(currentTask.id);
             setPendingReassign(res.data.data);
           })();
        }}
      />
    </Modal>
  );
};

export default TaskModal;
