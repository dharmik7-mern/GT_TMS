import { useMemo } from 'react';
import { TimelineTask, ProjectTimeline } from '../../../app/types';
import { isWithinInterval, parseISO } from 'date-fns';

/**
 * Hook to manage resource distribution and detect overloads.
 * An overload is defined as a single user having multiple overlapping tasks.
 */
export const useResourceLoad = (timeline: ProjectTimeline) => {
  return useMemo(() => {
    const userTasks = new Map<string, TimelineTask[]>();
    const overloadedTaskIds = new Set<string>();
    
    // 1. Group tasks by each assigned user
    timeline.phases.forEach(phase => {
      phase.tasks.forEach(task => {
        (task.assigneeIds || []).forEach(userId => {
          const list = userTasks.get(userId) || [];
          list.push(task);
          userTasks.set(userId, list);
        });
      });
    });

    // 2. Detect overlaps per user
    userTasks.forEach((tasks) => {
      // Sort tasks by start date to simplify comparison
      const sorted = [...tasks].sort((a, b) => 
        parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
      );

      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const taskA = sorted[i];
          const taskB = sorted[j];

          const startA = parseISO(taskA.startDate).getTime();
          const endA = parseISO(taskA.endDate).getTime();
          const startB = parseISO(taskB.startDate).getTime();
          const endB = parseISO(taskB.endDate).getTime();

          // Check if intervals overlap
          const overlaps = (startA <= endB && endA >= startB);

          if (overlaps) {
            overloadedTaskIds.add(taskA.id);
            overloadedTaskIds.add(taskB.id);
          }
        }
      }
    });

    return { overloadedTaskIds, userTasks };
  }, [timeline]);
};
