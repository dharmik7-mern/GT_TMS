import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, CheckCircle2, Clock, AlertTriangle, ArrowRight,
  FolderKanban, Building2, Activity
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn, formatDate, formatRelativeTime, getProgressColor, isDueDateOverdue, isTaskOverdue } from '../../utils/helpers';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { companiesService, activityService } from '../../services/api';

import { AvatarGroup } from '../../components/UserAvatar';
import { ProgressBar } from '../../components/ui';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Builds 7-day chart points using task creation/completion timestamps.
function buildChartDataFromTasks(tasks: { createdAt?: string; updatedAt?: string; status?: string }[]): { day: string; completed: number; added: number }[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const dayLabel = DAY_LABELS[d.getDay()];
    const added = tasks.filter((t) => {
      const created = t.createdAt ? new Date(t.createdAt) : null;
      return created && created >= d && created < next;
    }).length;
    const completed = tasks.filter((t) => {
      if (t.status !== 'done') return false;
      const updated = t.updatedAt ? new Date(t.updatedAt) : null;
      return updated && updated >= d && updated < next;
    }).length;
    return { day: dayLabel, completed, added };
  });
}

type DailyTaskSection = 'todo' | 'in_progress' | 'done';

// Normalizes raw task statuses into the 3 dashboard buckets.
function getDailyTaskSection(status?: string): DailyTaskSection {
  if (status === 'done') return 'done';
  if (status === 'in_progress') return 'in_progress';
  return 'todo';
}

function getDailyTaskSectionLabel(section: DailyTaskSection): string {
  if (section === 'done') return 'Done';
  if (section === 'in_progress') return 'In Progress';
  return 'To Do';
}

// Reusable top metric card used across dashboard KPIs.
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
    className={cn('card p-4 sm:p-5', onClick && 'cursor-pointer hover:shadow-card-hover transition-all')}
  >
    <div className="mb-3 flex items-start justify-between">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      {trend !== undefined && (
        <span className={cn('flex items-center gap-0.5 text-xs font-medium', trend >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
          <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="mb-0.5 font-display text-2xl font-bold text-surface-900 dark:text-white">{value}</p>
    <p className="text-sm text-surface-500 dark:text-surface-400">{label}</p>
    {sub && <p className="mt-0.5 text-xs text-surface-400">{sub}</p>}
  </motion.div>
);

type CompanyRow = {
  id: string;
  name: string;
  usersCount?: number;
  projectsCount?: number;
  status: string;
  color?: string;
  createdAt?: string;
};
type ActivityRow = { id: string; type: string; description: string; createdAt: string };
type DailyProjectRow = {
  id: string;
  name: string;
  color: string;
  status: string;
  progress: number;
  tasksCount: number;
  completedTasksCount: number;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority?: string;
    dueDate?: string;
    assigneeNames: string[];
  }>;
};
type DailyTaskRow = DailyProjectRow['tasks'][number];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { projects, tasks, users, quickTasks } = useAppStore();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [platformActivity, setPlatformActivity] = useState<ActivityRow[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [selectedDailyProjectId, setSelectedDailyProjectId] = useState<string>('');

  const isSuperAdmin = user?.role === 'super_admin';

  // Super admins get company-level stats for platform overview.
  useEffect(() => {
    if (isSuperAdmin) {
      setCompaniesLoading(true);
      companiesService
        .getAll()
        .then((res) => {
          const data = res.data?.data ?? res.data ?? [];
          setCompanies(Array.isArray(data) ? data : []);
        })
        .catch(() => setCompanies([]))
        .finally(() => setCompaniesLoading(false));
    }
  }, [isSuperAdmin]);

  // Admin/manager roles can view recent platform activity feed.
  useEffect(() => {
    const canViewActivity = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
    if (canViewActivity) {
      setActivityLoading(true);
      activityService
        .getRecent(20)
        .then((res) => {
          const data = res.data?.data ?? res.data ?? [];
          setPlatformActivity(Array.isArray(data) ? data : []);
        })
        .catch(() => setPlatformActivity([]))
        .finally(() => setActivityLoading(false));
    }
  }, [isSuperAdmin, user?.role]);

  // Only include tasks from non-archived projects in dashboard stats.
  const activeProjectTasks = useMemo(() => {
    return tasks.filter((t) => {
      const p = projects.find((proj) => proj.id === t.projectId);
      return p ? p.status !== 'archived' : true;
    });
  }, [tasks, projects]);

  const chartData = useMemo(() => buildChartDataFromTasks([...activeProjectTasks, ...quickTasks]), [activeProjectTasks, quickTasks]);

  const isManagerOrAdmin = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');

  // Non-manager users see their own actionable tasks in personal counters.
  const myTasks = useMemo(() => {
    const uid = user?.id || '';
    const filteredTasks = activeProjectTasks.filter((t) => (t.assigneeIds || []).includes(uid) || t.reporterId === uid);
    const filteredQuickTasks = quickTasks.filter((t) => (t.assigneeIds || []).includes(uid) || t.reporterId === uid || t.createdBy === uid);
    return [...filteredTasks.filter((t) => t.status !== 'done'), ...filteredQuickTasks.filter((t) => t.status !== 'done')];
  }, [activeProjectTasks, quickTasks, user?.id]);

  const overdueTasks = isManagerOrAdmin
    ? [...activeProjectTasks.filter((t) => isDueDateOverdue(t.dueDate, t.status)), ...quickTasks.filter((t) => isDueDateOverdue(t.dueDate, t.status))]
    : [
        ...activeProjectTasks.filter((t) => t.assigneeIds?.includes(user?.id || '') && isDueDateOverdue(t.dueDate, t.status)),
        ...quickTasks.filter((t) => (t.assigneeIds || []).includes(user?.id || '') && isDueDateOverdue(t.dueDate, t.status)),
      ];

  const completedThisWeek = isManagerOrAdmin
    ? [...activeProjectTasks.filter((t) => t.status === 'done'), ...quickTasks.filter((t) => t.status === 'done')]
    : [
        ...activeProjectTasks.filter((t) => t.assigneeIds?.includes(user?.id || '') && t.status === 'done'),
        ...quickTasks.filter((t) => (t.assigneeIds || []).includes(user?.id || '') && t.status === 'done'),
      ];

  const activeProjects = projects.filter((p) => p.status === 'active');
  const canSeeAllDailyProjects = true; // Everyone can see all active projects now

  // Daily task panel data: project list + task rows (role-scoped).
  const dailyProjects = useMemo<DailyProjectRow[]>(() => {
    const userId = user?.id || '';
    const visibleProjects = canSeeAllDailyProjects
      ? activeProjects
      : activeProjects.filter((project) =>
          tasks.some((task) =>
            task.projectId === project.id &&
            ((task.assigneeIds || []).includes(userId) || task.reporterId === userId)
          )
        );

    return visibleProjects.map((project) => {
      const projectTasks = tasks.filter((task) => {
        const isSameProject = task.projectId === project.id;
        if (!isSameProject) return false;
        if (canSeeAllDailyProjects) return true;
        return (task.assigneeIds || []).includes(userId) || task.reporterId === userId;
      });
      const completedTasksCount = projectTasks.filter((task) => task.status === 'done').length;
      const taskRows = projectTasks.slice(0, 12).map((task) => {
        const assigneeNames = (task.assigneeIds || [])
          .map((assigneeId) => users.find((item) => item.id === assigneeId)?.name)
          .filter(Boolean) as string[];

        return {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          assigneeNames,
        };
      });

      return {
        id: project.id,
        name: project.name,
        color: project.color || '#3366ff',
        status: project.status,
        progress: project.progress,
        tasksCount: projectTasks.length,
        completedTasksCount,
        tasks: taskRows,
      };
    });
  }, [activeProjects, canSeeAllDailyProjects, tasks, user?.id, users]);

  const selectedDailyProject = dailyProjects.find((project) => project.id === selectedDailyProjectId) || dailyProjects[0] || null;

  // Splits selected project tasks into To Do / In Progress / Done sections.
  const selectedDailyProjectSections = useMemo(() => {
    const grouped: Record<DailyTaskSection, DailyTaskRow[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };

    if (!selectedDailyProject) return grouped;

    selectedDailyProject.tasks.forEach((task) => {
      grouped[getDailyTaskSection(task.status)].push(task);
    });

    return grouped;
  }, [selectedDailyProject]);

  // Keeps selected project valid when visible project list changes.
  useEffect(() => {
    if (!dailyProjects.length) {
      setSelectedDailyProjectId('');
      return;
    }

    const exists = dailyProjects.some((project) => project.id === selectedDailyProjectId);
    if (!exists) {
      setSelectedDailyProjectId(dailyProjects[0].id);
    }
  }, [dailyProjects, selectedDailyProjectId]);

  // Maps backend activity rows to compact UI event cards.
  const platformEvents = useMemo(() => {
    return platformActivity.slice(0, 4).map((item) => {
      const type = String(item.type || '').toLowerCase();
      const isAlert = type.includes('error') || type.includes('suspend') || type.includes('delete');
      const isUpgrade = type.includes('update') || type.includes('upgrade');

      return {
        id: item.id,
        description: item.description || 'Platform activity recorded',
        time: formatRelativeTime(item.createdAt),
        icon: isAlert ? <AlertTriangle size={12} /> : isUpgrade ? <TrendingUp size={12} /> : <Activity size={12} />,
        color: isAlert ? 'bg-rose-500' : isUpgrade ? 'bg-brand-500' : 'bg-emerald-500',
      };
    });
  }, [platformActivity]);

  return (
    <div className="mx-auto max-w-full space-y-6">
      <div className="pt-2" />

      {/* Top KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<FolderKanban size={20} />} label="Active Projects" value={activeProjects.length} sub="across workspace" color="#3366ff" trend={12} delay={0} onClick={() => navigate('/projects?status=active')} />
        <StatCard icon={<CheckCircle2 size={20} />} label={isManagerOrAdmin ? 'Total Tasks Done' : 'Tasks Completed'} value={completedThisWeek.length} sub={isManagerOrAdmin ? 'all projects' : 'this week'} color="#10b981" trend={8} delay={0.05} onClick={() => navigate(isManagerOrAdmin ? '/tasks?filter=done' : '/tasks?filter=done&mine=true')} />
        <StatCard icon={<Clock size={20} />} label={isManagerOrAdmin ? 'Workspace Open Tasks' : 'My Open Tasks'} value={isManagerOrAdmin ? activeProjectTasks.length + quickTasks.length - completedThisWeek.length : myTasks.length} sub={isManagerOrAdmin ? 'active now' : 'assigned to me'} color="#f59e0b" trend={-3} delay={0.1} onClick={() => navigate(isManagerOrAdmin ? '/tasks?filter=active' : '/tasks?filter=active&mine=true')} />
        <StatCard icon={<AlertTriangle size={20} />} label="Overdue Tasks" value={overdueTasks.length} sub="need attention" color="#f43f5e" trend={-15} delay={0.15} onClick={() => navigate(isManagerOrAdmin ? '/tasks?filter=overdue' : '/tasks?filter=overdue&mine=true')} />
      </div>

      {/* Main body: left analytics/projects + right daily tasks/events */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Weekly task activity chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-surface-900 dark:text-white">Task Activity</h3>
                <p className="text-xs text-surface-400">Last 7 days</p>
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
                <Tooltip />
                <Area type="monotone" dataKey="completed" stroke="#3366ff" strokeWidth={2} fill="url(#colorCompleted)" />
                <Area type="monotone" dataKey="added" stroke="#e4e8f2" strokeWidth={1.5} fill="none" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Active project quick list */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white">Active Projects</h3>
              <button onClick={() => navigate('/projects')} className="btn-ghost btn-sm text-xs text-brand-600 dark:text-brand-400">
                View all <ArrowRight size={12} />
              </button>
            </div>
            <div className="divide-y divide-surface-50 dark:divide-surface-800">
              {activeProjects.slice(0, 5).map((project, i) => {
                const assignees = users.filter((u) => project.members.includes(u.id));
                const projectTasks = tasks.filter((t) => t.projectId === project.id);
                const projectOverdueCount = projectTasks.filter((t) => isDueDateOverdue(t.dueDate, t.status)).length;
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50"
                  >
                    <div className="h-9 w-9 flex-shrink-0 rounded-xl text-white flex items-center justify-center text-sm font-bold" style={{ backgroundColor: project.color }}>
                      {project.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-800 dark:text-surface-200">{project.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <ProgressBar value={project.progress} size="sm" color={getProgressColor(project.progress)} className="w-20 sm:w-24" />
                        <span className="text-xs text-surface-400">{project.progress}%</span>
                        {projectOverdueCount > 0 && (
                          <span className="ml-1 flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-500 dark:bg-rose-950/30">
                            <AlertTriangle size={10} />
                            {projectOverdueCount} Overdue
                          </span>
                        )}
                      </div>
                    </div>
                    <AvatarGroup users={assignees} max={3} size="xs" />
                  </motion.div>
                );
              })}
              {activeProjects.length === 0 && <div className="px-5 py-6 text-sm text-surface-400">No active projects found.</div>}
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          {/* Daily tasks panel: pick project first, then inspect tasks */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-surface-100 bg-surface-50 px-4 py-3 dark:border-surface-800 dark:bg-surface-950/50">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-surface-700 dark:text-surface-300">Daily Tasks</h3>
                <p className="text-[11px] text-surface-400">Select a project to see its tasks below.</p>
              </div>
              <button
                type="button"
                onClick={() => selectedDailyProject && navigate(`/projects/${selectedDailyProject.id}`)}
                disabled={!selectedDailyProject}
                className="btn-ghost btn-sm text-xs text-brand-600 dark:text-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open project <ArrowRight size={12} />
              </button>
            </div>

            <div className="border-b border-surface-100 px-4 py-3 dark:border-surface-800">
              {dailyProjects.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dailyProjects.map((project) => {
                    const isActive = selectedDailyProject?.id === project.id;
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => setSelectedDailyProjectId(project.id)}
                        className={cn(
                          'flex min-w-max items-center gap-2 rounded-full border px-3 py-2 text-left text-xs font-semibold transition-all',
                          isActive
                            ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-950/40 dark:text-brand-300'
                            : 'border-surface-200 bg-white text-surface-600 hover:border-brand-200 hover:bg-surface-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300'
                        )}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                        <span className="max-w-[140px] truncate">{project.name}</span>
                        <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-bold text-surface-500 dark:bg-surface-800 dark:text-surface-300">
                          {project.tasksCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-surface-400">No active projects with daily tasks found.</div>
              )}
            </div>

            <div className="max-h-[300px] overflow-y-auto">
              {selectedDailyProject ? (
                <div className="space-y-0">
                  <div className="border-b border-surface-50 px-4 py-3 dark:border-surface-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-surface-900 dark:text-white">{selectedDailyProject.name}</p>
                        <p className="text-[11px] text-surface-400">
                          {selectedDailyProject.tasksCount} tasks - {selectedDailyProject.completedTasksCount} done
                        </p>
                      </div>
                      <div className="w-24 flex-shrink-0">
                        <ProgressBar
                          value={selectedDailyProject.progress}
                          size="sm"
                          color={getProgressColor(selectedDailyProject.progress)}
                        />
                        <p className="mt-1 text-right text-[11px] text-surface-400">{selectedDailyProject.progress}%</p>
                      </div>
                    </div>
                  </div>

                  {selectedDailyProject.tasks.length > 0 ? (
                    <div className="space-y-1 px-4 py-3">
                      {/* Task groups rendered in business-priority order */}
                      {(['todo', 'in_progress', 'done'] as DailyTaskSection[]).map((section) => {
                        const sectionTasks = selectedDailyProjectSections[section];
                        if (!sectionTasks.length) return null;

                        return (
                          <div key={section} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400">
                                {getDailyTaskSectionLabel(section)}
                              </p>
                              <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-semibold text-surface-500 dark:bg-surface-800 dark:text-surface-300">
                                {sectionTasks.length}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {sectionTasks.map((task) => (
                                <div key={task.id} className="rounded-xl border border-surface-100 bg-surface-50/60 px-3 py-3 transition-colors dark:border-surface-800 dark:bg-surface-900/40">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-surface-800 dark:text-surface-200">{task.title}</p>
                                      <p className="mt-0.5 text-[11px] text-surface-400">
                                        Due: {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                                        {task.assigneeNames.length ? ` - ${task.assigneeNames.join(', ')}` : ''}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {task.priority && (
                                        <span className="rounded-full bg-surface-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-surface-500 dark:bg-surface-800 dark:text-surface-300">
                                          {task.priority}
                                        </span>
                                      )}
                                      <span className={cn(
                                        'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                                        section === 'done'
                                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300'
                                          : section === 'in_progress'
                                            ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-300'
                                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300'
                                      )}>
                                        {getDailyTaskSectionLabel(section)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-sm text-surface-400">No tasks found for this project.</div>
                  )}
                </div>
              ) : (
                <div className="px-4 py-6 text-sm text-surface-400">Select a project to view its tasks.</div>
              )}
            </div>
          </motion.div>

          {/* Platform events feed for admin-level visibility */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white">Platform Events</h3>
            </div>
            <div className="space-y-3">
              {platformEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className={cn('mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-white', event.color)}>
                    {event.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-5 text-surface-700 dark:text-surface-300">{event.description}</p>
                    <p className="mt-1 text-[11px] text-surface-400">{event.time}</p>
                  </div>
                </div>
              ))}
              {!platformEvents.length && !activityLoading && <p className="text-sm text-surface-400">No recent platform events found.</p>}
            </div>
          </motion.div>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={<Building2 size={18} />} label="Total Companies" value={companiesLoading ? '...' : companies.length} color="#3366ff" />
          <StatCard icon={<Activity size={18} />} label="Active Users" value={users.filter((u) => u.isActive).length} color="#10b981" />
          <StatCard icon={<FolderKanban size={18} />} label="Projects" value={companies.reduce((sum, c) => sum + (c.projectsCount || 0), 0)} color="#f59e0b" />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;




