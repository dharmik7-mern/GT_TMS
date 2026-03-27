import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, Flag, Tag, Users, Paperclip,
  Plus, Edit3, Trash2,
  ChevronDown, X, Send, AlertTriangle, ListTodo
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime, generateId } from '../../utils/helpers';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { UserAvatar } from '../UserAvatar';
import { Modal } from '../Modal';
import type { Activity, Task, Priority, TaskStatus, Comment } from '../../app/types';
import { tasksService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';

interface TaskModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

type ChecklistItem = { id: string; text: string; done: boolean };

function parseChecklist(value?: string) {
  const lines = String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [{ id: generateId(), text: '', done: false }] as ChecklistItem[];

  return lines.map((line) => {
    const checked = /^\[(x|X)\]\s*/.test(line);
    const unchecked = /^\[\s\]\s*/.test(line);
    return {
      id: generateId(),
      done: checked,
      text: line.replace(/^\[(x|X|\s)\]\s*/, '').replace(/^-+\s*/, ''),
    };
  }) as ChecklistItem[];
}

function serializeChecklist(items: ChecklistItem[]) {
  return items
    .filter((item) => item.text.trim())
    .map((item) => `[${item.done ? 'x' : ' '}] ${item.text.trim()}`)
    .join('\n');
}

type TimelineItem = {
  id: string;
  createdAt: string;
  actorId?: string;
  title: string;
  detail?: string;
};

function summarizeChecklist(value?: string) {
  return String(value || '')
    .split('\n')
    .map((line) => line.replace(/^\[(x|X|\s)\]\s*/, '').trim())
    .filter(Boolean)
    .join(' | ');
}

function buildTaskTimeline(task: Task, comments: Comment[]) {
  const items: TimelineItem[] = [];
  const seen = new Set<string>();
  const hasReviewLogs = (task.activityHistory || []).some((activity) =>
    activity.type === 'task_review_approved' || activity.type === 'task_review_changes_requested'
  );

  const pushItem = (item: TimelineItem) => {
    const key = `${item.createdAt}:${item.actorId || ''}:${item.title}:${item.detail || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  (task.activityHistory || []).forEach((activity: Activity) => {
    let title = activity.description;
    let detail = '';

    if (activity.type === 'task_created') {
      title = 'Created task';
    } else if (activity.type === 'task_status_changed') {
      title = 'Changed task status';
      const metadata = (activity.metadata || {}) as Record<string, unknown>;
      if (typeof metadata.from === 'string' && typeof metadata.to === 'string') {
        detail = `${metadata.from} -> ${metadata.to}`;
      }
    } else if (activity.type === 'task_review_approved') {
      title = 'Approved the task';
    } else if (activity.type === 'task_review_changes_requested') {
      title = 'Requested changes on the task';
    }

    pushItem({
      id: `log-${activity.id}`,
      createdAt: activity.createdAt,
      actorId: activity.userId,
      title,
      detail,
    });
  });

  comments.forEach((comment) => {
    pushItem({
      id: `comment-${comment.id}`,
      createdAt: comment.createdAt,
      actorId: comment.authorId,
      title: 'Added a comment',
      detail: comment.content,
    });
  });

  if (task.completionReview?.completedAt) {
    pushItem({
      id: 'completion',
      createdAt: task.completionReview.completedAt,
      actorId: task.completionReview.completedBy,
      title: 'Marked the task as completed',
      detail: summarizeChecklist(task.completionReview.completionRemark),
    });
  }

  if (task.completionReview?.reviewedAt && !hasReviewLogs) {
    pushItem({
      id: 'review',
      createdAt: task.completionReview.reviewedAt,
      actorId: task.completionReview.reviewedBy,
      title:
        task.completionReview.reviewStatus === 'approved'
          ? 'Approved the task'
          : 'Requested changes on the task',
      detail: [
        task.completionReview.rating ? `Rating ${task.completionReview.rating}/5` : '',
        summarizeChecklist(task.completionReview.reviewRemark),
      ].filter(Boolean).join(' | '),
    });
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const TaskModal: React.FC<TaskModalProps> = ({ task, open, onClose }) => {
  const { updateTask, deleteTask, projects, users, bootstrap } = useAppStore();
  const { user } = useAuthStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>(task?.comments || []);
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [completionChecklist, setCompletionChecklist] = useState<ChecklistItem[]>(parseChecklist(task?.completionReview?.completionRemark));
  const [reviewChecklist, setReviewChecklist] = useState<ChecklistItem[]>(parseChecklist(task?.completionReview?.reviewRemark));
  const [rating, setRating] = useState<number>(task?.completionReview?.rating || 0);
  const { register, handleSubmit } = useForm<{ title: string }>();
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingAssignee, setIsEditingAssignee] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!task) return null;

  const project = projects.find(p => p.id === task.projectId);
  const assignees = users.filter(u => task.assigneeIds.includes(u.id));
  const reporter = users.find(u => u.id === task.reporterId);
  const priority = PRIORITY_CONFIG[task.priority];
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
  const completionReview = task.completionReview;
  const activityItems = buildTaskTimeline(task, comments);
  
  const totalSubtasks = (task.subtasks || []).length;
  const completedSubtasks = (task.subtasks || []).filter(s => s.isCompleted).length;
  const subtaskProgress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
  const canReview = Boolean(
    user && (
      ['super_admin', 'admin', 'manager', 'team_leader'].includes(user.role) ||
      task.reporterId === user.id ||
      project?.reportingPersonIds?.includes(user.id)
    )
  );
  const canManageTask = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');

  const persistTaskUpdate = async (updates: Partial<Task> & { completionRemark?: string }, errorTitle = 'Task update failed') => {
    try {
      const response = await tasksService.update(task.id, updates);
      updateTask(task.id, response.data.data ?? response.data);
      await bootstrap();
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Task could not be updated.';
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

  const removeChecklistItem = (
    setter: React.Dispatch<React.SetStateAction<ChecklistItem[]>>
  , id: string) => {
    setter((items) => {
      const next = items.filter((item) => item.id !== id);
      return next.length ? next : [{ id: generateId(), text: '', done: false }];
    });
  };

  const addChecklistItem = (
    setter: React.Dispatch<React.SetStateAction<ChecklistItem[]>>
  ) => {
    setter((items) => [...items, { id: generateId(), text: '', done: false }]);
  };

  const completionRemark = serializeChecklist(completionChecklist);
  const reviewRemark = serializeChecklist(reviewChecklist);

  const handleReview = async (action: 'approve' | 'changes_requested') => {
    try {
      const response = await tasksService.review(task.id, {
        action,
        rating: action === 'approve' ? rating : undefined,
        reviewRemark: reviewRemark.trim() || undefined,
      });
      updateTask(task.id, response.data.data ?? response.data);
      await bootstrap();
      emitSuccessToast(action === 'approve' ? 'Task approved.' : 'Changes requested.');
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Task review failed.';
      emitErrorToast(message, 'Review failed');
    }
  };

  const addComment = () => {
    if (!newComment.trim() || !user) return;
    const comment: Comment = {
      id: generateId(),
      content: newComment,
      authorId: user.id,
      taskId: task.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setComments(prev => [...prev, comment]);
    setNewComment('');
  };

  const handleDelete = () => {
    if (!['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '')) {
      emitErrorToast('You do not have permission to delete tasks.', 'Forbidden');
      return;
    }
    (async () => {
      try {
        await tasksService.delete(task.id);
        deleteTask(task.id);
        await bootstrap();
        emitSuccessToast('Task deleted successfully.', 'Task Deleted');
        onClose();
      } catch (error: any) {
        const message =
          error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          'Task could not be deleted.';
        emitErrorToast(message, 'Delete failed');
      }
    })();
  };

  const handleAddSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    try {
      const response = await tasksService.addSubtask(task.id, { 
        title: subtaskTitle.trim(),
        isCompleted: false 
      } as any);
      updateTask(task.id, response.data.data ?? response.data);
      setSubtaskTitle('');
      setIsAddingSubtask(false);
      await bootstrap();
    } catch (err: any) {
      emitErrorToast(err?.response?.data?.message || 'Failed to add subtask', 'Error');
    }
  };

  const handleToggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    try {
      const response = await tasksService.patchSubtask(task.id, subtaskId, { isCompleted });
      updateTask(task.id, response.data.data ?? response.data);
      await bootstrap();
    } catch (err: any) {
      emitErrorToast(err?.response?.data?.message || 'Failed to update subtask', 'Error');
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    try {
      setIsUploading(true);
      const fileArray = Array.from(files);
      const response = await tasksService.uploadAttachments(task.id, fileArray);
      updateTask(task.id, response.data.data ?? response.data);
      await bootstrap();
      emitSuccessToast('Files uploaded successfully.');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to upload files';
      emitErrorToast(message, 'Upload Error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" showClose={false}>
      <div className="flex h-full max-h-[85vh] flex-col lg:flex-row">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-start gap-3 p-4 sm:p-6 pb-4 border-b border-surface-100 dark:border-surface-800">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-2 text-xs text-surface-400">
                <span className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: project?.color }} />
                <span>{project?.name}</span>
                <span>/</span>
                <span className={cn('px-1.5 py-0.5 rounded-md font-medium', statusCfg.bg, statusCfg.text)}>{statusCfg.label}</span>
              </div>

              {editingTitle && canManageTask ? (
                <form onSubmit={handleSubmit(data => {
                  (async () => {
                    await persistTaskUpdate({ title: data.title }, 'Title update failed');
                    setEditingTitle(false);
                  })();
                })}>
                  <input
                    {...register('title', { value: task.title })}
                    autoFocus
                    className="input text-xl font-display font-semibold mb-0 h-auto py-1"
                    onBlur={() => setEditingTitle(false)}
                  />
                </form>
              ) : (
                <h2 
                  className={cn(
                    "font-display font-semibold text-xl text-surface-900 dark:text-white leading-tight",
                    canManageTask && "cursor-pointer hover:text-brand-700 dark:hover:text-brand-300 transition-colors group"
                  )} 
                  onClick={() => canManageTask && setEditingTitle(true)}
                >
                  {task.title}
                  {canManageTask && <Edit3 size={14} className="inline ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-surface-400" />}
                </h2>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={handleDelete} className="btn-ghost w-8 h-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                <Trash2 size={15} />
              </button>
              <button onClick={onClose} className="btn-ghost w-8 h-8">
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex gap-1 px-4 sm:px-6 pt-3 border-b border-surface-100 dark:border-surface-800 overflow-x-auto">
            {(['details', 'activity'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-t-lg transition-all capitalize border-b-2 -mb-px',
                  activeTab === tab ? 'text-brand-700 dark:text-brand-300 border-brand-600' : 'text-surface-500 border-transparent hover:text-surface-700 dark:hover:text-surface-300'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4">
            {activeTab === 'details' ? (
              <div className="space-y-5">
                <div>
                  <label className="label">Description</label>
                  <textarea
                    defaultValue={task.description}
                    onBlur={e => { void persistTaskUpdate({ description: e.target.value }, 'Description update failed'); }}
                    placeholder="Add a description..."
                    className="input h-auto min-h-[80px] py-2 resize-none"
                    rows={3}
                  />
                </div>

                {(task.status === 'done' || completionReview?.completedAt) && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="label mb-0">Completion Remark</label>
                      <button
                        type="button"
                        onClick={() => { void persistTaskUpdate({ completionRemark }, 'Completion remark update failed'); }}
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
                            onChange={(e) => updateChecklistItem(setCompletionChecklist, item.id, { done: e.target.checked })}
                            className="rounded"
                          />
                          <input
                            value={item.text}
                            onChange={(e) => updateChecklistItem(setCompletionChecklist, item.id, { text: e.target.value })}
                            onBlur={() => { void persistTaskUpdate({ completionRemark }, 'Completion remark update failed'); }}
                            placeholder="Add completion checklist item..."
                            className="flex-1 bg-transparent text-sm outline-none"
                          />
                          <button type="button" onClick={() => removeChecklistItem(setCompletionChecklist, item.id)} className="btn-ghost w-8 h-8 text-surface-400">
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

                {(task.status === 'done' || completionReview?.reviewedAt || completionReview?.reviewRemark) && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label mb-0">Review</label>
                      <span className={cn(
                        'badge text-[10px]',
                        completionReview?.reviewStatus === 'approved'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300'
                          : completionReview?.reviewStatus === 'changes_requested'
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300'
                            : 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-300'
                      )}>
                        {(completionReview?.reviewStatus || 'pending').replace('_', ' ')}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {reviewChecklist.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 dark:border-surface-700 dark:bg-surface-900">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={(e) => updateChecklistItem(setReviewChecklist, item.id, { done: e.target.checked })}
                            className="rounded"
                          />
                          <input
                            value={item.text}
                            onChange={(e) => updateChecklistItem(setReviewChecklist, item.id, { text: e.target.value })}
                            placeholder="Add review checklist item..."
                            className="flex-1 bg-transparent text-sm outline-none"
                          />
                          <button type="button" onClick={() => removeChecklistItem(setReviewChecklist, item.id)} className="btn-ghost w-8 h-8 text-surface-400">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addChecklistItem(setReviewChecklist)} className="btn-ghost btn-sm text-xs">
                        <Plus size={12} />
                        Add Item
                      </button>
                    </div>
                    {canReview && task.status === 'done' && (
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
                        <button type="button" onClick={() => void handleReview('approve')} className="btn-primary btn-sm" disabled={rating < 1}>Approve</button>
                        <button type="button" onClick={() => void handleReview('changes_requested')} className="btn-secondary btn-sm">Request Changes</button>
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <label className="label mb-0">Subtasks</label>
                      {totalSubtasks > 0 && (
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors",
                          completedSubtasks === totalSubtasks && totalSubtasks > 0
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "text-surface-400 bg-surface-100 dark:bg-surface-800"
                        )}>
                          {completedSubtasks}/{totalSubtasks}
                        </span>
                      )}
                    </div>
                    {!isAddingSubtask && (
                      <button onClick={() => setIsAddingSubtask(true)} className="btn-ghost btn-sm text-xs">
                        <Plus size={12} />
                        Add
                      </button>
                    )}
                  </div>

                  {totalSubtasks > 0 && (
                    <div className="mb-4 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-black text-surface-400">
                        <span>Progress</span>
                        <span>{subtaskProgress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${subtaskProgress}%` }}
                          className="h-full bg-brand-500 rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {isAddingSubtask && (
                      <div className="flex items-center gap-2 p-1.5 rounded-xl border border-brand-500/30 bg-brand-50/10 dark:bg-brand-500/5 mb-3">
                        <input 
                          autoFocus
                          value={subtaskTitle}
                          onChange={e => setSubtaskTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddSubtask();
                            if (e.key === 'Escape') setIsAddingSubtask(false);
                          }}
                          placeholder="What needs to be done?"
                          className="flex-1 bg-transparent text-sm px-2 outline-none dark:text-surface-200"
                        />
                        <button onClick={handleAddSubtask} className="btn-primary btn-sm h-7 px-3 text-[10px] font-bold uppercase">Add</button>
                        <button onClick={() => setIsAddingSubtask(false)} className="btn-ghost btn-sm h-7 w-7 p-0 text-surface-400 hover:text-surface-600"><X size={14} /></button>
                      </div>
                    )}
                    {(task.subtasks || []).map(sub => (
                      <div key={sub.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-100 dark:border-surface-700 transition-all hover:border-surface-200 dark:hover:border-surface-600 group">
                        <input 
                          type="checkbox" 
                          checked={sub.isCompleted} 
                          onChange={(e) => handleToggleSubtask(sub.id, e.target.checked)}
                          className="rounded-md border-surface-300 text-brand-600 focus:ring-brand-500 dark:border-surface-700 dark:bg-surface-900 cursor-pointer h-4 w-4" 
                        />
                        <span className={cn('text-sm flex-1 transition-all', sub.isCompleted ? 'line-through text-surface-400 font-normal' : 'text-surface-700 dark:text-surface-200 font-medium')}>
                          {sub.title}
                        </span>
                      </div>
                    ))}
                    {(!isAddingSubtask && (!task.subtasks || task.subtasks.length === 0)) && (
                      <div className="py-6 text-center border-2 border-dashed border-surface-100 dark:border-surface-800 rounded-2xl">
                         <ListTodo size={24} className="mx-auto text-surface-200 mb-2" />
                         <p className="text-sm text-surface-400 italic">No subtasks yet. Break it down!</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">Attachments</label>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      multiple 
                      onChange={(e) => handleFileUpload(e.target.files)} 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isUploading}
                      className="btn-ghost btn-sm text-xs"
                    >
                      {isUploading ? <Clock size={12} className="animate-spin" /> : <Paperclip size={12} />}
                      {isUploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                  {(task.attachments || []).length > 0 && (
                    <div className="space-y-2 mb-4">
                      {(task.attachments || []).map((att) => (
                        <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-surface-800 rounded-xl border border-surface-100 dark:border-surface-700 text-xs hover:border-brand-500 transition-colors">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400 flex-shrink-0 font-medium">{att.name[0].toUpperCase()}</span>
                            <span className="truncate">{att.name}</span>
                          </span>
                          <span className="text-[10px] text-surface-400 flex-shrink-0">View</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleFileUpload(e.dataTransfer.files);
                    }}
                    className={cn(
                      "border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-brand-400 hover:bg-brand-50/10",
                      isUploading && "opacity-50 pointer-events-none"
                    )}
                  >
                    <Paperclip size={20} className="mx-auto text-surface-300 mb-2" />
                    <p className="text-xs text-surface-400">
                      {isUploading ? 'Uploading files...' : 'Drop files here or click to upload'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {activityItems.map(item => {
                  const author = item.actorId ? users.find(u => u.id === item.actorId) : null;
                  return (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                      <UserAvatar name={author?.name || 'System'} color={author?.color} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
                            {author?.name || 'System'}
                          </span>
                          <span className="text-xs text-surface-400">{formatRelativeTime(item.createdAt)}</span>
                        </div>
                        <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-3 text-sm text-surface-700 dark:text-surface-300">
                          <p>{item.title}</p>
                          {item.detail ? <p className="mt-1 text-xs text-surface-500 dark:text-surface-400 whitespace-pre-wrap">{item.detail}</p> : null}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {user && (
                  <div className="flex gap-3">
                    <UserAvatar name={user.name} color={user.color} size="sm" />
                    <div className="flex-1 relative">
                      <textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addComment(); }} className="input h-auto py-2 pr-10 resize-none" rows={2} />
                      <button onClick={addComment} disabled={!newComment.trim()} className="absolute right-2 bottom-2 btn-primary btn-sm w-7 h-7 p-0">
                        <Send size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-surface-100 dark:border-surface-800 p-4 sm:p-5 flex flex-col gap-4 flex-shrink-0 bg-surface-50/50 dark:bg-surface-950/30 overflow-y-auto">
          <div>
            <label className="label">Status</label>
            <div className="relative">
              <select value={task.status} onChange={e => { void persistTaskUpdate({ status: e.target.value as TaskStatus }, 'Status update failed'); }} className="input pr-8 appearance-none">
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
                      task.priority === key 
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
                    {task.assigneeIds.length > 0 ? 'Change' : 'Assign'}
                  </button>
                )}

                {isEditingAssignee && (
                  <div className="absolute left-0 top-full mt-2 z-30 w-56 p-1 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="max-h-48 overflow-y-auto">
                      {(project ? users.filter(u => project.members.includes(u.id)) : users).map(u => (
                        <button
                          key={u.id}
                          onClick={async () => {
                            const current = task.assigneeIds;
                            const next = current.includes(u.id) 
                              ? current.filter(id => id !== u.id)
                              : [...current, u.id];
                            await persistTaskUpdate({ assigneeIds: next }, 'Assignee update failed');
                            setIsEditingAssignee(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left",
                            task.assigneeIds.includes(u.id)
                              ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                              : "text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800"
                          )}
                        >
                          <UserAvatar name={u.name} color={u.color} size="xs" />
                          <span className="truncate flex-1">{u.name}</span>
                          {task.assigneeIds.includes(u.id) && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
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
              {task.dueDate ? (
                <span>{formatDate(task.dueDate)}{isOverdue && <AlertTriangle size={12} className="inline ml-1" />}</span>
              ) : (
                <span className="text-surface-400">No due date</span>
              )}
            </div>
          </div>

          {task.estimatedHours && (
            <div>
              <label className="label">Time Estimate</label>
              <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                <Clock size={14} />
                <span>{task.estimatedHours}h estimated</span>
              </div>
            </div>
          )}

          <div>
            <label className="label">Labels</label>
            <div className="flex flex-wrap gap-1.5">
              {(task.labels || []).map(label => (
                <span key={label} className="badge-gray text-[11px]">
                  <Tag size={9} />
                  {label}
                </span>
              ))}
              {(!task.labels || task.labels.length === 0) && <p className="text-xs text-surface-400">No labels</p>}
              <button className="badge text-[11px] bg-surface-100 dark:bg-surface-800 text-surface-500 hover:bg-surface-200 transition-colors">
                <Plus size={9} />
              </button>
            </div>
          </div>

          <div className="text-[11px] text-surface-400 pt-2 border-t border-surface-100 dark:border-surface-800">
            <p>Created {formatRelativeTime(task.createdAt)}</p>
            <p>Updated {formatRelativeTime(task.updatedAt)}</p>
            {completionReview?.completedAt && <p>Completed {formatRelativeTime(completionReview.completedAt)}</p>}
            {completionReview?.reviewedAt && <p>Reviewed {formatRelativeTime(completionReview.reviewedAt)}</p>}
            {completionReview?.rating ? <p>Rating {completionReview.rating}/5</p> : null}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TaskModal;
