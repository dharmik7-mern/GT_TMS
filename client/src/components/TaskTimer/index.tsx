import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Clock, History } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { tasksService } from '../../services/api';
import { useAppStore } from '../../context/appStore';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';
import type { Task } from '../../app/types';

interface TaskTimerProps {
  task: Task;
  isReadOnly?: boolean;
}

export const TaskTimer: React.FC<TaskTimerProps> = ({ task, isReadOnly }) => {
  const { updateTask, bootstrap } = useAppStore();
  const [activeSessionSeconds, setActiveSessionSeconds] = useState(0);
  const [isToggling, setIsToggling] = useState(false);

  const isInProgress = task.status === 'in_progress';

  // Find the active log if any
  const activeLog = task.timeLogs?.find(log => !log.endTime && log.status === 'in_progress');

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isInProgress && activeLog) {
      const startTime = new Date(activeLog.startTime).getTime();
      
      const update = () => {
        const now = new Date().getTime();
        const diff = Math.max(0, Math.floor((now - startTime) / 1000));
        setActiveSessionSeconds(diff);
      };

      update();
      interval = setInterval(update, 1000);
    } else {
      setActiveSessionSeconds(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isInProgress, activeLog]);

  const toggleTimer = async () => {
    if (isReadOnly || isToggling) return;
    setIsToggling(true);

    try {
      const newStatus = isInProgress ? 'todo' : 'in_progress';
      const response = await tasksService.move(task.id, newStatus);
      updateTask(task.id, response.data.data ?? response.data);
      await bootstrap();
      emitSuccessToast(isInProgress ? 'Timer paused' : 'Timer started');
    } catch (err: any) {
      emitErrorToast(err?.response?.data?.message || 'Failed to update timer');
    } finally {
      setIsToggling(false);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  };

  const totalTime = (task.totalTimeSpent || 0) + (isInProgress ? activeSessionSeconds : 0);

  return (
    <div className="space-y-3 rounded-2xl bg-surface-50 p-4 dark:bg-surface-800/50 border border-surface-100 dark:border-surface-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-surface-400 font-bold text-[10px] uppercase tracking-wider">
          <Clock size={12} />
          <span>Time Tracking</span>
        </div>
        {isInProgress && (
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="text-2xl font-black text-surface-900 dark:text-white tabular-nums">
            {formatTime(isInProgress ? activeSessionSeconds : totalTime)}
          </div>
          <div className="text-[10px] text-surface-400 font-medium mt-0.5">
            {isInProgress ? 'Current Session' : 'Total Time Spent'}
          </div>
        </div>

        <button
          onClick={toggleTimer}
          disabled={isReadOnly || isToggling}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50",
            isInProgress 
              ? "bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600" 
              : "bg-brand-500 text-white shadow-brand-500/20 hover:bg-brand-600"
          )}
        >
          {isToggling ? (
            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isInProgress ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} className="ml-0.5" fill="currentColor" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-100 dark:border-surface-700/50">
        <div>
          <div className="text-[10px] text-surface-400 font-bold uppercase tracking-tight mb-0.5">Total Time</div>
          <div className="text-xs font-bold text-surface-700 dark:text-surface-200">{formatTime(totalTime)}</div>
        </div>
        <div>
          <div className="text-[10px] text-surface-400 font-bold uppercase tracking-tight mb-0.5">In Progress</div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {formatTime((task.inProgressTime || 0) + (isInProgress ? activeSessionSeconds : 0))}
          </div>
        </div>
      </div>
    </div>
  );
};
