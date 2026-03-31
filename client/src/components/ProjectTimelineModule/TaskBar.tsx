import React, { useEffect, useRef, useState } from 'react';
import type { TimelineTask } from '../../app/types';
import { addDays } from './utils';

interface TaskBarProps {
  task: TimelineTask;
  phaseColor: string;
  dayWidth: number;
  rowTop: number;
  rowHeight: number;
  hasConflict: boolean;
  isReadOnly: boolean;
  users: any[];
  onCommit: (taskId: string, nextStartDate: string, nextEndDate: string) => void;
}

type DragMode = 'move' | 'resize-start' | 'resize-end';

export const TaskBar: React.FC<TaskBarProps> = ({
  task,
  phaseColor,
  dayWidth,
  rowTop,
  rowHeight,
  hasConflict,
  isReadOnly,
  users,
  onCommit,
}) => {
  const userMap = new Map(users.map(u => [u.id, u]));
  const [previewStartOffset, setPreviewStartOffset] = useState(task.startOffset);
  const [previewDuration, setPreviewDuration] = useState(task.durationInDays);
  const dragRef = useRef<{ mode: DragMode; pointerX: number; startOffset: number; duration: number } | null>(null);

  useEffect(() => {
    setPreviewStartOffset(task.startOffset);
    setPreviewDuration(task.durationInDays);
  }, [task.startOffset, task.durationInDays]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      const deltaDays = Math.round((event.clientX - dragRef.current.pointerX) / dayWidth);

      if (dragRef.current.mode === 'move') {
        setPreviewStartOffset(Math.max(0, dragRef.current.startOffset + deltaDays));
      } else if (dragRef.current.mode === 'resize-start') {
        const nextOffset = Math.max(0, dragRef.current.startOffset + deltaDays);
        const endOffset = dragRef.current.startOffset + dragRef.current.duration - 1;
        const nextDuration = Math.max(1, endOffset - nextOffset + 1);
        setPreviewStartOffset(nextOffset);
        setPreviewDuration(nextDuration);
      } else {
        setPreviewDuration(Math.max(1, dragRef.current.duration + deltaDays));
      }
    };

    const onUp = () => {
      if (!dragRef.current) return;
      const nextStartDate = addDays(task.startDate, previewStartOffset - task.startOffset);
      const nextEndDate = addDays(nextStartDate, previewDuration - 1);
      dragRef.current = null;
      onCommit(task.id, nextStartDate, task.type === 'milestone' ? nextStartDate : nextEndDate);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dayWidth, onCommit, previewDuration, previewStartOffset, task.id, task.startDate, task.startOffset, task.type]);

  const handleMoveDown = (event: React.PointerEvent) => {
    if (isReadOnly) return;
    dragRef.current = {
      mode: 'move',
      pointerX: event.clientX,
      startOffset: previewStartOffset,
      duration: previewDuration,
    };
  };

  const handleResizeStartDown = (event: React.PointerEvent) => {
    if (isReadOnly) return;
    event.stopPropagation();
    dragRef.current = {
      mode: 'resize-start',
      pointerX: event.clientX,
      startOffset: previewStartOffset,
      duration: previewDuration,
    };
  };

  const handleResizeEndDown = (event: React.PointerEvent) => {
    if (isReadOnly) return;
    event.stopPropagation();
    dragRef.current = {
      mode: 'resize-end',
      pointerX: event.clientX,
      startOffset: previewStartOffset,
      duration: previewDuration,
    };
  };

  if (task.type === 'milestone') {
    const left = previewStartOffset * dayWidth + dayWidth / 2;
    return (
      <button
        type="button"
        title={`${task.title}\n${task.startDate}`}
        className={cn(
           "absolute z-30 transition-transform group",
           isReadOnly ? "cursor-default" : "cursor-move active:scale-90"
        )}
        style={{ left: left - 10, top: rowTop + rowHeight / 2 - 10 }}
        disabled={isReadOnly}
        onPointerDown={handleMoveDown}
      >
        <span
          className={cn(
            "block h-5 w-5 rotate-45 rounded-[3px] border-2 shadow-sm transition-all bg-white relative overflow-hidden",
            task.isCritical ? "ring-2 ring-amber-400 ring-offset-2" : "",
            hasConflict ? "border-rose-500" : "border-white"
          )}
          style={{ backgroundColor: phaseColor }}
        >
           {task.assigneeIds && task.assigneeIds.length > 0 && (
             <div className="absolute inset-0 flex items-center justify-center -rotate-45 p-0.5">
                <div 
                  className="w-full h-full rounded-full border border-white/40 flex items-center justify-center text-[6px] font-bold"
                  style={{ backgroundColor: userMap.get(task.assigneeIds[0])?.color || 'rgba(0,0,0,0.1)' }}
                >
                  {(userMap.get(task.assigneeIds[0])?.name || '?').charAt(0).toUpperCase()}
                </div>
             </div>
           )}
        </span>
      </button>
    );
  }

  const barWidth = Math.max(dayWidth, previewDuration * dayWidth);
  const isTooShortForLabel = barWidth < 120;

  return (
    <div
      className={cn(
        "absolute z-20 flex items-center rounded-xl border-t border-white/20 text-left transition-all group overflow-hidden",
        task.isCritical ? "ring-2 ring-amber-300/40" : "",
        hasConflict ? "border-rose-400" : "border-transparent"
      )}
      style={{
        left: previewStartOffset * dayWidth,
        top: 6,
        width: barWidth,
        height: rowHeight - 12,
        backgroundColor: phaseColor,
        backgroundImage: 'linear-gradient(to bottom right, rgba(255,255,255,0.1), transparent)',
      }}
      title={`${task.title}\n${task.startDate} -> ${task.endDate}\n${previewDuration} day(s)`}
    >
      <button
        type="button"
        className="h-full w-2.5 cursor-ew-resize rounded-l-xl opacity-0 hover:opacity-100 transition-opacity bg-white/20 disabled:cursor-not-allowed"
        disabled={isReadOnly}
        onPointerDown={handleResizeStartDown}
      />
      <button
        type="button"
        className={cn(
          "flex h-full flex-1 items-center justify-between border border-black/5 px-2.5 shadow-sm transition-all",
          isReadOnly ? "cursor-default" : "cursor-move active:scale-[0.98] active:brightness-95",
          "rounded-xl"
        )}
        style={{ 
          backgroundColor: phaseColor,
          color: 'white',
          opacity: isReadOnly ? 0.9 : 1
        }}
        onPointerDown={handleMoveDown}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-1">
          {task.assigneeIds && task.assigneeIds.length > 0 && !isTooShortForLabel && (
             <div className="flex shrink-0 -space-x-1.5 overflow-hidden">
               {task.assigneeIds.slice(0, 2).map((id) => {
                 const user = userMap.get(id);
                 return (
                   <div 
                     key={id}
                     className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/30 text-[8px] font-bold ring-1 ring-black/5"
                     style={{ backgroundColor: user?.color || '#a1a1aa' }}
                     title={user?.name || 'Assigned'}
                   >
                     {(user?.name || '?').charAt(0).toUpperCase()}
                   </div>
                 );
               })}
             </div>
          )}
          <span className="truncate text-[11px] font-bold tracking-tight">
            {task.title}
          </span>
          {!isTooShortForLabel && (
            <span className="ml-auto shrink-0 text-[10px] font-bold opacity-70 bg-white/20 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
              {previewDuration}d
            </span>
          )}
        </div>

        {task.status === 'done' && (
          <div className="absolute inset-0 bg-emerald-500/10 rounded-xl overflow-hidden pointer-events-none">
            <div className="h-full bg-emerald-400/20 w-half" />
          </div>
        )}
      </button>
      <button
        type="button"
        className="h-full w-2.5 cursor-ew-resize rounded-r-xl opacity-0 hover:opacity-100 transition-opacity bg-white/20 disabled:cursor-not-allowed"
        disabled={isReadOnly}
        onPointerDown={handleResizeEndDown}
      />
    </div>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

export default TaskBar;
