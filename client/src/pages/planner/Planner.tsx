import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Calendar as CalendarIcon, 
  PanelRight, Rows, LayoutGrid, ChevronLeft, ChevronRight, ChevronDown
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
import PlannerInsightsPanel from './components/PlannerInsightsPanel';

const PlannerPage: React.FC = () => {
  const { personalTasks, addPersonalTask, updatePersonalTask, deletePersonalTask } = useAppStore();
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'high' | 'medium' | 'low'>('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [showPanel, setShowPanel] = useState(false);
  const smartInputRef = useRef<{ addValue: (val: string) => void }>(null);
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
    } else if (filter === 'medium') {
      tasks = tasks.filter(t => t.priority === 'medium');
    } else if (filter === 'low') {
      tasks = tasks.filter(t => t.priority === 'low');
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

  const handleAddTask = async (data: { input: string; description?: string }) => {
     const parsed = parseSmartInput(data.input);
     try {
       const res = await personalTasksService.create({ ...parsed, description: data.description });
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
      
      {/* compact header */}
      <header className="px-6 py-2.5 flex items-center justify-between border-b border-surface-100 dark:border-surface-900 bg-white dark:bg-surface-950 flex-shrink-0">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white flex-shrink-0">Planner</h1>
          <div className="w-px h-4 bg-surface-200 dark:bg-surface-800" />
          <PlannerStats
            stats={stats}
            onSelect={(nextFilter) => setFilter(nextFilter)}
          />
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

      <div className="border-b border-surface-100 bg-surface-50/20 px-6 py-3 dark:border-surface-800 dark:bg-surface-900/10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 rounded-lg border border-surface-100 bg-white p-0.5 dark:border-surface-800 dark:bg-surface-900">
              {[
                { id: 'all', label: 'All' },
                { id: 'today', label: 'Today' },
                { id: 'upcoming', label: 'Upcoming' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setFilter(item.id as any); setCurrentPage(1); }}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all',
                    filter === item.id ? 'bg-surface-900 text-white dark:bg-surface-800' : 'text-surface-500 hover:text-surface-800 dark:text-surface-400'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              id="priority-filter-trigger"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const event = new CustomEvent('open-priority-menu', { detail: { x: rect.left, y: rect.bottom + 8 } });
                window.dispatchEvent(event);
              }}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all',
                ['high', 'medium', 'low'].includes(filter)
                  ? 'border border-surface-100 bg-white text-brand-600 shadow-sm dark:border-surface-700 dark:bg-surface-800'
                  : 'text-surface-500 hover:text-surface-800 dark:text-surface-400'
              )}
            >
              <span>Priority</span>
              <ChevronDown size={12} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-48 rounded-lg border border-surface-200 bg-white py-1.5 pl-8 pr-3 text-[11px] font-semibold transition-all focus:outline-none dark:border-surface-800 dark:bg-surface-900"
              />
            </div>
            <div className="flex items-center rounded-lg border border-surface-100 bg-white p-0.5 dark:border-surface-800 dark:bg-surface-900">
              {[
                { id: 'list', icon: Rows },
                { id: 'kanban', icon: LayoutGrid },
                { id: 'calendar', icon: CalendarIcon }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as any)}
                  className={cn(
                    'rounded-md p-1.5 transition-all',
                    view === item.id ? 'bg-surface-100 text-brand-600 shadow-sm dark:bg-surface-800' : 'text-surface-400 hover:text-surface-600'
                  )}
                >
                  <item.icon size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-surface-100 bg-surface-50/10 px-6 py-6 dark:border-surface-800 dark:bg-surface-900/5">
        <div className="max-w-4xl">
          <h2 className="mb-3 px-1 text-[10px] font-black uppercase tracking-widest text-surface-400">Quick Add Task</h2>
          <SmartInput ref={smartInputRef} onAdd={handleAddTask} />
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
              <PlannerInsightsPanel tasks={personalTasks} onClose={() => setShowPanel(false)} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      {/* Priority Dropdown implementation */}
      <PriorityMenu 
        activeFilter={filter} 
        onSelect={(p) => { setFilter(p); setCurrentPage(1); }} 
      />
    </div>
  );
};

const PriorityMenu: React.FC<{ activeFilter: string; onSelect: (p: any) => void }> = ({ activeFilter, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: any) => {
      setPos(e.detail);
      setOpen(true);
    };
    window.addEventListener('open-priority-menu', handler);
    return () => window.removeEventListener('open-priority-menu', handler);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            style={{ left: pos.x, top: pos.y }}
            className="fixed z-[9999] min-w-[140px] bg-white dark:bg-surface-900 rounded-xl border border-surface-100 dark:border-surface-800 shadow-xl p-1"
          >
            {[
              { id: 'high', label: 'High Priority', color: 'bg-rose-500' },
              { id: 'medium', label: 'Medium Priority', color: 'bg-amber-500' },
              { id: 'low', label: 'Low Priority', color: 'bg-surface-400' },
              { id: 'all', label: 'Clear Filter', color: 'bg-surface-200' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => { onSelect(p.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all",
                  activeFilter === p.id 
                    ? "bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400" 
                    : "text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", p.color)} />
                  {p.label}
                </div>
                {activeFilter === p.id && <div className="w-1 h-1 rounded-full bg-brand-500" />}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PlannerPage;
