import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, CheckCircle2, Clock, AlertTriangle, ArrowRight,
  FolderKanban, Users, BarChart3, Plus, Zap, Building2, Activity
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn, formatDate, formatRelativeTime, getProgressColor, isDueDateOverdue } from '../../utils/helpers';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { companiesService, activityService } from '../../services/api';
import api from '../../services/api';
import { UserAvatar, AvatarGroup } from '../../components/UserAvatar';
import { ProgressBar } from '../../components/ui';
import { TaskCard } from '../../components/TaskCard';
import { ReassignRequestsPanel } from '../../components/ReassignRequestsPanel';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildChartDataFromTasks(tasks: { createdAt?: string; updatedAt?: string; status?: string }[]): { day: string; completed: number; added: number }[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const dayLabel = DAY_LABELS[d.getDay()];
    const added = tasks.filter(t => {
      const created = t.createdAt ? new Date(t.createdAt) : null;
      return created && created >= d && created < next;
    }).length;
    const completed = tasks.filter(t => {
      if (t.status !== 'done') return false;
      const updated = t.updatedAt ? new Date(t.updatedAt) : null;
      return updated && updated >= d && updated < next;
    }).length;
    return { day: dayLabel, completed, added };
  });
}

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  trend?: number;
  delay?: number;
  onClick?: () => void;
}> = ({ icon, label, value, sub, color, trend, delay = 0, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    onClick={onClick}
    className={cn(
      'card p-4 sm:p-5',
      onClick && 'cursor-pointer hover:shadow-card-hover transition-all'
    )}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      {trend !== undefined && (
        <span className={cn('text-xs font-medium flex items-center gap-0.5', trend >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
          <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="font-display font-bold text-2xl text-surface-900 dark:text-white mb-0.5">{value}</p>
    <p className="text-sm text-surface-500 dark:text-surface-400">{label}</p>
    {sub && <p className="text-xs text-surface-400 mt-0.5">{sub}</p>}
  </motion.div>
);

type CompanyRow = { id: string; name: string; usersCount?: number; projectsCount?: number; status: string; color?: string; createdAt?: string };
type ActivityRow = { id: string; type: string; description: string; createdAt: string };

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { projects, tasks, users, quickTasks } = useAppStore();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [platformActivity, setPlatformActivity] = useState<ActivityRow[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [overviewTasks, setOverviewTasks] = useState<any[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (isSuperAdmin) {
      setCompaniesLoading(true);
      companiesService.getAll()
        .then((res) => {
          const data = res.data?.data ?? res.data ?? [];
          setCompanies(Array.isArray(data) ? data : []);
        })
        .catch(() => setCompanies([]))
        .finally(() => setCompaniesLoading(false));
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    const canViewActivity = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
    if (canViewActivity) {
      setActivityLoading(true);
      activityService.getRecent(20)
        .then((res) => {
          const data = res.data?.data ?? res.data ?? [];
          setPlatformActivity(Array.isArray(data) ? data : []);
        })
        .catch(() => setPlatformActivity([]))
        .finally(() => setActivityLoading(false));
    }

    if (!isSuperAdmin) {
      setOverviewLoading(true);
      api.get('/tasks/overview')
        .then(res => setOverviewTasks(res.data?.data || []))
        .catch(console.error)
        .finally(() => setOverviewLoading(false));
    }
  }, []);

  const activeProjectTasks = useMemo(() => {
    return tasks.filter(t => {
      const p = projects.find(proj => proj.id === t.projectId);
      return p ? p.status !== 'archived' : true;
    });
  }, [tasks, projects]);

  const chartData = useMemo(() => buildChartDataFromTasks([...activeProjectTasks, ...quickTasks]), [activeProjectTasks, quickTasks]);

  const isManagerOrAdmin = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');

  const myTasks = useMemo(() => {
    const uid = user?.id || '';
    const filteredTasks = activeProjectTasks.filter(t => (t.assigneeIds || []).includes(uid) || t.reporterId === uid);
    const filteredQuickTasks = quickTasks.filter(t => (t.assigneeIds || []).includes(uid) || t.reporterId === uid || t.createdBy === uid);
    return [
      ...filteredTasks.filter(t => t.status !== 'done'),
      ...filteredQuickTasks.filter(t => t.status !== 'done')
    ];
  }, [activeProjectTasks, quickTasks, user?.id]);

  const overdueTasks = isManagerOrAdmin
    ? [
      ...activeProjectTasks.filter(t => isDueDateOverdue(t.dueDate, t.status)),
      ...quickTasks.filter(t => isDueDateOverdue(t.dueDate, t.status))
    ]
    : [
      ...activeProjectTasks.filter(t => t.assigneeIds?.includes(user?.id || '') && isDueDateOverdue(t.dueDate, t.status)),
      ...quickTasks.filter(t => (t.assigneeIds || []).includes(user?.id || '') && isDueDateOverdue(t.dueDate, t.status))
    ];

  const completedThisWeek = isManagerOrAdmin
    ? [
      ...activeProjectTasks.filter(t => t.status === 'done'),
      ...quickTasks.filter(t => t.status === 'done')
    ]
    : [
      ...activeProjectTasks.filter(t => t.assigneeIds?.includes(user?.id || '') && t.status === 'done'),
      ...quickTasks.filter(t => (t.assigneeIds || []).includes(user?.id || '') && t.status === 'done')
    ];

  const activeProjects = projects.filter(p => p.status === 'active');

  const planCounts = isSuperAdmin && companies.length > 0
    ? (() => {
      const byStatus = companies.reduce<Record<string, number>>((acc, c) => {
        acc[c.status || 'active'] = (acc[c.status || 'active'] || 0) + 1;
        return acc;
      }, {});
      const total = companies.length;
      return [
        { label: 'Active', count: byStatus['active'] ?? 0, color: 'bg-indigo-500', percent: total ? Math.round(((byStatus['active'] ?? 0) / total) * 100) : 0 },
        { label: 'Trial', count: byStatus['trial'] ?? 0, color: 'bg-brand-500', percent: total ? Math.round(((byStatus['trial'] ?? 0) / total) * 100) : 0 },
        { label: 'Suspended', count: byStatus['suspended'] ?? 0, color: 'bg-amber-500', percent: total ? Math.round(((byStatus['suspended'] ?? 0) / total) * 100) : 0 },
      ].filter(p => p.count > 0);
    })()
    : null;

  const platformEvents = useMemo(() => {
    return platformActivity.slice(0, 4).map((item) => {
      const type = String(item.type || '').toLowerCase();
      const isAlert = type.includes('error') || type.includes('suspend') || type.includes('delete');
      const isGrowth = type.includes('create') || type.includes('signup') || type.includes('register');
      const isUpgrade = type.includes('update') || type.includes('upgrade');

      return {
        id: item.id,
        description: item.description || 'Platform activity recorded',
        time: formatRelativeTime(item.createdAt),
        icon: isAlert ? <AlertTriangle size={12} /> : isUpgrade ? <TrendingUp size={12} /> : <Plus size={12} />,
        color: isAlert ? 'bg-rose-500' : isUpgrade ? 'bg-brand-500' : 'bg-emerald-500',
      };
    });
  }, [platformActivity]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (isSuperAdmin) {
    return (
      <div className="max-w-full mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="page-title text-2xl sm:text-3xl">
              Platform Overview, {user?.name.split(' ')[0]} 👋
            </h1>
            <p className="page-subtitle text-xs sm:text-sm">
              Monitor systems, companies, and platform-wide metrics.
            </p>
          </motion.div>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            onClick={() => navigate('/companies')}
            className="btn-primary btn-md w-full sm:w-auto"
          >
            <Plus size={16} />
            Add Company
          </motion.button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Building2 size={20} />} label="Total Companies" value={companiesLoading ? '…' : companies.length} sub="active on platform" color="#3366ff" delay={0} onClick={() => navigate('/companies')} />
          <StatCard icon={<Users size={20} />} label="Total Users" value={companiesLoading ? '…' : companies.reduce((n, c) => n + (c.usersCount ?? 0), 0)} sub="across all companies" color="#10b981" delay={0.05} onClick={() => navigate('/users')} />
          <StatCard icon={<Activity size={20} />} label="System Uptime" value="99.9%" sub="all regions healthy" color="#f59e0b" trend={0} delay={0.1} onClick={() => navigate('/logs?type=info')} />
          <StatCard icon={<Zap size={20} />} label="Active Modules" value="12/12" sub="no reported incidents" color="#7c3aed" trend={0} delay={0.15} onClick={() => navigate('/logs')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-semibold text-surface-900 dark:text-white">User Growth</h3>
                  <p className="text-xs text-surface-400">New registration activity</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-surface-500">
                    <span className="w-3 h-1 bg-brand-500 rounded-full inline-block" />
                    New Users
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3366ff" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3366ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8896b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8896b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tw-bg-opacity, #fff)',
                      border: '1px solid #e4e8f2',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                  />
                  <Area type="monotone" dataKey="added" stroke="#3366ff" strokeWidth={2} fill="url(#colorGrowth)" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-surface-900 dark:text-white">Recent Companies</h3>
                <button onClick={() => navigate('/companies')} className="btn-ghost btn-sm text-xs text-brand-600">View all <ArrowRight size={12} /></button>
              </div>
              <div className="space-y-4">
                {(companies.slice(0, 5)).map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-surface-700 flex items-center justify-center font-bold text-xs text-brand-600 shadow-sm">{(c.name || '')[0]}</div>
                      <div>
                        <p className="text-sm font-semibold text-surface-900 dark:text-white">{c.name}</p>
                        <p className="text-[10px] text-surface-400">{c.createdAt ? formatDate(c.createdAt) : '—'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-surface-700 dark:text-surface-300">—</p>
                      <p className="text-[10px] text-emerald-600 font-medium">{c.status || 'Active'}</p>
                    </div>
                  </div>
                ))}
                {companies.length === 0 && !companiesLoading && <p className="text-sm text-surface-400 py-2">No companies yet</p>}
              </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Support Queue</h3>
              <div className="space-y-3">
                {[
                  { user: 'Bhavin Patel', msg: 'Billing issue with Enterprise plan', time: '12m ago', priority: 'high' },
                  { user: 'Krupali Shah', msg: 'Unable to invite new members', time: '45m ago', priority: 'medium' },
                  { user: 'Meet Soni', msg: 'API integration documentation query', time: '2h ago', priority: 'low' },
                ].map((ticket, i) => (
                  <div key={i} className="p-3 rounded-xl border border-surface-100 dark:border-surface-800 hover:border-brand-500/30 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase font-bold text-surface-400">{ticket.user}</span>
                      <span className="text-[10px] font-medium text-surface-400">{ticket.time}</span>
                    </div>
                    <p className="text-xs font-medium text-surface-800 dark:text-surface-200 line-clamp-1">{ticket.msg}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/support')} className="btn-secondary w-full mt-4 text-xs">Go to Support Desk</button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">System Alerts</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold">API Latency High</p>
                    <p className="text-[10px] opacity-80">Region us-east-1 experiencing spikes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold">Backup Completed</p>
                    <p className="text-[10px] opacity-80">Full database backup successful</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* No header actions needed for dashboard as per request */}
      <div className="pt-2" />

      {/* Stats */}
      {user?.role === 'super_admin' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Building2 size={20} />} label="Total Companies" value={companies.length} sub="active tenants" color="#3366ff" delay={0} />
          <StatCard icon={<Users size={20} />} label="Total Users" value={users.length} sub="across platform" color="#10b981" delay={0.05} />
          <StatCard icon={<Activity size={20} />} label="Active Users" value={users.filter(u => u.isActive).length} sub="last 24 hours" color="#f59e0b" delay={0.1} />
          <StatCard icon={<AlertTriangle size={20} />} label="System Alerts" value="—" sub="need attention" color="#f43f5e" delay={0.15} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<FolderKanban size={20} />} label="Active Projects" value={activeProjects.length} sub="across workspace" color="#3366ff" trend={12} delay={0} onClick={() => navigate('/projects?status=active')} />
          <StatCard icon={<CheckCircle2 size={20} />} label={isManagerOrAdmin ? "Total Tasks Done" : "Tasks Completed"} value={completedThisWeek.length} sub={isManagerOrAdmin ? "all projects" : "this week"} color="#10b981" trend={8} delay={0.05} onClick={() => navigate(isManagerOrAdmin ? '/tasks?filter=done' : '/my-tasks?filter=done')} />
          <StatCard icon={<Clock size={20} />} label={isManagerOrAdmin ? "Workspace Open Tasks" : "My Open Tasks"} value={isManagerOrAdmin ? (activeProjectTasks.length + quickTasks.length) - completedThisWeek.length : myTasks.length} sub={isManagerOrAdmin ? "active now" : "assigned to me"} color="#f59e0b" trend={-3} delay={0.1} onClick={() => navigate(isManagerOrAdmin ? '/tasks?filter=active' : '/tasks?filter=active&mine=true')} />
          <StatCard icon={<AlertTriangle size={20} />} label="Overdue Tasks" value={overdueTasks.length} sub="need attention" color="#f43f5e" trend={-15} delay={0.15} onClick={() => navigate(isManagerOrAdmin ? '/tasks?filter=overdue' : '/my-tasks?filter=overdue')} />
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Activity chart + Projects */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold text-surface-900 dark:text-white">
                  {user?.role === 'super_admin' ? 'Platform Activity' : 'Task Activity'}
                </h3>
                <p className="text-xs text-surface-400">Last 7 days</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-surface-500">
                  <span className="w-3 h-1 bg-brand-500 rounded-full inline-block" />
                  Completed
                </span>
                <span className="flex items-center gap-1.5 text-surface-500">
                  <span className="w-3 h-1 bg-surface-300 dark:bg-surface-600 rounded-full inline-block" />
                  Added
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3366ff" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3366ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8896b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8896b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tw-bg-opacity, #fff)',
                    border: '1px solid #e4e8f2',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                  }}
                />
                <Area type="monotone" dataKey="completed" stroke="#3366ff" strokeWidth={2} fill="url(#colorCompleted)" />
                <Area type="monotone" dataKey="added" stroke="#e4e8f2" strokeWidth={1.5} fill="none" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Active Projects */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 pb-3">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white">Active Projects</h3>
              <button
                onClick={() => navigate('/projects')}
                className="btn-ghost btn-sm text-xs text-brand-600 dark:text-brand-400"
              >
                View all <ArrowRight size={12} />
              </button>
            </div>
            <div className="divide-y divide-surface-50 dark:divide-surface-800">
              {user?.role === 'super_admin' ? (
                companies.slice(0, 5).map((company, i) => (
                  <motion.div
                    key={company.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    onClick={() => navigate(`/companies/${company.id}`)}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: company.color || '#3366ff' }}>
                      {(company.name || '')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{company.name}</p>
                      <p className="text-xs text-surface-400 mt-1">{company.usersCount ?? 0} users • {company.projectsCount ?? 0} projects</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                        (company.status || 'Active') === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      )}>{company.status || 'Active'}</span>
                      <ArrowRight size={14} className="text-surface-300" />
                    </div>
                  </motion.div>
                ))
              ) : (
                activeProjects.slice(0, 5).map((project, i) => {
                  const assignees = users.filter(u => project.members.includes(u.id));
                  const projectTasks = tasks.filter(t => t.projectId === project.id);
                  const projectOverdueCount = projectTasks.filter(t => isDueDateOverdue(t.dueDate, t.status)).length;

                  return (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: project.color }}>
                        {project.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{project.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <ProgressBar value={project.progress} size="sm" color={getProgressColor(project.progress)} className="w-20 sm:w-24" />
                          <span className="text-xs text-surface-400">{project.progress}%</span>
                          {isManagerOrAdmin && projectOverdueCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded ml-1">
                              <AlertTriangle size={10} />
                              {projectOverdueCount} Overdue
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-surface-500">{project.completedTasksCount}/{project.tasksCount}</p>
                          <p className="text-[11px] text-surface-400">tasks</p>
                        </div>
                        <AvatarGroup users={assignees} max={3} size="xs" />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>

        {/* Right: My tasks + Activity Feed */}
        <div className="space-y-6">
          {['admin', 'manager', 'team_leader'].includes(user?.role || '') && (
            <ReassignRequestsPanel />
          )}
          {/* Team Tasks Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card overflow-hidden flex flex-col"
          >
            <div className="bg-surface-50 dark:bg-surface-950/50 px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-widest">
                Team Tasks Overview
              </h3>
              <span className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-950/30 px-2 py-0.5 rounded-full">
                In-Progress
              </span>
            </div>

            <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-hide">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-50 dark:bg-surface-900 text-surface-500 dark:text-surface-400 font-semibold tracking-wide uppercase text-[10px] sticky top-0 border-b border-surface-100 dark:border-surface-800">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Employee</th>
                    <th className="px-3 py-2 font-semibold">Task</th>
                    <th className="px-3 py-2 font-semibold hidden sm:table-cell">Project</th>
                    <th className="px-3 py-2 font-semibold hidden md:table-cell">Type</th>
                    <th className="px-3 py-2 font-semibold text-center">Status</th>
                    <th className="px-3 py-2 font-semibold text-right hidden lg:table-cell">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-50 dark:divide-surface-800">
                  {overviewLoading ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-surface-400">Loading tasks...</td></tr>
                  ) : overviewTasks.length > 0 ? (
                    overviewTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-surface-800 dark:text-surface-200 whitespace-nowrap">{task.assignedTo}</td>
                        <td className="px-3 py-2.5 text-surface-800 dark:text-surface-200 font-medium truncate max-w-[120px] sm:max-w-[150px]">{task.title}</td>
                        <td className="px-3 py-2.5 text-surface-500 dark:text-surface-400 truncate max-w-[100px] hidden sm:table-cell">{task.projectName}</td>
                        <td className="px-3 py-2.5 text-surface-500 dark:text-surface-400 capitalize hidden md:table-cell">{task.type}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={cn(
                            'px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wide border',
                            (task.status === 'in_progress') && 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
                            (task.status === 'done' || task.status === 'completed') && 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
                            (task.status === 'todo' || task.status === 'pending' || task.status === 'backlog') && 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                          )}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-surface-500 dark:text-surface-400 whitespace-nowrap hidden lg:table-cell">
                          {task.dueDate ? formatDate(task.dueDate) : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-surface-400">No in-progress tasks found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-surface-100 dark:border-surface-800 flex justify-end bg-surface-50 dark:bg-surface-950/50">
              <button
                onClick={() => navigate('/tasks')}
                className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-800 transition-colors flex items-center gap-1"
              >
                View All Tasks &rarr;
              </button>
            </div>
          </motion.div>

          {/* Platform Events */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="card p-4 sm:p-5"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white">Platform Events</h3>
              {platformEvents.length > 0 && (
                <span className="text-[11px] font-medium text-surface-400 whitespace-nowrap">
                  Latest {platformEvents.length}
                </span>
              )}
            </div>
            <div className="space-y-3 sm:space-y-4">
              {(platformEvents.length ? platformEvents : []).map((event) => (
                <div key={event.id} className="flex items-start gap-2.5 sm:gap-3">
                  <div className={cn("w-7 h-7 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-white flex-shrink-0 mt-0.5", event.color)}>
                    {event.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-[13px] leading-5 text-surface-700 dark:text-surface-300 break-words">
                      {event.description}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-surface-400 mt-1">{event.time}</p>
                  </div>
                </div>
              ))}
              {!platformEvents.length && !activityLoading && (
                <p className="text-sm text-surface-400">No recent platform events found.</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
