import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, Flag, Tag, Users, Paperclip,
  MessageSquare, CheckSquare, Plus, Edit3, Trash2,
  ChevronDown, X, Send, AlertTriangle
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime, generateId } from '../../utils/helpers';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { UserAvatar, AvatarGroup } from '../UserAvatar';
import { Modal } from '../Modal';
import type { Task, Priority, TaskStatus, Comment } from '../../app/types';
import { tasksService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';

interface TaskModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ task, open, onClose }) => {
  const { updateTask, deleteTask, projects, users, bootstrap } = useAppStore();
  const { user } = useAuthStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>(task?.comments || []);
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');

  const { register, handleSubmit, reset } = useForm<{ title: string; description: string }>();

  if (!task) return null;

  const project = projects.find(p => p.id === task.projectId);
  const assignees = users.filter(u => task.assigneeIds.includes(u.id));
  const reporter = users.find(u => u.id === task.reporterId);
  const priority = PRIORITY_CONFIG[task.priority];
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  const persistTaskUpdate = async (updates: Partial<Task>, successTitle = 'Task Updated') => {
    try {
      const response = await tasksService.update(task.id, updates);
      updateTask(task.id, response.data.data ?? response.data);
      await bootstrap();
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Task could not be updated.';
      emitErrorToast(message, successTitle);
    }
  };

  const handleStatusChange = (status: TaskStatus) => {
    persistTaskUpdate({ status }, 'Status update failed');
  };

  const handlePriorityChange = (p: Priority) => {
    persistTaskUpdate({ priority: p }, 'Priority update failed');
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

  return (
    <Modal open={open} onClose={onClose} size="xl" showClose={false}>
      <div className="flex h-full max-h-[85vh]">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-start gap-3 p-6 pb-4 border-b border-surface-100 dark:border-surface-800">
            <div className="flex-1 min-w-0">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 mb-2 text-xs text-surface-400">
                <span
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{ backgroundColor: project?.color }}
                />
                <span>{project?.name}</span>
                <span>/</span>
                <span className={cn('px-1.5 py-0.5 rounded-md font-medium', statusCfg.bg, statusCfg.text)}>
                  {statusCfg.label}
                </span>
              </div>

              {editingTitle ? (
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
                  className="font-display font-semibold text-xl text-surface-900 dark:text-white cursor-pointer hover:text-brand-700 dark:hover:text-brand-300 transition-colors leading-tight"
                  onClick={() => setEditingTitle(true)}
                >
                  {task.title}
                  <Edit3 size={14} className="inline ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-surface-400" />
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

          {/* Tabs */}
          <div className="flex gap-1 px-6 pt-3 border-b border-surface-100 dark:border-surface-800">
            {(['details', 'activity'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-t-lg transition-all capitalize border-b-2 -mb-px',
                  activeTab === tab
                    ? 'text-brand-700 dark:text-brand-300 border-brand-600'
                    : 'text-surface-500 border-transparent hover:text-surface-700 dark:hover:text-surface-300'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 pt-4">
            {activeTab === 'details' ? (
              <div className="space-y-5">
                {/* Description */}
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

                {/* Subtasks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">Subtasks</label>
                    <button className="btn-ghost btn-sm text-xs">
                      <Plus size={12} />
                      Add
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {(task.subtasks || []).map(sub => (
                      <div key={sub.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-100 dark:border-surface-700">
                        <input type="checkbox" checked={sub.isCompleted} readOnly className="rounded" />
                        <span className={cn('text-sm flex-1', sub.isCompleted && 'line-through text-surface-400')}>{sub.title}</span>
                      </div>
                    ))}
                    {(!task.subtasks || task.subtasks.length === 0) && (
                      <p className="text-sm text-surface-400 italic">No subtasks yet</p>
                    )}
                  </div>
                </div>

                {/* Attachments */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">Attachments</label>
                    <button className="btn-ghost btn-sm text-xs">
                      <Paperclip size={12} />
                      Upload
                    </button>
                  </div>
                  {(task.attachments || []).length > 0 && (
                    <div className="space-y-2 mb-4">
                      {(task.attachments || []).map((att) => (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-surface-800 rounded-xl border border-surface-100 dark:border-surface-700 text-xs hover:border-brand-500 transition-colors"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400 flex-shrink-0">
                              F
                            </span>
                            <span className="truncate">{att.name}</span>
                          </span>
                          <span className="text-[10px] text-surface-400 flex-shrink-0">View</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl p-6 text-center">
                    <Paperclip size={20} className="mx-auto text-surface-300 mb-2" />
                    <p className="text-xs text-surface-400">Drop files here or click to upload</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Comments */}
                {comments.map(comment => {
                  const author = users.find(u => u.id === comment.authorId) || users[0];
                  return (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3"
                    >
                      <UserAvatar name={author.name} color={author.color} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-surface-800 dark:text-surface-200">{author.name}</span>
                          <span className="text-xs text-surface-400">{formatRelativeTime(comment.createdAt)}</span>
                        </div>
                        <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-3 text-sm text-surface-700 dark:text-surface-300">
                          {comment.content}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Add comment */}
                {user && (
                  <div className="flex gap-3">
                    <UserAvatar name={user.name} color={user.color} size="sm" />
                    <div className="flex-1 relative">
                      <textarea
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addComment(); }}
                        className="input h-auto py-2 pr-10 resize-none"
                        rows={2}
                      />
                      <button
                        onClick={addComment}
                        disabled={!newComment.trim()}
                        className="absolute right-2 bottom-2 btn-primary btn-sm w-7 h-7 p-0"
                      >
                        <Send size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-64 border-l border-surface-100 dark:border-surface-800 p-5 flex flex-col gap-4 flex-shrink-0 bg-surface-50/50 dark:bg-surface-950/30 overflow-y-auto">
          {/* Status */}
          <div>
            <label className="label">Status</label>
            <div className="relative">
              <select
                value={task.status}
                onChange={e => handleStatusChange(e.target.value as TaskStatus)}
                className="input pr-8 appearance-none"
              >
                {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="label">Priority</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG.low][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => handlePriorityChange(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    task.priority === key
                      ? `${cfg.bg} ${cfg.text} border-current`
                      : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-300'
                  )}
                >
                  <Flag size={10} style={{ color: cfg.color }} />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignees */}
          <div>
            <label className="label">Assignees</label>
            <div className="space-y-1.5">
              {assignees.map(u => (
                <div key={u.id} className="flex items-center gap-2 py-1">
                  <UserAvatar name={u.name} color={u.color} size="xs" />
                  <span className="text-xs text-surface-700 dark:text-surface-300">{u.name}</span>
                </div>
              ))}
              {assignees.length === 0 && (
                <p className="text-xs text-surface-400">Unassigned</p>
              )}
              <button className="btn-ghost btn-sm text-xs mt-1">
                <Users size={12} />
                Assign
              </button>
            </div>
          </div>

          {/* Reporter */}
          {reporter && (
            <div>
              <label className="label">Reporter</label>
              <div className="flex items-center gap-2">
                <UserAvatar name={reporter.name} color={reporter.color} size="xs" />
                <span className="text-xs text-surface-700 dark:text-surface-300">{reporter.name}</span>
              </div>
            </div>
          )}

          {/* Due Date */}
          <div>
            <label className="label">Due Date</label>
            <div className={cn('flex items-center gap-2 text-sm', isOverdue ? 'text-rose-500' : 'text-surface-600 dark:text-surface-400')}>
              <Calendar size={14} />
              {task.dueDate ? (
                <span>
                  {formatDate(task.dueDate)}
                  {isOverdue && <AlertTriangle size={12} className="inline ml-1" />}
                </span>
              ) : (
                <span className="text-surface-400">No due date</span>
              )}
            </div>
          </div>

          {/* Time Estimate */}
          {task.estimatedHours && (
            <div>
              <label className="label">Time Estimate</label>
              <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                <Clock size={14} />
                <span>{task.estimatedHours}h estimated</span>
              </div>
              {task.trackedHours && (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between text-xs text-surface-400 mb-1">
                    <span>{task.trackedHours}h tracked</span>
                    <span>{Math.round((task.trackedHours / task.estimatedHours) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${Math.min((task.trackedHours / task.estimatedHours) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Labels */}
          <div>
            <label className="label">Labels</label>
            <div className="flex flex-wrap gap-1.5">
              {(task.labels || []).map(label => (
                <span key={label} className="badge-gray text-[11px]">
                  <Tag size={9} />
                  {label}
                </span>
              ))}
              {(!task.labels || task.labels.length === 0) && (
                <p className="text-xs text-surface-400">No labels</p>
              )}
              <button className="badge text-[11px] bg-surface-100 dark:bg-surface-800 text-surface-500 hover:bg-surface-200 transition-colors">
                <Plus size={9} />
              </button>
            </div>
          </div>

          {/* Created */}
          <div className="text-[11px] text-surface-400 pt-2 border-t border-surface-100 dark:border-surface-800">
            <p>Created {formatRelativeTime(task.createdAt)}</p>
            <p>Updated {formatRelativeTime(task.updatedAt)}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TaskModal;
