import React, { useMemo, useState, useEffect } from 'react';
import { 
  Calendar, List, Table as TableIcon, 
  ChevronLeft, ChevronRight, Lock, Unlock,
  Plus, Trash2, AlertCircle, CheckCircle2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, addDays, differenceInDays, 
  startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isWithinInterval, parseISO,
  isBefore, isAfter
} from 'date-fns';
import { cn } from '../../utils/helpers';
import { EmptyState, ProgressBar } from '../../components/ui';
import { Modal } from '../../components/Modal';

import { timelineService, projectsService } from '../../services/api';

import { emitSuccessToast, emitErrorToast } from '../../context/toastBus';
import type { TimelineTask, ProjectTimeline } from '../../app/types';
import { useAuthStore } from '../../context/authStore';

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
      const res = await timelineService.upsert(projectId, { 
        tasks: updatedTasks, 
        status: updatedStatus 
      });
      setTimeline(res.data.data);
      emitSuccessToast('Timeline saved successfully', 'Success');
    } catch (err: any) {
      emitErrorToast(err.response?.data?.message || 'Failed to save timeline', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const addTask = () => {
    if (!canModify) return;
    const newTask: TimelineTask = {
      id: `task-${Date.now()}`,
      taskName: 'New Task',
      startDate: project?.startDate || format(new Date(), 'yyyy-MM-dd'),
      endDate: project?.endDate || format(addDays(new Date(), 5), 'yyyy-MM-dd'),
      duration: project?.startDate && project?.endDate 
        ? differenceInDays(parseISO(project.endDate), parseISO(project.startDate)) + 1 
        : 6,
      progress: 0,
      status: 'pending'
    };

    setTasks([...tasks, newTask]);
  };

  const updateTask = (id: string, updates: Partial<TimelineTask>) => {
    if (!canModify) return;
    const newTasks = tasks.map(t => {
      if (t.id !== id) return t;
      
      const updated = { ...t, ...updates };
      
      // Auto-calculate duration
      if (updates.startDate || updates.endDate) {
        const start = parseISO(updated.startDate);
        const end = parseISO(updated.endDate);
        if (isBefore(end, start)) {
          // Validation: End date cannot be before start date
          updated.endDate = updated.startDate;
          updated.duration = 1;
        } else {
          updated.duration = differenceInDays(end, start) + 1;
        }
      }

      // Dependency Logic
      if (updated.dependencyTaskId) {
        const parent = tasks.find(pt => pt.id === updated.dependencyTaskId);
        if (parent) {
          const parentEnd = parseISO(parent.endDate);
          const currentStart = parseISO(updated.startDate);
          if (isBefore(currentStart, addDays(parentEnd, 0))) {
             // Constraint: Must start after or on parent end date (adjusting as per req)
             // req says: Task B startDate must be ≥ Task A endDate + 1
             const minStart = addDays(parentEnd, 1);
             updated.startDate = format(minStart, 'yyyy-MM-dd');
             const end = parseISO(updated.endDate);
             if (isBefore(end, minStart)) {
                updated.endDate = updated.startDate;
                updated.duration = 1;
             } else {
                updated.duration = differenceInDays(end, minStart) + 1;
             }
          }
        }
      }
      
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

  const totalDuration = useMemo(() => {
    if (tasks.length === 0) return 0;
    const projectStart = new Date(Math.min(...tasks.map(t => parseISO(t.startDate).getTime())));
    const projectEnd = new Date(Math.max(...tasks.map(t => parseISO(t.endDate).getTime())));
    return differenceInDays(projectEnd, projectStart) + 1;
  }, [tasks]);

  const totalCost = useMemo(() => {
    // Dummy cost calculation logic for connection: duration * 8 hours * 50 rate
    return tasks.reduce((acc, t) => acc + (t.duration * 8 * 50), 0);
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <Clock className="w-10 h-10 text-brand-300 mb-4" />
        <p className="text-surface-400">Loading timeline...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-xl">
          <button 
            onClick={() => setView('table')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              view === 'table' ? "bg-white dark:bg-surface-700 text-brand-600 shadow-sm" : "text-surface-500 hover:text-surface-700"
            )}
          >
            <TableIcon size={14} />
            List View
          </button>
          <button 
            onClick={() => setView('gantt')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              view === 'gantt' ? "bg-white dark:bg-surface-700 text-brand-600 shadow-sm" : "text-surface-500 hover:text-surface-700"
            )}
          >
            <Calendar size={14} />
            Gantt View
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] text-surface-400 uppercase tracking-wider font-bold">Estimated Cost</span>
             <span className="text-sm font-semibold text-brand-600">${totalCost.toLocaleString()}</span>
          </div>

          <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] text-surface-400 uppercase tracking-wider font-bold">Total Duration</span>
             <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">{totalDuration} Days</span>
          </div>

          {isAdmin && (
            <button 
              onClick={handleLockUnlock}
              className={cn(
                "btn-sm flex items-center gap-1.5",
                isLocked ? "btn-secondary text-amber-600 border-amber-200" : "btn-primary"
              )}
            >
              {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
              {isLocked ? 'Unlock Editing' : 'Approve Timeline'}
            </button>
          )}
          
          {canModify && (
            <button 
              onClick={() => handleSave()} 
              disabled={isSaving}
              className="btn-primary btn-sm"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {isLocked && !isAdmin && (
        <div className="flex items-center gap-3 p-3 bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/50 rounded-2xl">
          <Lock size={16} className="text-brand-600" />
          <p className="text-xs text-brand-700 dark:text-brand-300">
            This timeline has been <strong>Approved</strong> and is currently locked. Only administrators can make modifications.
          </p>
        </div>
      )}

      {/* Main View Area */}
      <AnimatePresence mode="wait">
        {view === 'table' ? (
          <motion.div 
            key="table-view"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="card overflow-hidden"
          >
            <table className="w-full text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-100 dark:border-surface-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-surface-400 uppercase tracking-wider">Task Details</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-surface-400 uppercase tracking-wider">Dates</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-surface-400 uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-surface-400 uppercase tracking-wider">Assignee</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-surface-400 uppercase tracking-wider">Dependency</th>
                  {canModify && <th className="px-4 py-3 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50 dark:divide-surface-800/50">
                {tasks.map((task) => {
                  const isDelayed = isAfter(new Date(), parseISO(task.endDate)) && task.progress < 100;
                  return (
                    <tr key={task.id} className={cn(
                      "group hover:bg-surface-50/50 dark:hover:bg-surface-800/30 transition-colors",
                      isDelayed && "bg-rose-50/30 dark:bg-rose-950/10"
                    )}>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <input 
                            value={task.taskName} 
                            onChange={(e) => updateTask(task.id, { taskName: e.target.value })}
                            disabled={!canModify}
                            className="bg-transparent border-none p-0 focus:ring-0 font-medium text-surface-800 dark:text-surface-200"
                            placeholder="Task name..."
                          />
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] text-surface-400">Progress: {task.progress}%</span>
                             <div className="w-20 h-1 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                               <div className="h-full bg-brand-500" style={{ width: `${task.progress}%` }} />
                             </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input 
                            type="date"
                            value={task.startDate}
                            onChange={(e) => updateTask(task.id, { startDate: e.target.value })}
                            disabled={!canModify}
                            min={new Date().toISOString().split('T')[0]}
                            className="text-xs bg-surface-50 dark:bg-surface-800 border-surface-100 dark:border-surface-700 rounded-lg p-1"
                          />
                          <span className="text-surface-300">→</span>
                          <input 
                            type="date"
                            value={task.endDate}
                            onChange={(e) => updateTask(task.id, { endDate: e.target.value })}
                            disabled={!canModify}
                            min={task.startDate || new Date().toISOString().split('T')[0]}
                            className="text-xs bg-surface-50 dark:bg-surface-800 border-surface-100 dark:border-surface-700 rounded-lg p-1"
                          />

                        </div>
                        {isDelayed && <span className="text-[10px] text-rose-500 font-bold mt-1 block">Delayed</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-bold text-surface-500">{task.duration}d</span>
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          value={task.assignedRole || ''}
                          onChange={(e) => updateTask(task.id, { assignedRole: e.target.value })}
                          disabled={!canModify}
                          className="text-xs bg-surface-50 dark:bg-surface-800 border-surface-100 dark:border-surface-700 rounded-lg p-1 w-full"
                        >
                          <option value="">Select Role</option>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          value={task.dependencyTaskId || ''}
                          onChange={(e) => updateTask(task.id, { dependencyTaskId: e.target.value })}
                          disabled={!canModify}
                          className="text-xs bg-surface-50 dark:bg-surface-800 border-surface-100 dark:border-surface-700 rounded-lg p-1 w-full"
                        >
                          <option value="">No dependency</option>
                          {tasks.filter(t => t.id !== task.id).map(t => (
                            <option key={t.id} value={t.id}>{t.taskName}</option>
                          ))}
                        </select>
                      </td>
                      {canModify && (
                        <td className="px-4 py-3">
                          <button 
                            onClick={() => removeTask(task.id)}
                            className="p-1.5 text-surface-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {canModify && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-center">
                      <button 
                        onClick={addTask}
                        className="flex items-center gap-2 text-xs font-semibold text-brand-600 hover:text-brand-700 mx-auto transition-colors"
                      >
                        <Plus size={14} />
                        Add New Timeline Entry
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
                          isWeekend && "bg-surface-100/30 dark:bg-surface-700/20",
                          isToday && "bg-brand-50 dark:bg-brand-950/20"
                        )}>
                          <span className="text-[9px] text-surface-400 uppercase">{format(day, 'EEE')}</span>
                          <span className={cn("text-[11px] font-bold", isToday ? "text-brand-600" : "text-surface-600 dark:text-surface-400")}>
                            {format(day, 'd')}
                          </span>
                        </div>
                      );
                    })}
                 </div>
              </div>
            </div>

            {/* Gantt Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden flex">
               {/* Left column titles */}
               <div className="w-64 flex-shrink-0 border-r border-surface-100 dark:border-surface-700 bg-surface-50/30 dark:bg-surface-900/10">
                  {tasks.map(task => (
                    <div key={task.id} className="h-14 border-b border-surface-50 dark:border-surface-800 px-4 flex flex-col justify-center">
                       <span className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{task.taskName}</span>
                       <span className="text-[10px] text-surface-400">{task.assignedRole || 'Unassigned'}</span>
                    </div>
                  ))}
               </div>

               {/* Right column bars */}
               <div className="flex-1 overflow-x-auto overflow-y-hidden relative group/canvas">
                  <div className="min-w-max">
                     {tasks.map(task => {
                        const start = parseISO(task.startDate);
                        const end = parseISO(task.endDate);
                        
                        // Calculate offset
                        const offset = differenceInDays(start, days[0]);
                        const width = differenceInDays(end, start) + 1;
                        const isDelayed = isAfter(new Date(), end) && task.progress < 100;

                        return (
                          <div key={task.id} className="h-14 border-b border-surface-50 dark:border-surface-800 relative">
                             <div 
                                className={cn(
                                  "absolute top-1/2 -translate-y-1/2 h-8 rounded-lg shadow-sm flex items-center px-2 z-10 overflow-hidden",
                                  isDelayed ? "bg-rose-100/80 border border-rose-200" : "bg-brand-100/80 border border-brand-200 dark:bg-brand-900/20 dark:border-brand-800"
                                )}
                                 style={{ 
                                   left: `${offset * 40}px`, 
                                   width: `${Math.max(width * 40, 20)}px`,
                                   minWidth: '40px'
                                 }}
                             >
                                {/* Progress Fill */}
                                <div 
                                  className={cn("absolute inset-0 z-0", isDelayed ? "bg-rose-200/50" : "bg-brand-500/10")} 
                                  style={{ width: `${task.progress}%` }} 
                                />
                                
                                <span className={cn(
                                  "text-[11px] font-bold z-10 truncate",
                                  isDelayed ? "text-rose-700" : "text-brand-700 dark:text-brand-300"
                                )}>
                                  {task.taskName}
                                </span>

                                {task.progress > 0 && (
                                  <span className="ml-auto text-[9px] font-bold z-10 opacity-70">
                                    {task.progress}%
                                  </span>
                                )}
                             </div>
                             
                             {/* Daily grid lines behind bars */}
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
                  <div className="w-3 h-3 bg-brand-500/20 border border-brand-500/50 rounded" />
                  <span className="text-[10px] text-surface-500 font-medium tracking-wide">Standard Task</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-rose-200/80 border border-rose-300 rounded" />
                  <span className="text-[10px] text-rose-500 font-bold tracking-wide">Delayed Task</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-surface-100 dark:bg-surface-700 border border-surface-200 rounded" />
                  <span className="text-[10px] text-surface-500 font-medium tracking-wide">Weekend</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tasks.length === 0 && !isLoading && (
        <EmptyState 
          icon={<Clock size={24} />}
          title="No timeline data yet"
          description="Build your project roadmap by adding timeline stages."
          action={<button onClick={addTask} className="btn-primary btn-sm"><Plus size={14} /> Create Timeline</button>}
        />
      )}
    </div>
  );
};
