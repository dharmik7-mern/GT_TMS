import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, Flag, Tag, Users, Paperclip,
  Plus, Edit3, Trash2,
  ChevronDown, X, Send, AlertTriangle, ListTodo, UserPlus, PlusCircle
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime, generateId, isDueDateOverdue } from '../../utils/helpers';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { UserAvatar } from '../UserAvatar';
import { Modal } from '../Modal';
import { ReassignRequestModal } from '../ReassignRequestModal';
import type { Activity, Task, Priority, TaskStatus, Comment, User, Label } from '../../app/types';
import { tasksService, reassignService, labelsService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';

interface TaskModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  initialTab?: 'details' | 'activity';
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

export const TaskModal: React.FC<TaskModalProps> = ({ task, open, onClose, initialTab = 'details' }) => {
  const { tasks, updateTask, deleteTask, projects, users, bootstrap, allLabels } = useAppStore();
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
  const [tagInput, setTagInput] = useState('');
  const [isCreatingNewLabel, setIsCreatingNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#71717a');
  const [isReassigning, setIsReassigning] = useState(false);
  const [pendingReassign, setPendingReassign] = useState<any>(null);
  const [selectedSubtaskAssigneeId, setSelectedSubtaskAssigneeId] = useState<string | null>(null);
  const [isSubtaskAssigneeOpen, setIsSubtaskAssigneeOpen] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  
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
      setSelectedSubtaskAssigneeId(null);
      setIsSubtaskAssigneeOpen(false);
      setEditingSubtaskId(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [initialTab, open, currentTask?.id]);

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
  const category = project?.subcategories?.find((item) => item.id === currentTask.subcategoryId);
  const canManageTask = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
  const isAssigned = currentTask.assigneeIds.includes(user?.id || '');
  const isReporter = currentTask.reporterId === user?.id;
  const canAddSubtask = canManageTask || isAssigned || isReporter;
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
      (
        !currentTask.assigneeIds.includes(user.id) &&
        project?.reportingPersonIds?.includes(user.id)
      )
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
                  {category ? (
                    <>
                      <span>/</span>
                      <span
                        className="rounded-md px-1.5 py-0.5 font-medium"
                        style={{ backgroundColor: `${category.color || '#6366f1'}20`, color: category.color || '#6366f1' }}
                      >
                        {category.name}
                      </span>
                    </>
                  ) : null}
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
                        Only admin, manager, team leadership, or a reporting person can submit the review.
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="label mb-0">Subtasks</label>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                        <div 
                          className="h-full bg-brand-500 transition-all duration-500" 
                          style={{ 
                            width: `${(currentTask.subtasks || []).length > 0 
                              ? Math.round(((currentTask.subtasks || []).filter((item) => item.isCompleted).length / (currentTask.subtasks || []).length) * 100) 
                              : 0}%` 
                          }} 
                        />
                      </div>
                      <span className="text-xs font-bold text-surface-500">{(currentTask.subtasks || []).filter((item) => item.isCompleted).length}/{(currentTask.subtasks || []).length} done</span>
                    </div>
                  </div>
                  {canAddSubtask && (
                    <div className="mb-3 flex items-center gap-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsSubtaskAssigneeOpen(!isSubtaskAssigneeOpen)}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl border transition-all",
                            selectedSubtaskAssigneeId 
                              ? "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-900/50 dark:bg-brand-950/20" 
                              : "border-surface-200 bg-white text-surface-400 hover:border-brand-300 hover:text-brand-500 dark:border-surface-700 dark:bg-surface-800"
                          )}
                          title="Assign subtask"
                        >
                          {selectedSubtaskAssigneeId ? (
                            <UserAvatar 
                              name={users.find(u => u.id === selectedSubtaskAssigneeId)?.name || '?'} 
                              color={users.find(u => u.id === selectedSubtaskAssigneeId)?.color} 
                              size="xs" 
                            />
                          ) : (
                            <UserPlus size={16} />
                          )}
                        </button>

                        {isSubtaskAssigneeOpen && (
                          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-surface-200 bg-white p-1 shadow-xl dark:border-surface-700 dark:bg-surface-900">
                            <div className="max-h-48 overflow-y-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSubtaskAssigneeId(null);
                                  setIsSubtaskAssigneeOpen(false);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800"
                              >
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
                                  <X size={10} />
                                </div>
                                <span>Unassigned</span>
                              </button>
                              {(project ? users.filter(u => project.members.includes(u.id) && ['team_leader', 'team_member'].includes(u.role)) : users.filter(u => ['team_leader', 'team_member'].includes(u.role))).map(u => (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSubtaskAssigneeId(u.id);
                                    setIsSubtaskAssigneeOpen(false);
                                  }}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                                    selectedSubtaskAssigneeId === u.id
                                      ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                                      : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-surface-800"
                                  )}
                                >
                                  <UserAvatar name={u.name} color={u.color} size="xs" />
                                  <span className="truncate">{u.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <input 
                        value={subtaskTitle} 
                        onChange={(event) => {
                          setSubtaskTitle(event.target.value);
                          if (!selectedSubtaskAssigneeId && user?.role === 'team_member') {
                            setSelectedSubtaskAssigneeId(user.id);
                          }
                        }} 
                        onKeyDown={(event) => { 
                          if (event.key === 'Enter') { 
                            event.preventDefault(); 
                            if (!subtaskTitle.trim()) return;
                            void syncTask(
                              () => {
                                console.log(`[addSubtask] Task: ${currentTask.id}, Title: ${subtaskTitle.trim()}, Assignee: ${selectedSubtaskAssigneeId}`);
                                return tasksService.addSubtask(currentTask.id, { 
                                  title: subtaskTitle.trim(), 
                                  assigneeId: selectedSubtaskAssigneeId ? selectedSubtaskAssigneeId : undefined 
                                });
                              }, 
                              'Subtask failed', 
                              'Subtask added successfully.'
                            ); 
                            setSubtaskTitle(''); 
                            setSelectedSubtaskAssigneeId(null);
                          } 
                        }} 
                        className="input h-9 flex-1 text-sm" 
                        placeholder="Add a subtask..." 
                      />
                      <button 
                        type="button" 
                        onClick={() => { 
                          if (!subtaskTitle.trim()) return;
                          void syncTask(
                            () => tasksService.addSubtask(currentTask.id, { 
                              title: subtaskTitle.trim(), 
                              assigneeId: selectedSubtaskAssigneeId ? selectedSubtaskAssigneeId : undefined 
                            }), 
                            'Subtask failed', 
                            'Subtask added successfully.'
                          ); 
                          setSubtaskTitle(''); 
                          setSelectedSubtaskAssigneeId(null);
                        }} 
                        disabled={!subtaskTitle.trim()} 
                        className="btn-secondary btn-sm h-9"
                      >
                        Add
                      </button>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {(currentTask.subtasks || []).map((subtask) => {
                      const rawAssignee = subtask.assigneeId;
                      const subAssignee = rawAssignee 
                        ? (typeof rawAssignee === 'object' && (rawAssignee as any).name 
                            ? (rawAssignee as any) 
                            : users.find(u => String(u.id) === String(rawAssignee) || String((u as any)._id) === String(rawAssignee)))
                        : null;
                      return (
                        <div key={subtask.id} className="group flex items-center gap-2 rounded-xl border border-surface-100 bg-surface-50 p-2.5 transition-all hover:border-surface-200 dark:border-surface-700 dark:bg-surface-800 dark:hover:border-surface-600">
                          <input 
                            type="checkbox" 
                            checked={subtask.isCompleted} 
                            onChange={() => { void syncTask(() => tasksService.patchSubtask(currentTask.id, subtask.id, { isCompleted: !subtask.isCompleted }), 'Subtask update failed'); }} 
                            disabled={user?.role === 'team_member' && String(user.id) !== String(subtask.assigneeId)}
                            className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50" 
                          />
                          <span className={cn('flex-1 text-sm font-medium', subtask.isCompleted ? 'line-through text-surface-400' : 'text-surface-700 dark:text-surface-200')}>
                            {subtask.title}
                          </span>
                          
                          {subAssignee ? (
                            <div className="relative group/subassignee">
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (user?.role === 'team_member' && String(user.id) !== String(subtask.assigneeId)) return;
                                  setEditingSubtaskId(editingSubtaskId === subtask.id ? null : subtask.id);
                                }}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-full bg-white px-2 py-1 shadow-sm dark:bg-surface-900 border border-surface-100 dark:border-surface-700 hover:border-brand-300 transition-colors",
                                  (user?.role === 'team_member' && String(user.id) !== String(subtask.assigneeId)) && "cursor-default hover:border-surface-100 dark:hover:border-surface-700"
                                )}
                              >
                                <UserAvatar name={subAssignee.name} color={subAssignee.color} size="xs" />
                                <span className="text-[10px] font-bold text-surface-500 whitespace-nowrap">{subAssignee.name.split(' ')[0]}</span>
                              </button>
                              
                              {editingSubtaskId === subtask.id && (
                                <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-surface-200 bg-white p-1 shadow-xl dark:border-surface-700 dark:bg-surface-950">
                                   <div className="max-h-40 overflow-y-auto">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void syncTask(() => tasksService.patchSubtask(currentTask.id, subtask.id, { assigneeId: null }), 'Update failed');
                                          setEditingSubtaskId(null);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800"
                                      >
                                        <X size={10} />
                                        <span>Remove Assignee</span>
                                      </button>
                                      {(project ? users.filter(u => project.members.includes(u.id) && ['team_leader', 'team_member'].includes(u.role)) : users.filter(u => ['team_leader', 'team_member'].includes(u.role))).map(u => (
                                        <button
                                          key={u.id}
                                          type="button"
                                          onClick={() => {
                                            void syncTask(() => tasksService.patchSubtask(currentTask.id, subtask.id, { assigneeId: u.id }), 'Update failed');
                                            setEditingSubtaskId(null);
                                          }}
                                          className={cn(
                                            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                                            (String(u.id) === String(subtask.assigneeId) || String((u as any)._id) === String(subtask.assigneeId))
                                              ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                                              : "text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-surface-800"
                                          )}
                                        >
                                          <UserAvatar name={u.name} color={u.color} size="xs" />
                                          <span className="truncate">{u.name}</span>
                                        </button>
                                      ))}
                                   </div>
                                </div>
                              )}
                            </div>
                          ) : subtask.assigneeId ? (
                            <div className="flex items-center gap-1 text-[10px] text-surface-400 opacity-60">
                               <Clock size={10} />
                               <span>Syncing...</span>
                            </div>
                          ) : (
                            <div className="relative">
                               <button 
                                 title="Assign subtask"
                                 onClick={() => {
                                   if (user?.role === 'team_member') return; // Only managers/reporters can assign unassigned subtasks (unless it's during creation)
                                   setEditingSubtaskId(editingSubtaskId === subtask.id ? null : subtask.id);
                                 }}
                                 className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded-full border border-dashed border-surface-300 px-2 py-1 text-[10px] text-surface-400 hover:border-brand-400 hover:text-brand-500 transition-all"
                               >
                                 <Plus size={10} />
                                 Unassigned
                               </button>

                               {editingSubtaskId === subtask.id && (
                                <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-surface-200 bg-white p-1 shadow-xl dark:border-surface-700 dark:bg-surface-950">
                                   <div className="max-h-40 overflow-y-auto">
                                      {(project ? users.filter(u => project.members.includes(u.id) && ['team_leader', 'team_member'].includes(u.role)) : users.filter(u => ['team_leader', 'team_member'].includes(u.role))).map(u => (
                                        <button
                                          key={u.id}
                                          type="button"
                                          onClick={() => {
                                            void syncTask(() => tasksService.patchSubtask(currentTask.id, subtask.id, { assigneeId: u.id }), 'Update failed');
                                            setEditingSubtaskId(null);
                                          }}
                                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-surface-800 transition-colors"
                                        >
                                          <UserAvatar name={u.name} color={u.color} size="xs" />
                                          <span className="truncate">{u.name}</span>
                                        </button>
                                      ))}
                                   </div>
                                </div>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => { void syncTask(() => tasksService.deleteSubtask(currentTask.id, subtask.id), 'Delete failed', 'Subtask removed.'); }}
                            disabled={user?.role === 'team_member' && String(user.id) !== String(subtask.assigneeId)}
                            className="ml-1 opacity-0 group-hover:opacity-100 p-1 text-surface-400 hover:text-rose-500 transition-all disabled:hidden"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
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
          <div className="flex justify-end gap-1 -mt-1 -mr-1">
            {canManageTask && (
              <button 
                onClick={() => { void (async () => { try { await tasksService.delete(currentTask.id); deleteTask(currentTask.id); await bootstrap(); emitSuccessToast('Task deleted successfully.', 'Task Deleted'); onClose(); } catch (error: any) { emitErrorToast(error?.response?.data?.message || 'Task could not be deleted.', 'Delete failed'); } })(); }} 
                className="btn-ghost h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button onClick={onClose} className="btn-ghost h-8 w-8 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800">
              <X size={15} />
            </button>
          </div>

          <div>
            <label className="label">Status</label>
            <div className="relative">
              <select
                  disabled={isReadOnly}
                  value={currentTask.status}
                  onChange={(e) => persistTaskUpdate({ status: e.target.value as TaskStatus }, 'Status update failed')}
                  className={cn(
                    'bg-white dark:bg-surface-800 border rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 outline-none transition-all w-full flex items-center justify-between appearance-none',
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
                      {(project ? users.filter(u => project.members.includes(u.id) && ['team_leader', 'team_member'].includes(u.role)) : users.filter(u => ['team_leader', 'team_member'].includes(u.role))).map(u => (
                        <button
                          key={u.id}
                          onClick={async () => {
                            const current = currentTask.assigneeIds;
                            const next = current.includes(u.id) 
                              ? current.filter(id => id !== u.id)
                              : [...current, u.id];
                            // Any assignment action resets status to 'todo' as requested
                            await persistTaskUpdate({ assigneeIds: next, status: 'todo' }, 'Assignee update failed');
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

          {category && (
            <div>
              <label className="label">Category</label>
              <div
                className="inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold"
                style={{ backgroundColor: `${category.color || '#6366f1'}20`, color: category.color || '#6366f1' }}
              >
                {category.name}
              </div>
            </div>
          )}

          <div>
            <label className="label">Created Date</label>
            <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
              <PlusCircle size={14} className="text-brand-500" />
              <span>{new Date(currentTask.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

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
            <div className="flex flex-wrap gap-1.5 items-center mb-1">
              {(currentTask.labels || []).map(label => {
                const l = typeof label === 'object' ? label : allLabels.find(allL => allL.id === label);
                if (!l) return null;
                return (
                  <span 
                    key={l.id} 
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold group relative transition-all"
                    style={{ backgroundColor: `${l.color}20`, color: l.color }}
                  >
                    {l.name}
                    {canAddSubtask && (
                      <button 
                        onClick={async () => {
                          const next = (currentTask.labels || []).map(lb => typeof lb === 'object' ? lb.id : lb).filter(id => id !== l.id);
                          await persistTaskUpdate({ labels: next }, 'Label removal failed');
                        }}
                        className="absolute -right-1 -top-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X size={8} strokeWidth={3} />
                      </button>
                    )}
                  </span>
                );
              })}
              
              <div className="relative">
                {canAddSubtask && (
                  <button 
                    type="button"
                    onClick={() => setIsAddingLabel(!isAddingLabel)}
                    className="h-6 w-6 rounded-md bg-surface-100 dark:bg-surface-800 text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors flex items-center justify-center"
                  >
                    <Plus size={12} strokeWidth={3} />
                  </button>
                )}

                {isAddingLabel && (
                  <div className="absolute left-0 top-full mt-2 z-50 w-56 rounded-xl border border-surface-200 bg-white p-1 shadow-xl dark:border-surface-700 dark:bg-surface-900 animate-in fade-in zoom-in duration-150">
                    <div className="max-h-48 overflow-y-auto">
                      <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider font-bold text-surface-400 border-b border-surface-100 dark:border-surface-800 mb-1">Select Labels</div>
                      {allLabels.map(l => {
                        const isSelected = (currentTask.labels || []).some(cl => (typeof cl === 'object' ? cl.id : cl) === l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={async () => {
                              const currentIds = (currentTask.labels || []).map(cl => typeof cl === 'object' ? cl.id : cl);
                              const next = isSelected ? currentIds.filter(id => id !== l.id) : [...currentIds, l.id];
                              await persistTaskUpdate({ labels: next }, 'Label update failed');
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors text-left font-medium",
                              isSelected ? "bg-surface-100 dark:bg-surface-800" : "hover:bg-surface-50 dark:hover:bg-surface-800"
                            )}
                          >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                            <span className="truncate flex-1">{l.name}</span>
                            {isSelected && <X size={10} className="text-surface-400" />}
                          </button>
                        );
                      })}
                      
                      <div className="border-t border-surface-100 dark:border-surface-800 mt-1 pt-1">
                        {(!isCreatingNewLabel && canManageTask) ? (
                          <button 
                            onClick={() => setIsCreatingNewLabel(true)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-brand-600 font-bold hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
                          >
                            <Plus size={12} strokeWidth={2.5} />
                            Create new label
                          </button>
                        ) : isCreatingNewLabel ? (
                          <div className="p-2 space-y-2">
                             <input 
                              autoFocus
                              value={newLabelName}
                              onChange={e => setNewLabelName(e.target.value)}
                              placeholder="Label name..."
                              className="input h-8 text-xs py-1"
                             />
                             <div className="flex items-center gap-1.5 flex-wrap">
                               {['#71717a', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'].map(c => (
                                 <button 
                                  key={c}
                                  onClick={() => setNewLabelColor(c)}
                                  className={cn("w-5 h-5 rounded-full border-2 transition-all", newLabelColor === c ? "border-brand-500 scale-110 shadow-sm" : "border-transparent")}
                                  style={{ backgroundColor: c }}
                                 />
                               ))}
                             </div>
                             <div className="flex gap-1 pt-1">
                               <button 
                                onClick={async () => {
                                  if (!newLabelName.trim()) return;
                                  try {
                                    const res = await labelsService.create({ name: newLabelName.trim(), color: newLabelColor });
                                    const newL = res.data.data;
                                    await bootstrap(); // Refresh labels
                                    const currentIds = (currentTask.labels || []).map(cl => typeof cl === 'object' ? cl.id : cl);
                                    await persistTaskUpdate({ labels: [...currentIds, newL.id] }, 'Update failed');
                                    setNewLabelName('');
                                    setIsCreatingNewLabel(false);
                                    setIsAddingLabel(false);
                                  } catch (e: any) {
                                    emitErrorToast(e?.response?.data?.error?.message || 'Failed to create label');
                                  }
                                }}
                                className="btn-primary btn-xs flex-1"
                               >
                                 Create
                               </button>
                               <button onClick={() => setIsCreatingNewLabel(false)} className="btn-secondary btn-xs">Cancel</button>
                             </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {(currentTask.tags || []).map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-md bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-[10px] font-medium text-surface-600 dark:text-surface-400 group relative">
                  #{tag}
                  {canAddSubtask && (
                    <button 
                      onClick={async () => {
                        const next = (currentTask.tags || []).filter(t => t !== tag);
                        await persistTaskUpdate({ tags: next }, 'Tag removal failed');
                      }}
                      className="absolute -right-1 -top-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <X size={8} strokeWidth={3} />
                    </button>
                  )}
                </span>
              ))}
              
              <div className="relative">
                <input 
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      const trimmed = tagInput.trim().replace(/^#/, '');
                      if (trimmed && !(currentTask.tags || []).includes(trimmed)) {
                        const next = [...(currentTask.tags || []), trimmed];
                        await persistTaskUpdate({ tags: next }, 'Tag addition failed');
                        setTagInput('');
                      }
                    }
                  }}
                  placeholder="Add tag..."
                  className="bg-transparent border-none outline-none text-[11px] w-20 py-0.5 text-surface-500 focus:text-brand-600 transition-colors"
                />
              </div>
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
