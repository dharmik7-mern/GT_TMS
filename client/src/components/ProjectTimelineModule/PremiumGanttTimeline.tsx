import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  format,
  addDays as dateFnsAddDays,
  startOfDay,
  differenceInDays,
  eachDayOfInterval,
  isSameDay,
  isToday,
  parseISO,
  startOfMonth,
  endOfMonth,
  isWithinInterval
} from 'date-fns';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ProjectTimeline, TimelineTask, TimelinePhase } from '../../app/types';
import { cn } from '../../utils/helpers';
import { GanttTooltip } from './GanttTooltip';
import { useCriticalPath } from './hooks/useCriticalPath';
import { useResourceLoad } from './hooks/useResourceLoad';
import { useAppStore } from '../../context/appStore';
import { Calendar, ChevronRight, Clock, Info, AlertCircle, Users } from 'lucide-react';

const SIDEBAR_WIDTH = 320;
const DAY_WIDTH = 44;
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 80; // Matches the 80px sticky header

const getInitials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getAvatarBg = (name: string) => {
  if (!name) return 'bg-slate-400';
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getTaskAssignees = (task: TimelineTask, allUsers: any[]) => {
  const direct = (task as any).assignedTo;
  if (Array.isArray(direct) && direct.length > 0) return direct;

  if (Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0) {
    return task.assigneeIds
      .map(id => allUsers.find(u => u.id === id))
      .filter(u => !!u)
      .map(u => ({ name: u.name, avatar: u.avatar }));
  }

  if (typeof task.assignee === 'string' && task.assignee) {
    const user = allUsers.find(u => u.id === task.assignee);
    if (user) return [{ name: user.name, avatar: user.avatar }];
  }

  return [];
};

const DEFAULT_SDLC_PHASES = [
  'PLANNING',
  'ANALYSIS',
  'DESIGN',
  'DEVELOPMENT',
  'TESTING',
  'DEPLOYMENT',
  'MAINTENANCE'
];

interface PremiumGanttTimelineProps {
  timeline: ProjectTimeline;
  onTaskUpdate?: (taskId: string, start: string, end: string) => void;
  onDependencyChange?: (fromTaskId: string, toTaskId: string, action: 'add' | 'remove') => void;
  isReadOnly?: boolean;
}

export const PremiumGanttTimeline: React.FC<PremiumGanttTimelineProps> = ({ 
  timeline, 
  onTaskUpdate, 
  onDependencyChange,
  isReadOnly 
}) => {
  const { users } = useAppStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  // Interactions & Optimistic UI State
  const [activeDrag, setActiveDrag] = useState<{
    taskId: string,
    type: 'move' | 'resize',
    startX: number,
    currentDayDiff: number,
    initialStart: string,
    initialEnd: string
  } | null>(null);

  // Connection State (Enhanced)
  const [links, setLinks] = useState<{ sourceId: string, targetId: string }[]>([]);
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);

  // Sync initial links from timeline
  useEffect(() => {
    const initialLinks: { sourceId: string, targetId: string }[] = [];
    timeline.tasks.forEach(task => {
      if (task.dependencies) {
        task.dependencies.forEach(depId => {
          initialLinks.push({ sourceId: depId, targetId: task.id });
        });
      }
    });
    setLinks(initialLinks);
  }, [timeline.tasks]);

  const { overloadedTaskIds } = useResourceLoad(timeline);
  const criticalTaskIds = useCriticalPath(timeline);

  const startDate = useMemo(() => startOfDay(parseISO(timeline.projectWindow.startDate)), [timeline]);
  const endDate = useMemo(() => startOfDay(parseISO(timeline.projectWindow.endDate)), [timeline]);

  const days = useMemo(() => {
    try {
      return eachDayOfInterval({ start: startDate, end: endDate });
    } catch (e) {
      return Array.from({ length: 30 }).map((_, i) => dateFnsAddDays(startDate, i));
    }
  }, [startDate, endDate]);

  const months = useMemo(() => {
    const result: { name: string; daysCount: number }[] = [];
    let currentMonth = '';
    let count = 0;

    days.forEach((day) => {
      const monthName = format(day, 'MMMM yyyy');
      if (monthName !== currentMonth) {
        if (currentMonth) result.push({ name: currentMonth, daysCount: count });
        currentMonth = monthName;
        count = 1;
      } else {
        count++;
      }
    });
    result.push({ name: currentMonth, daysCount: count });
    return result;
  }, [days]);

  const getAugmentedTask = (task: TimelineTask) => {
    if (!activeDrag || activeDrag.taskId !== task.id) return task;
    if (activeDrag.type === 'move') {
      const nextStart = format(dateFnsAddDays(parseISO(activeDrag.initialStart), activeDrag.currentDayDiff), 'yyyy-MM-dd');
      const nextEnd = format(dateFnsAddDays(parseISO(activeDrag.initialEnd), activeDrag.currentDayDiff), 'yyyy-MM-dd');
      return { ...task, startDate: nextStart, endDate: nextEnd };
    } else {
      const nextEnd = format(dateFnsAddDays(parseISO(activeDrag.initialEnd), activeDrag.currentDayDiff), 'yyyy-MM-dd');
      return { ...task, endDate: nextEnd };
    }
  };

  const allPhases = useMemo(() => {
    const existingPhases = timeline.phases || [];
    const result: TimelinePhase[] = [];

    DEFAULT_SDLC_PHASES.forEach((name, index) => {
      const existing = existingPhases.find(p => p.name.toUpperCase() === name);
      if (existing) {
        result.push(existing);
      } else {
        result.push({
          id: `default-${name.toLowerCase()}`,
          projectId: timeline.projectId,
          name: name,
          order: index,
          tasks: []
        });
      }
    });

    existingPhases.forEach(p => {
      if (!DEFAULT_SDLC_PHASES.includes(p.name.toUpperCase())) result.push(p);
    });

    return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [timeline]);

  const togglePhase = (phaseId: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  const handleDragStart = (e: React.MouseEvent, task: TimelineTask, type: 'move' | 'resize') => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setActiveDrag({
      taskId: task.id,
      type,
      startX: e.clientX,
      currentDayDiff: 0,
      initialStart: task.startDate,
      initialEnd: task.endDate
    });
  };

  const handleDragEnd = () => {
    if (!activeDrag || !onTaskUpdate) return;
    if (activeDrag.currentDayDiff !== 0) {
      const nextStart = activeDrag.type === 'move'
        ? format(dateFnsAddDays(parseISO(activeDrag.initialStart), activeDrag.currentDayDiff), 'yyyy-MM-dd')
        : activeDrag.initialStart;
      const nextEnd = format(dateFnsAddDays(parseISO(activeDrag.initialEnd), activeDrag.currentDayDiff), 'yyyy-MM-dd');
      onTaskUpdate(activeDrag.taskId, nextStart, nextEnd);
    }
    setActiveDrag(null);
  };

  const onMouseMoveGantt = (e: React.MouseEvent) => {
    if (activeDrag) {
       const dx = e.clientX - activeDrag.startX;
       const dayDiff = Math.round(dx / DAY_WIDTH);
       if (dayDiff !== activeDrag.currentDayDiff) {
         setActiveDrag({ ...activeDrag, currentDayDiff: dayDiff });
       }
    }

    if (linkingSourceId && scrollContainerRef.current) {
       const rect = scrollContainerRef.current.getBoundingClientRect();
       setMousePos({
         x: e.clientX - rect.left + scrollLeft,
         y: e.clientY - rect.top + scrollTop
       });
    }
  };

  const getStatusColor = (task: TimelineTask) => {
    const isOverdue = new Date(task.endDate) < new Date() && task.status !== 'done';
    if (isOverdue) return 'bg-rose-500';
    if (task.status === 'done') return 'bg-emerald-500';
    if (task.status === 'in_progress' || task.status === 'in_review') return 'bg-blue-500 shadow-blue-500/20';
    return 'bg-slate-400';
  };

  // Helper to get task position from DOM
  const getTaskPosFromDOM = (id: string, side: 'left' | 'right' = 'left') => {
    const el = document.getElementById(`task-bar-${id}`);
    if (!el || !scrollContainerRef.current) return null;
    
    const rect = el.getBoundingClientRect();
    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    
    return {
      x: (side === 'left' ? rect.left : rect.right) - containerRect.left + scrollLeft,
      y: (rect.top + rect.height / 2) - containerRect.top + scrollTop
    };
  };

  const handleLinkStart = (id: string) => {
    setLinkingSourceId(id);
  };

  const handleLinkEnd = (targetId: string) => {
    if (!linkingSourceId || linkingSourceId === targetId) {
      setLinkingSourceId(null);
      setMousePos(null);
      return;
    }

    // Check for existing link
    const exists = links.some(l => l.sourceId === linkingSourceId && l.targetId === targetId);
    if (exists) {
      setLinkingSourceId(null);
      setMousePos(null);
      return;
    }

    // Simple Circular Check
    const checkCircular = (fromId: string, toId: string, visited = new Set<string>()): boolean => {
      if (fromId === toId) return true;
      if (visited.has(fromId)) return false;
      visited.add(fromId);
      return links
        .filter(l => l.sourceId === fromId)
        .some(l => checkCircular(l.targetId, toId, visited));
    };

    if (checkCircular(targetId, linkingSourceId)) {
      alert("Circular dependency not allowed!");
      setLinkingSourceId(null);
      setMousePos(null);
      return;
    }

    const newLink = { sourceId: linkingSourceId, targetId };
    setLinks(prev => [...prev, newLink]);
    onDependencyChange?.(linkingSourceId, targetId, 'add');
    
    setLinkingSourceId(null);
    setMousePos(null);
  };

  return (
    <div
      className="relative flex flex-col h-[75vh] min-h-[600px] rounded-[32px] border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-950 overflow-hidden shadow-2xl shadow-surface-200/50 group/timeline"
      onMouseMove={onMouseMoveGantt}
      onMouseUp={() => { handleDragEnd(); setLinkingSourceId(null); setMousePos(null); }}
      onMouseLeave={() => { handleDragEnd(); setLinkingSourceId(null); setMousePos(null); }}
    >
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto scroll-smooth custom-scrollbar"
      >
        <div
          className="relative"
          style={{ width: SIDEBAR_WIDTH + days.length * DAY_WIDTH, height: 'auto' }}
        >
          {/* SVG Connection Layer */}
          <svg className="absolute inset-0 z-[5] pointer-events-none overflow-visible">
            <defs>
              <marker id="gantt-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
            </defs>
            {links.map((link, idx) => {
              const from = getTaskPosFromDOM(link.sourceId, 'right');
              const to = getTaskPosFromDOM(link.targetId, 'left');
              if (!from || !to) return null;

              // Manhattan Path
              const midX = from.x + (to.x - from.x) / 2;
              const d = `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;

              return (
                <path
                  key={idx}
                  d={d}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  fill="none"
                  markerEnd="url(#gantt-arrow)"
                  className="opacity-60 transition-all hover:stroke-brand-500 hover:stroke-[2px] pointer-events-auto cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Remove this link?")) {
                      setLinks(prev => prev.filter((_, i) => i !== idx));
                      onDependencyChange?.(link.sourceId, link.targetId, 'remove');
                    }
                  }}
                />
              );
            })}
            
            {/* Real-time Linking Preview */}
            {linkingSourceId && mousePos && (() => {
               const from = getTaskPosFromDOM(linkingSourceId, 'right');
               if (!from) return null;
               return (
                 <line 
                   x1={from.x} y1={from.y} 
                   x2={mousePos.x} y2={mousePos.y} 
                   stroke="#6366f1" 
                   strokeWidth="2" 
                   strokeDasharray="4 4" 
                 />
               );
            })()}
          </svg>

          {/* Sticky Headers */}
          <div className="sticky top-0 z-40 flex h-[80px]">
            <div
              className="sticky left-0 top-0 z-[60] flex h-[80px] flex-col justify-center border-b border-r border-surface-100 bg-white px-6 dark:border-surface-800 dark:bg-surface-950"
              style={{ width: SIDEBAR_WIDTH }}
            >
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-surface-400">Project Timeline</h3>
              <div className="mt-1 flex items-center gap-2 text-xs font-bold text-surface-900 dark:text-white">
                <span>{days.length} Day View</span>
                <span className="h-1 w-1 rounded-full bg-surface-200" />
                <span className="text-surface-400">{timeline.summary.totalTasks} Tasks</span>
              </div>
            </div>

            <div className="flex flex-col flex-1">
              <div className="flex h-10 border-b border-surface-100 dark:border-surface-800">
                {months.map((month, idx) => (
                  <div key={idx} className="flex shrink-0 items-center border-r border-surface-50 bg-surface-50/50 px-4 text-[11px] font-black uppercase tracking-wider text-surface-500 dark:border-surface-800 dark:bg-surface-900/50" style={{ width: month.daysCount * DAY_WIDTH }}>
                    {month.name}
                  </div>
                ))}
              </div>
              <div className="flex h-10 border-b border-surface-100 dark:border-surface-800">
                {days.map((day, idx) => {
                  const active = isToday(day);
                  return (
                    <div key={idx} className={cn("flex shrink-0 flex-col items-center justify-center border-r border-surface-50 text-[10px] font-bold dark:border-surface-800", active ? "bg-brand-50 text-brand-600 dark:bg-brand-950/30" : "bg-white text-surface-500 dark:bg-surface-950")} style={{ width: DAY_WIDTH }}>
                      <span className="uppercase opacity-60">{format(day, 'EEE')[0]}</span>
                      <span className={cn("text-xs", active && "text-brand-600 font-black")}>{format(day, 'dd')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 z-0 flex" style={{ left: SIDEBAR_WIDTH }}>
              {days.map((day, idx) => (
                <div key={idx} className={cn("shrink-0 border-r border-surface-50/50 dark:border-surface-800/50", isToday(day) && "bg-brand-50/10 dark:bg-brand-500/5")} style={{ width: DAY_WIDTH }} />
              ))}
            </div>

            <div className="relative z-10">
              {allPhases.map((phase) => (
                <PhaseGroup
                  key={phase.id}
                  phase={phase}
                  startDate={startDate}
                  getStatusColor={getStatusColor}
                  isCollapsed={collapsedPhases.has(phase.id)}
                  onToggle={() => togglePhase(phase.id)}
                  onDragStart={handleDragStart}
                  isReadOnly={isReadOnly}
                  getAugmentedTask={getAugmentedTask}
                  allUsers={users || []}
                  onLinkStart={handleLinkStart}
                  onLinkEnd={handleLinkEnd}
                  isLinking={!!linkingSourceId}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PhaseGroup: React.FC<{
  phase: TimelinePhase;
  startDate: Date;
  getStatusColor: (task: TimelineTask) => string;
  isCollapsed: boolean;
  onToggle: () => void;
  onDragStart: (e: React.MouseEvent, task: TimelineTask, type: 'move' | 'resize') => void;
  isReadOnly?: boolean;
  getAugmentedTask: (task: TimelineTask) => TimelineTask;
  allUsers: any[];
  onLinkStart: (taskId: string) => void;
  onLinkEnd: (taskId: string) => void;
  isLinking: boolean;
}> = ({ phase, startDate, getStatusColor, isCollapsed, onToggle, onDragStart, isReadOnly, getAugmentedTask, allUsers, onLinkStart, onLinkEnd, isLinking }) => {
  const hasTasks = phase.tasks && phase.tasks.length > 0;

  return (
    <div className="flex flex-col">
      <div className="group flex h-11 w-full cursor-pointer select-none" onClick={onToggle}>
        <div className="sticky left-0 z-[40] flex items-center border-b border-surface-100 bg-surface-50/50 px-4 backdrop-blur-sm dark:border-surface-800 dark:bg-surface-900/30" style={{ width: SIDEBAR_WIDTH }}>
          <div className="flex items-center gap-2">
            <div className={cn("flex h-5 w-5 items-center justify-center rounded-md border border-surface-200 bg-white text-surface-400 dark:border-surface-700 dark:bg-surface-800 transition-all", !isCollapsed && "bg-brand-50 border-brand-200 text-brand-600")}>
              <ChevronRight size={12} className={cn("transition-transform duration-200", !isCollapsed && "rotate-90")} />
            </div>
            <div className="flex flex-col">
              <span className={cn("text-[10px] font-black uppercase tracking-[0.1em] transition-colors", !isCollapsed ? "text-brand-600" : "text-surface-900 dark:text-white")}>{phase.name}</span>
              <span className="text-[8px] font-bold text-surface-400 uppercase tracking-widest">{phase.tasks.length} tasks</span>
            </div>
          </div>
        </div>
        <div className="flex-1 border-b border-surface-50/50 bg-surface-50/10 dark:border-surface-800/20 dark:bg-surface-900/5" />
      </div>

      {!isCollapsed && (
        <>
          {hasTasks ? (
            phase.tasks.map((origTask) => {
              const task = getAugmentedTask(origTask);
              const taskStart = parseISO(task.startDate);
              const taskEnd = parseISO(task.endDate);
              const offsetDays = differenceInDays(taskStart, startDate);
              const durationDays = differenceInDays(taskEnd, taskStart) + 1;
              const barWidth = durationDays * DAY_WIDTH;
              const leftOffset = SIDEBAR_WIDTH + offsetDays * DAY_WIDTH;

              const resolvedAssignees = getTaskAssignees(task, allUsers);

              return (
                <div key={task.id} className="group/row relative flex h-11 transition-colors hover:bg-surface-50/50 dark:hover:bg-surface-800/10">
                  <div className="sticky left-0 z-[40] flex flex-col justify-center border-r border-surface-100 bg-white px-4 pl-10 shadow-[4px_0_12px_rgba(0,0,0,0.01)] dark:border-surface-800 dark:bg-surface-950" style={{ width: SIDEBAR_WIDTH }}>
                    <div className="flex items-center gap-2">
                       <h4 className="truncate text-[12px] font-bold text-surface-900 dark:text-surface-100 leading-tight">{task.title}</h4>
                    </div>
                    <div className="mt-0 flex items-center gap-1 text-[9px] font-bold text-surface-400">
                      <Calendar size={9} />
                      <span>{format(taskStart, 'MMM dd')} - {format(taskEnd, 'MMM dd')}</span>
                    </div>
                  </div>

                  <div className="flex-1 border-b border-surface-50/50 dark:border-surface-800/30">
                    <GanttTooltip task={task} isDisabled={isLinking}>
                      <div
                        id={`task-bar-${task.id}`}
                        className={cn(
                          "absolute top-1/2 z-[30] flex h-7 -translate-y-1/2 items-center rounded-lg p-0.5 shadow-md shadow-black/5 group/bar",
                          getStatusColor(task),
                          !isReadOnly && "cursor-grab active:cursor-grabbing hover:scale-[1.01] transition-transform"
                        )}
                        style={{ left: leftOffset + 4, width: barWidth - 8 }}
                        onMouseDown={(e) => onDragStart(e, task, 'move')}
                        onMouseUp={(e) => {
                           if (isLinking) {
                              e.stopPropagation();
                              onLinkEnd(task.id);
                           }
                        }}
                      >
                        <div className="absolute inset-y-0.5 left-0.5 rounded-md bg-white/20 pointer-events-none" style={{ width: `${task.progress || 0}%` }} />
                        
                        {/* Connection Handles */}
                        {!isReadOnly && (
                          <>
                            <div className="connector left absolute -left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white border border-surface-300 z-50 pointer-events-none opacity-0 group-hover/bar:opacity-100 transition-opacity">
                              <div className="h-1 w-1 rounded-full bg-surface-300 m-auto mt-1" />
                            </div>
                            <div 
                              className="connector right absolute -right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center z-50 cursor-crosshair opacity-0 group-hover/bar:opacity-100 transition-opacity"
                              onMouseDown={(e) => {
                                 e.stopPropagation();
                                 onLinkStart(task.id);
                              }}
                            >
                              <div className="h-3 w-3 rounded-full bg-brand-500 border-2 border-white shadow-sm" />
                            </div>
                          </>
                        )}

                        <div className="relative z-10 flex w-full items-center justify-between px-1.5 gap-2">
                          <div className="flex items-center gap-1 min-w-0">
                            <div className="flex -space-x-1.5 flex-shrink-0">
                              {resolvedAssignees.slice(0, 2).map((user: any, idx: number) => (
                                <Tooltip.Provider key={idx} delayDuration={50}>
                                  <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                      <div className="relative group/avatar transition-all hover:scale-110 active:scale-95 hover:z-20">
                                        {user.avatar ? (
                                          <img src={user.avatar} className="h-5 w-5 rounded-full border border-white shadow-md object-cover" alt={user.name} />
                                        ) : (
                                          <div className={cn("h-5 w-5 rounded-full border border-white shadow-md flex items-center justify-center text-[7px] font-black text-white", getAvatarBg(user.name))}>
                                            {getInitials(user.name)}
                                          </div>
                                        )}
                                      </div>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                      <Tooltip.Content side="top" className="z-[10000] rounded-xl bg-surface-900 px-3 py-1.5 text-xs font-bold text-white shadow-xl animate-in font-display">
                                         {user.name}
                                         <Tooltip.Arrow className="fill-surface-900" />
                                      </Tooltip.Content>
                                    </Tooltip.Portal>
                                  </Tooltip.Root>
                                </Tooltip.Provider>
                              ))}
                              {resolvedAssignees.length > 2 && (
                                <div className="h-5 w-5 rounded-full border border-white bg-white/10 backdrop-blur-md flex items-center justify-center text-[7px] font-black text-white shadow-md">
                                  +{resolvedAssignees.length - 2}
                                </div>
                              )}
                            </div>
                            <span className="truncate text-[10px] font-black uppercase tracking-wider text-white pointer-events-none">{task.title}</span>
                          </div>
                          <span className="text-[9px] font-black text-white/90 pointer-events-none">{task.progress || 0}%</span>
                        </div>
                        
                        {!isReadOnly && (
                          <div className="absolute right-0 inset-y-0 w-3 cursor-ew-resize hover:bg-white/10 active:bg-white/20 rounded-r-xl" onMouseDown={(e) => onDragStart(e, task, 'resize')} />
                        )}
                      </div>
                    </GanttTooltip>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex h-12 w-full">
              <div className="sticky left-0 z-[40] flex items-center pl-10 border-r border-surface-50 bg-white dark:bg-surface-950" style={{ width: SIDEBAR_WIDTH }}>
                <span className="text-[10px] font-bold italic text-surface-300">No tasks planned</span>
              </div>
              <div className="flex-1 border-b border-surface-50/30" />
            </div>
          )}
        </>
      )}
    </div>
  );
};
