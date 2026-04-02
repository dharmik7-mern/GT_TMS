import React, { useEffect, useMemo, useState } from 'react';
import { addDaysToDateKey, generateId } from '../../utils/helpers';
import { getReservedTaskTitleError } from '../../utils/taskTitleValidation';
import { PRIORITY_CONFIG, STATUS_CONFIG, TASK_TYPE_CONFIG } from '../../app/constants';
import { Modal } from '../Modal';
import { UserAvatar } from '../UserAvatar';
import type { Priority, Project, ProjectCategory, TaskStatus, TaskType, TimelinePhase, User } from '../../app/types';

export interface ProjectTaskCreateValues {
  title: string;
  description?: string;
  taskType: TaskType;
  priority: Priority;
  status: TaskStatus;
  startDate: string;
  dueDate: string;
  durationDays: number;
  phaseId?: string;
  subcategoryId?: string;
  assigneeIds: string[];
  estimatedHours?: number;
  files: File[];
}

interface ProjectTaskCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ProjectTaskCreateValues) => Promise<void> | void;
  project: Project;
  members: User[];
  phases: TimelinePhase[];
  defaultStatus?: TaskStatus;
  canSubmit?: boolean;
  submitLabel?: string;
  title?: string;
  onCreatePhase?: (input: { id: string; name: string; order: number; color: string }) => Promise<string | void> | string | void;
}

const CATEGORY_COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#ea580c', '#dc2626', '#0891b2'];

function createDefaultValues(project: Project, defaultStatus: TaskStatus): ProjectTaskCreateValues {
  const today = new Date().toISOString().split('T')[0];
  const startDate = project.startDate && project.startDate >= today ? project.startDate : today;
  return {
    title: '',
    description: '',
    taskType: 'operational',
    priority: 'medium',
    status: defaultStatus,
    startDate,
    dueDate: startDate,
    durationDays: 1,
    phaseId: '',
    subcategoryId: '',
    assigneeIds: [],
    estimatedHours: undefined,
    files: [],
  };
}

export const ProjectTaskCreateModal: React.FC<ProjectTaskCreateModalProps> = ({
  open,
  onClose,
  onSubmit,
  project,
  members,
  phases,
  defaultStatus = 'todo',
  canSubmit = true,
  submitLabel = 'Create Task',
  title = 'New Task',
  onCreatePhase,
}) => {
  const [form, setForm] = useState<ProjectTaskCreateValues>(() => createDefaultValues(project, defaultStatus));
  const [showNewPhaseInput, setShowNewPhaseInput] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const titleError = getReservedTaskTitleError(form.title);

  const categories = useMemo<ProjectCategory[]>(() => project.subcategories || [], [project.subcategories]);

  useEffect(() => {
    if (!open) return;
    setForm(createDefaultValues(project, defaultStatus));
    setShowNewPhaseInput(false);
    setNewPhaseName('');
    setSubmitting(false);
  }, [open, project, defaultStatus]);

  useEffect(() => {
    setForm((current) => {
      if (!current.startDate || !current.dueDate) return current;
      const nextDuration = Math.max(
        1,
        Math.floor((new Date(current.dueDate).getTime() - new Date(current.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
      );
      if (nextDuration === current.durationDays) return current;
      return { ...current, durationDays: nextDuration };
    });
  }, [form.startDate, form.dueDate]);

  const setField = <K extends keyof ProjectTaskCreateValues>(key: K, value: ProjectTaskCreateValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleStartDateChange = (value: string) => {
    setForm((current) => {
      const dueDate = current.dueDate && current.dueDate >= value ? current.dueDate : value;
      const durationDays = Math.max(
        1,
        Math.floor((new Date(dueDate).getTime() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)) + 1
      );
      return { ...current, startDate: value, dueDate, durationDays };
    });
  };

  const handleDueDateChange = (value: string) => {
    setForm((current) => {
      const safeDueDate = value >= current.startDate ? value : current.startDate;
      const durationDays = Math.max(
        1,
        Math.floor((new Date(safeDueDate).getTime() - new Date(current.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
      );
      return { ...current, dueDate: safeDueDate, durationDays };
    });
  };

  const handleDurationChange = (value: number) => {
    const durationDays = Math.max(1, Number(value) || 1);
    setForm((current) => ({
      ...current,
      durationDays,
      dueDate: addDaysToDateKey(current.startDate, durationDays - 1),
    }));
  };

  const handleCreatePhase = async () => {
    const name = newPhaseName.trim();
    if (!name || !onCreatePhase) return;
    const nextPhase = {
      id: generateId(),
      name,
      order: phases.length,
      color: CATEGORY_COLORS[phases.length % CATEGORY_COLORS.length],
    };
    const createdPhaseId = await onCreatePhase(nextPhase);
    setForm((current) => ({ ...current, phaseId: createdPhaseId || nextPhase.id }));
    setNewPhaseName('');
    setShowNewPhaseInput(false);
  };

  const toggleAssignee = (userId: string) => {
    setForm((current) => ({
      ...current,
      assigneeIds: current.assigneeIds.includes(userId)
        ? current.assigneeIds.filter((id) => id !== userId)
        : [...current.assigneeIds, userId],
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !form.title.trim() || !form.startDate || !form.dueDate || titleError) return;
    try {
      setSubmitting(true);
      await onSubmit({
        ...form,
        title: form.title.trim(),
        description: form.description?.trim() || undefined,
        phaseId: form.phaseId || undefined,
        subcategoryId: form.subcategoryId || undefined,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="label">Title *</label>
          <input
            className="input"
            value={form.title}
            onChange={(event) => setField('title', event.target.value)}
            placeholder="Task title"
            required
          />
          {titleError ? <p className="mt-1 text-xs text-rose-500">{titleError}</p> : null}
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input h-auto min-h-[90px] resize-none py-2"
            value={form.description || ''}
            onChange={(event) => setField('description', event.target.value)}
            placeholder="Optional description"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.taskType} onChange={(event) => setField('taskType', event.target.value as TaskType)}>
              {(Object.keys(TASK_TYPE_CONFIG) as TaskType[]).map((key) => (
                <option key={key} value={key}>{TASK_TYPE_CONFIG[key].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={form.priority} onChange={(event) => setField('priority', event.target.value as Priority)}>
              {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((key) => (
                <option key={key} value={key}>{PRIORITY_CONFIG[key].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(event) => setField('status', event.target.value as TaskStatus)}>
              {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((key) => (
                <option key={key} value={key}>{STATUS_CONFIG[key].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Start Date *</label>
            <input 
              className="input" 
              type="date" 
              min={new Date().toISOString().split('T')[0]}
              value={form.startDate} 
              onChange={(event) => handleStartDateChange(event.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="label">Due Date *</label>
            <input 
              className="input" 
              type="date" 
              min={form.startDate} 
              value={form.dueDate} 
              onChange={(event) => handleDueDateChange(event.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="label">Duration (days)</label>
            <input className="input" type="number" min={1} step={1} value={form.durationDays} onChange={(event) => handleDurationChange(Number(event.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Phase</label>
            <select
              className="input"
              value={form.phaseId || ''}
              onChange={(event) => {
                const value = event.target.value;
                if (value === '__new__') {
                  setShowNewPhaseInput(true);
                  setField('phaseId', '');
                  return;
                }
                setShowNewPhaseInput(false);
                setField('phaseId', value);
              }}
            >
              <option value="">Ungrouped</option>
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>{phase.name}</option>
              ))}
              {onCreatePhase ? <option value="__new__">+ Add new phase</option> : null}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.subcategoryId || ''} onChange={(event) => setField('subcategoryId', event.target.value)}>
              <option value="">All categories / none</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Estimated Hours</label>
            <input
              className="input"
              type="number"
              min={0}
              step={0.5}
              placeholder="0"
              value={form.estimatedHours ?? ''}
              onChange={(event) => setField('estimatedHours', event.target.value ? Number(event.target.value) : undefined)}
            />
          </div>
        </div>

        {showNewPhaseInput ? (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="label">Add New Phase</label>
              <input className="input" value={newPhaseName} onChange={(event) => setNewPhaseName(event.target.value)} placeholder="e.g. API Development" />
            </div>
            <button type="button" className="btn-secondary btn-md" onClick={() => void handleCreatePhase()} disabled={!newPhaseName.trim()}>
              Add Phase
            </button>
          </div>
        ) : null}

        <div>
          <label className="label">Assignees</label>
          <div className="border border-surface-100 dark:border-surface-800 rounded-xl p-3 max-h-44 overflow-y-auto space-y-2">
            {members.length ? members.map((member) => (
              <label key={member.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <input type="checkbox" checked={form.assigneeIds.includes(member.id)} onChange={() => toggleAssignee(member.id)} />
                  <UserAvatar name={member.name} color={member.color} size="xs" />
                  <span className="truncate">{member.name}</span>
                </div>
                <span className="text-[10px] text-surface-400 flex-shrink-0">{member.role.replace('_', ' ')}</span>
              </label>
            )) : (
              <p className="text-xs text-surface-400">No project members available.</p>
            )}
          </div>
        </div>

        <div>
          <label className="label">Files</label>
          <input type="file" multiple className="input" onChange={(event) => setField('files', event.target.files ? Array.from(event.target.files) : [])} />
          {form.files.length ? (
            <div className="mt-2 space-y-1">
              {form.files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 text-xs text-surface-600 dark:text-surface-300">
                  <span className="truncate">{file.name}</span>
                  <button type="button" className="btn-ghost btn-sm p-1 text-rose-500" onClick={() => setField('files', form.files.filter((_, currentIndex) => currentIndex !== index))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary btn-md flex-1">Cancel</button>
          <button type="submit" disabled={!canSubmit || submitting || !form.title.trim() || Boolean(titleError)} className="btn-primary btn-md flex-1">
            {submitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ProjectTaskCreateModal;
