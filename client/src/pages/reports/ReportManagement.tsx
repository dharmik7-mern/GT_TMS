import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, BarChart3, CalendarClock, CheckCircle2, ChevronDown, Download, RefreshCcw, Search, TrendingUp, Users } from 'lucide-react';
import { addDays, endOfDay, format, isWithinInterval, parseISO, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns';
import { cn, formatDate } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { reportsService } from '../../services/api';
import type { DailyWorkReport, Priority } from '../../app/types';

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
type CardFilter = 'current' | 'completed' | 'due' | 'overdue' | 'active' | 'completion';
type FlatItem = {
  id: string;
  title: string;
  type: 'project_task' | 'quick_task';
  status: string;
  priority: Priority;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  reviewStatus?: string;
  rating?: number;
  assigneeIds: string[];
  projectName: string;
};

const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
] as const;

const COLORS = { blue: '#2f55f5', cyan: '#0ea5e9', green: '#10b981', amber: '#f59e0b', red: '#ef4444', slate: '#94a3b8', violet: '#7c3aed' };
const STATUS_COLORS: Record<string, string> = { todo: '#94a3b8', scheduled: '#8b5cf6', in_progress: '#2f55f5', in_review: '#f59e0b', done: '#10b981' };
const PRIORITY_COLORS: Record<Priority, string> = { low: '#94a3b8', medium: '#0ea5e9', high: '#f59e0b', urgent: '#ef4444' };

const parseDate = (value?: string | null) => {
  if (!value) return null;
  try {
    return value.includes('T') ? parseISO(value) : parseISO(`${value}T00:00:00`);
  } catch {
    return null;
  }
};

const isDone = (status?: string) => status === 'done';
const inRange = (value: string | undefined, range: { start: Date; end: Date }) => {
  const date = parseDate(value);
  return date ? isWithinInterval(date, range) : false;
};
const isOverdue = (value?: string, status?: string) => {
  const due = parseDate(value);
  return Boolean(due && !isDone(status) && due.getTime() < startOfDay(new Date()).getTime());
};
const isOnTimeCompletion = (item: FlatItem) => {
  const completed = parseDate(item.completedAt);
  const due = parseDate(item.dueDate);
  return Boolean(completed && due && completed.getTime() <= due.getTime());
};
const titleize = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function buildPerformanceScore({
  assignedCount,
  completedCount,
  completedInRange,
  approvedInRange,
  overdueCount,
  averageRating,
  onTimeInRange,
}: {
  assignedCount: number;
  completedCount: number;
  completedInRange: number;
  approvedInRange: number;
  overdueCount: number;
  averageRating: number;
  onTimeInRange: number;
}) {
  const completionRate = assignedCount ? (completedCount / assignedCount) * 100 : 0;
  const approvalRate = completedInRange ? (approvedInRange / completedInRange) * 100 : 0;
  const onTimeRate = completedInRange ? (onTimeInRange / completedInRange) * 100 : 0;
  const ratingScore = averageRating ? (averageRating / 5) * 100 : 0;
  return clamp((completionRate * 0.35) + (approvalRate * 0.25) + (onTimeRate * 0.2) + (ratingScore * 0.2) - (overdueCount * 4));
}

function getRange(period: ReportPeriod) {
  const now = new Date();
  if (period === 'daily') return { start: startOfDay(now), end: endOfDay(now), bucketMode: 'day' as const, steps: 1 };
  if (period === 'weekly') return { start: startOfDay(subDays(now, 6)), end: endOfDay(now), bucketMode: 'day' as const, steps: 7 };
  if (period === 'monthly') return { start: startOfDay(subDays(now, 29)), end: endOfDay(now), bucketMode: 'day' as const, steps: 30 };
  return { start: startOfMonth(subMonths(now, 11)), end: endOfDay(now), bucketMode: 'month' as const, steps: 12 };
}

function csv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function escapeHtml(value: string | number) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderPdfTable(headers: string[], rows: Array<Array<string | number>>) {
  return `<table class="report-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

const MetricCard = ({
  label,
  value,
  helper,
  icon,
  accent,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  accent: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-xl border bg-white p-4 text-left transition-all',
      'hover:shadow-card-hover hover:-translate-y-0.5',
      active
        ? 'border-brand-500 ring-2 ring-brand-200/70 dark:ring-brand-900/40'
        : 'border-surface-200 dark:border-surface-800',
      'dark:bg-surface-900'
    )}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-surface-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">{value}</p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-100 dark:bg-surface-800" style={{ color: accent }}>
        {icon}
      </div>
    </div>
    <p className="mt-2 text-xs text-surface-500 dark:text-surface-400">{helper}</p>
  </button>
);

export const ReportManagementPage: React.FC = () => {
  const { tasks, quickTasks, users, projects } = useAppStore();
  const [period, setPeriod] = useState<ReportPeriod>('daily');
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [cardFilter, setCardFilter] = useState<CardFilter>('current');
  const [generatedAt, setGeneratedAt] = useState(new Date().toISOString());
  const [latestDailyReport, setLatestDailyReport] = useState<DailyWorkReport | null>(null);
  const [dailyHistory, setDailyHistory] = useState<DailyWorkReport[]>([]);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [historyRes, latestRes] = await Promise.all([reportsService.getDaily(10), reportsService.getDailyLatest()]);
        if (!active) return;
        setDailyHistory(historyRes.data?.data || []);
        const latest = latestRes.data?.data || null;
        setLatestDailyReport(latest);
        if (latest?.generatedAt) setGeneratedAt(latest.generatedAt);
      } catch {
        if (!active) return;
        setDailyHistory([]);
        setLatestDailyReport(null);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (!userDropdownRef.current?.contains(event.target as Node)) setUserDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [userDropdownOpen]);

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);
  const range = useMemo(() => getRange(period), [period]);
  const selectedUserLabel = selectedUserId === 'all' ? 'All Employees' : (userMap.get(selectedUserId) || 'Selected Employee');
  const periodLabel = PERIODS.find((option) => option.key === period)?.label || 'Report';
  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return query ? users.filter((user) => user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)) : users;
  }, [userSearch, users]);

  const allItems = useMemo<FlatItem[]>(() => ([
    ...tasks.map((task) => ({ id: task.id, title: task.title, type: 'project_task' as const, status: task.status, priority: task.priority, dueDate: task.dueDate, createdAt: task.createdAt, updatedAt: task.updatedAt, completedAt: task.completionReview?.completedAt || (task.status === 'done' ? task.updatedAt : undefined), reviewStatus: task.completionReview?.reviewStatus, rating: task.completionReview?.rating, assigneeIds: task.assigneeIds || [], projectName: projectMap.get(task.projectId) || 'Project task' })),
    ...quickTasks.map((task) => ({ id: task.id, title: task.title, type: 'quick_task' as const, status: task.status, priority: task.priority, dueDate: task.dueDate, createdAt: task.createdAt, updatedAt: task.updatedAt, completedAt: task.completionReview?.completedAt || (task.status === 'done' ? task.updatedAt : undefined), reviewStatus: task.completionReview?.reviewStatus, rating: task.completionReview?.rating, assigneeIds: task.assigneeIds || [], projectName: 'Quick task' })),
  ]), [projectMap, quickTasks, tasks]);

  const scopedItems = useMemo(() => selectedUserId === 'all' ? allItems : allItems.filter((item) => item.assigneeIds.includes(selectedUserId)), [allItems, selectedUserId]);
  const createdInRange = useMemo(() => scopedItems.filter((item) => inRange(item.createdAt, range)), [range, scopedItems]);
  const completedInRange = useMemo(() => scopedItems.filter((item) => isDone(item.status) && inRange(item.completedAt, range)), [range, scopedItems]);
  const dueInRange = useMemo(() => scopedItems.filter((item) => !isDone(item.status) && inRange(item.dueDate, range)), [range, scopedItems]);
  const openItems = useMemo(() => scopedItems.filter((item) => !isDone(item.status)), [scopedItems]);
  const overdueOpenItems = useMemo(() => openItems.filter((item) => isOverdue(item.dueDate, item.status)), [openItems]);
  const filteredCardItems = useMemo(() => {
    if (cardFilter === 'completed') return completedInRange;
    if (cardFilter === 'due') return dueInRange;
    if (cardFilter === 'overdue') return overdueOpenItems;
    if (cardFilter === 'active') return scopedItems.filter((item) => (item.assigneeIds || []).length > 0);
    if (cardFilter === 'completion') return scopedItems.filter((item) => isDone(item.status));
    return scopedItems;
  }, [cardFilter, completedInRange, dueInRange, overdueOpenItems, scopedItems]);
  const approvedCompletedInRange = useMemo(() => completedInRange.filter((item) => item.reviewStatus === 'approved'), [completedInRange]);
  const ratedCompletedInRange = useMemo(() => approvedCompletedInRange.filter((item) => typeof item.rating === 'number'), [approvedCompletedInRange]);
  const onTimeCompletedInRange = useMemo(() => completedInRange.filter((item) => isOnTimeCompletion(item)), [completedInRange]);
  const averageRating = ratedCompletedInRange.length ? Number((ratedCompletedInRange.reduce((sum, item) => sum + Number(item.rating || 0), 0) / ratedCompletedInRange.length).toFixed(1)) : 0;

  const summary = useMemo(() => {
    const activeEmployeeIds = new Set(scopedItems.flatMap((item) => item.assigneeIds).filter((id) => id && userMap.has(id)));
    return {
      totalCurrentItems: scopedItems.length,
      totalOpenItems: openItems.length,
      createdInRange: createdInRange.length,
      completedInRange: completedInRange.length,
      dueInRange: dueInRange.length,
      overdueOpen: overdueOpenItems.length,
      activeEmployees: activeEmployeeIds.size,
      projectTaskCount: scopedItems.filter((item) => item.type === 'project_task').length,
      quickTaskCount: scopedItems.filter((item) => item.type === 'quick_task').length,
      completionRate: scopedItems.length ? Math.round((scopedItems.filter((item) => isDone(item.status)).length / scopedItems.length) * 100) : 0,
      onTimeRate: completedInRange.length ? Math.round((onTimeCompletedInRange.length / completedInRange.length) * 100) : 0,
      averageRating,
      performanceScore: buildPerformanceScore({ assignedCount: scopedItems.length, completedCount: scopedItems.filter((item) => isDone(item.status)).length, completedInRange: completedInRange.length, approvedInRange: approvedCompletedInRange.length, overdueCount: overdueOpenItems.length, averageRating, onTimeInRange: onTimeCompletedInRange.length }),
    };
  }, [approvedCompletedInRange.length, averageRating, completedInRange, createdInRange.length, dueInRange.length, onTimeCompletedInRange.length, openItems.length, overdueOpenItems.length, scopedItems, userMap]);

  const trendData = useMemo(() => {
    const buckets = range.bucketMode === 'month'
      ? Array.from({ length: 12 }, (_, index) => {
          const date = startOfMonth(subMonths(range.end, 11 - index));
          return { label: format(date, 'MMM'), start: startOfMonth(date), end: endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0)) };
        })
      : Array.from({ length: range.steps }, (_, index) => {
          const date = addDays(range.start, index);
          return { label: format(date, 'MMM d'), start: startOfDay(date), end: endOfDay(date) };
        });
    return buckets.map((bucket) => ({
      label: bucket.label,
      created: filteredCardItems.filter((item) => inRange(item.createdAt, bucket)).length,
      completed: filteredCardItems.filter((item) => isDone(item.status) && inRange(item.completedAt, bucket)).length,
      due: filteredCardItems.filter((item) => !isDone(item.status) && inRange(item.dueDate, bucket)).length,
    }));
  }, [filteredCardItems, range]);

  const statusData = useMemo(() => {
    const rows = Object.entries(filteredCardItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {})).map(([status, value]) => ({ name: titleize(status), value, color: STATUS_COLORS[status] || COLORS.slate }));
    return rows.length ? rows.sort((a, b) => b.value - a.value) : [{ name: 'No Data', value: 1, color: COLORS.slate }];
  }, [filteredCardItems]);

  const filteredOpenItems = useMemo(() => filteredCardItems.filter((item) => !isDone(item.status)), [filteredCardItems]);
  const priorityData = useMemo(() => (['low', 'medium', 'high', 'urgent'] as Priority[]).map((priority) => ({
    name: titleize(priority),
    value: filteredOpenItems.filter((item) => item.priority === priority).length,
    color: PRIORITY_COLORS[priority],
  })), [filteredOpenItems]);

  const employeeRows = useMemo(() => {
    const visibleUsers = selectedUserId === 'all' ? users : users.filter((user) => user.id === selectedUserId);
    return visibleUsers.map((user) => {
      const assignedItems = filteredCardItems.filter((item) => item.assigneeIds.includes(user.id));
      const completedAll = assignedItems.filter((item) => isDone(item.status));
      const openNow = assignedItems.filter((item) => !isDone(item.status));
      const completedWindow = assignedItems.filter((item) => isDone(item.status) && inRange(item.completedAt, range));
      const quickAssigned = assignedItems.filter((item) => item.type === 'quick_task');
      const quickCompletedWindow = completedWindow.filter((item) => item.type === 'quick_task');
      const dueWindow = assignedItems.filter((item) => !isDone(item.status) && inRange(item.dueDate, range));
      const overdue = openNow.filter((item) => isOverdue(item.dueDate, item.status));
      const approvedWindow = completedWindow.filter((item) => item.reviewStatus === 'approved');
      const ratedWindow = approvedWindow.filter((item) => typeof item.rating === 'number');
      const avgRating = ratedWindow.length ? Number((ratedWindow.reduce((sum, item) => sum + Number(item.rating || 0), 0) / ratedWindow.length).toFixed(1)) : 0;
      const onTimeWindow = completedWindow.filter((item) => isOnTimeCompletion(item));
      if (!assignedItems.length && !completedWindow.length && !dueWindow.length && !overdue.length) return null;
      return {
        id: user.id,
        name: user.name,
        open: openNow.length,
        completed: completedWindow.length,
        quickCompleted: quickCompletedWindow.length,
        quickAssigned: quickAssigned.length,
        dueInWindow: dueWindow.length,
        overdue: overdue.length,
        avgRating,
        score: buildPerformanceScore({ assignedCount: assignedItems.length, completedCount: completedAll.length, completedInRange: completedWindow.length, approvedInRange: approvedWindow.length, overdueCount: overdue.length, averageRating: avgRating, onTimeInRange: onTimeWindow.length }),
        note: overdue.length ? `${overdue.length} overdue item${overdue.length === 1 ? '' : 's'} need follow-up.` : dueWindow.length ? `${dueWindow.length} open item${dueWindow.length === 1 ? '' : 's'} are due in this ${period} window.` : completedWindow.length ? `${completedWindow.length} item${completedWindow.length === 1 ? '' : 's'} completed in this ${period} window (${quickCompletedWindow.length} quick task${quickCompletedWindow.length === 1 ? '' : 's'}).` : `Current workload is stable (${quickAssigned.length} quick task${quickAssigned.length === 1 ? '' : 's'} assigned).`,
      };
    }).filter(Boolean).sort((left, right) => {
      const a = left as NonNullable<typeof left>;
      const b = right as NonNullable<typeof right>;
      if (b.score !== a.score) return b.score - a.score;
      if (b.completed !== a.completed) return b.completed - a.completed;
      return a.overdue - b.overdue;
    }).slice(0, selectedUserId === 'all' ? 10 : 1) as Array<{ id: string; name: string; open: number; completed: number; quickCompleted: number; quickAssigned: number; dueInWindow: number; overdue: number; avgRating: number; score: number; note: string }>;
  }, [filteredCardItems, period, range, selectedUserId, users]);

  const deadlineRows = useMemo(() => filteredOpenItems.filter((item) => item.dueDate).sort((left, right) => (parseDate(left.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER) - (parseDate(right.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER)).slice(0, 12), [filteredOpenItems]);
  const compactEmployeeRows = useMemo(() => employeeRows.slice(0, 6), [employeeRows]);
  const compactDeadlineRows = useMemo(() => deadlineRows.slice(0, 6), [deadlineRows]);

  const summaryHeadline = useMemo(() => {
    if (period === 'daily' && selectedUserId === 'all' && latestDailyReport?.analysis?.headline) return latestDailyReport.analysis.headline;
    if (!summary.totalCurrentItems) return `No work items are available for ${selectedUserLabel.toLowerCase()} in the current workspace scope.`;
    if (summary.overdueOpen > 0) return `${selectedUserLabel} currently has ${summary.overdueOpen} overdue open item${summary.overdueOpen === 1 ? '' : 's'} that need attention.`;
    return `${summary.completedInRange} item${summary.completedInRange === 1 ? '' : 's'} were completed in the selected ${period} window with a ${summary.performanceScore}% performance score.`;
  }, [latestDailyReport?.analysis?.headline, period, selectedUserId, selectedUserLabel, summary.completedInRange, summary.overdueOpen, summary.performanceScore, summary.totalCurrentItems]);

  const summaryPoints = useMemo(() => {
    if (period === 'daily' && selectedUserId === 'all' && latestDailyReport?.analysis) {
      return [...latestDailyReport.analysis.strengths.slice(0, 1), ...latestDailyReport.analysis.risks.slice(0, 1), ...latestDailyReport.analysis.recommendations.slice(0, 1)].filter(Boolean);
    }
    return [
      `${summary.createdInRange} item${summary.createdInRange === 1 ? '' : 's'} entered the selected ${period} window.`,
      `${summary.dueInRange} open item${summary.dueInRange === 1 ? '' : 's'} are due inside this reporting range.`,
      `${summary.activeEmployees} active contributor${summary.activeEmployees === 1 ? '' : 's'} are represented in this scope.`,
    ];
  }, [latestDailyReport?.analysis, period, selectedUserId, summary.activeEmployees, summary.createdInRange, summary.dueInRange]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      if (period === 'daily') {
        const res = await reportsService.runDailyNow();
        const report = res.data?.data?.report || null;
        setLatestDailyReport(report);
        const historyRes = await reportsService.getDaily(10);
        setDailyHistory(historyRes.data?.data || []);
        if (report?.generatedAt) setGeneratedAt(report.generatedAt);
      } else {
        setGeneratedAt(new Date().toISOString());
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportCsv = () => {
    const rows: Array<Array<string | number>> = [
      ['Report', `${periodLabel} report`], ['Scope', selectedUserLabel], ['Generated At', formatDate(generatedAt, 'MMM d, yyyy hh:mm a')],
      ['Current Items', summary.totalCurrentItems], ['Open Items', summary.totalOpenItems], ['Created In Range', summary.createdInRange],
      ['Completed In Range', summary.completedInRange], ['Due In Range', summary.dueInRange], ['Overdue Open', summary.overdueOpen],
      ['Completion Rate', `${summary.completionRate}%`], ['On-time Rate', `${summary.onTimeRate}%`], ['Average Rating', summary.averageRating ? `${summary.averageRating}/5` : '--'], ['Performance Score', `${summary.performanceScore}%`], [],
      ['Employee', 'Open Now', 'Completed In Window', 'Quick Completed', 'Due In Window', 'Overdue', 'Score'],
      ...employeeRows.map((row) => [row.name, row.open, row.completed, row.quickCompleted, row.dueInWindow, row.overdue, `${row.score}%`]),
    ];
    const blob = new Blob([csv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-management-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      window.alert('Please allow pop-ups for this site to export the PDF.');
      return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(`${periodLabel} Report`)}</title><style>@page{size:A4;margin:16mm;}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#172554;}.hero{border:1px solid #dbe4ff;background:linear-gradient(135deg,#eef4ff 0%,#ffffff 68%);border-radius:20px;padding:24px;margin-bottom:20px;}.eyebrow{color:#2f55f5;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;}.title{margin:10px 0 6px;font-size:28px;font-weight:700;color:#0f172a;}.sub{color:#475569;font-size:13px;margin-top:4px;}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}.card{border:1px solid #e2e8f0;border-radius:14px;padding:14px;}.card-label{font-size:11px;text-transform:uppercase;color:#64748b;}.card-value{margin-top:8px;font-size:22px;font-weight:700;color:#0f172a;}.section{margin-top:22px;}.section h2{font-size:16px;margin:0 0 10px;color:#0f172a;}.report-table{width:100%;border-collapse:collapse;font-size:12px;}.report-table th,.report-table td{border:1px solid #e2e8f0;padding:8px;text-align:left;vertical-align:top;}.report-table th{background:#f8fafc;text-transform:uppercase;font-size:10px;color:#475569;letter-spacing:.06em;}.list{margin:0;padding-left:18px;color:#334155;font-size:12px;line-height:1.6;}</style></head><body><div class="hero"><div class="eyebrow">Report Management</div><div class="title">${escapeHtml(periodLabel)} Report</div><div class="sub">Scope: ${escapeHtml(selectedUserLabel)}</div><div class="sub">Generated: ${escapeHtml(formatDate(generatedAt, 'MMM d, yyyy hh:mm a'))}</div><div class="sub">${escapeHtml(summaryHeadline)}</div></div><div class="grid"><div class="card"><div class="card-label">Current Items</div><div class="card-value">${summary.totalCurrentItems}</div></div><div class="card"><div class="card-label">Completed In Window</div><div class="card-value">${summary.completedInRange}</div></div><div class="card"><div class="card-label">Overdue Open</div><div class="card-value">${summary.overdueOpen}</div></div><div class="card"><div class="card-label">Performance Score</div><div class="card-value">${summary.performanceScore}%</div></div></div><div class="section"><h2>Highlights</h2><ul class="list">${summaryPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul></div><div class="section"><h2>Employee Overview</h2>${renderPdfTable(['Employee', 'Open Now', 'Completed In Window', 'Quick Completed', 'Due In Window', 'Overdue', 'Score'], employeeRows.map((row) => [row.name, row.open, row.completed, row.quickCompleted, row.dueInWindow, row.overdue, `${row.score}%`]))}</div><div class="section"><h2>Deadline Table</h2>${renderPdfTable(['Title', 'Type', 'Project', 'Assignees', 'Due Date', 'Priority'], deadlineRows.map((row) => [row.title, row.type === 'project_task' ? 'Project Task' : 'Quick Task', row.projectName, row.assigneeIds.map((id) => userMap.get(id) || 'Unknown').join(', ') || 'Unassigned', row.dueDate ? formatDate(row.dueDate) : 'No due date', titleize(row.priority)]))}</div></body></html>`;
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.onload = () => setTimeout(() => reportWindow.print(), 250);
  };

  return (
    <div className="mx-auto flex max-w-full flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Current Work Items" value={summary.totalCurrentItems} helper="All project and quick tasks in the selected scope" icon={<BarChart3 size={20} />} accent={COLORS.blue} active={cardFilter === 'current'} onClick={() => setCardFilter('current')} />
        <MetricCard label="Completed In Window" value={summary.completedInRange} helper={`Finished during the selected ${period} period`} icon={<CheckCircle2 size={20} />} accent={COLORS.green} active={cardFilter === 'completed'} onClick={() => setCardFilter('completed')} />
        <MetricCard label="Due In Window" value={summary.dueInRange} helper="Open items whose due date falls inside this report window" icon={<CalendarClock size={20} />} accent={COLORS.amber} active={cardFilter === 'due'} onClick={() => setCardFilter('due')} />
        <MetricCard label="Overdue Open" value={summary.overdueOpen} helper="Current open items already past their due date" icon={<AlertTriangle size={20} />} accent={COLORS.red} active={cardFilter === 'overdue'} onClick={() => setCardFilter('overdue')} />
        <MetricCard label="Active Employees" value={summary.activeEmployees} helper="People represented in this selected scope" icon={<Users size={20} />} accent={COLORS.violet} active={cardFilter === 'active'} onClick={() => setCardFilter('active')} />
        <MetricCard label="Completion Rate" value={`${summary.completionRate}%`} helper="Snapshot of done items versus total current items" icon={<TrendingUp size={20} />} accent={COLORS.green} active={cardFilter === 'completion'} onClick={() => setCardFilter('completion')} />
      </div>

      <section className="rounded-[28px] border border-surface-200 bg-surface-50/80 p-4 dark:border-surface-800 dark:bg-surface-950/40">
        <div className="flex overflow-x-auto rounded-2xl bg-white p-1 dark:bg-surface-900">
          {PERIODS.map((option) => <button key={option.key} type="button" onClick={() => setPeriod(option.key)} className={cn('flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all', period === option.key ? 'bg-gray-100 text-surface-950 shadow-sm dark:bg-surface-900 dark:text-white' : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-200')}>{option.label}</button>)}
        </div>
        <div ref={userDropdownRef} className="relative mt-4">
          <button type="button" onClick={() => setUserDropdownOpen((open) => !open)} className="input flex w-full items-center justify-between gap-3 rounded-2xl border-surface-200 bg-white px-4 py-3.5 text-left shadow-none dark:border-surface-700 dark:bg-surface-900"><span className="truncate text-base">{selectedUserLabel}</span><ChevronDown size={16} className={cn('shrink-0 text-surface-500 transition-transform', userDropdownOpen && 'rotate-180')} /></button>
          {userDropdownOpen && <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-2xl dark:border-surface-700 dark:bg-surface-900"><div className="border-b border-surface-100 p-3 dark:border-surface-800"><div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" /><input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search  ..." className="input w-full rounded-2xl pl-9" /></div></div><div className="max-h-72 overflow-y-auto py-2"><button type="button" onClick={() => { setSelectedUserId('all'); setUserDropdownOpen(false); setUserSearch(''); }} className={cn('flex w-full items-center px-4 py-3 text-left text-sm transition-colors', selectedUserId === 'all' ? 'bg-brand-600 text-white' : 'text-surface-700 hover:bg-surface-50 dark:text-surface-200 dark:hover:bg-surface-800')}>All Employees</button>{filteredUsers.length > 0 ? filteredUsers.map((user) => <button key={user.id} type="button" onClick={() => { setSelectedUserId(user.id); setUserDropdownOpen(false); setUserSearch(''); }} className={cn('flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors', selectedUserId === user.id ? 'bg-brand-600 text-white' : 'text-surface-700 hover:bg-surface-50 dark:text-surface-200 dark:hover:bg-surface-800')}><span className="truncate">{user.name}</span><span className={cn('shrink-0 truncate text-xs', selectedUserId === user.id ? 'text-white/75' : 'text-surface-400')}>{user.email}</span></button>) : <div className="px-4 py-5 text-sm text-surface-400">No employee found.</div>}</div></div>}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button onClick={handleGenerate} disabled={isGenerating} className="btn-primary btn-md rounded-2xl"><RefreshCcw size={15} className={cn(isGenerating && 'animate-spin')} />{isGenerating ? 'Generating...' : 'Generate Report'}</button>
          <button onClick={handleExportCsv} className="btn-secondary btn-md rounded-2xl"><Download size={15} />Export CSV</button>
          <button onClick={handleExportPdf} className="btn-secondary btn-md rounded-2xl"><Download size={15} />Export PDF</button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="rounded-[28px] border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="font-display text-xl font-bold text-surface-950 dark:text-white">Activity Trend</h3><p className="mt-1 text-xs text-surface-400">Period-based events only: work created, completed, and due inside the selected reporting window.</p></div><div className="flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-surface-400"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2f55f5]" />Created</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#10b981]" />Completed</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" />Due</span></div></div>
          <ResponsiveContainer width="100%" height={300}><AreaChart data={trendData}><defs><linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.18} /><stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} /></linearGradient><linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.green} stopOpacity={0.18} /><stop offset="95%" stopColor={COLORS.green} stopOpacity={0} /></linearGradient><linearGradient id="dueGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.amber} stopOpacity={0.18} /><stop offset="95%" stopColor={COLORS.amber} stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e8f2" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="created" stroke={COLORS.blue} strokeWidth={2.5} fill="url(#createdGrad)" /><Area type="monotone" dataKey="completed" stroke={COLORS.green} strokeWidth={2.5} fill="url(#completedGrad)" /><Area type="monotone" dataKey="due" stroke={COLORS.amber} strokeWidth={2.5} fill="url(#dueGrad)" /></AreaChart></ResponsiveContainer>
        </div>
        <div className="rounded-[28px] border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-5"><h3 className="font-display text-xl font-bold text-surface-950 dark:text-white">Current Status Mix</h3><p className="mt-1 text-xs text-surface-400">Snapshot of the current workload state for this scope.</p></div>
          <div className="h-[240px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={4}>{statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
          <div className="mt-4 space-y-2">{statusData.map((row) => <div key={row.name} className="flex items-center justify-between rounded-2xl bg-surface-50 px-3 py-2 text-xs dark:bg-surface-800/70"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} /><span className="font-medium text-surface-600 dark:text-surface-300">{row.name}</span></div><span className="font-bold text-surface-900 dark:text-white">{row.value}</span></div>)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-5"><h3 className="font-display text-xl font-bold text-surface-950 dark:text-white">Open Priority Load</h3><p className="mt-1 text-xs text-surface-400">Only open work is included here, so urgency reflects what still needs action.</p></div>
          <ResponsiveContainer width="100%" height={260}><BarChart data={priorityData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e8f2" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip /><Bar dataKey="value" radius={[10, 10, 0, 0]}>{priorityData.map((row) => <Cell key={row.name} fill={row.color} />)}</Bar></BarChart></ResponsiveContainer>
        </div>
        <div className="rounded-[28px] border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-4 flex items-center gap-2"><Activity size={18} className="text-brand-600" /><h3 className="font-display text-xl font-bold text-surface-950 dark:text-white">Recent Daily Reports</h3></div>
          <div className="space-y-3">{dailyHistory.length > 0 ? dailyHistory.slice(0, 6).map((report) => <div key={report.id || report.reportDate} className="rounded-2xl border border-surface-100 bg-surface-50/80 px-4 py-3 dark:border-surface-800 dark:bg-surface-950/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-surface-900 dark:text-surface-100">{formatDate(report.reportDate)}</p><p className="mt-1 text-xs leading-5 text-surface-400">{report.analysis.headline}</p></div><div className="text-right"><p className="text-sm font-semibold text-brand-600">{report.summary.totalCompletedToday} done</p><p className="text-[11px] text-surface-400">{report.summary.totalOverdueOpen} overdue</p></div></div></div>) : <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-surface-400 dark:border-surface-800">No generated daily history yet.</div>}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="overflow-hidden rounded-[28px] border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="border-b border-surface-100 px-5 py-4 dark:border-surface-800">
            <h3 className="font-display text-xl font-bold text-surface-950 dark:text-white">Top Employee Snapshot</h3>
            <p className="mt-1 text-xs text-surface-400">Best visible performance rows for this selected report scope.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[100%] divide-y divide-surface-100 dark:divide-surface-800">
              <thead className="bg-surface-50 dark:bg-surface-950/40">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-surface-400">Employee</th>
                  <th className="px-5 py-3 text-center text-[11px] uppercase tracking-wide text-surface-400">Open</th>
                  <th className="px-5 py-3 text-center text-[11px] uppercase tracking-wide text-surface-400">Done</th>
                  <th className="px-5 py-3 text-center text-[11px] uppercase tracking-wide text-surface-400">Quick Done</th>
                  <th className="px-5 py-3 text-center text-[11px] uppercase tracking-wide text-surface-400">Overdue</th>
                  <th className="px-5 py-3 text-center text-[11px] uppercase tracking-wide text-surface-400">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {compactEmployeeRows.length > 0 ? compactEmployeeRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-50/70 dark:hover:bg-surface-900/60">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-surface-950 dark:text-surface-100">{row.name}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-surface-400">{row.note}</p>
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium text-surface-700 dark:text-surface-200">{row.open}</td>
                    <td className="px-5 py-4 text-center text-sm font-medium text-surface-700 dark:text-surface-200">{row.completed}</td>
                    <td className="px-5 py-4 text-center text-sm font-medium text-surface-700 dark:text-surface-200">{row.quickCompleted}</td>
                    <td className="px-5 py-4 text-center text-sm font-medium text-rose-500">{row.overdue}</td>
                    <td className="px-5 py-4 text-center"><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">{row.score}%</span></td>
                  </tr>
                )) : <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-surface-400">No employee activity is available for this report scope.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="border-b border-surface-100 px-5 py-4 dark:border-surface-800">
            <h3 className="font-display text-xl font-bold text-surface-950 dark:text-white">Upcoming Deadlines</h3>
            <p className="mt-1 text-xs text-surface-400">A shorter queue of the nearest open due items.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[100%] divide-y divide-surface-100 dark:divide-surface-800">
              <thead className="bg-surface-50 dark:bg-surface-950/40">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-surface-400">Title</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-surface-400">Type</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-surface-400">Due</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-surface-400">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {compactDeadlineRows.length > 0 ? compactDeadlineRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-50/70 dark:hover:bg-surface-900/60">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-surface-950 dark:text-surface-100">{row.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-surface-400">{row.projectName}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-surface-600 dark:text-surface-300">{row.type === 'project_task' ? 'Project Task' : 'Quick Task'}</td>
                    <td className="px-5 py-4 text-sm text-surface-600 dark:text-surface-300">{row.dueDate ? formatDate(row.dueDate) : 'No due date'}</td>
                    <td className="px-5 py-4"><span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: PRIORITY_COLORS[row.priority] || COLORS.slate }}>{titleize(row.priority)}</span></td>
                  </tr>
                )) : <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-surface-400">No open deadlines are available for this report scope.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportManagementPage;
