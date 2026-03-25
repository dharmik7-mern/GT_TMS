import React, { useMemo, useState, useEffect } from 'react';
import { 
  Calendar, List, Table as TableIcon, 
  ChevronLeft, ChevronRight, Lock, Unlock,
  Plus, Trash2, AlertCircle, CheckCircle2,
  Clock, Flag, User, MapPin, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, addDays, differenceInDays, 
  startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isWithinInterval, parseISO,
  isBefore, isAfter, min as minDate, max as maxDate
} from 'date-fns';
import { cn } from '../../utils/helpers';
import { EmptyState, ProgressBar, Dropdown } from '../../components/ui';
import { Modal } from '../../components/Modal';

import { timelineService, projectsService } from '../../services/api';

import { emitSuccessToast, emitErrorToast } from '../../context/toastBus';
import type { TimelineTask, ProjectTimeline } from '../../app/types';
import { useAuthStore } from '../../context/authStore';
import { UserAvatar, AvatarGroup } from '../UserAvatar';
import { getProgressColor, formatDate } from '../../utils/helpers';

interface ProjectTimelineModuleProps {
  projectId: string;
  isLocked?: boolean;
  canEdit?: boolean;
}

const ROLES = ['Frontend Developer', 'Backend Developer', 'UI/UX Designer', 'Project Manager', 'QA Engineer', 'DevOps'];

export const ProjectTimelineModule: React.FC<ProjectTimelineModuleProps> = ({ 
  projectId, 
  isLocked: propLocked,
  canEdit: propCanEdit 
}) => {
  const { user } = useAuthStore();
  const [view, setView] = useState<'table' | 'gantt'>('table');
  const [timeline, setTimeline] = useState<ProjectTimeline | null>(null);
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [project, setProject] = useState<any>(null);

  
  // Gantt State
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(addDays(new Date(), 30));


  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);
  
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isLocked = timeline?.status === 'Approved';
  const canModify = !isLocked || isAdmin;

  useEffect(() => {
    fetchTimeline();
  }, [projectId]);

  const fetchTimeline = async () => {
    try {
      setIsLoading(true);
      // Fetch both project details and timeline in parallel
      const [timelineRes, projectRes] = await Promise.all([
        timelineService.get(projectId),
        projectsService.getById(projectId)
      ]);

      const data = timelineRes.data.data;
      const proj = projectRes.data.data ?? projectRes.data;
      
      setProject(proj);

      if (proj && proj.startDate) {
        const pStart = parseISO(proj.startDate);
        setStartDate(pStart);
        // If the project has an end date, use it, otherwise use start + 30 days
        if (proj.endDate) {
           setEndDate(addDays(parseISO(proj.endDate), 30));
        } else {
           setEndDate(addDays(pStart, 30));
        }
      }

      if (data) {
        setTimeline(data);
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSave = async (updatedTasks = tasks, updatedStatus = timeline?.status || 'Draft') => {
    try {
      setIsSaving(true);
      
      // Auto-recalculate delays for all tasks before saving
      const finalTasks = updatedTasks.map(t => calculateTaskMetrics(t));

      const res = await timelineService.upsert(projectId, { 
        tasks: finalTasks, 
        status: updatedStatus 
      });
      setTimeline(res.data.data);
      setTasks(res.data.data.tasks || []);
      emitSuccessToast('Timeline saved successfully', 'Success');
    } catch (err: any) {
      emitErrorToast(err.response?.data?.message || 'Failed to save timeline', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateTaskMetrics = (task: TimelineTask): TimelineTask => {
    const updated = { ...task };
    const today = new Date();
    const plannedEnd = parseISO(updated.plannedEndDate);

    // Auto-status detection for delays
    if (updated.status !== 'completed' && isAfter(today, plannedEnd)) {
      updated.status = 'delayed';
    }

    // Delay calculation
    if (updated.actualEndDate) {
      const actualEnd = parseISO(updated.actualEndDate);
      if (isAfter(actualEnd, plannedEnd)) {
        updated.delayDays = differenceInDays(actualEnd, plannedEnd);
      } else {
        updated.delayDays = 0;
      }
    } else if (updated.status === 'delayed') {
       updated.delayDays = differenceInDays(today, plannedEnd);
    } else {
       updated.delayDays = 0;
    }

    // Variance calculation
    if (updated.actualDuration && updated.plannedDuration) {
      updated.varianceDays = updated.actualDuration - updated.plannedDuration;
    }

    return updated;
  };

  const addTask = () => {
    if (!canModify) return;
    const start = project?.startDate || format(new Date(), 'yyyy-MM-dd');
    const end = project?.endDate || format(addDays(new Date(), 5), 'yyyy-MM-dd');
    const dur = differenceInDays(parseISO(end), parseISO(start)) + 1;

    const newTask: TimelineTask = {
      id: `task-${Date.now()}`,
      taskName: 'New Task',
      startDate: start,
      endDate: end,
      duration: dur,
      plannedStartDate: start,
      plannedEndDate: end,
      plannedDuration: dur,
      progress: 0,
      status: 'not_started'
    };

    setTasks([...tasks, newTask]);
  };

  const updateTask = (id: string, updates: Partial<TimelineTask>) => {
    const newTasks = tasks.map(t => {
      if (t.id !== id) return t;
      
      let updated = { ...t, ...updates };

      // Baseline locking logic: can't change planned dates if approved unless admin
      if (isLocked && !isAdmin && (updates.plannedStartDate || updates.plannedEndDate)) {
          return t;
      }
      
      // Auto-set Actual Start Date when progress starts or status changes to in_progress
      if ((updates.progress && updates.progress > 0 && !updated.actualStartDate) || 
          (updates.status === 'in_progress' && !updated.actualStartDate)) {
          updated.actualStartDate = format(new Date(), 'yyyy-MM-dd');
          if (!updated.status || updated.status === 'not_started') updated.status = 'in_progress';
      }

      // Auto-set Actual End Date when progress reaches 100% or status completed
      if ((updates.progress === 100 && !updated.actualEndDate) || 
          (updates.status === 'completed' && !updated.actualEndDate)) {
          updated.actualEndDate = format(new Date(), 'yyyy-MM-dd');
          updated.status = 'completed';
          updated.progress = 100;
      }

      // Handle Date dependencies and duration calculations
      if (updates.plannedStartDate || updates.plannedEndDate) {
        const pStart = parseISO(updated.plannedStartDate);
        const pEnd = parseISO(updated.plannedEndDate);
        if (isBefore(pEnd, pStart)) {
          updated.plannedEndDate = updated.plannedStartDate;
          updated.plannedDuration = 1;
        } else {
          updated.plannedDuration = differenceInDays(pEnd, pStart) + 1;
        }
        // Sync legacy fields
        updated.startDate = updated.plannedStartDate;
        updated.endDate = updated.plannedEndDate;
        updated.duration = updated.plannedDuration;
      }

      if (updated.actualStartDate && updated.actualEndDate) {
        const aStart = parseISO(updated.actualStartDate);
        const aEnd = parseISO(updated.actualEndDate);
        if (isBefore(aEnd, aStart)) {
          updated.actualEndDate = updated.actualStartDate;
          updated.actualDuration = 1;
        } else {
          updated.actualDuration = differenceInDays(aEnd, aStart) + 1;
        }
      }

      // Re-calculate metrics
      updated = calculateTaskMetrics(updated);

      return updated;
    });
    setTasks(newTasks);
  };

  const removeTask = (id: string) => {
    if (!canModify) return;
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleLockUnlock = async () => {
    if (!isAdmin) return;
    try {
       const res = isLocked 
         ? await timelineService.unlock(projectId)
         : await timelineService.lock(projectId);
       setTimeline(res.data.data);
       emitSuccessToast(`Timeline ${isLocked ? 'unlocked' : 'approved'}`, 'Success');
    } catch (err: any) {
       emitErrorToast(err.response?.data?.message || 'Action failed', 'Error');
    }
  };

  const projectStats = useMemo(() => {
    if (tasks.length === 0) return { totalDuration: 0, totalCost: 0, totalDelay: 0, avgVariance: 0 };
    
    const projectStart = new Date(Math.min(...tasks.map(t => parseISO(t.plannedStartDate || t.startDate).getTime())));
    const projectEnd = new Date(Math.max(...tasks.map(t => parseISO(t.actualEndDate || t.plannedEndDate || t.endDate).getTime())));
    
    const totalDelay = tasks.reduce((acc, t) => acc + (t.delayDays || 0), 0);
    const totalVariance = tasks.reduce((acc, t) => acc + (t.varianceDays || 0), 0);
    
    return {
      totalDuration: differenceInDays(projectEnd, projectStart) + 1,
      totalCost: tasks.reduce((acc, t) => acc + ((t.actualDuration || t.plannedDuration || t.duration) * 8 * 50), 0),
      totalDelay,
      avgVariance: totalVariance / tasks.length
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (filterStatus === 'all') return tasks;
    return tasks.filter(t => {
      if (filterStatus === 'delayed') return t.status === 'delayed';
      if (filterStatus === 'completed') return t.status === 'completed';
      if (filterStatus === 'in_progress') return t.status === 'in_progress';
      return true;
    });
  }, [tasks, filterStatus]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <Clock className="w-10 h-10 text-brand-300 mb-4" />
        <p className="text-surface-400">Loading timeline...</p>
      </div>
    );
  }

  // --- Calculations for UI ---
  const members = project?.members ? [] : []; // We'd ideally fetch project members here, but project.members might be IDs

  return (
    <div className="flex flex-col h-full space-y-3 max-h-[calc(100vh-180px)] overflow-hidden">
      {/* 1. COMPACT HEADER */}
      <div className="flex items-center justify-between gap-4 py-2 border-b border-surface-100 dark:border-surface-800 flex-shrink-0">
        <div className="flex items-center gap-6 overflow-hidden">
          <div className="flex items-center gap-3 shrink-0">
             <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: project?.color || '#4F46E5' }}>
               {project?.name?.[0] || 'P'}
             </div>
             <div className="flex flex-col justify-center">
               <h2 className="text-sm font-bold text-surface-900 dark:text-white truncate max-w-[150px]">{project?.name}</h2>
               <span className="text-[10px] text-surface-400 font-medium uppercase tracking-tighter">Timeline Board</span>
             </div>
          </div>

          <div className="h-4 w-[1px] bg-surface-200 dark:bg-surface-700 hidden sm:block" />

          {/* Progress */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-surface-400 uppercase font-bold">Progress</span>
            <div className="w-20 h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500" style={{ width: `${project?.progress || 0}%` }} />
            </div>
            <span className="text-xs font-bold text-surface-700 dark:text-surface-300">{project?.progress || 0}%</span>
          </div>

          {/* Due date */}
          <div className="hidden xl:flex items-center gap-2 shrink-0">
             <Calendar size={12} className="text-surface-400" />
             <span className="text-xs font-semibold text-surface-700 dark:text-surface-400">
               {project?.endDate ? formatDate(project.endDate) : 'No deadline'}
             </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canModify && (
            <button 
              onClick={addTask} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 text-xs font-bold rounded-lg transition-all"
            >
              <Plus size={14} /> Add Task
            </button>
          )}

          {isAdmin && (
            <button 
              onClick={handleLockUnlock}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold rounded-lg transition-all",
                isLocked ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-brand-50 text-brand-700 border-brand-200"
              )}
            >
              {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
              {isLocked ? 'Unlock' : 'Approve'}
            </button>
          )}

          {canModify && (
            <button 
              onClick={() => handleSave()} 
              disabled={isSaving}
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm shadow-brand-200 dark:shadow-none"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {/* 2. SUMMARY BAR (HORIZONTAL) */}
      <div className="flex items-center gap-8 px-4 py-2.5 bg-surface-50/50 dark:bg-surface-800/20 rounded-xl border border-surface-100 dark:border-surface-800 flex-shrink-0">
         <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-surface-300 uppercase tracking-widest">Planned Cost:</span>
            <span className="text-xs font-bold text-brand-600">₹{projectStats.totalCost.toLocaleString()}</span>
         </div>
         <div className="w-[1px] h-3 bg-surface-200 dark:bg-surface-700" />
         <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-rose-300 dark:text-rose-900/50 uppercase tracking-widest">Delay:</span>
            <span className={cn("text-xs font-bold", projectStats.totalDelay > 0 ? "text-rose-500" : "text-surface-400")}>
              {projectStats.totalDelay} Days
            </span>
         </div>
         <div className="w-[1px] h-3 bg-surface-200 dark:bg-surface-700" />
         <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-surface-300 uppercase tracking-widest">Duration:</span>
            <span className="text-xs font-bold text-surface-700 dark:text-surface-300">{projectStats.totalDuration} Days</span>
         </div>
         <div className="w-[1px] h-3 bg-surface-200 dark:bg-surface-700" />
         <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-surface-300 uppercase tracking-widest">Status:</span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest",
              projectStats.totalDelay > 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
            )}>
              {projectStats.totalDelay > 0 ? 'Delayed' : 'On Track'}
            </span>
         </div>

         {/* View Toggle integrated in Summary Bar area */}
         <div className="ml-auto flex items-center gap-1 bg-surface-200/50 dark:bg-surface-900/50 p-0.5 rounded-lg">
           <button 
             onClick={() => setView('table')}
             className={cn("p-1 rounded transition-all", view === 'table' ? "bg-white dark:bg-surface-700 shadow-xs text-brand-600" : "text-surface-400")}
           >
             <TableIcon size={14} />
           </button>
           <button 
             onClick={() => setView('gantt')}
             className={cn("p-1 rounded transition-all", view === 'gantt' ? "bg-white dark:bg-surface-700 shadow-xs text-brand-600" : "text-surface-400")}
           >
             <Calendar size={14} />
           </button>
         </div>
      </div>

      {isLocked && !isAdmin && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/50 rounded-lg flex-shrink-0">
          <Lock size={14} className="text-brand-600" />
          <p className="text-[11px] text-brand-700 dark:text-brand-300 font-medium">Timeline Approved. Baseline dates locked.</p>
        </div>
      )}

      {/* 3. MAIN TABLE AREA */}
      <AnimatePresence mode="wait">
        {view === 'table' ? (
          <motion.div 
            key="table-view"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex-1 overflow-hidden flex flex-col border border-surface-100 dark:border-surface-800 rounded-xl bg-white dark:bg-surface-900"
          >
            <div className="overflow-x-auto flex-1 scrollbar-hide">
              <table className="w-full text-sm min-w-[1000px] border-collapse relative">
                <thead className="sticky top-0 z-30 bg-surface-50 dark:bg-surface-900 border-b border-surface-100 dark:border-surface-800">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-surface-400">
                    <th className="px-4 py-3 text-left w-64">Task</th>
                    <th className="px-4 py-3 text-left w-44">Baseline</th>
                    <th className="px-4 py-3 text-left w-44">Actual</th>
                    <th className="px-4 py-3 text-center w-24 whitespace-nowrap">Var</th>
                    <th className="px-4 py-3 text-left w-48">Assignee</th>
                    <th className="px-4 py-3 text-center w-28 whitespace-nowrap">Status</th>
                    {canModify && <th className="px-4 py-3 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-50 dark:divide-surface-800/50">
                  {filteredTasks.map((task) => {
                    const isDelayed = task.status === 'delayed';
                    const varianceColor = (task.varianceDays || 0) > 0 ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/20' : (task.varianceDays || 0) < 0 ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'text-surface-400 bg-surface-50 dark:bg-surface-800';
                    
                    return (
                      <tr key={task.id} className={cn(
                        "group h-12 hover:bg-surface-50/50 dark:hover:bg-surface-800/20 transition-colors",
                        isDelayed && "bg-rose-50/20 dark:bg-rose-950/5"
                      )}>
                        <td className="px-4 py-2">
                          <div className="flex flex-col gap-0.5">
                            <input 
                              value={task.taskName} 
                              onChange={(e) => updateTask(task.id, { taskName: e.target.value })}
                              disabled={!canModify}
                              className="bg-transparent border-none p-0 focus:ring-0 font-bold text-surface-800 dark:text-surface-200 w-full text-xs"
                              placeholder="Task name..."
                            />
                            <div className="w-24 h-1 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden mt-0.5">
                              <div className="h-full bg-brand-500/60" style={{ width: `${task.progress}%` }} />
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-2">
                          <div className="flex flex-col leading-none">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-surface-500">
                              <span>{task.plannedStartDate ? format(parseISO(task.plannedStartDate), 'MMM d') : '-'}</span>
                              <ChevronRight size={10} className="text-surface-300" />
                              <span>{task.plannedEndDate ? format(parseISO(task.plannedEndDate), 'MMM d') : '-'}</span>
                            </div>
                            <span className="text-[9px] text-surface-400 font-medium uppercase mt-1 tracking-tighter">
                              {task.plannedDuration} days Plan
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-2">
                          {!task.actualStartDate ? (
                             <span className="text-[11px] text-surface-300 font-bold tracking-widest">—</span>
                          ) : (
                            <div className="flex flex-col leading-none">
                              <div className="flex items-center gap-2 text-[11px] font-bold text-surface-700 dark:text-surface-300">
                                <span>{format(parseISO(task.actualStartDate), 'MMM d')}</span>
                                <ChevronRight size={10} className="text-surface-400" />
                                <span>{task.actualEndDate ? format(parseISO(task.actualEndDate), 'MMM d') : '...'}</span>
                              </div>
                              <span className="text-[9px] text-surface-400 font-medium uppercase mt-1 tracking-tighter">
                                {task.actualDuration ? `${task.actualDuration}d Actual` : 'In Progress'}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-2 text-center">
                          <div className={cn("px-1.5 py-0.5 rounded text-[10px] font-black tracking-tight inline-block", varianceColor)}>
                             {task.varianceDays && task.varianceDays > 0 ? `+${task.varianceDays}` : task.varianceDays || 0}d
                          </div>
                        </td>

                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center border border-surface-200 dark:border-surface-700 shrink-0">
                               <User size={12} className="text-surface-400" />
                             </div>
                             <div className="flex flex-col min-w-0">
                               <Dropdown 
                                value={task.assignedRole || ''}
                                onChange={(val) => updateTask(task.id, { assignedRole: val })}
                                disabled={!canModify}
                                placeholder="Role"
                                triggerClassName="p-0 border-none bg-transparent h-auto text-[11px] font-bold text-surface-700 dark:text-surface-300 text-left min-w-0"
                                items={ROLES.map(r => ({ id: r, label: r }))}
                              />
                             </div>
                          </div>
                        </td>

                        <td className="px-4 py-2 text-center">
                          <Dropdown 
                            value={task.status}
                            onChange={(val) => updateTask(task.id, { status: val as any })}
                            triggerClassName={cn(
                               "text-[10px] h-6 font-black uppercase tracking-tight px-3 py-0 min-w-[80px] rounded-md border text-center mx-auto",
                               task.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                               task.status === 'in_progress' ? 'bg-brand-50 text-brand-600 border-brand-100' :
                               task.status === 'delayed' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                               'bg-surface-50 text-surface-400 border-surface-100 dark:border-surface-800'
                            )}
                            items={[
                              { id: 'not_started', label: 'To Do' },
                              { id: 'in_progress', label: 'Active' },
                              { id: 'completed', label: 'Done' },
                              { id: 'delayed', label: 'Delay' },
                            ]}
                          />
                        </td>
                        {canModify && (
                          <td className="px-4 py-2">
                            <button 
                              onClick={() => removeTask(task.id)}
                              className="p-1.5 text-surface-300 hover:text-rose-500 transition-colors rounded-md opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="gantt-view"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="card p-0 overflow-hidden flex flex-col h-[500px]"
          >
            {/* Gantt Header/Dates */}
            <div className="flex border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30">
              <div className="w-64 flex-shrink-0 border-r border-surface-100 dark:border-surface-700 px-4 py-3 font-bold text-xs uppercase tracking-wider text-surface-400">
                Tasks
              </div>
              <div className="flex-1 overflow-x-auto scrollbar-hide flex">
                 <div className="flex min-w-max">
                    {days.map((day, i) => {
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div key={i} className={cn(
                          "w-10 h-10 flex flex-col items-center justify-center border-r border-surface-100/50 dark:border-surface-700/50 flex-shrink-0",
                          isWeekend && "bg-surface-100/50 dark:bg-surface-800/40",
                          isToday && "bg-brand-50/50 dark:bg-brand-950/30"
                        )}>
                          <span className="text-[9px] text-surface-400 dark:text-surface-500 uppercase">{format(day, 'EEE')}</span>
                          <span className={cn("text-[11px] font-bold", isToday ? "text-brand-600 dark:text-brand-400" : "text-surface-600 dark:text-surface-300")}>
                            {format(day, 'd')}
                          </span>
                        </div>
                      );
                    })}
                 </div>
              </div>
            </div>

            {/* Gantt Body */}
            <div className="flex-1 overflow-hidden flex">
               {/* Left column titles with fixed width */}
               <div className="w-64 flex-shrink-0 border-r border-surface-100 dark:border-surface-700 bg-surface-50/20 dark:bg-surface-900/10 overflow-y-auto scrollbar-hide">
                  {filteredTasks.map(task => (
                    <div key={task.id} className="h-16 border-b border-surface-100/50 dark:border-surface-800/50 px-4 flex flex-col justify-center gap-0.5">
                       <span className="text-[13px] font-bold text-surface-800 dark:text-surface-200 truncate">{task.taskName}</span>
                       <div className="flex items-center gap-2">
                        <span className="text-[9px] text-surface-400 font-bold uppercase tracking-tighter">{task.status.replace('_', ' ')}</span>
                        {task.delayDays && task.delayDays > 0 ? (
                           <span className="text-[9px] font-black text-rose-500 px-1 rounded bg-rose-50 dark:bg-rose-950/30 flex items-center gap-0.5">
                             <AlertCircle size={8} /> {task.delayDays}d
                           </span>
                        ) : null}
                       </div>
                    </div>
                  ))}
                  {filteredTasks.length === 0 && (
                    <div className="h-16 flex items-center px-4 text-[11px] text-surface-400 font-medium">No active tasks</div>
                  )}
               </div>

               {/* Right column bars scroll independently */}
               <div className="flex-1 overflow-auto relative group/canvas">
                  <div className="min-w-max">
                     {filteredTasks.map(task => {
                        const pStart = parseISO(task.plannedStartDate || task.startDate);
                        const pEnd = parseISO(task.plannedEndDate || task.endDate);
                        const aStart = task.actualStartDate ? parseISO(task.actualStartDate) : null;
                        const aEnd = task.actualEndDate ? parseISO(task.actualEndDate) : (task.status !== 'completed' ? new Date() : null);
                        
                        // Baseline Pos
                        const pOffset = differenceInDays(pStart, days[0]);
                        const pWidth = differenceInDays(pEnd, pStart) + 1;
                        
                        // Actual Pos
                        const aOffset = aStart ? differenceInDays(aStart, days[0]) : null;
                        const aWidth = (aStart && aEnd) ? Math.max(differenceInDays(aEnd, aStart) + 1, 0.5) : 0;

                        const isDelayed = task.status === 'delayed';

                        return (
                          <div key={task.id} className="h-16 border-b border-surface-100/50 dark:border-surface-800/50 relative">
                             {/* Baseline Bar (Planned) */}
                             <div 
                                className="absolute top-4 h-2 rounded bg-surface-200 dark:bg-surface-800 z-10 opacity-60 border border-surface-300 dark:border-surface-700"
                                style={{ 
                                  left: `${pOffset * 40}px`, 
                                  width: `${Math.max(pWidth * 40, 5)}px` 
                                }}
                                title={`Planned: ${format(pStart, 'MMM d')} - ${format(pEnd, 'MMM d')}`}
                             />

                             {/* Actual Bar (Execution) */}
                             {aStart && (
                               <div 
                                  className={cn(
                                    "absolute top-8 h-4 rounded-md shadow-sm flex items-center px-2 z-20 group/bar transition-all",
                                    isDelayed ? "bg-rose-500/90" : 
                                    task.status === 'completed' ? "bg-emerald-500/90" : "bg-brand-500"
                                  )}
                                   style={{ 
                                     left: `${(aOffset || 0) * 40}px`, 
                                     width: `${Math.max(aWidth * 40, 10)}px`,
                                     minWidth: '10px'
                                   }}
                               >
                                  {/* Progress Overlay */}
                                  <div 
                                    className="absolute inset-0 bg-white/10 dark:bg-black/10 z-0" 
                                    style={{ width: `${task.progress}%` }} 
                                  />

                                  {/* Label if wide enough */}
                                  {aWidth > 2 && (
                                    <span className="text-[8px] font-black text-white z-10 truncate uppercase tracking-tighter mix-blend-overlay">
                                      {task.progress}%
                                    </span>
                                  )}

                                  {/* Delay Marker Tooltip-like */}
                                  {isDelayed && (
                                     <div className="absolute -top-6 left-0 bg-rose-600 text-white text-[8px] px-1 rounded font-bold whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                       DELAYED {task.delayDays}d
                                     </div>
                                  )}
                               </div>
                             )}
                             
                             {/* Daily grid lines */}
                             <div className="absolute inset-0 flex">
                                {days.map((_, i) => (
                                  <div key={i} className="w-10 border-r border-surface-50/50 dark:border-surface-800/30 h-full" />
                                ))}
                             </div>
                          </div>
                        );
                     })}
                  </div>
               </div>
            </div>

            {/* Legend / Footer */}
            <div className="p-3 bg-surface-50 dark:bg-surface-800/50 border-t border-surface-100 dark:border-surface-700 flex items-center gap-6 justify-center">
               <div className="flex items-center gap-2">
                  <div className="w-3 h-1 bg-surface-300 dark:bg-surface-700 rounded" />
                  <span className="text-[10px] text-surface-500 dark:text-surface-400 font-bold uppercase tracking-widest">Baseline (Planned)</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-brand-500 border border-brand-600 rounded" />
                  <span className="text-[10px] text-surface-500 dark:text-surface-400 font-bold uppercase tracking-widest">Execution (Actual)</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-rose-500 border border-rose-600 rounded" />
                  <span className="text-[10px] text-rose-500 dark:text-rose-400 font-bold uppercase tracking-widest">Delayed Execution</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 border border-emerald-600 rounded" />
                  <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold uppercase tracking-widest">Completed Early/On-Time</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tasks.length === 0 && !isLoading && (
        <div className="flex-1 border border-dashed border-surface-200 dark:border-surface-800 rounded-xl flex items-center justify-center p-10 bg-surface-50/30">
          <EmptyState 
            icon={<Clock size={24} />}
            title="No timeline data yet"
            description="Build your project roadmap by adding timeline stages."
            action={<button onClick={addTask} className="btn-primary btn-sm"><Plus size={14} /> Create Timeline Stage</button>}
          />
        </div>
      )}
    </div>
  );
};
