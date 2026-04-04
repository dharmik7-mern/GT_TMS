import React, { useMemo } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { ProjectTimeline } from '../../app/types';

interface ProjectGanttChartProps {
  timeline: ProjectTimeline;
  viewMode: ViewMode;
  onTaskClick?: (task: Task) => void;
  onDateChange?: (task: Task) => Promise<any>;
  onProgressChange?: (task: Task) => Promise<any>;
  onDelete?: (task: Task) => Promise<any>;
  onDoubleClick?: (task: Task) => void;
}

export const ProjectGanttChart: React.FC<ProjectGanttChartProps> = ({
  timeline,
  viewMode,
  onTaskClick,
  onDateChange,
  onProgressChange,
  onDelete,
  onDoubleClick,
}) => {
  const ganttTasks: Task[] = useMemo(() => {
    const tasks: Task[] = [];
    
    // 1. Map phases and tasks
    const sortedPhases = [...timeline.phases].sort((a, b) => a.order - b.order);
    
    sortedPhases.forEach((phase) => {
      const phaseTasks = phase.tasks || [];
      if (phaseTasks.length === 0) return;

      // Find phase bounds
      const phaseStart = new Date(Math.min(...phaseTasks.map(t => new Date(t.startDate).getTime())));
      const phaseEnd = new Date(Math.max(...phaseTasks.map(t => new Date(t.endDate).getTime())));
      
      // Calculate phase progress (average of task progress)
      const phaseProgress = phaseTasks.length > 0 
        ? Math.round(phaseTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / phaseTasks.length)
        : 0;

      // Add Phase as a Project separator
      tasks.push({
        start: phaseStart,
        end: phaseEnd,
        name: phase.name.toUpperCase(),
        id: phase.id,
        type: 'project',
        progress: phaseProgress,
        isDisabled: true,
        styles: { 
          backgroundColor: phase.color || '#2563eb', 
          backgroundSelectedColor: phase.color || '#2563eb',
          progressColor: '#ffffff',
          progressSelectedColor: '#ffffff'
        },
      });

      phaseTasks.forEach((task) => {
        const isOverdue = new Date(task.endDate) < new Date() && task.status !== 'done';
        
        let color = '#94a3b8'; // gray for pending/todo
        let progressColor = '#cbd5e1';
        
        if (task.status === 'done') {
            color = '#22c55e'; // green
            progressColor = '#86efac';
        } else if (task.status === 'in_progress' || task.status === 'in_review') {
            color = '#3b82f6'; // blue
            progressColor = '#93c5fd';
        }
        
        if (isOverdue) {
            color = '#ef4444'; // red
            progressColor = '#fca5a5';
        }

        tasks.push({
          start: new Date(task.startDate),
          end: new Date(task.endDate),
          name: task.title,
          id: task.id,
          project: phase.id,
          type: task.type === 'milestone' ? 'milestone' : 'task',
          progress: task.progress || 0,
          dependencies: task.dependencies,
          styles: { 
            backgroundColor: color, 
            backgroundSelectedColor: color,
            progressColor,
            progressSelectedColor: progressColor
          },
        });
      });
    });

    return tasks;
  }, [timeline]);

  if (ganttTasks.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-[28px] border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-950">
        <div className="text-sm text-surface-400">No tasks planned for this project yet.</div>
      </div>
    );
  }

  return (
    <div className="gantt-chart-wrapper overflow-hidden rounded-[28px] border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-950">
      <style>{`
        .gantt-chart-wrapper ._2_9re { 
          border-color: #f1f5f9;
          background-color: #ffffff;
        }
        .dark .gantt-chart-wrapper ._2_9re {
          border-color: #1e293b;
          background-color: #020617;
        }
        .gantt-chart-wrapper ._3_7p- {
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
        }
        .gantt-chart-wrapper ._3_o_6 {
          stroke: #f1f5f9;
        }
        .dark .gantt-chart-wrapper ._3_o_6 {
          stroke: #1e293b;
        }
        .gantt-chart-wrapper ._3v_k_ {
          fill: #f8fafc;
        }
        .dark .gantt-chart-wrapper ._3v_k_ {
          fill: #0f172a;
        }
      `}</style>
      <Gantt
        tasks={ganttTasks}
        viewMode={viewMode}
        onSelect={onTaskClick}
        onDateChange={onDateChange}
        onProgressChange={onProgressChange}
        onDelete={onDelete}
        onDoubleClick={onDoubleClick}
        listCellWidth="240px"
        columnWidth={viewMode === ViewMode.Day ? 65 : 120}
        headerHeight={60}
        rowHeight={50}
        barCornerRadius={8}
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="12px"
        todayColor="rgba(239, 68, 68, 0.1)"
      />
    </div>
  );
};
