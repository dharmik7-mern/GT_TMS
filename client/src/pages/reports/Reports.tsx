import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Download,
  Users,
  Building2,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { cn } from '../../utils/helpers';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { companiesService } from '../../services/api';

type PeriodKey = 'week' | 'month' | 'quarter' | 'year';

type CompanyRow = {
  id: string;
  name: string;
  usersCount?: number;
  projectsCount?: number;
  status: string;
  color?: string;
  createdAt?: string;
};

type ReportCardProps = {
  title: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  accent?: string;
  onClick?: () => void;
};

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Last 3 months' },
  { key: 'year', label: 'This year' },
];

const TASK_STATUS_COLORS: Record<string, string> = {
  done: '#10b981',
  in_progress: '#3366ff',
  todo: '#8896b8',
  backlog: '#cbd5e1',
  scheduled: '#8b5cf6',
  in_review: '#f59e0b',
  blocked: '#ef4444',
};

const COMPANY_STATUS_COLORS: Record<string, string> = {
  active: '#3366ff',
  trial: '#7c3aed',
  suspended: '#8896b8',
};

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  try {
    return value.includes('T') ? parseISO(value) : parseISO(`${value}T00:00:00`);
  } catch {
    return null;
  }
}

function getPeriodRange(period: PeriodKey) {
  const now = new Date();
  const end = endOfDay(now);

  if (period === 'week') {
    return { start: startOfDay(subDays(now, 6)), end, granularity: 'day' as const };
  }
  if (period === 'month') {
    return { start: startOfDay(subDays(now, 29)), end, granularity: 'day' as const };
  }
  if (period === 'quarter') {
    return { start: startOfMonth(subMonths(now, 2)), end, granularity: 'month' as const };
  }
  return { start: startOfMonth(subMonths(now, 11)), end, granularity: 'month' as const };
}

function isInRange(dateValue?: string | null, period?: { start: Date; end: Date }) {
  const date = parseDate(dateValue);
  if (!date || !period) return false;
  return isWithinInterval(date, { start: period.start, end: period.end });
}

function titleize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function emptyChartLabel(period: PeriodKey) {
  return period === 'week' || period === 'month' ? format(new Date(), 'MMM d') : format(new Date(), 'MMM');
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPdfTable(headers: string[], rows: Array<Array<string | number>>) {
  return `
    <table class="report-table">
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

const ReportCard: React.FC<ReportCardProps> = ({ title, value, sub, icon, accent = '#3366ff', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'card p-5 text-left',
      onClick && 'cursor-pointer hover:shadow-card-hover transition-all'
    )}
  >
    <div className="mb-3 flex items-start justify-between">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${accent}14`, color: accent }}
      >
        {icon}
      </div>
    </div>
    <p className="text-2xl font-semibold text-surface-900 dark:text-white">{value}</p>
    <p className="mt-1 text-sm font-medium text-surface-700 dark:text-surface-300">{title}</p>
    <p className="mt-1 text-xs text-surface-400">{sub}</p>
  </button>
);

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const { user } = useAuthStore();
  const { projects, tasks, quickTasks, users } = useAppStore();

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (!isSuperAdmin) return;

    let active = true;
    setLoadingCompanies(true);

    companiesService.getAll()
      .then((res) => {
        if (!active) return;
        const data = res.data?.data ?? res.data ?? [];
        setCompanies(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setCompanies([]);
      })
      .finally(() => {
        if (active) setLoadingCompanies(false);
      });

    return () => {
      active = false;
    };
  }, [isSuperAdmin]);

  const range = useMemo(() => getPeriodRange(period), [period]);

  const superAdminData = useMemo(() => {
    const sourceCompanies = companies;
    const scopedQuickTasks = quickTasks.filter((task) => {
      const created = parseDate(task.createdAt);
      const updated = parseDate(task.updatedAt);
      const due = parseDate(task.dueDate);
      return (created && isWithinInterval(created, { start: range.start, end: range.end }))
        || (updated && isWithinInterval(updated, { start: range.start, end: range.end }))
        || (due && isWithinInterval(due, { start: range.start, end: range.end }));
    });

    const periods = range.granularity === 'day'
      ? eachDayOfInterval({ start: range.start, end: range.end })
      : eachMonthOfInterval({ start: range.start, end: range.end });

    const growthData = periods.map((bucket) => {
      const bucketStart = range.granularity === 'day' ? startOfDay(bucket) : startOfMonth(bucket);
      const bucketEnd = range.granularity === 'day' ? endOfDay(bucket) : endOfDay(addMonths(startOfMonth(bucket), 1));

      const visibleCompanies = sourceCompanies.filter((company) => {
        const created = parseDate(company.createdAt);
        return created ? created <= bucketEnd : false;
      });

      return {
        name: range.granularity === 'day' ? format(bucket, 'MMM d') : format(bucket, 'MMM'),
        companies: visibleCompanies.length,
        users: visibleCompanies.reduce((sum, company) => sum + (company.usersCount || 0), 0),
      };
    });

    const companyStatusData = ['active', 'trial', 'suspended']
      .map((status) => ({
        name: titleize(status),
        value: sourceCompanies.filter((company) => company.status === status).length,
        color: COMPANY_STATUS_COLORS[status],
      }))
      .filter((item) => item.value > 0);

    const topCompanies = [...sourceCompanies]
      .sort((a, b) => {
        const scoreA = (a.usersCount || 0) + (a.projectsCount || 0) * 5;
        const scoreB = (b.usersCount || 0) + (b.projectsCount || 0) * 5;
        return scoreB - scoreA;
      })
      .slice(0, 5)
      .map((company) => {
        const activityScore = Math.min(
          100,
          Math.round(((company.projectsCount || 0) * 12) + ((company.usersCount || 0) * 1.2))
        );
        return {
          ...company,
          activity: activityScore,
        };
      });

    const newlyCreatedCompanies = sourceCompanies.filter((company) => isInRange(company.createdAt, range)).length;
    const totalUsers = sourceCompanies.reduce((sum, company) => sum + (company.usersCount || 0), 0);

    return {
      growthData: growthData.length ? growthData : [{ name: emptyChartLabel(period), companies: 0, users: 0 }],
      companyStatusData: companyStatusData.length
        ? companyStatusData
        : [{ name: 'No Data', value: 1, color: '#cbd5e1' }],
      topCompanies,
      metrics: {
        companies: sourceCompanies.length,
        newCompanies: newlyCreatedCompanies,
        users: totalUsers,
        avgUsersPerCompany: sourceCompanies.length ? Math.round(totalUsers / sourceCompanies.length) : 0,
      },
    };
  }, [companies, period, range]);

  const workspaceData = useMemo(() => {
    const scopedProjects = projects.filter((project) => {
      const created = parseDate(project.createdAt);
      const updated = parseDate(project.updatedAt);
      return (created && isWithinInterval(created, { start: range.start, end: range.end }))
        || (updated && isWithinInterval(updated, { start: range.start, end: range.end }));
    });

    const visibleProjects = scopedProjects.length > 0 ? scopedProjects : projects;
    const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));

    const scopedTasks = tasks.filter((task) => {
      if (visibleProjectIds.has(task.projectId)) return true;
      const created = parseDate(task.createdAt);
      const updated = parseDate(task.updatedAt);
      const due = parseDate(task.dueDate);
      return (created && isWithinInterval(created, { start: range.start, end: range.end }))
        || (updated && isWithinInterval(updated, { start: range.start, end: range.end }))
        || (due && isWithinInterval(due, { start: range.start, end: range.end }));
    });

    const scopedQuickTasks = quickTasks.filter((task) => {
      const created = parseDate(task.createdAt);
      const updated = parseDate(task.updatedAt);
      const due = parseDate(task.dueDate);
      return (created && isWithinInterval(created, { start: range.start, end: range.end }))
        || (updated && isWithinInterval(updated, { start: range.start, end: range.end }))
        || (due && isWithinInterval(due, { start: range.start, end: range.end }));
    });

    const periods = range.granularity === 'day'
      ? eachDayOfInterval({ start: range.start, end: range.end })
      : eachMonthOfInterval({ start: range.start, end: range.end });

    const progressData = periods.map((bucket) => {
      const bucketStart = range.granularity === 'day' ? startOfDay(bucket) : startOfMonth(bucket);
      const bucketEnd = range.granularity === 'day' ? endOfDay(bucket) : endOfDay(addMonths(startOfMonth(bucket), 1));

      const bucketProjects = projects.filter((project) => {
        const created = parseDate(project.createdAt);
        return created ? created <= bucketEnd : false;
      });

      const avgProgress = bucketProjects.length
        ? Math.round(bucketProjects.reduce((sum, project) => sum + (project.progress || 0), 0) / bucketProjects.length)
        : 0;

      return {
        name: range.granularity === 'day' ? format(bucket, 'MMM d') : format(bucket, 'MMM'),
        progress: avgProgress,
      };
    });

    const taskStatusData = Object.entries(
      scopedTasks.reduce<Record<string, number>>((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {})
    )
      .map(([status, value]) => ({
        name: titleize(status),
        value,
        color: TASK_STATUS_COLORS[status] || '#94a3b8',
      }))
      .sort((a, b) => b.value - a.value);

    const priorityData = PRIORITY_ORDER.map((priority) => ({
      priority: titleize(priority),
      count: scopedTasks.filter((task) => task.priority === priority).length,
    })).filter((item) => item.count > 0);

    const assigneeStats = users.map((member) => {
      const assignedTasks = scopedTasks.filter((task) => task.assigneeIds?.includes(member.id));
      const assignedQuickTasks = scopedQuickTasks.filter((task) => task.assigneeIds?.includes(member.id));
      const allAssignedWork = [...assignedTasks, ...assignedQuickTasks];
      const completedTasks = assignedTasks.filter((task) => task.status === 'done').length;
      const completedQuickTasks = assignedQuickTasks.filter((task) => task.status === 'done').length;
      const overdueTasks = assignedTasks.filter((task) => {
        const dueDate = parseDate(task.dueDate);
        return dueDate && dueDate < new Date() && task.status !== 'done';
      }).length + assignedQuickTasks.filter((task) => {
        const dueDate = parseDate(task.dueDate);
        return dueDate && dueDate < new Date() && task.status !== 'done';
      }).length;

      const approvedRatings = allAssignedWork
        .filter((task) => task.completionReview?.reviewStatus === 'approved' && typeof task.completionReview?.rating === 'number')
        .map((task) => task.completionReview!.rating as number);

      const scoreBase = allAssignedWork.length === 0 ? 0 : Math.round((((completedTasks + completedQuickTasks) / allAssignedWork.length) * 100));
      const ratingBoost = approvedRatings.length ? Math.round((approvedRatings.reduce((sum, value) => sum + value, 0) / approvedRatings.length) * 4) : 0;
      const score = Math.max(0, Math.min(100, scoreBase + ratingBoost - overdueTasks * 5));

      return {
        id: member.id,
        name: member.name,
        assigned: allAssignedWork.length,
        completed: completedTasks + completedQuickTasks,
        averageRating: approvedRatings.length
          ? Number((approvedRatings.reduce((sum, value) => sum + value, 0) / approvedRatings.length).toFixed(1))
          : 0,
        score,
      };
    })
      .filter((member) => member.assigned > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const completedThisPeriod =
      scopedTasks.filter((task) => task.status === 'done').length +
      scopedQuickTasks.filter((task) => task.status === 'done').length;
    const overdueOpenTasks = scopedTasks.filter((task) => {
      const dueDate = parseDate(task.dueDate);
      return dueDate && dueDate < new Date() && task.status !== 'done';
    }).length + scopedQuickTasks.filter((task) => {
      const dueDate = parseDate(task.dueDate);
      return dueDate && dueDate < new Date() && task.status !== 'done';
    }).length;
    const approvedRatings = [...scopedTasks, ...scopedQuickTasks]
      .filter((task) => task.completionReview?.reviewStatus === 'approved' && typeof task.completionReview?.rating === 'number')
      .map((task) => task.completionReview!.rating as number);

    return {
      progressData: progressData.length ? progressData : [{ name: emptyChartLabel(period), progress: 0 }],
      taskStatusData: taskStatusData.length ? taskStatusData : [{ name: 'No Tasks', value: 1, color: '#cbd5e1' }],
      priorityData: priorityData.length ? priorityData : [{ priority: 'No Tasks', count: 0 }],
      assigneeStats,
      metrics: {
        activeProjects: visibleProjects.filter((project) => project.status === 'active').length,
        avgProjectProgress: visibleProjects.length
          ? Math.round(visibleProjects.reduce((sum, project) => sum + (project.progress || 0), 0) / visibleProjects.length)
          : 0,
        completedTasks: completedThisPeriod,
        overdueTasks: overdueOpenTasks,
        averageRating: approvedRatings.length
          ? Number((approvedRatings.reduce((sum, value) => sum + value, 0) / approvedRatings.length).toFixed(1))
          : 0,
      },
    };
  }, [projects, tasks, quickTasks, users, period, range]);

  const exportPdf = () => {
    const periodLabel = PERIOD_OPTIONS.find((item) => item.key === period)?.label || period;
    const generatedAt = format(new Date(), 'PPpp');
    const rangeLabel = `${format(range.start, 'PP')} to ${format(range.end, 'PP')}`;
    const title = isSuperAdmin ? 'Platform Analytics Report' : 'Workspace Performance Report';
    const summaryCards = isSuperAdmin
      ? [
          ['Companies', superAdminData.metrics.companies, `${superAdminData.metrics.newCompanies} created in selected period`],
          ['User Footprint', superAdminData.metrics.users, 'Current users across listed companies'],
          ['Avg Users / Company', superAdminData.metrics.avgUsersPerCompany, 'Average size of each company account'],
          ['Tracked Companies', superAdminData.topCompanies.length, 'High-activity companies included in ranking'],
        ]
      : [
          ['Active Projects', workspaceData.metrics.activeProjects, 'Projects active in selected scope'],
          ['Average Progress', `${workspaceData.metrics.avgProjectProgress}%`, 'Mean completion across visible projects'],
          ['Completed Tasks', workspaceData.metrics.completedTasks, 'Done tasks in selected scope'],
          ['Overdue Tasks', workspaceData.metrics.overdueTasks, 'Open tasks past due date'],
        ];

    const trendRows = isSuperAdmin
      ? superAdminData.growthData.map((item) => [item.name, item.companies, item.users])
      : workspaceData.progressData.map((item) => [item.name, `${item.progress}%`]);

    const distributionRows = isSuperAdmin
      ? superAdminData.companyStatusData.map((item) => [item.name, item.value])
      : workspaceData.taskStatusData.map((item) => [item.name, item.value]);

    const rankingRows = isSuperAdmin
      ? superAdminData.topCompanies.map((company, index) => [
          index + 1,
          company.name,
          company.usersCount || 0,
          company.projectsCount || 0,
          `${company.activity}%`,
        ])
      : workspaceData.assigneeStats.map((member, index) => [
          index + 1,
          member.name,
          member.assigned,
          member.completed,
          `${member.score}%`,
        ]);

    const detailRows = isSuperAdmin
      ? [
          ['Most Common Status', superAdminData.companyStatusData[0]?.name || 'No data'],
          ['Top Company', superAdminData.topCompanies[0]?.name || 'No company data'],
          ['Reporting Window', rangeLabel],
          ['Generated At', generatedAt],
        ]
      : [
          ['Visible Projects', projects.length],
          ['Visible Tasks', tasks.length],
          ['Priority Buckets', workspaceData.priorityData.map((item) => `${item.priority}: ${item.count}`).join(', ') || 'No tasks'],
          ['Generated At', generatedAt],
        ];

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)} - ${escapeHtml(periodLabel)}</title>
          <style>
            @page { size: A4; margin: 16mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #172554;
              background: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .report {
              width: 100%;
            }
            .hero {
              border: 1px solid #dbe4ff;
              background: linear-gradient(135deg, #eff6ff 0%, #ffffff 62%);
              border-radius: 18px;
              padding: 24px;
              margin-bottom: 20px;
            }
            .eyebrow {
              color: #3366ff;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              margin-bottom: 8px;
            }
            h1 {
              margin: 0;
              font-size: 28px;
              line-height: 1.15;
            }
            .subtitle {
              margin: 10px 0 18px;
              color: #5f6f94;
              font-size: 13px;
              line-height: 1.6;
            }
            .meta {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
            }
            .meta-item {
              background: rgba(255,255,255,0.86);
              border: 1px solid #dbe4ff;
              border-radius: 14px;
              padding: 12px 14px;
            }
            .meta-label {
              color: #7b89ab;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              margin-bottom: 4px;
            }
            .meta-value {
              color: #172554;
              font-size: 13px;
              font-weight: 700;
            }
            .section {
              margin-top: 18px;
              page-break-inside: avoid;
            }
            .section h2 {
              margin: 0 0 10px;
              font-size: 16px;
            }
            .section p.section-copy {
              margin: 0 0 12px;
              color: #6b7a9d;
              font-size: 12px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 12px;
            }
            .summary-card {
              border: 1px solid #e4e8f2;
              border-radius: 16px;
              padding: 16px;
              background: #ffffff;
            }
            .summary-card h3 {
              margin: 0 0 8px;
              color: #42537c;
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
            }
            .summary-card .value {
              margin: 0;
              font-size: 26px;
              font-weight: 800;
              color: #172554;
            }
            .summary-card .sub {
              margin: 8px 0 0;
              color: #6b7a9d;
              font-size: 12px;
              line-height: 1.5;
            }
            .report-table {
              width: 100%;
              border-collapse: collapse;
              overflow: hidden;
              border: 1px solid #e4e8f2;
              border-radius: 14px;
            }
            .report-table th,
            .report-table td {
              padding: 10px 12px;
              border-bottom: 1px solid #eef2fb;
              text-align: left;
              font-size: 12px;
            }
            .report-table th {
              background: #f8fbff;
              color: #4c5d86;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
            }
            .report-table tr:last-child td {
              border-bottom: none;
            }
            .two-col {
              display: grid;
              grid-template-columns: 1.2fr 0.8fr;
              gap: 16px;
            }
            .note {
              border: 1px solid #e4e8f2;
              border-radius: 16px;
              padding: 16px;
              background: #ffffff;
            }
            .note-list {
              margin: 0;
              padding-left: 18px;
              color: #5f6f94;
              font-size: 12px;
              line-height: 1.7;
            }
            .footer {
              margin-top: 22px;
              padding-top: 12px;
              border-top: 1px solid #e4e8f2;
              color: #7b89ab;
              font-size: 11px;
              display: flex;
              justify-content: space-between;
              gap: 12px;
            }
            @media print {
              .section { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="report">
            <section class="hero">
              <div class="eyebrow">${escapeHtml(isSuperAdmin ? 'Executive Report' : 'Delivery Report')}</div>
              <h1>${escapeHtml(title)}</h1>
              <p class="subtitle">
                ${escapeHtml(
                  isSuperAdmin
                    ? 'Structured platform summary covering company growth, user footprint, account distribution, and top-performing companies.'
                    : 'Structured workspace summary covering project execution, task delivery, status distribution, and team performance.'
                )}
              </p>
              <div class="meta">
                <div class="meta-item">
                  <div class="meta-label">Period</div>
                  <div class="meta-value">${escapeHtml(periodLabel)}</div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">Range</div>
                  <div class="meta-value">${escapeHtml(rangeLabel)}</div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">Generated</div>
                  <div class="meta-value">${escapeHtml(generatedAt)}</div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">Prepared For</div>
                  <div class="meta-value">${escapeHtml(user?.name || 'System User')}</div>
                </div>
              </div>
            </section>

            <section class="section">
              <h2>Key Metrics</h2>
              <p class="section-copy">High-level indicators for the selected reporting window.</p>
              <div class="summary-grid">
                ${summaryCards.map(([label, value, sub]) => `
                  <div class="summary-card">
                    <h3>${escapeHtml(label)}</h3>
                    <p class="value">${escapeHtml(value)}</p>
                    <p class="sub">${escapeHtml(sub)}</p>
                  </div>
                `).join('')}
              </div>
            </section>

            <section class="section two-col">
              <div>
                <h2>${escapeHtml(isSuperAdmin ? 'Trend Overview' : 'Progress Overview')}</h2>
                <p class="section-copy">
                  ${escapeHtml(
                    isSuperAdmin
                      ? 'Period-by-period company and user growth values.'
                      : 'Period-by-period average project progress values.'
                  )}
                </p>
                ${renderPdfTable(
                  isSuperAdmin ? ['Period', 'Companies', 'Users'] : ['Period', 'Average Progress'],
                  trendRows
                )}
              </div>
              <div>
                <h2>${escapeHtml(isSuperAdmin ? 'Distribution' : 'Task Distribution')}</h2>
                <p class="section-copy">
                  ${escapeHtml(
                    isSuperAdmin
                      ? 'Current company counts grouped by account status.'
                      : 'Current visible task counts grouped by status.'
                  )}
                </p>
                ${renderPdfTable(
                  isSuperAdmin ? ['Status', 'Companies'] : ['Status', 'Tasks'],
                  distributionRows
                )}
              </div>
            </section>

            <section class="section two-col">
              <div>
                <h2>${escapeHtml(isSuperAdmin ? 'Ranking Table' : 'Team Performance')}</h2>
                <p class="section-copy">
                  ${escapeHtml(
                    isSuperAdmin
                      ? 'Top companies ranked by users, projects, and calculated activity score.'
                      : 'Top contributors ranked by assigned tasks, completed tasks, and delivery score.'
                  )}
                </p>
                ${renderPdfTable(
                  isSuperAdmin
                    ? ['Rank', 'Company', 'Users', 'Projects', 'Activity']
                    : ['Rank', 'Member', 'Assigned', 'Completed', 'Score'],
                  rankingRows.length ? rankingRows : [[1, isSuperAdmin ? 'No companies available' : 'No team activity', '-', '-', '-']]
                )}
              </div>
              <div>
                <h2>Management Notes</h2>
                <p class="section-copy">Quick reference details for decision making and audit context.</p>
                <div class="note">
                  <ul class="note-list">
                    ${detailRows.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join('')}
                  </ul>
                </div>
              </div>
            </section>

            <div class="footer">
              <span>${escapeHtml(title)}</span>
              <span>${escapeHtml(periodLabel)}</span>
            </div>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => window.print(), 250);
            };
          </script>
        </body>
      </html>
    `;

    const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!reportWindow) return;
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
  };

  return (
    <div className="mx-auto flex max-w-full flex-col gap-6">
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{isSuperAdmin ? 'Platform Analytics' : 'Project Reports'}</h1>
          <p className="page-subtitle">
            {isSuperAdmin
              ? 'Analyze company growth, user footprint, and platform health using live data.'
              : 'Track project progress, task distribution, and team delivery metrics using live workspace data.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center rounded-2xl bg-surface-100 p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setPeriod(option.key)}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-medium transition-all',
                  period === option.key
                    ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-900 dark:text-white'
                    : 'text-surface-500 hover:text-surface-700'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button className="btn-secondary btn-md" onClick={exportPdf}>
            <Download size={15} /> Export PDF
          </button>
        </div>
      </div>

      {isSuperAdmin ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReportCard
              title="Companies"
              value={loadingCompanies ? '...' : superAdminData.metrics.companies}
              sub={`${superAdminData.metrics.newCompanies} created in selected period`}
              icon={<Building2 size={20} />}
              accent="#3366ff"
              onClick={() => navigate('/companies')}
            />
            <ReportCard
              title="User Footprint"
              value={loadingCompanies ? '...' : superAdminData.metrics.users}
              sub="Current users across listed companies"
              icon={<Users size={20} />}
              accent="#7c3aed"
              onClick={() => navigate('/users')}
            />
            <ReportCard
              title="Avg Users / Company"
              value={loadingCompanies ? '...' : superAdminData.metrics.avgUsersPerCompany}
              sub="Average size of each company account"
              icon={<TrendingUp size={20} />}
              accent="#10b981"
              onClick={() => navigate('/companies')}
            />
            <ReportCard
              title="Tracked Companies"
              value={superAdminData.topCompanies.length}
              sub="High-activity companies shown below"
              icon={<FolderKanban size={20} />}
              accent="#f59e0b"
              onClick={() => navigate('/companies')}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="card p-5 xl:col-span-2">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-surface-900 dark:text-white">Company & User Growth</h3>
                  <p className="text-xs text-surface-400">Cumulative platform footprint over the selected period</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 text-brand-600">
                    <div className="h-2 w-2 rounded-full bg-brand-600" /> Companies
                  </div>
                  <div className="flex items-center gap-1.5 text-violet-600">
                    <div className="h-2 w-2 rounded-full bg-violet-600" /> Users
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={superAdminData.growthData} margin={{ left: -20 }}>
                  <defs>
                    <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3366ff" stopOpacity={0.16} />
                      <stop offset="95%" stopColor="#3366ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.16} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e8f2" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e4e8f2', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="companies" stroke="#3366ff" strokeWidth={3} fill="url(#compGrad)" />
                  <Area type="monotone" dataKey="users" stroke="#7c3aed" strokeWidth={2.5} fill="url(#userGrad)" strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <div className="mb-6">
                <h3 className="font-display font-bold text-surface-900 dark:text-white">Company Status Distribution</h3>
                <p className="text-xs text-surface-400">Current companies by account status</p>
              </div>

              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={superAdminData.companyStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {superAdminData.companyStatusData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 space-y-2">
                {superAdminData.companyStatusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-medium text-surface-600 dark:text-surface-400">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-surface-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="card p-5">
              <h3 className="mb-6 font-display font-bold text-surface-900 dark:text-white">Company Performance Index</h3>
              <div className="space-y-5">
                {superAdminData.topCompanies.length > 0 ? superAdminData.topCompanies.map((company, index) => (
                  <div key={company.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-surface-400">0{index + 1}</span>
                        <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">{company.name}</span>
                      </div>
                      <span className="text-xs font-medium text-surface-500">{company.activity}% Activity</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${company.activity}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-surface-400">
                      <span>{company.usersCount || 0} users</span>
                      <span>{company.projectsCount || 0} projects</span>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-surface-400">No companies available yet.</p>
                )}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="mb-6 font-display font-bold text-surface-900 dark:text-white">Platform Summary</h3>
              <div className="space-y-4">
                <div className="rounded-2xl bg-surface-50 p-4 dark:bg-surface-800/40">
                  <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">Selected Period</p>
                  <p className="mt-1 text-xs text-surface-400">{PERIOD_OPTIONS.find((item) => item.key === period)?.label}</p>
                </div>
                <div className="rounded-2xl bg-surface-50 p-4 dark:bg-surface-800/40">
                  <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">Most Common Status</p>
                  <p className="mt-1 text-xs text-surface-400">
                    {superAdminData.companyStatusData[0]?.name || 'No company status data'}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-50 p-4 dark:bg-surface-800/40">
                  <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">Top Company</p>
                  <p className="mt-1 text-xs text-surface-400">
                    {superAdminData.topCompanies[0]?.name || 'No company data'}
                  </p>
                </div>
                <button className="btn-primary mt-2 w-full" onClick={exportPdf}>Open Printable Report</button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReportCard
              title="Active Projects"
              value={workspaceData.metrics.activeProjects}
              sub="Projects active in the selected scope"
              icon={<FolderKanban size={20} />}
              accent="#3366ff"
              onClick={() => navigate('/projects?status=active')}
            />
            <ReportCard
              title="Average Progress"
              value={`${workspaceData.metrics.avgProjectProgress}%`}
              sub="Mean completion across visible projects"
              icon={<TrendingUp size={20} />}
              accent="#10b981"
              onClick={() => navigate('/projects')}
            />
            <ReportCard
              title="Completed Work"
              value={workspaceData.metrics.completedTasks}
              sub="Done project and quick tasks in the selected scope"
              icon={<CheckCircle2 size={20} />}
              accent="#7c3aed"
              onClick={() => navigate('/my-tasks?filter=done')}
            />
            <ReportCard
              title="Average Rating"
              value={`${workspaceData.metrics.averageRating}/5`}
              sub="Reviewer rating across approved task completions"
              icon={<Users size={20} />}
              accent="#f59e0b"
              onClick={() => navigate('/tasks')}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="card p-5 xl:col-span-2">
              <div className="mb-6">
                <h3 className="font-display font-bold text-surface-900 dark:text-white">Project Progress</h3>
                <p className="text-xs text-surface-400">Average completion trend across visible projects</p>
              </div>

              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={workspaceData.progressData} margin={{ left: -20 }}>
                  <defs>
                    <linearGradient id="reportsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3366ff" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3366ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e8f2" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e4e8f2', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="progress" stroke="#3366ff" strokeWidth={3} fill="url(#reportsGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <div className="mb-6">
                <h3 className="font-display font-bold text-surface-900 dark:text-white">Task Status</h3>
                <p className="text-xs text-surface-400">Current distribution of visible tasks</p>
              </div>

              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workspaceData.taskStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={82}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {workspaceData.taskStatusData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                {workspaceData.taskStatusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] font-medium text-surface-500">{item.name}</span>
                    </div>
                    <span className="text-[11px] font-bold text-surface-800 dark:text-surface-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="card p-5">
              <div className="mb-6 text-center">
                <h3 className="font-display font-bold text-surface-900 dark:text-white">Task Priority</h3>
                <p className="text-xs text-surface-400">Count of visible tasks by priority level</p>
              </div>

              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={workspaceData.priorityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e8f2" />
                  <XAxis dataKey="priority" tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="count" fill="#3366ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <div className="mb-6">
                <h3 className="font-display font-bold text-surface-900 dark:text-white">Team Performance</h3>
                <p className="text-xs text-surface-400">Completion score based on assigned and completed visible tasks</p>
              </div>

              <div className="space-y-5">
                {workspaceData.assigneeStats.length > 0 ? workspaceData.assigneeStats.map((member, index) => (
                  <div key={member.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-surface-400">0{index + 1}</span>
                        <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">{member.name}</span>
                      </div>
                      <span className="text-xs font-medium text-surface-500">{member.score}% Score</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${member.score}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-surface-400">
                      <span>{member.completed}/{member.assigned} completed</span>
                      <span>{member.averageRating ? `${member.averageRating}/5 rating` : `${differenceInCalendarDays(new Date(), range.start) + 1} day window`}</span>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-50 dark:bg-surface-800">
                      <TrendingUp size={24} className="text-brand-500" />
                    </div>
                    <h3 className="font-display font-bold text-surface-900 dark:text-white">No team activity</h3>
                    <p className="mt-2 max-w-[280px] text-sm text-surface-400">
                      Team contribution metrics will appear here once tasks are assigned and updated.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsPage;
