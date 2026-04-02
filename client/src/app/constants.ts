export const PROJECT_COLORS = [
  '#3366ff', '#7c3aed', '#f43f5e', '#f59e0b', '#10b981',
  '#06b6d4', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6',
];

export const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400' },
  high: { label: 'High', color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400' },
  urgent: { label: 'Urgent', color: '#f43f5e', bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-400' },
} as const;

export const STATUS_CONFIG = {
  backlog: { label: 'Backlog', color: '#8896b8', bg: 'bg-surface-100 dark:bg-surface-800', text: 'text-surface-600 dark:text-surface-400' },
  todo: { label: 'New task', color: '#5e72a0', bg: 'bg-slate-50 dark:bg-slate-900/40', text: 'text-slate-700 dark:text-slate-300' },
  scheduled: { label: 'Scheduled', color: '#0ea5e9', bg: 'bg-sky-50 dark:bg-sky-950/30', text: 'text-sky-700 dark:text-sky-400' },
  in_progress: { label: 'In Progress', color: '#3366ff', bg: 'bg-brand-50 dark:bg-brand-950/30', text: 'text-brand-700 dark:text-brand-400' },
  in_review: { label: 'In Review', color: '#7c3aed', bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-400' },
  done: { label: 'Completed', color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400' },
} as const;

export const TASK_TYPE_CONFIG = {
  operational: { label: 'Operational', dot: '#3366ff' },
  design: { label: 'Design', dot: '#fb7185' },
  important: { label: 'Important', dot: '#f97316' },
} as const;

export const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30' },
  admin: { label: 'Admin', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' },
  manager: { label: 'Manager', color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-950/30' },
  team_leader: { label: 'Team Leader', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  team_member: { label: 'Team Member', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
} as const;

