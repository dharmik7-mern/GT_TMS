import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { addDays, format, formatDistanceToNow, isBefore, isSameDay, isToday, isYesterday, parseISO, startOfDay } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, fmt);
  } catch {
    return '';
  }
}

export function formatRelativeTime(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true });
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d, yyyy');
  } catch {
    return '';
  }
}

export function addDaysToDateKey(date: string | Date, days: number): string {
  try {
    const base = typeof date === 'string' ? parseISO(date) : date;
    return format(addDays(base, days), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

export function getTodayDateKey(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function isTaskOverdue(task: { dueDate?: string | Date | null; status?: string }, currentDate: Date = new Date()): boolean {
  if (!task.dueDate) return false;
  
  try {
    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    
    const status = (task.status || '').toUpperCase();
    const terminalStatuses = ['DONE', 'COMPLETED', 'CANCELLED'];
    
    return due.getTime() < today.getTime() && !terminalStatuses.includes(status);
  } catch {
    return false;
  }
}

export function isDueDateOverdue(dueDate?: string | Date | null, status?: string): boolean {
  return isTaskOverdue({ dueDate, status });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getProgressColor(progress: number): string {
  if (progress >= 80) return '#10b981';
  if (progress >= 50) return '#3366ff';
  if (progress >= 25) return '#f59e0b';
  return '#f43f5e';
}

export function sortByDate<T extends { createdAt: string }>(items: T[], dir: 'asc' | 'desc' = 'desc'): T[] {
  return [...items].sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return dir === 'desc' ? diff : -diff;
  });
}

export function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const group = String(item[key]);
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export const AVATAR_COLORS = [
  '#3366ff', '#7c3aed', '#f43f5e', '#f59e0b', '#10b981',
  '#06b6d4', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6',
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getAvatarUrl(avatar?: string): string | undefined {
  if (!avatar) return undefined;
  if (avatar.startsWith('http') || avatar.startsWith('data:') || avatar.startsWith('blob:')) return avatar;

  // Return the path as is (e.g., /uploads/...).
  // The Vite proxy configurated in vite.config.ts will map this to http://localhost:5000/uploads
  return avatar;
}
