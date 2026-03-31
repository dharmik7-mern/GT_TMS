import React from 'react';
import type { ProjectTimeline } from '../../app/types';
import Header from './Header';
import TaskBar from './TaskBar';
import type { TimelineRow } from './utils';

interface TimelineGridProps {
  timeline: ProjectTimeline;
  rows: TimelineRow[];
  allRows: TimelineRow[];
  totalHeight: number;
  dayWidth: number;
  extraRightPadding?: number;
  onTaskCommit: (taskId: string, nextStartDate: string, nextEndDate: string) => void;
  users: any[];
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({
  timeline,
  rows,
  allRows,
  totalHeight,
  dayWidth,
  extraRightPadding = 80,
  onTaskCommit,
  users,
}) => {
  const gridWidth = timeline.projectWindow.totalDays * dayWidth;
  const width = gridWidth + extraRightPadding;
  const taskBarInsetY = 10;
  const milestoneSize = 20;
  const phaseColorByTaskId = new Map(
    timeline.phases.flatMap((phase) => phase.tasks.map((task) => [task.id, phase.color || '#2563eb'] as const))
  );
  const conflictIds = new Set(timeline.resourceConflicts.flatMap((conflict) => conflict.taskIds));
  const rowByTaskId = new Map(allRows.filter((row) => row.kind === 'task').map((row) => [row.task.id, row]));
  const connectorInset = Math.max(12, Math.round(dayWidth * 0.7));
  const connectorLaneGap = 12;

  const getTaskAnchor = (row: Extract<TimelineRow, { kind: 'task' }>, side: 'start' | 'end') => {
    const centerY = row.top + row.height / 2;

    if (row.task.type === 'milestone') {
      const centerX = row.task.startOffset * dayWidth + dayWidth / 2;
      const edgeOffset = milestoneSize / 2;
      return {
        x: side === 'start' ? centerX - edgeOffset : centerX + edgeOffset,
        y: centerY,
      };
    }

    const barLeft = row.task.startOffset * dayWidth;
    const barWidth = Math.max(dayWidth, row.task.durationInDays * dayWidth);
    return {
      x: side === 'start' ? barLeft : barLeft + barWidth,
      y: row.top + taskBarInsetY + (row.height - taskBarInsetY * 2) / 2,
    };
  };

  return (
    <div className="relative">
      <Header
        startDate={timeline.projectWindow.startDate}
        totalDays={timeline.projectWindow.totalDays}
        dayWidth={dayWidth}
        extraRightPadding={extraRightPadding}
      />
      <div className="relative" style={{ width, height: totalHeight }}>
        <div className="absolute inset-y-0 left-0" style={{ width: gridWidth }}>
          {Array.from({ length: timeline.projectWindow.totalDays }).map((_, index) => (
            <div
              key={index}
              className={`absolute top-0 h-full border-r border-surface-100 dark:border-surface-900 ${Math.floor(index / 7) % 2 === 0 ? 'bg-white dark:bg-surface-950' : 'bg-surface-50/55 dark:bg-surface-900/30'}`}
              style={{ left: index * dayWidth, width: dayWidth }}
            />
          ))}
        </div>

        <div
          className="absolute top-0 z-30 h-full border-l-2 border-rose-500/50 pointer-events-none"
          style={{ left: Math.max(0, timeline.projectWindow.todayOffset) * dayWidth }}
        >
          <div className="sticky top-10 -left-3 z-30 flex items-center gap-1.5 whitespace-nowrap bg-rose-500 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white rounded-full">
            <div className="w-1 h-1 rounded-full bg-white animate-ping" />
            Today
          </div>
        </div>

        <svg className="pointer-events-none absolute inset-0 z-[12] overflow-visible" width={width} height={totalHeight}>
          <defs>
            <marker id="timeline-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#2563eb" />
            </marker>
          </defs>
          {timeline.dependencies.map((dependency) => {
            const fromRow = rowByTaskId.get(dependency.fromTaskId);
            const toRow = rowByTaskId.get(dependency.toTaskId);
            if (!fromRow || !toRow || fromRow.kind !== 'task' || toRow.kind !== 'task') return null;

            const source = getTaskAnchor(fromRow, 'end');
            const target = getTaskAnchor(toRow, 'start');
            const sourceX = source.x + 2;
            const sourceY = source.y;
            const targetX = Math.max(8, target.x - 6);
            const targetY = target.y;
            const fromBarTop = fromRow.top + taskBarInsetY;
            const toBarTop = toRow.top + taskBarInsetY;
            const hasForwardRoom = targetX - sourceX > connectorInset * 2;
            const sameRow = Math.abs(sourceY - targetY) < 2;
            const laneY = Math.max(
              10,
              Math.min(fromBarTop, toBarTop) - connectorLaneGap - ((Math.abs(fromRow.top - toRow.top) / Math.max(1, fromRow.height)) % 3) * 6
            );
            const d = sameRow || hasForwardRoom
              ? [
                `M ${sourceX} ${sourceY}`,
                `L ${Math.max(sourceX + connectorInset, targetX - connectorInset)} ${sourceY}`,
                `L ${Math.max(sourceX + connectorInset, targetX - connectorInset)} ${targetY}`,
                `L ${targetX} ${targetY}`,
              ].join(' ')
              : [
                `M ${sourceX} ${sourceY}`,
                `L ${sourceX + connectorInset} ${sourceY}`,
                `L ${sourceX + connectorInset} ${laneY}`,
                `L ${targetX - connectorInset} ${laneY}`,
                `L ${targetX - connectorInset} ${targetY}`,
                `L ${targetX} ${targetY}`,
              ].join(' ');

            return (
              <g key={dependency.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="rgba(255,255,255,0.96)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={d}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="5 4"
                  markerEnd="url(#timeline-arrow)"
                />
                <circle cx={sourceX} cy={sourceY} r="3" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
              </g>
            );
          })}
        </svg>

        {rows.map((row) => (
          <div
            key={row.id}
            className={row.kind === 'phase'
              ? 'absolute inset-x-0 border-b border-surface-200 bg-surface-100/70 dark:border-surface-800 dark:bg-surface-900/55'
              : 'absolute inset-x-0 z-[18] border-b border-surface-100/80 dark:border-surface-900'}
            style={{ top: row.top, height: row.height }}
          >
            {row.kind === 'task' ? (
              <TaskBar
                task={row.task}
                phaseColor={phaseColorByTaskId.get(row.task.id) || '#2563eb'}
                dayWidth={dayWidth}
                rowTop={row.top}
                rowHeight={row.height}
                hasConflict={conflictIds.has(row.task.id)}
                isReadOnly={timeline.status === 'Approved'}
                onCommit={onTaskCommit}
                users={users}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineGrid;
