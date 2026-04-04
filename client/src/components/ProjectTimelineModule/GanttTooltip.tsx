import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { format, parseISO } from 'date-fns';
import { TimelineTask } from '../../app/types';
import { cn } from '../../utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';

interface GanttTooltipProps {
  task: TimelineTask;
  children: React.ReactNode;
  isDisabled?: boolean;
}

export const GanttTooltip: React.FC<GanttTooltipProps> = ({ task, children, isDisabled }) => {
  const taskStart = parseISO(task.startDate);
  const taskEnd = parseISO(task.endDate);

  if (isDisabled) return <>{children}</>;

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="center"
            sideOffset={8}
            className="z-[9999]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              className="w-56 overflow-hidden rounded-[18px] bg-surface-900 p-4 text-white shadow-2xl dark:bg-surface-800 ring-1 ring-white/10"
            >
              <div className="mb-2.5 border-b border-white/10 pb-2.5">
                <h4 className="text-[13px] font-black uppercase tracking-[0.1em] text-white truncate">
                  {task.title}
                </h4>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Timeline</span>
                  <span className="text-[11px] font-black text-white/90">
                    {format(taskStart, 'MMM dd')} - {format(taskEnd, 'MMM dd')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Progress</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${task.progress || 0}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-black text-white/90">{task.progress || 0}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Status</span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                    task.status === 'done' ? "bg-emerald-500" : "bg-blue-500 shadow-lg shadow-blue-500/30"
                  )}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <Tooltip.Arrow className="fill-surface-900 dark:fill-surface-800" width={12} height={6} />
            </motion.div>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
