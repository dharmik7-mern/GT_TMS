import { useMemo } from 'react';
import { TimelineTask, TimelinePhase, ProjectTimeline } from '../../../app/types';

/**
 * Hook to identify the critical path of a project.
 * The critical path consists of tasks that, if delayed, will delay the entire project.
 * logic: Highlight tasks marked as 'isCritical' by the backend or the longest dependency chain.
 */
export const useCriticalPath = (timeline: ProjectTimeline) => {
  return useMemo(() => {
    const criticalTaskIds = new Set<string>();
    
    // 1. Check if backend already identified them
    timeline.phases.forEach((phase: TimelinePhase) => {
        phase.tasks.forEach((task: TimelineTask) => {
            if (task.isCritical) {
               criticalTaskIds.add(task.id);
            }
        });
    });

    // 2. If no critical tasks from backend, we could calculate via dependencies here
    // But since the project already has a 'summary.criticalTasks' count, we trust the isCritical flag.
    
    return criticalTaskIds;
  }, [timeline]);
};
