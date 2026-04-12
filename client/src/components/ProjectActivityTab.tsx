import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CalendarRange,
  ChevronDown,
  Clock3,
  Filter,
  Loader2,
  Search,
  TimerReset,
} from 'lucide-react';
import type {
  ProjectTimelineActivity,
  ProjectTimelineDateBucket,
  ProjectTimelineResponse,
  ProjectTimelineTaskGroup,
  TimelineActivityStatus,
  TimelineDateGroup,
  TimelineDensityMode,
} from '../app/types';
import { STATUS_CONFIG } from '../app/constants';
import { useAppStore } from '../context/appStore';
import { activityService } from '../services/api';
import { cn, formatRelativeTime } from '../utils/helpers';
import { EmptyState } from './ui';
import { UserAvatar } from './UserAvatar';

interface ProjectActivityTabProps {
  projectId: string;
}

interface TimelineTaskGroupState extends ProjectTimelineTaskGroup {
  fetchedAtMs: number;
}

interface TimelineDateBucketState extends Omit<ProjectTimelineDateBucket, 'tasks'> {
  tasks: TimelineTaskGroupState[];
}

type TimelineRow =
  | { kind: 'date'; key: string; dateGroup: TimelineDateGroup; taskCount: number }
  | { kind: 'task'; key: string; dateGroup: TimelineDateGroup; task: TimelineTaskGroupState };

const DATE_GROUP_ORDER: TimelineDateGroup[] = ['Today', 'Yesterday', 'Last Week', 'Older'];
const DEFAULT_COLLAPSED: Record<TimelineDateGroup, boolean> = {
  Today: true,
  Yesterday: true,
  'Last Week': true,
  Older: true,
};
const VIEWPORT_HEIGHT = 680;

function formatDuration(seconds: number) {
  if (!seconds) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours ? `${days}d ${remHours}h` : `${days}d`;
  }
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${Math.max(minutes, 1)}m`;
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function getActivityTone(status: Exclude<TimelineActivityStatus, 'all'>) {
  switch (status) {
    case 'created':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40';
    case 'assigned':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/40';
    case 'completed':
      return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/40';
    default:
      return 'bg-surface-50 text-surface-600 border-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:border-surface-700';
  }
}

function getTaskStatusMeta(taskStatus: string) {
  const known = STATUS_CONFIG[taskStatus as keyof typeof STATUS_CONFIG];
  if (known) return known;
  return {
    label: taskStatus === 'project' ? 'Project' : titleCase(taskStatus || 'updated'),
    color: '#64748b',
    bg: 'bg-surface-100 dark:bg-surface-800',
    text: 'text-surface-600 dark:text-surface-300',
  };
}

function dedupeActivities(existing: ProjectTimelineActivity[], incoming: ProjectTimelineActivity[]) {
  const map = new Map(existing.map((activity) => [activity.id, activity]));
  for (const activity of incoming) {
    map.set(activity.id, activity);
  }
  return [...map.values()].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

function mergeTimelineBuckets(
  previous: TimelineDateBucketState[],
  incoming: ProjectTimelineDateBucket[],
  fetchedAtMs: number
) {
  const bucketMap = new Map<TimelineDateGroup, TimelineDateBucketState>(
    previous.map((bucket) => [bucket.dateGroup, bucket])
  );

  for (const bucket of incoming) {
    const existingBucket = bucketMap.get(bucket.dateGroup);

    if (!existingBucket) {
      bucketMap.set(bucket.dateGroup, {
        dateGroup: bucket.dateGroup,
        tasks: bucket.tasks.map((task) => ({ ...task, fetchedAtMs })),
      });
      continue;
    }

    const taskMap = new Map(existingBucket.tasks.map((task) => [task.taskId, task]));
    for (const task of bucket.tasks) {
      const current = taskMap.get(task.taskId);
      if (!current) {
        taskMap.set(task.taskId, { ...task, fetchedAtMs });
        continue;
      }

      taskMap.set(task.taskId, {
        ...current,
        ...task,
        fetchedAtMs: Math.max(current.fetchedAtMs, fetchedAtMs),
        activitiesCount: Math.max(current.activitiesCount, task.activitiesCount),
        latestActivityAt:
          new Date(task.latestActivityAt).getTime() > new Date(current.latestActivityAt).getTime()
            ? task.latestActivityAt
            : current.latestActivityAt,
        activities: dedupeActivities(current.activities, task.activities),
      });
    }

    existingBucket.tasks = [...taskMap.values()].sort(
      (left, right) => new Date(right.latestActivityAt).getTime() - new Date(left.latestActivityAt).getTime()
    );
  }

  return DATE_GROUP_ORDER
    .map((group) => bucketMap.get(group))
    .filter(Boolean) as TimelineDateBucketState[];
}

function getTaskMetrics(task: TimelineTaskGroupState, nowMs: number) {
  if (!task.liveSessionStartedAt || !task.liveStatus) {
    return {
      totalTime: task.totalTime,
      inProgressTime: task.inProgressTime,
      stages: task.stages,
    };
  }

  const deltaSeconds = Math.max(0, Math.floor((nowMs - task.fetchedAtMs) / 1000));
  if (!deltaSeconds) {
    return {
      totalTime: task.totalTime,
      inProgressTime: task.inProgressTime,
      stages: task.stages,
    };
  }

  return {
    totalTime: task.totalTime + deltaSeconds,
    inProgressTime: task.liveStatus === 'in_progress' ? task.inProgressTime + deltaSeconds : task.inProgressTime,
    stages: task.stages.map((stage) => (
      stage.status === task.liveStatus
        ? { ...stage, duration: stage.duration + deltaSeconds }
        : stage
    )),
  };
}



export const ProjectActivityTab: React.FC<ProjectActivityTabProps> = ({ projectId }) => {
  const { users } = useAppStore();
  const [timeline, setTimeline] = useState<TimelineDateBucketState[]>([]);
  const [summary, setSummary] = useState<ProjectTimelineResponse['summary']>({
    activities: 0,
    tasks: 0,
    totalTracked: 0,
    totalInProgress: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<TimelineActivityStatus>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [density, setDensity] = useState<TimelineDensityMode>('compact');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<TimelineDateGroup, boolean>>(DEFAULT_COLLAPSED);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const deferredSearch = useDeferredValue(search);

  const fetchTimeline = async ({
    nextCursor = null,
    append = false,
    signal,
  }: {
    nextCursor?: string | null;
    append?: boolean;
    signal?: AbortSignal;
  }) => {
    const response = await activityService.getProjectTimeline(
      projectId,
      {
        limit: 24,
        cursor: nextCursor,
        userId: userFilter || undefined,
        status: statusFilter,
        q: deferredSearch.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      },
      signal
    );

    const payload = response.data?.data as ProjectTimelineResponse;
    const fetchedAtMs = Date.now();

    setTimeline((prev) => mergeTimelineBuckets(append ? prev : [], payload.groups || [], fetchedAtMs));
    setCursor(payload.pagination?.nextCursor || null);
    setHasMore(Boolean(payload.pagination?.hasMore));
    setSummary((prev) => (
      append
        ? {
            activities: prev.activities + (payload.summary?.activities || 0),
            tasks: new Set([
              ...prevSummaryTaskIds(prev, timeline),
              ...currentSummaryTaskIds(payload.groups || []),
            ]).size,
            totalTracked: 0,
            totalInProgress: 0,
          }
        : payload.summary
    ));
  };

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setTimeline([]);
    setCursor(null);
    setHasMore(false);
    setCollapsedGroups(DEFAULT_COLLAPSED);
    setExpandedTasks(new Set());

    void fetchTimeline({ signal: controller.signal })
      .catch((error) => {
        if (error?.name !== 'CanceledError' && error?.code !== 'ERR_CANCELED') {
          console.error(error);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [projectId, deferredSearch, userFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const visibleRows = useMemo<TimelineRow[]>(() => {
    const rows: TimelineRow[] = [];
    for (const bucket of timeline) {
      rows.push({
        kind: 'date',
        key: `date-${bucket.dateGroup}`,
        dateGroup: bucket.dateGroup,
        taskCount: bucket.tasks.length,
      });

      if (collapsedGroups[bucket.dateGroup]) continue;

      for (const task of bucket.tasks) {
        rows.push({
          kind: 'task',
          key: `task-${bucket.dateGroup}-${task.taskId}`,
          dateGroup: bucket.dateGroup,
          task,
        });
      }
    }
    return rows;
  }, [collapsedGroups, timeline]);

  const computedSummary = useMemo(() => {
    const taskIds = new Set<string>();
    let totalTracked = 0;
    let totalInProgress = 0;
    let totalActivities = 0;

    for (const bucket of timeline) {
      for (const task of bucket.tasks) {
        totalActivities += task.activities.length;
        if (taskIds.has(task.taskId)) continue;
        taskIds.add(task.taskId);
        const metrics = getTaskMetrics(task, nowMs);
        totalTracked += metrics.totalTime;
        totalInProgress += metrics.inProgressTime;
      }
    }

    return {
      activities: totalActivities || summary.activities,
      tasks: taskIds.size || summary.tasks,
      totalTracked,
      totalInProgress,
    };
  }, [nowMs, summary.activities, summary.tasks, timeline]);

  const topTask = useMemo(() => {
    const allTasks = timeline.flatMap((bucket) => bucket.tasks);
    return [...allTasks]
      .sort((left, right) => getTaskMetrics(right, nowMs).totalTime - getTaskMetrics(left, nowMs).totalTime)[0];
  }, [nowMs, timeline]);



  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchTimeline({ nextCursor: cursor, append: true });
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-surface-100 bg-white/80 dark:border-surface-800 dark:bg-surface-900/70">
        <Loader2 size={34} className="animate-spin text-brand-500" />
        <p className="text-sm font-medium text-surface-400">Loading scalable timeline...</p>
      </div>
    );
  }

  if (!timeline.length) {
    return (
      <EmptyState
        icon={<Clock3 size={32} />}
        title="No timeline activity found"
        description="Try a different date range, user, or search term."
      />
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-surface-500">
            <Clock3 size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Tracked Time</span>
          </div>
          <p className="mt-2 text-xl font-display font-bold text-surface-900 dark:text-white">{formatDuration(computedSummary.totalTracked)}</p>
          <p className="mt-1 text-[11px] text-surface-400">{computedSummary.tasks} active timeline groups</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <TimerReset size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">In Progress</span>
          </div>
          <p className="mt-2 text-xl font-display font-bold text-surface-900 dark:text-white">{formatDuration(computedSummary.totalInProgress)}</p>
          <p className="mt-1 text-[11px] text-surface-400">Live task time updates every 30s</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-brand-500">
            <Activity size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Top Task</span>
          </div>
          <p className="mt-2 truncate text-base font-display font-bold text-surface-900 dark:text-white">{topTask?.taskName || 'No task'}</p>
          <p className="mt-1 text-[11px] text-surface-400">{topTask ? formatDuration(getTaskMetrics(topTask, nowMs).totalTime) : '0m'}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-surface-500">
            <Filter size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Feed Density</span>
          </div>
          <div className="mt-3 inline-flex rounded-2xl bg-surface-50 p-1 dark:bg-surface-800">
            {(['compact', 'detailed'] as TimelineDensityMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDensity(mode)}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                  density === mode
                    ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-900 dark:text-white'
                    : 'text-surface-500'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-surface-100 p-4 dark:border-surface-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-lg font-display font-semibold text-surface-900 dark:text-white">Manager Timeline</h3>
              <p className="text-sm text-surface-400">Date-grouped, task-grouped, lazy-loaded, and optimized for thousands of records.</p>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:flex">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search task or user..."
                  className="input h-10 min-w-[220px] pl-9"
                />
              </div>

              <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)} className="input h-10 min-w-[170px]">
                <option value="">All users</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as TimelineActivityStatus)}
                className="input h-10 min-w-[170px]"
              >
                <option value="all">All activity types</option>
                <option value="created">Created</option>
                <option value="assigned">Assigned</option>
                <option value="completed">Completed</option>
                <option value="updated">Updated</option>
              </select>

              <div className="flex items-center gap-2 rounded-2xl border border-surface-200 px-3 dark:border-surface-800">
                <CalendarRange size={14} className="text-surface-400" />
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 bg-transparent text-sm outline-none" />
                <span className="text-surface-300">-</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 bg-transparent text-sm outline-none" />
              </div>
            </div>
          </div>
        </div>

        <div
          className="relative overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.05),_transparent_40%)]"
          style={{ height: VIEWPORT_HEIGHT }}
        >
          <div className="flex flex-col gap-1 pb-4 pt-2">
            {visibleRows.map((row) => {
              if (row.kind === 'date') {
                const collapsed = collapsedGroups[row.dateGroup];
                return (
                  <div
                    key={row.key}
                    className="px-4 pt-3"
                  >
                    <div
                      className="flex w-full items-center justify-between rounded-2xl border border-surface-200 bg-white/90 px-4 py-3 shadow-sm dark:border-surface-800 dark:bg-surface-900/90"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-brand-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                          {row.dateGroup}
                        </div>
                        <span className="text-sm text-surface-500">{row.taskCount} task groups</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setCollapsedGroups((prev) => ({ ...prev, [row.dateGroup]: !prev[row.dateGroup] }))}
                        className="rounded-full p-1.5 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
                      >
                        <ChevronDown size={18} className={cn('text-surface-400 transition-transform', !collapsed && 'rotate-180')} />
                      </button>
                    </div>
                  </div>
                );
              }

              const expanded = expandedTasks.has(row.task.taskId);
              const metrics = getTaskMetrics(row.task, nowMs);
              const statusMeta = getTaskStatusMeta(row.task.taskStatus);
              const stageTotal = metrics.totalTime || row.task.stages.reduce((sum, stage) => sum + stage.duration, 0);
              const visibleActivities = density === 'compact' ? row.task.activities.slice(0, 3) : row.task.activities.slice(0, 6);

              return (
                <div
                  key={row.key}
                  className="px-4 py-1"
                >
                  <div className="rounded-3xl border border-surface-200 bg-white/90 shadow-sm dark:border-surface-800 dark:bg-surface-900/90">
                    <div
                      className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-surface-900 dark:text-white">{row.task.taskName}</p>
                          <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]', statusMeta.bg, statusMeta.text)}>
                            {statusMeta.label}
                          </span>
                          {row.task.liveStatus ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                              Live
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-surface-500">
                          <span className="rounded-full bg-surface-50 px-2.5 py-1 dark:bg-surface-800">Tracked {formatDuration(metrics.totalTime)}</span>
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                            In progress {formatDuration(metrics.inProgressTime)}
                          </span>
                          <span className="rounded-full bg-surface-50 px-2.5 py-1 dark:bg-surface-800">
                            {row.task.activitiesCount} updates
                          </span>
                          <span className="rounded-full bg-surface-50 px-2.5 py-1 dark:bg-surface-800">
                            Updated {formatRelativeTime(row.task.latestActivityAt)}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex min-w-0 flex-1 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                            {(metrics.stages.length ? metrics.stages : row.task.stages).slice(0, 5).map((stage) => {
                              const percent = stageTotal > 0 ? Math.max((stage.duration / stageTotal) * 100, 8) : 100;
                              return (
                                <div
                                  key={`${row.task.taskId}-${stage.status}`}
                                  className="h-2"
                                  style={{
                                    width: `${percent}%`,
                                    backgroundColor: getTaskStatusMeta(stage.status).color,
                                  }}
                                  title={`${titleCase(stage.status)} ${formatDuration(stage.duration)}`}
                                />
                              );
                            })}
                          </div>
                          <span className="text-[11px] text-surface-400">{(metrics.stages.length || row.task.stages.length)} stages</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <div className="flex -space-x-2">
                          {row.task.assignees.slice(0, 3).map((assignee) => (
                            <div key={assignee.id} className="rounded-full ring-2 ring-white dark:ring-surface-900">
                              <UserAvatar name={assignee.name} color={assignee.color} size="xs" />
                            </div>
                          ))}
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setExpandedTasks((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.task.taskId)) next.delete(row.task.taskId);
                            else next.add(row.task.taskId);
                            return next;
                          })}
                          className="rounded-full p-1 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
                        >
                          <ChevronDown size={18} className={cn('text-surface-400 transition-transform', expanded && 'rotate-180')} />
                        </button>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'border-t border-surface-100 px-4 transition-all dark:border-surface-800',
                        expanded ? 'max-h-[220px] pb-4 pt-3 opacity-100' : 'max-h-0 overflow-hidden border-transparent p-0 opacity-0'
                      )}
                    >
                      <div className={cn('grid gap-4', density === 'compact' ? 'lg:grid-cols-[1.1fr_0.9fr]' : 'lg:grid-cols-[0.95fr_1.05fr]')}>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Latest updates</p>
                          <div className="mt-3 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: density === 'compact' ? 118 : 180 }}>
                            {visibleActivities.map((activity) => (
                              <div key={activity.id} className="rounded-2xl border border-surface-100 bg-surface-50/80 p-3 dark:border-surface-800 dark:bg-surface-800/40">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]', getActivityTone(activity.status))}>
                                        {activity.status}
                                      </span>
                                      <span className="text-[11px] text-surface-400">{formatRelativeTime(activity.createdAt)}</span>
                                    </div>
                                    <p className="mt-1 text-sm text-surface-700 dark:text-surface-200">{activity.description}</p>
                                  </div>
                                  {activity.user ? (
                                    <div className="flex items-center gap-2">
                                      <UserAvatar name={activity.user.name} color={activity.user.color} size="xs" />
                                      <span className="hidden text-[11px] font-medium text-surface-500 sm:inline">{activity.user.name}</span>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Stage breakdown</p>
                          <div className="mt-3 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: density === 'compact' ? 118 : 180 }}>
                            {(metrics.stages.length ? metrics.stages : row.task.stages).map((stage) => (
                              <div key={`${row.task.taskId}-stage-${stage.status}`} className="rounded-2xl border border-surface-100 bg-white px-3 py-2.5 dark:border-surface-800 dark:bg-surface-900">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getTaskStatusMeta(stage.status).color }} />
                                    <span className="font-medium text-surface-700 dark:text-surface-200">{titleCase(stage.status)}</span>
                                  </div>
                                  <span className="font-semibold text-surface-900 dark:text-white">{formatDuration(stage.duration)}</span>
                                </div>
                              </div>
                            ))}
                            {!row.task.stages.length ? (
                              <p className="rounded-2xl border border-dashed border-surface-200 px-3 py-4 text-sm text-surface-400 dark:border-surface-800">
                                Timeline data will appear as users move this task across stages.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-surface-100 px-4 py-3 dark:border-surface-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-surface-500">
            Loaded {timeline.reduce((sum, bucket) => sum + bucket.tasks.length, 0)} grouped task timelines with {computedSummary.activities} visible activities.
          </p>
          <button
            type="button"
            onClick={loadMore}
            disabled={!hasMore || loadingMore}
            className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
            {hasMore ? 'Load more activity' : 'Everything loaded'}
          </button>
        </div>
      </div>
    </div>
  );
};

function currentSummaryTaskIds(groups: ProjectTimelineDateBucket[]) {
  return groups.flatMap((bucket) => bucket.tasks.map((task) => task.taskId));
}

function prevSummaryTaskIds(
  previousSummary: ProjectTimelineResponse['summary'],
  timeline: TimelineDateBucketState[]
) {
  if (!previousSummary.tasks) return [];
  return timeline.flatMap((bucket) => bucket.tasks.map((task) => task.taskId));
}
