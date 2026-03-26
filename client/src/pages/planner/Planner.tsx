import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Calendar as CalendarIcon, 
  PanelRight, Rows, LayoutGrid
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

export const PlannerPage: React.FC = () => {
  const { personalTasks, addPersonalTask, updatePersonalTask, deletePersonalTask } = useAppStore();
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'high'>('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    personalTasksService.getStats().then(res => setStats(res.data.data));
  }, [personalTasks]);

  const filteredTasks = useMemo(() => {
    let tasks = [...personalTasks];
    if (search) tasks = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    
    if (filter === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      tasks = tasks.filter(t => t.dueDate === todayStr);
    } else if (filter === 'upcoming') {
      const todayStr = new Date().toISOString().split('T')[0];
      tasks = tasks.filter(t => t.dueDate && t.dueDate > todayStr);
    } else if (filter === 'high') {
      tasks = tasks.filter(t => t.priority === 'high');
    }

    return tasks;
  }, [personalTasks, filter, search]);

  const handleAddTask = async (input: string) => {
     const parsed = parseSmartInput(input);
     try {
       const res = await personalTasksService.create(parsed);
       addPersonalTask(res.data.data);
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
    <div className="h-[calc(100vh-64px)] overflow-hidden bg-white dark:bg-surface-950 flex flex-col font-sans">
      
      {/* compact header */}
      <header className="px-6 py-2.5 flex items-center justify-between border-b border-surface-100 dark:border-surface-900 bg-white dark:bg-surface-950 flex-shrink-0">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white flex-shrink-0">Planner</h1>
          <div className="w-px h-4 bg-surface-200 dark:bg-surface-800" />
          <PlannerStats stats={stats} />
        </div>
        
        <button 
          onClick={() => setShowPanel(!showPanel)}
          className={cn(
            "p-1.5 rounded-md transition-all",
            showPanel ? "bg-brand-600 text-white shadow-sm shadow-brand-500/20" : "text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-900"
          )}
        >
          <PanelRight size={18} />
        </button>
      </header>

      {/* compact control bar */}
      <div className="px-6 py-3 space-y-3 bg-surface-50/20 dark:bg-surface-900/10 border-b border-surface-100 dark:border-surface-800 flex-shrink-0">
         <div className="flex items-center justify-between gap-4">
            <div className="bg-white dark:bg-surface-900 p-0.5 rounded-lg flex items-center gap-0.5 border border-surface-100 dark:border-surface-800">
              {[
                { id: 'all', label: 'All' },
                { id: 'today', label: 'Today' },
                { id: 'upcoming', label: 'Upcoming' },
                { id: 'high', label: 'Priority' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all",
                    filter === f.id 
                      ? "bg-surface-900 text-white dark:bg-surface-800" 
                      : "text-surface-500 hover:text-surface-800 dark:text-surface-400"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex-1 flex items-center gap-3">
               <div className="flex-1 max-w-xl">
                 <SmartInput onAdd={handleAddTask} />
               </div>
               
               <div className="relative">
                 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                 <input 
                   type="text"
                   placeholder="Search..."
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="w-40 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg py-1.5 pl-8 pr-3 text-[11px] focus:outline-none focus:w-60 transition-all font-semibold"
                 />
              </div>

              <div className="flex items-center bg-white dark:bg-surface-900 p-0.5 rounded-lg border border-surface-100 dark:border-surface-800">
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
                        ? "bg-surface-100 dark:bg-surface-800 text-brand-600 shadow-sm" 
                        : "text-surface-400 hover:text-surface-600"
                    )}
                  >
                    <v.icon size={14} />
                  </button>
                ))}
              </div>
            </div>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* main task area */}
        <main className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
           <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg overflow-hidden flex flex-col h-full max-h-full">
             {view === 'list' && (
               <div className="flex flex-col h-full">
                  <div className="grid grid-cols-[1fr,150px,180px,80px] px-6 py-2.5 border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/20 sticky top-0 z-[1]">
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">TASK</span>
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest text-center">LABELS</span>
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest text-center">DUE DATE</span>
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest text-right">•••</span>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800 no-scrollbar">
                     {filteredTasks.length === 0 ? (
                        <div className="py-12 text-center text-surface-400 text-xs italic">
                           Nothing here yet.
                        </div>
                     ) : (
                       filteredTasks.map(task => (
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
               </div>
             )}

             {view === 'kanban' && <div className="h-full"><KanbanView tasks={filteredTasks} onMove={async (id, status) => {
                  const res = await personalTasksService.update(id, { status, completedAt: status === 'done' ? new Date().toISOString() : null });
                  updatePersonalTask(id, res.data.data);
               }} /></div>}

             {view === 'calendar' && <div className="flex-1 h-full min-h-0"><CalendarView tasks={filteredTasks} /></div>}
           </div>
        </main>

        {/* insights panel */}
        <AnimatePresence>
          {showPanel && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-950 overflow-y-auto flex-shrink-0"
            >
              <div className="p-6 space-y-8">
                 <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-surface-400">STREAK</h3>
                    <div className="space-y-3 bg-surface-50 dark:bg-surface-900 p-4 rounded-xl border border-surface-100/50 dark:border-surface-800/50">
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-2xl font-semibold text-surface-900 dark:text-white leading-none">{stats?.streak || 0}d</span>
                          <span className="text-[9px] font-bold uppercase text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">Current</span>
                       </div>
                       <div className="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-600 w-[65%]" />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-surface-400">UPCOMING</h3>
                    <div className="space-y-3">
                      {filteredTasks.filter(t => t.dueDate && t.status !== 'done').slice(0, 5).map(t => (
                        <div key={t.id} className="text-xs group cursor-pointer p-1.5 hover:bg-surface-50 dark:hover:bg-surface-800/50 rounded-lg transition-colors">
                            <p className="font-semibold text-surface-700 dark:text-surface-300 truncate group-hover:text-brand-600">{t.title}</p>
                            <p className="text-[10px] text-surface-400 mt-0.5">{formatDate(t.dueDate as string, 'MMM d')}</p>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PlannerPage;
