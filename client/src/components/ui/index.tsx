import React from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../utils/helpers';

// ─── Tabs ────────────────────────────────────────────────────────────────────
interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

interface TabsProps {
  value: string;
  onValueChange: (v: string) => void;
  items: TabItem[];
  children: React.ReactNode;
  variant?: 'underline' | 'pill';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  value, onValueChange, items, children, variant = 'underline', className
}) => (
  <RadixTabs.Root value={value} onValueChange={onValueChange} className={className}>
    <RadixTabs.List className={cn(
      'flex',
      variant === 'underline' && 'border-b border-surface-100 dark:border-surface-800 gap-1',
      variant === 'pill' && 'bg-surface-100 dark:bg-surface-800 p-1 rounded-xl gap-1'
    )}>
      {items.map(item => (
        <RadixTabs.Trigger
          key={item.value}
          value={item.value}
          className={cn(
            'flex items-center gap-2 text-sm font-medium transition-all outline-none',
            variant === 'underline' && cn(
              'px-4 py-2.5 border-b-2 -mb-px rounded-t-lg',
              value === item.value
                ? 'text-brand-700 dark:text-brand-300 border-brand-600'
                : 'text-surface-500 border-transparent hover:text-surface-700 dark:hover:text-surface-300'
            ),
            variant === 'pill' && cn(
              'px-3 py-1.5 rounded-lg',
              value === item.value
                ? 'bg-white dark:bg-surface-900 text-surface-900 dark:text-white shadow-sm'
                : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
            )
          )}
        >
          {item.icon}
          {item.label}
          {item.badge !== undefined && item.badge > 0 && (
            <span className="w-4 h-4 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {item.badge}
            </span>
          )}
        </RadixTabs.Trigger>
      ))}
    </RadixTabs.List>
    {children}
  </RadixTabs.Root>
);

export const TabsContent = RadixTabs.Content;

// ─── Table ────────────────────────────────────────────────────────────────────
interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function Table<T>({
  columns, data, keyExtractor, onRowClick, loading, emptyMessage = 'No data found', className
}: TableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-12 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-100 dark:border-surface-800">
            {columns.map(col => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={cn(
                  'px-4 py-2.5 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider whitespace-nowrap',
                  col.align === 'center' && 'text-center',
                  col.align === 'right' && 'text-right',
                  !col.align && 'text-left'
                )}
              >
                {col.sortable ? (
                  <button
                    onClick={() => handleSort(col.key)}
                    className="flex items-center gap-1 hover:text-surface-700 dark:hover:text-surface-200 transition-colors"
                  >
                    {col.header}
                    <ChevronsUpDown size={12} />
                  </button>
                ) : col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-50 dark:divide-surface-800/50">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-surface-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <motion.tr
                key={keyExtractor(row)}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50'
                )}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-sm text-surface-700 dark:text-surface-300',
                      col.align === 'center' && 'text-center',
                      col.align === 'right' && 'text-right'
                    )}
                  >
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </motion.tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange, className }) => {
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (page <= 3) return i + 1;
    if (page >= totalPages - 2) return totalPages - 4 + i;
    return page - 2 + i;
  });

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <p className="text-sm text-surface-400">Page {page} of {totalPages}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="btn-ghost btn-sm w-8 h-8 p-0 disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              'btn-sm w-8 h-8 p-0 text-sm',
              page === p ? 'btn-primary' : 'btn-ghost'
            )}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="btn-ghost btn-sm w-8 h-8 p-0 disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────
interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value, max = 100, color = '#3366ff', size = 'md', showLabel, className
}) => {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const heights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2.5' };

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-surface-400">{Math.round(pct)}%</span>
        </div>
      )}
      <div className={cn(heights[size], 'bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden')}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('skeleton', className)} />
);

export const SkeletonCard: React.FC = () => (
  <div className="card p-4 space-y-3">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-3 w-1/2" />
    <div className="flex gap-2 pt-1">
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  </div>
);

// ─── Badge Status ─────────────────────────────────────────────────────────────
interface StatusBadgeProps {
  status: string;
  label: string;
  color: string;
  bg: string;
  text: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, color, bg, text }) => (
  <span className={cn('badge', bg, text)}>
    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
    {label}
  </span>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon, title, description, action, className
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}
  >
    <div className="w-14 h-14 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center mb-4 text-surface-400">
      {icon}
    </div>
    <h3 className="text-base font-display font-semibold text-surface-700 dark:text-surface-300 mb-1">{title}</h3>
    {description && <p className="text-sm text-surface-400 max-w-xs mb-4">{description}</p>}
    {action}
  </motion.div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
interface ToastProps {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onRemove: (id: string) => void;
}

const TOAST_STYLES = {
  success: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800',
  error: 'bg-rose-50 border-rose-200 dark:bg-rose-950/50 dark:border-rose-800',
  info: 'bg-brand-50 border-brand-200 dark:bg-brand-950/50 dark:border-brand-800',
  warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800',
};

export const Toast: React.FC<ToastProps> = ({ id, title, message, type, onRemove }) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: 60 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 60 }}
    className={cn('p-4 rounded-2xl border shadow-card flex items-start gap-3 min-w-[280px]', TOAST_STYLES[type])}
  >
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">{title}</p>
      {message && <p className="text-xs text-surface-500 mt-0.5">{message}</p>}
    </div>
    <button onClick={() => onRemove(id)} className="text-surface-400 hover:text-surface-600 flex-shrink-0">
      <X size={14} />
    </button>
  </motion.div>
);

// Re-export X to avoid import issues
const X: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
