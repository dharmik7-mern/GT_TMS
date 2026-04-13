import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tasksService } from '../services/api';
import type { Task, User } from '../app/types';
import { useAppStore } from '../context/appStore';
import { STATUS_CONFIG } from '../app/constants';
import { cn, formatRelativeTime } from '../utils/helpers';
import { UserAvatar } from './UserAvatar';
import { Loader2, Activity, SlidersHorizontal } from 'lucide-react';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

interface HighDensityTaskListProps {
  projectId: string;
  onOpenTask: (task: Task) => void;
  categoryId?: string;
}

interface TaskRowProps {
  task: Task;
  users: User[];
  isDetailed: boolean;
  onClick: () => void;
}

const TaskRow = memo(({ task, users, isDetailed, onClick }: TaskRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    if (rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect();
      setCoords({ top: rect.top, left: rect.left, width: rect.width });
    }
    setIsHovered(true);
  };

  const statusMeta = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const totalTime = (task as any).totalTime || (task as any).totalTimeSpent || 0;
  const stageBreakdown: Array<{ stage: string; time: number }> = (task as any).timeByStage?.slice(0, 4) || [];
  const userBreakdown: Array<{ userId: string; time: number }> = (task as any).timeByUser?.slice(0, 3) || [];

  const assignees = useMemo(() => {
    return task.assigneeIds.map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
  }, [task.assigneeIds, users]);

  return (
    <div
      ref={rowRef}
      className="px-2 py-1"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        onClick={onClick}
        className={cn(
          'group flex items-center justify-between w-full gap-4 px-5 rounded-2xl border border-surface-100/50 dark:border-surface-800/50 transition-all cursor-pointer bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] dark:bg-surface-900/60 hover:border-brand-300 dark:hover:border-brand-500/50 hover:shadow-md hover:-translate-y-0.5',
          !isDetailed && 'py-2.5',
          isDetailed && 'py-4 flex-col items-start'
        )}
      >
        <div className="flex w-full items-center justify-between min-w-0 pr-6 relative">

          {/* Main Info */}
          <div className="flex items-center min-w-0 pr-4 w-[40%]">
            <span className="w-2 h-2 rounded-full flex-shrink-0 mr-3" style={{ backgroundColor: statusMeta.color }} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-surface-900 dark:text-surface-100 truncate pr-2">
                {task.title}
              </p>
              {isDetailed && (
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-surface-400">
                  <span className="font-medium px-1.5 py-0.5 border border-surface-200 dark:border-surface-800 rounded">{task.priority.toUpperCase()}</span>
                  <span>Created {formatRelativeTime(task.createdAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Time Bar */}
          <div className="hidden lg:flex w-[25%] px-2 items-center">
            {totalTime > 0 ? (
              <div className="w-full flex h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden" title={`Total time: ${formatDuration(totalTime)}`}>
                {stageBreakdown.map((stage) => {
                  const percent = Math.max((stage.time / totalTime) * 100, 5);
                  const stageMeta = STATUS_CONFIG[stage.stage as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.done;
                  return (
                    <div
                      key={stage.stage}
                      className="h-full transition-all"
                      style={{ width: `${percent}%`, backgroundColor: stageMeta.color }}
                      title={`${stageMeta.label.split(' ')[0]} ${formatDuration(stage.time)}`}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="w-full h-1.5 rounded-full bg-surface-100 dark:bg-surface-800/50" />
            )}
          </div>

          {/* Hover tooltip via Portal */}
          {isHovered && !isDetailed && createPortal(
            <div
              style={{
                position: 'fixed',
                top: coords.top - 8,
                left: coords.left + coords.width / 2,
                transform: 'translateX(-50%) translateY(-100%)',
                zIndex: 9999,
              }}
              className="w-[400px] p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-surface-200 bg-white/95 dark:border-surface-700 dark:bg-surface-950/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 origin-bottom"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-surface-100 dark:border-surface-800 mb-3">
                <p className="text-[10px] font-black text-surface-400 uppercase tracking-[0.2em]">Activity Breakdown</p>
                <p className="text-xs font-black text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/30 px-2 py-0.5 rounded-full">{formatDuration(totalTime)} Total</p>
              </div>
              {stageBreakdown.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {stageBreakdown.map(s => {
                    const cfg = STATUS_CONFIG[s.stage as keyof typeof STATUS_CONFIG];
                    const percent = totalTime > 0 ? Math.round((s.time / totalTime) * 100) : 0;
                    return (
                      <div key={s.stage} className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="flex items-center gap-1.5 font-bold text-surface-600 dark:text-surface-400">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg?.color || '#ccc' }} />
                            {cfg?.label.split(' ')[0] || s.stage}
                          </span>
                          <span className="font-black text-surface-900 dark:text-surface-100">{formatDuration(s.time)}</span>
                        </div>
                        <div className="h-1 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: cfg?.color || '#ccc' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-surface-400 italic">No activity recorded yet.</p>
              )}
            </div>,
            document.body
          )}

          {/* User time breakdown */}
          <div className="hidden md:flex flex-1 items-center gap-1.5 pr-4 justify-end">
            {userBreakdown.map(ut => {
              const u = users.find(x => x.id === ut.userId);
              const initials = u?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
              return (
                <span key={ut.userId} className="text-[10px] font-bold text-surface-600 dark:text-surface-400 bg-surface-100/80 dark:bg-surface-800/80 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-surface-200/50 dark:border-surface-700/50">
                  <span className="opacity-70">{initials}</span>
                  <span className="text-surface-900 dark:text-surface-100">{formatDuration(ut.time)}</span>
                </span>
              );
            })}
          </div>

          {/* Assignees + Status */}
          <div className="flex items-center gap-2 w-[180px] justify-end flex-shrink-0">
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 3).map((a) => (
                <UserAvatar key={a.id} name={a.name} color={a.color} size="xs" className="ring-2 ring-white dark:ring-surface-900" />
              ))}
              {assignees.length === 0 && <span className="text-[10px] text-surface-400 font-medium italic">Unassigned</span>}
            </div>
            <span className={cn(
              'ml-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-lg border whitespace-nowrap',
              statusMeta.bg, statusMeta.text, 'border-current/10'
            )}>
              {statusMeta.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

TaskRow.displayName = 'TaskRow';

export const HighDensityTaskList: React.FC<HighDensityTaskListProps> = ({ projectId, categoryId, onOpenTask }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { users } = useAppStore();

  const fetchTasks = useCallback(async (pageNum: number, isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const limit = 50;
      const res = await tasksService.getAll(projectId, undefined, undefined, pageNum, limit);
      const newTasks: any[] = res.data?.data || [];
      const totalTasks: number = res.data?.meta?.total || newTasks.length;

      let finalBatch = newTasks;
      if (categoryId && categoryId !== 'all') {
        finalBatch = finalBatch.filter((t: Task) => t.subcategoryId === categoryId);
      }

      if (isInitial) {
        setTasks(finalBatch);
        setTotal(totalTasks);
      } else {
        setTasks(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          return [...prev, ...finalBatch.filter((t: Task) => !existingIds.has(t.id))];
        });
      }

      setHasMore(newTasks.length === limit);
      setPage(pageNum);
    } catch (err) {
      console.error('[HighDensityTaskList]', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [projectId, categoryId]);

  useEffect(() => {
    setPage(1);
    setTasks([]);
    setHasMore(true);
    fetchTasks(1, true);
  }, [fetchTasks]);

  // Infinite scroll via scroll event on container
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loading || loadingMore || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      fetchTasks(page + 1);
    }
  }, [loading, loadingMore, hasMore, page, fetchTasks]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-brand-500" />
        <p className="text-xs text-surface-400 font-medium">Loading activity insights...</p>
      </div>
    );
  }

  if (!loading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] border border-surface-200 dark:border-surface-800 rounded-3xl bg-surface-50/30 dark:bg-surface-900/10">
        <SlidersHorizontal size={32} className="text-surface-300 dark:text-surface-700 mb-3" />
        <p className="text-sm font-semibold text-surface-900 dark:text-white">No tasks found</p>
        <p className="text-xs text-surface-400 mt-1">Change your filters or create a new task.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-surface-200 dark:border-surface-800 rounded-3xl bg-surface-50/30 dark:bg-surface-900/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-surface-200 dark:border-surface-800 bg-white/50 dark:bg-surface-950/50 backdrop-blur-sm">
        <div>
          <p className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Activity size={14} className="text-brand-500" /> Activity Insights
          </p>
          <p className="text-[10px] text-surface-500 font-medium mt-0.5">
            Showing {tasks.length}{total > tasks.length ? ` of ${total}` : ''} tasks
          </p>
        </div>
      </div>

      {/* Scrollable task list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto max-h-[650px] py-2 custom-scrollbar"
      >
        {tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            users={users}
            isDetailed={false}
            onClick={() => onOpenTask(task)}
          />
        ))}

        {loadingMore && (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 size={14} className="animate-spin text-brand-500" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-surface-500">Loading more...</span>
          </div>
        )}
      </div>
    </div>
  );
};
