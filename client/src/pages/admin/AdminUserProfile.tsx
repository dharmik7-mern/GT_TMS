import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react';
import { addDays, endOfDay, format, isWithinInterval, parseISO, startOfDay, subDays, subMonths, subYears } from 'date-fns';
import { usersService } from '../../services/api';
import { useAppStore } from '../../context/appStore';
import { cn, formatDate } from '../../utils/helpers';
import { UserAvatar } from '../../components/UserAvatar';
import { ROLE_CONFIG } from '../../app/constants';
import type { Priority, ProjectStatus, QuickTask, Task, User, UserPerformance } from '../../app/types';

type ViewPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
type FlatWorkItem = {
  id: string;
  title: string;
  type: 'project_task' | 'quick_task';
  status: string;
  priority: Priority;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  projectName?: string;
};

const PERIOD_OPTIONS: Array<{ key: ViewPeriod; label: string; helper: string }> = [
  { key: 'daily', label: 'Daily', helper: 'Today’s delivery and deadlines' },
  { key: 'weekly', label: 'Weekly', helper: 'Last 7 days of output and pace' },
  { key: 'monthly', label: 'Monthly', helper: '30-day performance and quality' },
  { key: 'yearly', label: 'Yearly', helper: '12-month consistency and trend view' },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#94a3b8',
  medium: '#3366ff',
  high: '#f59e0b',
  urgent: '#ef4444',
};

function parseDate(value?: string | null) {
  if (!value) return null;
  try {
    return value.includes('T') ? parseISO(value) : parseISO(`${value}T00:00:00`);
  } catch {
    return null;
  }
}

function getRange(period: ViewPeriod) {
  const now = new Date();
  if (period === 'daily') return { start: startOfDay(now), end: endOfDay(now), steps: 1, mode: 'day' as const };
  if (period === 'weekly') return { start: startOfDay(subDays(now, 6)), end: endOfDay(now), steps: 7, mode: 'day' as const };
  if (period === 'monthly') return { start: startOfDay(subDays(now, 29)), end: endOfDay(now), steps: 30, mode: 'day' as const };
  return { start: startOfDay(subYears(now, 1)), end: endOfDay(now), steps: 12, mode: 'month' as const };
}

function inRange(dateValue: string | undefined, range: { start: Date; end: Date }) {
  const date = parseDate(dateValue);
  return date ? isWithinInterval(date, range) : false;
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  accent?: string;
}> = ({ title, value, helper, icon, accent = '#3366ff' }) => (
  <div className="card p-5">
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${accent}14`, color: accent }}>
      {icon}
    </div>
    <p className="text-2xl font-semibold text-surface-900 dark:text-white">{value}</p>
    <p className="mt-1 text-sm font-medium text-surface-700 dark:text-surface-300">{title}</p>
    <p className="mt-1 text-xs text-surface-400">{helper}</p>
  </div>
);

export const AdminUserProfilePage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { users, tasks, quickTasks, projects } = useAppStore();
  const [period, setPeriod] = useState<ViewPeriod>('monthly');
  const [user, setUser] = useState<User | null>(null);
  const [performance, setPerformance] = useState<UserPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const localUser = users.find((entry) => entry.id === id) || null;
        const [userRes, performanceRes] = await Promise.all([
          localUser ? Promise.resolve({ data: { data: localUser } }) : usersService.getById(id),
          usersService.getPerformance(id),
        ]);
        if (cancelled) return;
        setUser(userRes.data?.data ?? userRes.data ?? null);
        setPerformance(performanceRes.data?.data ?? performanceRes.data ?? null);
      } catch {
        if (cancelled) return;
        setUser(null);
        setPerformance(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, users]);

  const range = useMemo(() => getRange(period), [period]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);

  const userWorkItems = useMemo<FlatWorkItem[]>(() => {
    if (!id) return [];
    const projectTasks = tasks
      .filter((task) => task.assigneeIds.includes(id))
      .map((task: Task) => ({
        id: task.id,
        title: task.title,
        type: 'project_task' as const,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completionReview?.completedAt || (task.status === 'done' ? task.updatedAt : undefined),
        projectName: projectMap.get(task.projectId) || 'Project task',
      }));

    const personalQuickTasks = quickTasks
      .filter((task) => task.assigneeIds.includes(id))
      .map((task: QuickTask) => ({
        id: task.id,
        title: task.title,
        type: 'quick_task' as const,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completionReview?.completedAt || (task.status === 'done' ? task.updatedAt : undefined),
        projectName: 'Quick task',
      }));

    return [...projectTasks, ...personalQuickTasks];
  }, [id, projectMap, quickTasks, tasks]);

  const scopedItems = useMemo(() => userWorkItems.filter((item) => (
    inRange(item.createdAt, range) || inRange(item.updatedAt, range) || inRange(item.dueDate, range) || inRange(item.completedAt, range)
  )), [range, userWorkItems]);

  const scopedSummary = useMemo(() => {
    const total = scopedItems.length;
    const completed = scopedItems.filter((item) => item.status === 'done').length;
    const open = scopedItems.filter((item) => item.status !== 'done').length;
    const overdue = scopedItems.filter((item) => {
      const due = parseDate(item.dueDate);
      return due && due < startOfDay(new Date()) && item.status !== 'done';
    }).length;
    const dueToday = scopedItems.filter((item) => {
      const due = parseDate(item.dueDate);
      return due && isWithinInterval(due, { start: startOfDay(new Date()), end: endOfDay(new Date()) }) && item.status !== 'done';
    }).length;
    const quickTasksCount = scopedItems.filter((item) => item.type === 'quick_task').length;
    const projectTasksCount = scopedItems.filter((item) => item.type === 'project_task').length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    return {
      total,
      completed,
      open,
      overdue,
      dueToday,
      quickTasksCount,
      projectTasksCount,
      completionRate,
    };
  }, [scopedItems]);

  const trendData = useMemo(() => {
    const buckets = range.mode === 'month'
      ? Array.from({ length: 12 }, (_, index) => {
        const date = subMonths(range.end, 11 - index);
        const start = startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
        const end = endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
        return { label: format(date, 'MMM'), start, end };
      })
      : Array.from({ length: range.steps }, (_, index) => {
        const date = addDays(range.start, index);
        return { label: format(date, 'MMM d'), start: startOfDay(date), end: endOfDay(date) };
      });

    return buckets.map((bucket) => ({
      label: bucket.label,
      completed: scopedItems.filter((item) => inRange(item.completedAt, bucket)).length,
      created: scopedItems.filter((item) => inRange(item.createdAt, bucket)).length,
      due: scopedItems.filter((item) => inRange(item.dueDate, bucket) && item.status !== 'done').length,
    }));
  }, [range, scopedItems]);

  const mixData = useMemo(() => ([
    { name: 'Project Tasks', value: scopedSummary.projectTasksCount, color: '#3366ff' },
    { name: 'Quick Tasks', value: scopedSummary.quickTasksCount, color: '#7c3aed' },
  ].filter((item) => item.value > 0)), [scopedSummary.projectTasksCount, scopedSummary.quickTasksCount]);

  const statusData = useMemo(() => {
    const grouped = scopedItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
      color: name === 'done' ? '#10b981' : name === 'blocked' ? '#ef4444' : '#3366ff',
    }));
  }, [scopedItems]);

  const ratingData = useMemo(() => performance?.ratingDistribution?.map((entry) => ({
    label: `${entry.rating} Star`,
    count: entry.count,
  })) || [], [performance?.ratingDistribution]);

  const focusItems = useMemo(() => scopedItems
    .filter((item) => item.status !== 'done')
    .sort((left, right) => {
      const leftDate = parseDate(left.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
      const rightDate = parseDate(right.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate;
    })
    .slice(0, 6), [scopedItems]);

  const activeProjects = useMemo(() => {
    const visible = performance?.activeProjects || [];
    return visible.slice(0, 6) as Array<{ id: string; name: string; status: ProjectStatus }>;
  }, [performance?.activeProjects]);

  if (loading) {
    return <div className="mx-auto max-w-7xl text-sm text-surface-400">Loading user profile...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate('/admin/users')} className="btn-secondary btn-md mb-6">
          <ArrowLeft size={16} />
          Back to Users
        </button>
        <div className="card p-8 text-center text-surface-400">User profile could not be loaded.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="page-header flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <button onClick={() => navigate('/admin/users')} className="btn-secondary btn-md self-start">
            <ArrowLeft size={16} />
          </button>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <UserAvatar name={user.name} color={user.color} size="lg" isOnline={user.isActive} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="page-title">{user.name}</h1>
                <span className={cn('badge text-xs', ROLE_CONFIG[user.role].bg, ROLE_CONFIG[user.role].color)}>
                  {ROLE_CONFIG[user.role].label}
                </span>
                <span className={cn('badge text-xs', user.isActive ? 'badge-green' : 'badge-gray')}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="page-subtitle">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-surface-500">
                <span>Employee ID: {user.employeeId || 'Not assigned'}</span>
                <span>Joined: {formatDate(user.createdAt)}</span>
                <span>{user.jobTitle || 'No title'}{user.department ? ` • ${user.department}` : ''}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex overflow-x-auto rounded-2xl bg-surface-100 p-1 dark:bg-surface-800">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setPeriod(option.key)}
              className={cn(
                'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all',
                period === option.key
                  ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-900 dark:text-white'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-200'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card border-brand-100 bg-gradient-to-r from-brand-50 via-white to-surface-50 p-5 dark:border-brand-900/30 dark:from-brand-950/15 dark:via-surface-900 dark:to-surface-900 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Performance Overview</p>
            <h2 className="mt-2 text-3xl font-semibold text-surface-900 dark:text-white">
              {performance?.insight?.headline || `${user.name} has ${scopedSummary.completed} completed items in the selected ${period} view.`}
            </h2>
            <p className="mt-3 max-w-3xl text-sm text-surface-600 dark:text-surface-300">
              {PERIOD_OPTIONS.find((entry) => entry.key === period)?.helper}. This profile combines delivery output, task quality, deadlines, workload mix, and recent focus areas for a more complete admin view.
            </p>
            {performance?.insight?.focusAreas?.length ? (
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {performance.insight.focusAreas.slice(0, 3).map((item) => (
                  <div key={item} className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-surface-700 dark:bg-surface-900/70 dark:text-surface-200">
                    {item}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/80 px-4 py-4 dark:bg-surface-900/80">
              <p className="text-[11px] uppercase tracking-wide text-surface-400">Overall Score</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-surface-100">{performance?.summary.performanceScore ?? 0}%</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-4 dark:bg-surface-900/80">
              <p className="text-[11px] uppercase tracking-wide text-surface-400">Completion Rate</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-surface-100">{performance?.summary.completionRate ?? scopedSummary.completionRate}%</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-4 dark:bg-surface-900/80">
              <p className="text-[11px] uppercase tracking-wide text-surface-400">Average Rating</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-surface-100">{performance?.summary.averageRating ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-4 dark:bg-surface-900/80">
              <p className="text-[11px] uppercase tracking-wide text-surface-400">Active Projects</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-surface-100">{performance?.summary.activeProjects ?? activeProjects.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Assigned" value={performance?.summary.assignedTasks ?? scopedSummary.total} helper="Overall assigned work" icon={<Briefcase size={20} />} accent="#3366ff" />
        <StatCard title="Completed" value={scopedSummary.completed} helper={`Done in ${period} view`} icon={<CheckCircle2 size={20} />} accent="#10b981" />
        <StatCard title="Open Work" value={scopedSummary.open} helper="Still in progress or pending" icon={<Clock3 size={20} />} accent="#7c3aed" />
        <StatCard title="Overdue" value={scopedSummary.overdue} helper="Open items past due date" icon={<CalendarClock size={20} />} accent="#ef4444" />
        <StatCard title="Due Today" value={scopedSummary.dueToday} helper="Items requiring attention today" icon={<Target size={20} />} accent="#f59e0b" />
        <StatCard title="Approved" value={performance?.summary.approvedTasks ?? 0} helper="Reviewed and approved tasks" icon={<Star size={20} />} accent="#14b8a6" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="card p-5">
          <div className="mb-6">
            <h3 className="font-display font-bold text-surface-900 dark:text-white">Work Trend</h3>
            <p className="text-xs text-surface-400">Created, completed, and due work across the selected period</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="userProfileCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3366ff" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3366ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="userProfileCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e8f2" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="created" stroke="#3366ff" fill="url(#userProfileCreated)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="completed" stroke="#10b981" fill="url(#userProfileCompleted)" strokeWidth={3} />
              <Area type="monotone" dataKey="due" stroke="#f59e0b" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="mb-6">
            <h3 className="font-display font-bold text-surface-900 dark:text-white">Work Mix</h3>
            <p className="text-xs text-surface-400">Project tasks vs quick tasks in this view</p>
          </div>
          <div className="h-[220px] sm:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={mixData.length ? mixData : [{ name: 'No data', value: 1, color: '#cbd5e1' }]} dataKey="value" innerRadius={58} outerRadius={86}>
                  {(mixData.length ? mixData : [{ name: 'No data', value: 1, color: '#cbd5e1' }]).map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {(mixData.length ? mixData : [{ name: 'No data', value: 0, color: '#cbd5e1' }]).map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-surface-500">{item.name}</span>
                </div>
                <span className="font-bold text-surface-900 dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card p-5">
          <div className="mb-6">
            <h3 className="font-display font-bold text-surface-900 dark:text-white">Status Distribution</h3>
            <p className="text-xs text-surface-400">How the user’s work is currently distributed by status</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e8f2" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="mb-6">
            <h3 className="font-display font-bold text-surface-900 dark:text-white">Rating Distribution</h3>
            <p className="text-xs text-surface-400">Approval ratings from reviewed completions</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ratingData.length ? ratingData : [{ label: 'No ratings', count: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e8f2" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#7c3aed" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-surface-100 px-5 py-4 dark:border-surface-800">
            <h3 className="font-display font-bold text-surface-900 dark:text-white">Current Focus</h3>
            <p className="text-xs text-surface-400">The user’s nearest open work items in the selected view</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] divide-y divide-surface-100 dark:divide-surface-800">
              <thead className="bg-surface-50 dark:bg-surface-950/40">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-surface-400">Title</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-surface-400">Type</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-surface-400">Project</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-surface-400">Due Date</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-surface-400">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {focusItems.length > 0 ? focusItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4 text-sm font-medium text-surface-900 dark:text-surface-100">{item.title}</td>
                    <td className="px-5 py-4 text-sm text-surface-600 dark:text-surface-300">{item.type === 'project_task' ? 'Project Task' : 'Quick Task'}</td>
                    <td className="px-5 py-4 text-sm text-surface-600 dark:text-surface-300">{item.projectName || '—'}</td>
                    <td className="px-5 py-4 text-sm text-surface-600 dark:text-surface-300">{item.dueDate ? formatDate(item.dueDate) : 'No due date'}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: PRIORITY_COLORS[item.priority] }}>
                        {item.priority}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-surface-400">No open work items in this profile view.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="mb-5 flex items-center gap-2">
              <TrendingUp size={18} className="text-brand-600" />
              <h3 className="font-display font-bold text-surface-900 dark:text-white">Performance Summary</h3>
            </div>
            <div className="space-y-3 text-sm text-surface-600 dark:text-surface-300">
              <p>{performance?.insight?.headline || `${user.name} is currently being tracked in the ${period} profile view.`}</p>
              <p>{scopedSummary.projectTasksCount} project tasks and {scopedSummary.quickTasksCount} quick tasks are included in this window.</p>
              <p>{performance?.summary.pendingReviewTasks ?? 0} tasks are pending review and {performance?.summary.changesRequestedTasks ?? 0} have requested changes.</p>
              <p>{performance?.summary.onTimeRate ?? 0}% of completed work has been delivered on time.</p>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-display font-bold text-surface-900 dark:text-white">Active Projects</h3>
            <div className="mt-4 space-y-3">
              {activeProjects.length > 0 ? activeProjects.map((project) => (
                <div key={project.id} className="rounded-2xl border border-surface-100 px-4 py-3 dark:border-surface-800">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">{project.name}</p>
                      <p className="text-xs text-surface-400">{project.status.replace(/_/g, ' ')}</p>
                    </div>
                    <span className="badge text-xs badge-blue">{project.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-surface-400 dark:border-surface-800">
                  No active projects linked to this user yet.
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-display font-bold text-surface-900 dark:text-white">Recent Evaluations</h3>
            <div className="mt-4 space-y-3">
              {performance?.recentEvaluations?.length ? performance.recentEvaluations.slice(0, 4).map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-surface-50 px-4 py-3 dark:bg-surface-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">{entry.title}</p>
                      <p className="text-xs text-surface-400">{entry.type === 'project_task' ? 'Project Task' : 'Quick Task'} • {entry.reviewedAt ? formatDate(entry.reviewedAt) : 'Not reviewed yet'}</p>
                    </div>
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                      {entry.rating ? `${entry.rating}/5` : 'Pending'}
                    </span>
                  </div>
                  {entry.reviewRemark ? <p className="mt-2 text-sm text-surface-600 dark:text-surface-300">{entry.reviewRemark}</p> : null}
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-surface-400 dark:border-surface-800">
                  No recent evaluation records are available.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserProfilePage;
