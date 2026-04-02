import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Calendar, Flag, Search, User, X, Paperclip, Lock, Trash2 } from 'lucide-react';
import { Modal } from '../Modal';
import { cn, getTodayDateKey } from '../../utils/helpers';
import { getReservedTaskTitleError } from '../../utils/taskTitleValidation';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import type { Priority, QuickTask, QuickTaskStatus, Role } from '../../app/types';
import { quickTasksService } from '../../services/api';
import { UserAvatar } from '../UserAvatar';

type QuickTaskFormData = {
  title: string;
  description?: string;
  priority: Priority;
  status: QuickTaskStatus;
  assigneeIds: string[];
  dueDate?: string;
  isPrivate: boolean;
};

const ASSIGNABLE_ROLES: Role[] = ['manager', 'team_leader', 'team_member', 'admin'];

interface QuickTaskModalProps {
  open: boolean;
  onClose: () => void;
  task?: QuickTask | null;
}

export const QuickTaskModal: React.FC<QuickTaskModalProps> = ({ open, onClose, task }) => {
  const { user } = useAuthStore();
  const { users, bootstrap } = useAppStore();
  const defaultDueDate = getTodayDateKey();

  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuickTaskFormData>({
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      priority: task?.priority ?? 'medium',
      status: task?.status ?? 'todo',
      assigneeIds: task?.assigneeIds ?? [],
      dueDate: task?.dueDate ?? defaultDueDate,
      isPrivate: task?.isPrivate ?? false,
    },
  });

  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const assigneeRef = useRef<HTMLDivElement | null>(null);

  const selectedAssigneeIds = watch('assigneeIds') || [];

  const assignableUsers = useMemo(
    () => users.filter((u) => u.isActive && ASSIGNABLE_ROLES.includes(u.role)),
    [users]
  );

  const canCurrentUserUsePrivateTask =
    ['super_admin', 'admin'].includes(user?.role || '') || Boolean(user?.canUsePrivateQuickTasks);

  const selectedAssignees = useMemo(() => {
    return selectedAssigneeIds
      .map((id) => assignableUsers.find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => !!u);
  }, [selectedAssigneeIds, assignableUsers]);

  useEffect(() => {
    reset({
      title: task?.title ?? '',
      description: task?.description ?? '',
      priority: task?.priority ?? 'medium',
      status: task?.status ?? 'todo',
      assigneeIds: task?.assigneeIds ?? [],
      dueDate: task?.dueDate ?? defaultDueDate,
      isPrivate: task?.isPrivate ?? false,
    });
  }, [defaultDueDate, task, reset, open]);

  useEffect(() => {
    setAssigneeOpen(false);
    setAssigneeQuery('');
    setFiles([]);
    setSubmitting(false);
  }, [open, task]);

  useEffect(() => {
    if (!assigneeOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (assigneeRef.current?.contains(event.target as Node)) return;
      setAssigneeOpen(false);
      setAssigneeQuery('');
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [assigneeOpen]);

  useEffect(() => {
    if (!canCurrentUserUsePrivateTask) {
      setValue('isPrivate', false, { shouldDirty: true });
    }
  }, [canCurrentUserUsePrivateTask, setValue]);

  const filteredAssignableUsers = useMemo(() => {
    const query = assigneeQuery.trim().toLowerCase();
    if (!query) return assignableUsers;
    return assignableUsers.filter((u) => {
      const roleLabel = u.role.replace(/_/g, ' ');
      return (
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        roleLabel.includes(query)
      );
    });
  }, [assignableUsers, assigneeQuery]);

  const assigneeLabel = selectedAssignees.length
    ? `${selectedAssignees.map((u) => u.name).slice(0, 2).join(', ')}${selectedAssignees.length > 2 ? ` +${selectedAssignees.length - 2}` : ''}`
    : 'Unassigned';

  const toggleAssignee = (assigneeId: string) => {
    const set = new Set(selectedAssigneeIds);
    if (set.has(assigneeId)) set.delete(assigneeId);
    else set.add(assigneeId);
    setValue('assigneeIds', Array.from(set), { shouldDirty: true, shouldValidate: true });
  };

  const clearAssignees = () => {
    setValue('assigneeIds', [], { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (data: QuickTaskFormData) => {
    if (submitting) return;

    const payload = {
      title: data.title.trim(),
      description: data.description?.trim() || undefined,
      status: 'todo', // Always start as 'New task'
      priority: data.priority,
      assigneeIds: data.assigneeIds || [],
      dueDate: data.dueDate || undefined,
      ...(canCurrentUserUsePrivateTask ? { isPrivate: data.isPrivate } : {}),
    };

    try {
      setSubmitting(true);
      let qtId: string | undefined;
      if (task) {
        const res = await quickTasksService.update(task.id, payload);
        qtId = res.data?.data?.id ?? task.id;
      } else {
        const res = await quickTasksService.create(payload);
        qtId = res.data?.data?.id;
      }

      if (qtId && files.length) {
        try {
          await quickTasksService.uploadAttachments(qtId, files);
        } catch (uploadErr) {
          console.error('Failed to upload attachments for quick task:', uploadErr);
        }
      }

      await bootstrap();
      onClose();
    } catch (err) {
      console.error('Failed to save quick task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    (async () => {
      if (!task) return;
      try {
        await quickTasksService.delete(task.id);
        await bootstrap();
        onClose();
      } catch {
        // noop
      }
    })();
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" showClose={false}>
      <div className="bg-[radial-gradient(circle_at_top,_rgba(51,102,255,0.08),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,247,255,0.96))] p-4 sm:p-6 dark:bg-[radial-gradient(circle_at_top,_rgba(51,102,255,0.14),_transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.94))]">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-semibold text-lg text-surface-900 dark:text-white">
              {task ? 'Edit Quick Task' : 'New Quick Task'}
            </h2>
            <p className="text-sm text-surface-400">
              Assign to one or more people (no project required)
            </p>
          </div>
          <div className="flex items-center gap-1">
            {task && ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '') && (
              <button
                type="button"
                onClick={handleDelete}
                className="btn-ghost w-8 h-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-ghost w-8 h-8" title="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-5">
          <div>
            <label className="label">Title</label>
            <input
              {...register('title', {
                required: 'Title is required',
                validate: (value) => getReservedTaskTitleError(value) || true,
              })}
              className={cn('input border-white/70 bg-white/90 shadow-sm dark:border-surface-700/80 dark:bg-surface-900/85', errors.title && 'border-rose-300 focus:ring-rose-200')}
              placeholder="e.g. Follow up with design review"
              autoFocus
            />
            {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              {...register('description')}
              className="input h-auto min-h-[96px] resize-none border-white/70 bg-white/90 py-3 shadow-sm dark:border-surface-700/80 dark:bg-surface-900/85"
              rows={3}
              placeholder="Add details..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <div className="relative">
                <select {...register('status')} className="input appearance-none border-white/70 bg-white/90 pr-10 shadow-sm dark:border-surface-700/80 dark:bg-surface-900/85">
                  <option value="todo">{STATUS_CONFIG.todo.label}</option>
                  <option value="in_progress">{STATUS_CONFIG.in_progress.label}</option>
                  <option value="done">{STATUS_CONFIG.done.label}</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none">
                  <Calendar size={14} />
                </span>
              </div>
            </div>
            <div>
              <label className="label">Due date</label>
              <div className="relative">
                <input
                  type="date"
                  {...register('dueDate', { required: 'Due date is required' })}
                  className={cn(
                    'input border-white/70 bg-white/90 pr-10 shadow-sm dark:border-surface-700/80 dark:bg-surface-900/85',
                    errors.dueDate && 'border-rose-300 focus:ring-rose-200'
                  )}
                  min={defaultDueDate}
                />
                <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              </div>
              {errors.dueDate && <p className="text-xs text-rose-500 mt-1">{errors.dueDate.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Priority</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG.low][]).map(([key, cfg]) => (
                <label key={key} className={cn(
                  'flex items-center gap-2 rounded-2xl border bg-white/85 px-3 py-3 shadow-sm transition-all cursor-pointer dark:border-surface-700/80 dark:bg-surface-900/75',
                  'border-white/70 hover:border-surface-300 dark:hover:border-surface-600'
                )}>
                  <input type="radio" value={key} {...register('priority')} className="accent-brand-600" />
                  <Flag size={12} style={{ color: cfg.color }} />
                  <span className={cn('text-sm font-medium', cfg.text)}>{cfg.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="label mb-0">Assignees</label>
              <button
                type="button"
                onClick={() => {
                  setAssigneeOpen((prev) => !prev);
                  if (assigneeOpen) setAssigneeQuery('');
                }}
                className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {assigneeOpen ? 'Hide list' : 'Show list'}
              </button>
            </div>
            <div className="rounded-[22px] border border-white/70 bg-white/75 p-3 shadow-sm backdrop-blur dark:border-surface-700/80 dark:bg-surface-900/70">
              <input
                type="hidden"
                {...register('assigneeIds', {
                  validate: (value) => Array.isArray(value) && value.length > 0 ? true : 'Select at least one assignee',
                })}
              />

              {selectedAssignees.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedAssignees.map((assignee) => (
                    <button
                      key={assignee.id}
                      type="button"
                      onClick={() => toggleAssignee(assignee.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
                      title={`Remove ${assignee.name}`}
                    >
                      <UserAvatar name={assignee.name} avatar={assignee.avatar} color={assignee.color} size="xs" />
                      <span className="max-w-[140px] truncate">{assignee.name}</span>
                      <X size={12} />
                    </button>
                  ))}
                </div>
              )}

              <div ref={assigneeRef} className="relative">
                <div
                  className={cn(
                    'input min-h-[46px] flex items-center gap-2 pr-10 bg-white dark:bg-surface-950 border-surface-200/80 dark:border-surface-700/80',
                    assigneeOpen && 'ring-2 ring-brand-200 border-brand-400'
                  )}
                >
                  <Search size={14} className="text-surface-400 flex-shrink-0" />
                  <input
                    value={assigneeOpen ? assigneeQuery : assigneeLabel}
                    onFocus={() => setAssigneeOpen(true)}
                    onChange={(e) => {
                      setAssigneeOpen(true);
                      setAssigneeQuery(e.target.value);
                    }}
                    placeholder={selectedAssignees.length ? 'Add or change assignees...' : 'Search assignees...'}
                    className="flex-1 bg-transparent outline-none text-surface-800 dark:text-surface-200 placeholder:text-surface-400"
                  />
                </div>
                <User size={14} className="absolute right-3 top-[22px] -translate-y-1/2 text-surface-400 pointer-events-none" />

                {assigneeOpen && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-surface-200/80 bg-white/98 shadow-card backdrop-blur dark:border-surface-700/80 dark:bg-surface-900/98">
                    <div className="flex items-center justify-between gap-3 border-b border-surface-100 px-4 py-2 text-xs text-surface-500 dark:border-surface-800 dark:text-surface-400">
                      <span>{filteredAssignableUsers.length} result{filteredAssignableUsers.length === 1 ? '' : 's'}</span>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setAssigneeOpen(false);
                          setAssigneeQuery('');
                        }}
                        className="font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        Hide
                      </button>
                    </div>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={clearAssignees}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors',
                        !selectedAssigneeIds.length
                          ? 'bg-brand-600 text-white'
                          : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800/60'
                      )}
                    >
                      <span>Unassigned</span>
                      <span className={cn('text-[11px]', !selectedAssigneeIds.length ? 'text-white/80' : 'text-surface-400')}>
                        No owners
                      </span>
                    </button>

                    <div className="max-h-60 overflow-y-auto border-t border-surface-100 dark:border-surface-800">
                      {filteredAssignableUsers.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-surface-400">No matching people found.</div>
                      ) : (
                        filteredAssignableUsers.map((u) => {
                          const isSelected = selectedAssigneeIds.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => toggleAssignee(u.id)}
                              className={cn(
                                'w-full px-4 py-3 text-left transition-colors',
                                isSelected
                                  ? 'bg-brand-50 dark:bg-brand-950/30'
                                  : 'hover:bg-surface-50 dark:hover:bg-surface-800/60'
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <UserAvatar name={u.name} avatar={u.avatar} color={u.color} size="xs" />
                                  <span className={cn('truncate text-sm font-medium', isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-surface-800 dark:text-surface-200')}>
                                    {u.name}
                                  </span>
                                </div>
                                <span className="text-[11px] uppercase tracking-wide text-surface-400">
                                  {u.role.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <div className="mt-0.5 text-xs text-surface-400">{u.email}</div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-surface-500 dark:text-surface-400">
                {selectedAssignees.length ? `${selectedAssignees.length} assignee${selectedAssignees.length > 1 ? 's' : ''} selected` : 'No assignee selected'}
              </span>
              {selectedAssignees.length > 0 && (
                <span className="max-w-[60%] truncate text-right text-surface-500 dark:text-surface-400">
                  {assigneeLabel}
                </span>
              )}
            </div>
            {errors.assigneeIds && <p className="text-xs text-rose-500 mt-2">{errors.assigneeIds.message}</p>}
          </div>

          {canCurrentUserUsePrivateTask && (
            <div className="flex items-center gap-2 rounded-xl border border-surface-200 bg-surface-50/50 p-3 dark:border-surface-700 dark:bg-surface-800/30">
              <Lock size={14} className="text-amber-500" />
              <div className="flex-1">
                <p className="text-xs font-medium text-surface-800 dark:text-surface-200">Private Task</p>
                <p className="text-[10px] text-surface-400">
                  Private quick tasks are only visible to the creator, assigned users, and admins.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" {...register('isPrivate')} className="sr-only peer" />
                <div className="w-9 h-5 bg-surface-200 peer-focus:outline-none rounded-full peer dark:bg-surface-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-brand-600"></div>
              </label>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Files</label>
              <span className="text-xs text-surface-400">Optional</span>
            </div>
            
            {(task?.attachments || []).length > 0 && (
              <div className="mb-4 space-y-2">
                {task!.attachments!.map((att) => (
                  <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-surface-800 rounded-xl border border-surface-100 dark:border-surface-700 text-[10px] hover:border-brand-500 transition-colors">
                    <span className="flex items-center gap-2 min-w-0">
                      <Paperclip size={10} className="text-brand-500 flex-shrink-0" />
                      <span className="truncate font-medium">{att.name}</span>
                    </span>
                    <span className="text-surface-400 flex-shrink-0">View</span>
                  </a>
                ))}
              </div>
            )}

            <div 
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files) {
                  setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
                }
              }}
              className="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl p-5 text-center hover:border-brand-400 hover:bg-brand-50/10 transition-colors cursor-pointer relative"
              onClick={() => document.getElementById('quick-task-file-upload')?.click()}
            >
              <Paperclip size={18} className="mx-auto text-surface-300 mb-2" />
              <p className="text-xs text-surface-400 mb-3">Drop files here or click to upload</p>
              <input
                id="quick-task-file-upload"
                type="file"
                multiple
                onChange={(e) => setFiles(prev => [...prev, ... (e.target.files ? Array.from(e.target.files) : [])])}
                className="hidden"
              />
              {files.length ? (
                <div className="mt-3 space-y-1 text-left" onClick={e => e.stopPropagation()}>
                  {files.map((f, idx) => (
                    <div key={`${f.name}-${idx}`} className="flex items-center justify-between gap-3 p-1.5 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
                      <span className="text-[10px] text-surface-700 dark:text-surface-200 truncate font-medium">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="btn-ghost btn-sm p-1 h-6 w-6 text-rose-500 hover:bg-rose-50"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary btn-sm hidden md:flex" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary btn-sm hidden md:flex disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? (task ? 'Saving...' : 'Creating...') : task ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default QuickTaskModal;
