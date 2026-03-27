import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Calendar as CalendarIcon, 
  PanelRight, Rows, LayoutGrid, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDate } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { personalTasksService } from '../../services/api';
import type { PersonalTask } from '../../app/types';
import { parseSmartInput } from '../../utils/nlp';

// Inner Components
import { SmartInput } from './components/SmartInput';
import { TaskItem } from './components/TaskItem';
import { KanbanView } from './components/KanbanView';
import { CalendarView } from './components/CalendarView';
import { PlannerStats } from './components/PlannerStats';
import { PlannerInsights } from './components/PlannerInsights';

export const PlannerPage: React.FC = () => {
  const { personalTasks, addPersonalTask, updatePersonalTask, deletePersonalTask } = useAppStore();
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'high'>('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 10;

  useEffect(() => {
    personalTasksService.getStats().then(res => setStats(res.data.data));
  }, [personalTasks]);

  const filteredTasks = useMemo(() => {
    let tasks = [...personalTasks];
    if (search) tasks = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.labels?.some(l => l.toLowerCase().includes(search.toLowerCase())));
    
    if (filter === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      tasks = tasks.filter(t => t.dueDate === todayStr);
    } else if (filter === 'upcoming') {
      const todayStr = new Date().toISOString().split('T')[0];
      tasks = tasks.filter(t => t.dueDate && t.dueDate > todayStr);
    } else if (filter === 'high') {
      tasks = tasks.filter(t => t.priority === 'high');
    }

    return tasks.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [personalTasks, filter, search]);

  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
  const currentTasks = useMemo(() => {
    return filteredTasks.slice((currentPage - 1) * tasksPerPage, currentPage * tasksPerPage);
  }, [filteredTasks, currentPage]);

  const handleAddTask = async (input: string) => {
     const parsed = parseSmartInput(input);
     try {
       const res = await personalTasksService.create(parsed);
       addPersonalTask(res.data.data);
       setCurrentPage(1);
     } catch (err) { console.error(err); }
  };

  const commonActions = {
    onToggleDone: async (task: PersonalTask) => {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      const res = await personalTasksService.update(task.id, { status: newStatus, completedAt: newStatus === 'done' ? new Date().toISOString() : null });
      updatePersonalTask(task.id, res.data.data);
    },
    onTogglePin: async (taskId: string) => {
      const res = await personalTasksService.togglePinned(taskId);
      updatePersonalTask(taskId, res.data.data);
    },
    onDelete: async (taskId: string) => {
      await personalTasksService.delete(taskId);
      deletePersonalTask(taskId);
    },
    onUpdate: (taskId: string, updates: Partial<PersonalTask>) => {
      personalTasksService.update(taskId, updates).then(res => updatePersonalTask(taskId, res.data.data));
    }
  };

  return (
    <div className="h-[calc(100vh-60px)] overflow-hidden bg-white dark:bg-surface-950 flex flex-col font-sans -m-6">
      
      {/* 1. Header Row */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-950 flex-shrink-0 gap-6">
         <div className="flex items-center gap-6">
            <div className="bg-surface-50 dark:bg-surface-900 p-0.5 rounded-lg flex items-center gap-0.5 border border-surface-100 dark:border-surface-800">
              {[
                { id: 'all', label: 'All' },
                { id: 'today', label: 'Today' },
                { id: 'upcoming', label: 'Upcoming' },
                { id: 'high', label: 'Priority' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => { setFilter(f.id as any); setCurrentPage(1); }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all",
                    filter === f.id 
                      ? "bg-white text-surface-900 dark:bg-surface-800 shadow-sm" 
                      : "text-surface-500 hover:text-surface-800 dark:text-surface-400"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-surface-200 dark:bg-surface-800" />
            <PlannerStats stats={stats} />
         </div>

         <div className="flex items-center gap-4">
            <div className="relative">
               <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
               <input 
                 type="text"
                 placeholder="Search tasks..."
                 value={search}
                 onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                 className="w-48 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg py-1.5 pl-8 pr-3 text-[11px] focus:outline-none focus:w-64 transition-all font-semibold"
               />
            </div>

            <div className="flex items-center bg-surface-50 dark:bg-surface-900 p-0.5 rounded-lg border border-surface-100 dark:border-surface-800">
              {[
                { id: 'list', icon: Rows },
                { id: 'kanban', icon: LayoutGrid },
                { id: 'calendar', icon: CalendarIcon }
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id as any)}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    view === v.id 
                      ? "bg-white dark:bg-surface-800 text-brand-600 shadow-sm" 
                      : "text-surface-400 hover:text-surface-600"
                  )}
                >
                  <v.icon size={14} />
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowPanel(!showPanel)}
              className={cn(
                "p-1.5 rounded-md transition-all border border-surface-100 dark:border-surface-800",
                showPanel ? "bg-brand-600 text-white shadow-sm shadow-brand-500/20" : "text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-900"
              )}
            >
              <PanelRight size={18} />
            </button>
         </div>
      </div>

      {/* 2. Quick Add Area */}
      <div className="px-6 py-6 bg-surface-50/10 dark:bg-surface-900/5 border-b border-surface-100 dark:border-surface-800">
         <div className="max-w-4xl">
           <div className="flex flex-col gap-4">
              <div className="flex-1">
                 <h2 className="text-[10px] font-black tracking-widest text-surface-400 uppercase mb-3 px-1">Quick Add Task</h2>
                 <SmartInput onAdd={handleAddTask} />
              </div>
              
              <div className="flex flex-col gap-2">
                 <h3 className="text-[10px] font-bold text-surface-400 uppercase tracking-widest px-1">Common Labels</h3>
                 <div className="flex flex-wrap gap-2">
                    {['Urgent', 'Today', 'Work', 'Personal', 'Meeting', 'Call'].map(l => (
                      <button 
                        key={l}
                        onClick={() => {
                          const input = document.querySelector('input[placeholder*="What\'s next"]') as HTMLInputElement;
                          if (input) {
                            input.focus();
                            const current = input.value;
                            input.value = current + (current.endsWith(' ') || !current ? '' : ' ') + '#' + l.toLowerCase() + ' ';
                            const event = new Event('input', { bubbles: true });
                            input.dispatchEvent(event);
                          }
                        }}
                        className="text-[10px] font-black uppercase tracking-tight px-3 py-1 rounded-full bg-white dark:bg-surface-800 border-2 border-surface-100 dark:border-surface-800 text-surface-500 hover:border-brand-500 hover:text-brand-600 transition-all shadow-sm"
                      >
                        #{l}
                      </button>
                    ))}
                 </div>
              </div>
           </div>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* main task area */}
        <main className="flex-1 flex flex-col overflow-hidden">
           <div className="bg-white dark:bg-surface-950 flex flex-col h-full overflow-hidden">
             {view === 'list' && (
                <>
                  <div className="grid grid-cols-[1fr,150px,120px,120px,80px] px-6 py-2.5 border-b border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900 sticky top-0 z-[1]/50">
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">TASK</span>
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest text-center">LABELS</span>
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest text-center">DUE DATE</span>
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest text-center">STATUS</span>
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest text-right">•••</span>
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                     {currentTasks.length === 0 ? (
                        <div className="py-12 text-center text-surface-400 text-xs italic">
                           Nothing here yet.
                        </div>
                     ) : (
                        currentTasks.map(task => (
                          <TaskItem 
                            key={task.id} 
                            task={task} 
                            onToggleDone={() => commonActions.onToggleDone(task)}
                            onTogglePin={() => commonActions.onTogglePin(task.id)}
                            onDelete={() => commonActions.onDelete(task.id)}
                            onUpdate={(upd) => commonActions.onUpdate(task.id, upd)}
                          />
                        ))
                     )}
                  </div>

                  {/* Pagination Sticky Bottom */}
                  {totalPages > 1 && (
                    <div className="px-6 py-3 border-t border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-950 flex items-center justify-between sticky bottom-0">
                       <span className="text-[10px] font-black uppercase tracking-widest text-surface-400">
                         Page {currentPage} of {totalPages}
                       </span>
                       <div className="flex items-center gap-3">
                          <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-800 disabled:opacity-20 hover:bg-surface-50 transition-colors"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-800 disabled:opacity-20 hover:bg-surface-50 transition-colors"
                          >
                            <ChevronRight size={16} />
                          </button>
                       </div>
                    </div>
                  )}
                </>
             )}

             {view === 'kanban' && <div className="h-full px-6 py-4 overflow-y-auto"><KanbanView tasks={filteredTasks} onMove={async (id, status) => {
                  const res = await personalTasksService.update(id, { status, completedAt: status === 'done' ? new Date().toISOString() : null });
                  updatePersonalTask(id, res.data.data);
               }} /></div>}

             {view === 'calendar' && <div className="flex-1 h-full min-h-0 px-6 py-4 overflow-y-auto"><CalendarView tasks={filteredTasks} /></div>}
           </div>
        </main>

        {/* insights panel */}
        <AnimatePresence mode="wait">
          {showPanel && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-950 overflow-y-auto flex-shrink-0"
            >
              <PlannerInsights tasks={personalTasks} onClose={() => setShowPanel(false)} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
