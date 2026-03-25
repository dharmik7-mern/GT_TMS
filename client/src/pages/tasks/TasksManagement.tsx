import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, List, LayoutGrid, Plus, MoreHorizontal, 
  Calendar, Clock, User, ChevronDown, Check, Mail, AlertCircle,
  Hash, Paperclip, MessageSquare, Tag, Repeat, Users, X as XIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { cn, formatDate } from '../../utils/helpers';
import { UserAvatar } from '../../components/UserAvatar';
import { KanbanBoard } from '../../components/KanbanBoard';

interface TaskRow {
  id: string;
  _id?: string;
  title: string;
  assignedTo: string;
  assigneeIds?: string[];
  projectId: string | null;
  projectName: string;
  type: 'project' | 'quick';
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedHours?: number;
  subtasks?: any[];
  attachments?: any[];
  description?: string;
  reporterId?: string;
}

export const TasksManagement: React.FC = () => {
  const { user } = useAuthStore();
  const { users, projects } = useAppStore();
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [projectTasks, setProjectTasks] = useState<TaskRow[]>([]);
  const [quickTasks, setQuickTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
   const [fullTaskData, setFullTaskData] = useState<any>(null);
   const [fullTaskLoading, setFullTaskLoading] = useState(false);
   const [isAddingTask, setIsAddingTask] = useState(false);
   const [groupBy, setGroupBy] = useState<'none' | 'status' | 'project'>('none');
   const [filterStatus, setFilterStatus] = useState('all');
   const [activeSections, setActiveSections] = useState<string[]>(['active', 'projects', 'quick']);
   const [openDropdown, setOpenDropdown] = useState<string | null>(null);
 
   useEffect(() => {
     if (selectedTask) {
      fetchFullTask(selectedTask.id);
     } else {
       setFullTaskData(null);
     }
   }, [selectedTask]);

   useEffect(() => {
     const handleClickOutside = (e: MouseEvent) => {
       if (!(e.target as HTMLElement).closest('.relative')) {
         setOpenDropdown(null);
       }
     };
     window.addEventListener('mousedown', handleClickOutside);
     return () => window.removeEventListener('mousedown', handleClickOutside);
   }, []);

    const fetchFullTask = async (id: string) => {
    if (!id) return;
     try {
       setFullTaskLoading(true);
       console.log(`[TasksManagement] Initiating fetch for Task ID: ${id}`);
       // New Unified Endpoint: no more guesswork between collections!
       const res = await api.get(`/tasks/detail/${id}`);
      if (res.data?.success) {
        setFullTaskData(res.data.data);
      }
    } catch (err) {
      console.error('Fetch task details failed:', err);
    } finally {
      setFullTaskLoading(false);
    }
  };

  const handleUpdateTaskField = async (field: string, value: any) => {
    if (!selectedTask) return;
    try {
      const endpoint = selectedTask.type === 'project' ? `/tasks/${selectedTask.id}` : `/quick-tasks/${selectedTask.id}`;
      // Use put for full update or patch if API supports it
      await api.put(endpoint, { [field]: value });
      fetchFullTask(selectedTask.id);
      fetchTasks(); // Refresh list
    } catch (err) {
      console.error(`Update ${field} failed:`, err);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    if (!selectedTask || selectedTask.type !== 'project') return;
    try {
      await api.patch(`/tasks/${selectedTask.id}/subtasks/${subtaskId}`, { isCompleted });
      fetchFullTask(selectedTask.id);
    } catch (err) {
      console.error('Toggle subtask failed:', err);
    }
  };

  const handleAddSubtask = async (title: string) => {
    if (!selectedTask || selectedTask.type !== 'project' || !title.trim()) return;
    try {
      await api.post(`/tasks/${selectedTask.id}/subtasks`, { title });
      fetchFullTask(selectedTask.id);
    } catch (err) {
      console.error('Add subtask failed:', err);
    }
  };

   const handlePostComment = async (content: string) => {
    if (!selectedTask || !content.trim()) return;
    const taskId = selectedTask.id;
    try {
      // Use the resolved type from fullData if available, fallback to selectedTask
      const taskType = fullTaskData?.type || selectedTask.type;
      const url = taskType === 'project' ? `/tasks/${taskId}/comments` : `/quick-tasks/${taskId}/comments`;
      
      try {
        await api.post(url, { content });
      } catch (err: any) {
        if (err.response?.status === 404) {
          const altUrl = taskType === 'project' ? `/quick-tasks/${taskId}/comments` : `/tasks/${taskId}/comments`;
          await api.post(altUrl, { content });
        } else {
          throw err;
        }
      }

      await fetchFullTask(taskId);
      fetchTasks();
    } catch (err) {
      console.error('Post comment failed:', err);
    }
  };
  
  // Kanban columns data
  const kanbanTasks = [...projectTasks, ...quickTasks];

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks/all');
      if (res.data?.success) {
        setProjectTasks(res.data.data.projectTasks || []);
        setQuickTasks(res.data.data.quickTasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

   const filteredTasks = (list: TaskRow[]) => {
     let filtered = list.filter(t => 
       (t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
       t.assignedTo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       t.projectName?.toLowerCase().includes(searchTerm.toLowerCase()))
     );
 
     if (filterStatus !== 'all') {
       filtered = filtered.filter(t => t.status === filterStatus);
     }
 
     return filtered;
   };

   const toggleSection = (section: string) => {
     setActiveSections(prev => 
       prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
     );
   };

  const allFilteredTasks = [...filteredTasks(projectTasks), ...filteredTasks(quickTasks)];

  const StatusIcon = ({ status }: { status: string }) => {
    const s = status.toLowerCase().replace('_', '');
    if (s === 'done' || s === 'completed') return <Check size={14} className="text-emerald-500" />;
    return <Mail size={14} className="text-gray-400" />;
  };

  const TypePill = ({ type, priority }: { type: string, priority: string }) => {
    let color = 'bg-blue-100 text-blue-600';
    if (priority === 'urgent' || priority === 'high') color = 'bg-rose-100 text-rose-600';
    if (priority === 'medium') color = 'bg-amber-100 text-amber-600';
    
    return (
      <div className="flex items-center gap-2">
        <span className={cn('w-2.5 h-2.5 rounded-full', color.split(' ')[0])} />
        <span className="capitalize">{priority}</span>
      </div>
    );
  };

   return (
    <div className="h-full flex flex-col bg-[#f8f9fc] dark:bg-surface-950 p-6 overflow-hidden">
      {/* Bordio Style Top Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddingTask(true)}
            className="bg-[#00a3ff] hover:bg-[#0082cc] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus size={18} />
            Add new
          </button>
          
          <div className="flex items-center bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-800 rounded-lg p-1 shadow-sm">
            <button 
              onClick={() => setView('table')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                view === 'table' ? "bg-gray-100 dark:bg-surface-800 text-gray-900 dark:text-surface-100 shadow-sm" : "text-gray-500 dark:text-surface-400 hover:text-gray-700 dark:hover:text-surface-200"
              )}
            >
              <List size={14} />
              Table view
            </button>
            <button 
              onClick={() => setView('kanban')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                view === 'kanban' ? "bg-gray-100 dark:bg-surface-800 text-gray-900 dark:text-surface-100 shadow-sm" : "text-gray-500 dark:text-surface-400 hover:text-gray-700 dark:hover:text-surface-200"
              )}
            >
              <LayoutGrid size={14} />
              Kanban board
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-surface-500" size={16} />
             <input 
               type="text" 
               placeholder="Search projects, tasks, people..." 
               className="bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-800 rounded-full pl-9 pr-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-brand-500/20 transition-all shadow-sm text-gray-900 dark:text-surface-100"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
          
           <div className="relative">
             <div 
               onClick={() => setOpenDropdown(openDropdown === 'group' ? null : 'group')}
               className="flex items-center gap-2 bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-800 rounded-lg px-3 py-2 shadow-sm text-xs font-bold text-gray-600 dark:text-surface-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800 uppercase tracking-tight transition-all"
             >
               <Users size={14} />
               Group: {groupBy === 'none' ? 'None' : groupBy}
             </div>
             {openDropdown === 'group' && (
               <div className="absolute top-full mt-2 right-0 bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-xl shadow-xl p-2 z-50 min-w-[120px] animate-in fade-in zoom-in-95 duration-100">
                  {['none', 'status', 'project'].map(g => (
                    <div 
                      key={g} 
                      onClick={() => { setGroupBy(g as any); setOpenDropdown(null); }} 
                      className="px-3 py-2 text-[11px] font-bold text-gray-600 dark:text-surface-400 hover:bg-gray-50 dark:hover:bg-surface-800 rounded-lg cursor-pointer capitalize transition-colors"
                    >
                      {g}
                    </div>
                  ))}
               </div>
             )}
           </div>
          
           <div className="relative">
             <div 
               onClick={() => setOpenDropdown(openDropdown === 'filter' ? null : 'filter')}
               className="flex items-center gap-2 bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-800 rounded-lg px-3 py-2 shadow-sm text-xs font-bold text-gray-600 dark:text-surface-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800 uppercase tracking-tight transition-all"
             >
               <Filter size={14} />
               Filter: {filterStatus === 'all' ? 'All' : filterStatus.replace('_', ' ')}
             </div>
             {openDropdown === 'filter' && (
               <div className="absolute top-full mt-2 right-0 bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-xl shadow-xl p-2 z-50 min-w-[140px] animate-in fade-in zoom-in-95 duration-100">
                  {['all', 'todo', 'in_progress', 'done', 'blocked'].map(f => (
                    <div 
                      key={f} 
                      onClick={() => { setFilterStatus(f); setOpenDropdown(null); }} 
                      className="px-3 py-2 text-[11px] font-bold text-gray-600 dark:text-surface-400 hover:bg-gray-50 dark:hover:bg-surface-800 rounded-lg cursor-pointer capitalize transition-colors"
                    >
                      {f.replace('_', ' ')}
                    </div>
                  ))}
               </div>
             )}
           </div>

           <div className="flex -space-x-2">
             {users.slice(0, 5).map((u, i) => (
               <UserAvatar key={u.id} name={u.name} size="xs" color={u.color} className="border-2 border-white dark:border-surface-950" />
             ))}
             {users.length > 5 && (
               <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-surface-800 border-2 border-white dark:border-surface-950 flex items-center justify-center text-[10px] font-bold text-gray-500">
                 +{users.length - 5}
               </div>
             )}
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {view === 'table' ? (
            <motion.div 
              key="table"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full flex flex-col"
            >
               <div className="flex flex-col h-full gap-6 overflow-auto custom-scrollbar">
                 {/* 1. Active Tasks Section */}
                 <div className="bg-white dark:bg-surface-900 rounded-xl border border-gray-200 dark:border-surface-800 shadow-sm overflow-hidden flex flex-col shrink-0 ring-1 ring-black/5">
                   <div 
                     onClick={() => toggleSection('active')}
                     className="px-5 py-3 border-b border-gray-100 dark:border-surface-800 flex items-center justify-between bg-white dark:bg-surface-950/20 sticky top-0 z-10 backdrop-blur-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800/40 transition-colors"
                   >
                     <div className="flex items-center gap-2">
                       <ChevronDown size={14} className={cn("text-gray-400 transition-transform", !activeSections.includes('active') && "-rotate-90")} />
                       <span className="text-sm font-bold text-gray-700 dark:text-surface-200">Active tasks</span>
                       <span className="bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-surface-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{allFilteredTasks.length}</span>
                     </div>
                   </div>
                   
                   {activeSections.includes('active') && (
                     <div className="overflow-auto border-gray-100 dark:border-surface-800 border-t">
                       <table className="w-full text-xs text-left border-collapse">
                         <thead className="bg-white dark:bg-surface-900 text-gray-400 dark:text-surface-500 font-semibold border-b border-gray-50 dark:border-surface-800">
                           <tr>
                             <th className="px-5 py-3 font-semibold min-w-[300px]">Task Name</th>
                             <th className="px-3 py-3 font-semibold">Status</th>
                             <th className="px-3 py-3 font-semibold">Type</th>
                             <th className="px-3 py-3 font-semibold">Due date</th>
                             <th className="px-3 py-3 font-semibold">Est. time</th>
                             <th className="px-3 py-3 font-semibold">Responsible</th>
                             <th className="px-5 py-3 w-10 text-right"><MoreHorizontal size={14} className="text-gray-300 dark:text-surface-700" /></th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-50 dark:divide-surface-800">
                           {loading ? (
                             <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Loading your tasks...</td></tr>
                           ) : allFilteredTasks.length > 0 ? (
                             allFilteredTasks.map((task, idx) => (
                               <TaskRowComponent key={task.id || idx} task={task} onClick={() => setSelectedTask(task)} />
                             ))
                           ) : (
                             <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No active tasks found matching your search.</td></tr>
                           )}
                         </tbody>
                       </table>
                     </div>
                   )}
                 </div>

                 {/* 2. Projects Section */}
                 <div className="bg-white dark:bg-surface-900 rounded-xl border border-gray-200 dark:border-surface-800 shadow-sm overflow-hidden flex flex-col shrink-0 ring-1 ring-black/5">
                   <div 
                     onClick={() => toggleSection('projects')}
                     className="px-5 py-3 border-b border-gray-100 dark:border-surface-800 flex items-center justify-between bg-white dark:bg-surface-950/20 sticky top-0 z-10 backdrop-blur-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800/40 transition-colors"
                   >
                     <div className="flex items-center gap-2">
                       <ChevronDown size={14} className={cn("text-gray-400 transition-transform", !activeSections.includes('projects') && "-rotate-90")} />
                       <span className="text-sm font-bold text-gray-700 dark:text-surface-200 uppercase tracking-tight">Projects</span>
                       <span className="bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-surface-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{allFilteredTasks.filter(t => t.projectName !== '-').length}</span>
                     </div>
                   </div>

                   {activeSections.includes('projects') && (
                     <div className="overflow-auto border-gray-100 dark:border-surface-800 border-t">
                        <table className="w-full text-xs text-left border-collapse">
                          <tbody className="divide-y divide-gray-50 dark:divide-surface-800">
                             {allFilteredTasks.filter(t => t.projectName !== '-').length === 0 ? (
                               <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No project tasks found.</td></tr>
                             ) : (
                               (() => {
                                 const groups: Record<string, TaskRow[]> = {};
                                 allFilteredTasks.filter(t => t.projectName !== '-').forEach(t => {
                                   if (!groups[t.projectName]) groups[t.projectName] = [];
                                   groups[t.projectName].push(t);
                                 });
                                 return Object.entries(groups).map(([groupName, tasks]) => (
                                   <React.Fragment key={groupName}>
                                      <tr className="bg-gray-50/50 dark:bg-surface-950/30">
                                        <td colSpan={7} className="px-5 py-2 text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-widest border-y border-gray-100 dark:border-surface-800">
                                          {groupName} — {tasks.length} tasks
                                        </td>
                                      </tr>
                                      {tasks.map((task, idx) => (
                                        <TaskRowComponent key={task.id || idx} task={task} onClick={() => setSelectedTask(task)} />
                                      ))}
                                   </React.Fragment>
                                 ));
                               })()
                             )}
                          </tbody>
                        </table>
                     </div>
                   )}
                 </div>

                 {/* 3. Quick Tasks Section */}
                 <div className="bg-white dark:bg-surface-900 rounded-xl border border-gray-200 dark:border-surface-800 shadow-sm overflow-hidden flex flex-col shrink-0 ring-1 ring-black/5">
                   <div 
                     onClick={() => toggleSection('quick')}
                     className="px-5 py-3 border-b border-gray-100 dark:border-surface-800 flex items-center justify-between bg-white dark:bg-surface-950/20 sticky top-0 z-10 backdrop-blur-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800/40 transition-colors"
                   >
                     <div className="flex items-center gap-2">
                       <ChevronDown size={14} className={cn("text-gray-400 transition-transform", !activeSections.includes('quick') && "-rotate-90")} />
                       <span className="text-sm font-bold text-gray-700 dark:text-surface-200 uppercase tracking-tight">Quick Tasks</span>
                       <span className="bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-surface-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{allFilteredTasks.filter(t => t.projectName === '-').length}</span>
                     </div>
                   </div>

                   {activeSections.includes('quick') && (
                     <div className="overflow-auto border-gray-100 dark:border-surface-800 border-t">
                        <table className="w-full text-xs text-left border-collapse">
                          <tbody className="divide-y divide-gray-50 dark:divide-surface-800">
                             {allFilteredTasks.filter(t => t.projectName === '-').length === 0 ? (
                               <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No quick tasks found.</td></tr>
                             ) : (
                               allFilteredTasks.filter(t => t.projectName === '-').map((task, idx) => (
                                 <TaskRowComponent key={task.id || idx} task={task} onClick={() => setSelectedTask(task)} />
                               ))
                             )}
                          </tbody>
                        </table>
                     </div>
                   )}
                 </div>
               </div>
            </motion.div>
          ) : (
            <motion.div 
              key="kanban"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="h-full"
            >
               {/* Fixed KanbanBoard props if they differ */}
               <KanbanBoard 
                 tasksOverride={kanbanTasks as any} 
                 projectId="" 
                 onOpenTask={(t) => setSelectedTask(t as any)}
               />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Task Overlay - Bordio Style Full Pop-up */}
      <AnimatePresence>
        {isAddingTask && (
          <CreateTaskOverlay 
            onClose={() => setIsAddingTask(false)} 
            onCreated={fetchTasks}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTask && (
          <TaskDetailOverlay 
            task={selectedTask} 
            fullData={fullTaskData}
            loading={fullTaskLoading}
            onClose={() => setSelectedTask(null)} 
            onToggleSubtask={handleToggleSubtask}
            onAddSubtask={handleAddSubtask}
            onUpdateField={handleUpdateTaskField}
            onPostComment={handlePostComment}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const CreateTaskOverlay: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const { users, projects } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    projectId: '',
    status: 'todo',
    priority: 'normal',
    dueDate: '',
    assignedToId: '',
    description: ''
  });

   const handleCreate = async () => {
    if (!formData.title.trim()) return;
    try {
      setLoading(true);
      const isQuickTask = !formData.projectId;
      const endpoint = isQuickTask ? '/quick-tasks' : '/tasks';
      const payload = isQuickTask 
        ? { title: formData.title, priority: formData.priority, assigneeIds: formData.assignedToId ? [formData.assignedToId] : [], status: 'todo' }
        : { ...formData, assigneeIds: formData.assignedToId ? [formData.assignedToId] : [] };

      const res = await api.post(endpoint, payload);
      if (res.data?.success) {
        onCreated();
        onClose();
      }
    } catch (err) {
      console.error('Create task failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          className="bg-white dark:bg-surface-900 rounded-[2rem] w-full max-w-2xl shadow-2xl p-10 mt-10"
          onClick={e => e.stopPropagation()}
        >
           <div className="flex items-center justify-between mb-8">
              <h2 className="text-[28px] font-bold text-gray-900 dark:text-surface-50">Create New Task</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-full"><XIcon size={24} className="text-gray-400 dark:text-surface-500" /></button>
           </div>
          
          <div className="space-y-6">
             <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">Task Title</label>
                 <input 
                   type="text" 
                   placeholder="What needs to be done?" 
                   className="w-full bg-[#f8f9fc] dark:bg-surface-800 border border-gray-100 dark:border-surface-700 rounded-2xl p-5 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-brand-500/20 dark:text-surface-100 transition-all placeholder:text-gray-300 dark:placeholder:text-surface-600"
                   value={formData.title}
                   onChange={e => setFormData({ ...formData, title: e.target.value })}
                 />
             </div>

             <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-surface-500 ml-1">Project</label>
                    <select 
                      className="w-full bg-[#f8f9fc] dark:bg-surface-800 border border-gray-100 dark:border-surface-700 rounded-2xl p-4 text-[13px] font-semibold appearance-none focus:outline-none dark:text-surface-200"
                      value={formData.projectId}
                      onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                    >
                       <option value="" className="dark:bg-surface-900">No project (Quick Task)</option>
                       {projects.map(p => <option key={p.id} value={p.id} className="dark:bg-surface-900">{p.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-surface-500 ml-1">Assign To</label>
                    <select 
                      className="w-full bg-[#f8f9fc] dark:bg-surface-800 border border-gray-100 dark:border-surface-700 rounded-2xl p-4 text-[13px] font-semibold appearance-none focus:outline-none dark:text-surface-200"
                      value={formData.assignedToId}
                      onChange={e => setFormData({ ...formData, assignedToId: e.target.value })}
                    >
                       <option value="" className="dark:bg-surface-900">Unassigned</option>
                       {users.map(u => <option key={u.id} value={u.id} className="dark:bg-surface-900">{u.name}</option>)}
                    </select>
                 </div>
                <div className="space-y-2">
                   <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">Due Date</label>
                   <input 
                     type="date" 
                     className="w-full bg-[#f8f9fc] border border-gray-100 rounded-2xl p-4 text-[13px] font-semibold focus:outline-none"
                     value={formData.dueDate}
                     onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">Priority</label>
                   <select 
                     className="w-full bg-[#f8f9fc] border border-gray-100 rounded-2xl p-4 text-[13px] font-semibold appearance-none focus:outline-none"
                     value={formData.priority}
                     onChange={e => setFormData({ ...formData, priority: e.target.value })}
                   >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                   </select>
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">Description</label>
                <textarea 
                  placeholder="Add more details about this task..." 
                  className="w-full bg-[#f8f9fc] border border-gray-100 rounded-2xl p-5 text-[14px] min-h-[120px] resize-none focus:outline-none"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
             </div>

             <div className="flex items-center justify-end gap-4 pt-4">
                <button onClick={onClose} className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700">Discard</button>
                <button 
                  onClick={handleCreate}
                  disabled={loading || !formData.title}
                  className="bg-[#00a3ff] hover:bg-[#0082cc] text-white px-8 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </button>
             </div>
          </div>
       </motion.div>
    </motion.div>
  );
};

const TaskDetailOverlay: React.FC<{ 
  task: TaskRow; 
  fullData: any;
  loading: boolean;
  onClose: () => void; 
  onToggleSubtask: (id: string, completed: boolean) => void;
  onAddSubtask: (title: string) => void;
  onUpdateField: (field: string, value: any) => void;
  onPostComment: (content: string) => void;
}> = ({ task, fullData, loading, onClose, onToggleSubtask, onAddSubtask, onUpdateField, onPostComment }) => {
  const { users, projects } = useAppStore();
  const { user } = useAuthStore();
   const [newSubtask, setNewSubtask] = useState('');
   const [commentText, setCommentText] = useState('');
   const [showTagMenu, setShowTagMenu] = useState(false);
   const [showRepeatMenu, setShowRepeatMenu] = useState(false);
  
  const project = projects.find(p => p.id === task.projectId);
  const data = fullData || task;
  const responsible = users.find(u => (data.assigneeIds || []).includes(u.id)) || { name: task.assignedTo || 'Unassigned', color: 'gray' };
  const reporter = users.find(u => u.id === data.reporterId) || { name: 'System', color: 'gray' };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-[2px]"
      onClick={onClose}
    >
       <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        className="w-full max-w-[950px] h-full bg-white dark:bg-surface-900 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Detail Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-surface-200 dark:border-surface-800">
           <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-widest">
              <span className="hover:text-blue-500 cursor-pointer">{project?.name || 'Workspace'}</span>
              <span>/</span>
              <span className="text-gray-500 font-bold">{task.projectName !== '-' ? task.projectName : 'General Task'}</span>
           </div>
           <div className="flex items-center gap-1.5">
             <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><MoreHorizontal size={18} /></button>
             <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><XIcon size={20} /></button>
           </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Main Content Side */}
          <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
             {loading && !fullData ? (
              <div className="flex items-center justify-center h-40 text-gray-400">Loading task details...</div>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-surface-100 leading-tight">{data.title}</h1>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-10 max-w-lg">
                   <div className="flex items-center gap-6">
                     <span className="text-[13px] text-gray-400 dark:text-surface-500 font-medium w-24">Status</span>
                     <select 
                       className="bg-transparent text-[13px] font-bold text-gray-800 dark:text-surface-200 focus:outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800 px-2 py-1 rounded transition-colors"
                       value={data.status}
                       onChange={(e) => onUpdateField('status', e.target.value)}
                     >
                        <option value="backlog" className="dark:bg-surface-900">Backlog</option>
                        <option value="todo" className="dark:bg-surface-900">Todo</option>
                        <option value="in_progress" className="dark:bg-surface-900">In Progress</option>
                        <option value="in_review" className="dark:bg-surface-900">In Review</option>
                        <option value="done" className="dark:bg-surface-900">Completed</option>
                        <option value="blocked" className="dark:bg-surface-900">Blocked</option>
                     </select>
                   </div>
                  
                   <div className="flex items-center gap-6">
                     <span className="text-[13px] text-gray-400 dark:text-surface-500 font-medium w-24">Type</span>
                     <select 
                       className="bg-transparent text-[13px] font-bold text-gray-800 dark:text-surface-200 focus:outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800 px-2 py-1 rounded transition-colors"
                       value={data.priority}
                       onChange={(e) => onUpdateField('priority', e.target.value)}
                     >
                        <option value="low" className="dark:bg-surface-900">Low</option>
                        <option value="normal" className="dark:bg-surface-900">Normal</option>
                        <option value="medium" className="dark:bg-surface-900">Medium</option>
                        <option value="high" className="dark:bg-surface-900">High</option>
                        <option value="urgent" className="dark:bg-surface-900">Urgent</option>
                     </select>
                   </div>

                   <div className="flex items-center gap-6">
                     <span className="text-[13px] text-gray-400 dark:text-surface-500 font-medium w-24">Due date</span>
                     <input 
                       type="date" 
                       className="bg-transparent text-[13px] font-bold text-gray-800 dark:text-surface-200 focus:outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800 px-1 rounded transition-colors"
                       value={data.dueDate ? data.dueDate.split('T')[0] : ''}
                       onChange={(e) => onUpdateField('dueDate', e.target.value)}
                     />
                   </div>

                   <div className="flex items-center gap-6">
                      <span className="text-[13px] text-gray-400 dark:text-surface-500 font-medium w-24">Responsible</span>
                      <select 
                       className="bg-transparent text-[13px] font-bold text-gray-800 dark:text-surface-200 focus:outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800 px-2 py-1 rounded appearance-none transition-colors"
                       value={(responsible as any).id || ''}
                       onChange={(e) => onUpdateField('assigneeIds', [e.target.value])}
                     >
                        <option value="" className="dark:bg-surface-900">Unassigned</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id} className="dark:bg-surface-900">{u.name}</option>
                        ))}
                     </select>
                   </div>

                   <div className="flex items-center gap-6">
                      <span className="text-[13px] text-gray-400 dark:text-surface-500 font-medium w-24">Reporter</span>
                      <div className="flex items-center gap-2 text-[13px] font-bold text-gray-800 dark:text-surface-200">
                        <UserAvatar name={reporter.name} size="xs" color={(reporter as any).color} />
                        {reporter.name}
                     </div>
                   </div>
                </div>

                <div className="flex items-center gap-10 pt-4 px-1">
                   <div className="relative">
                    <button 
                      onClick={() => { setShowTagMenu(!showTagMenu); setShowRepeatMenu(false); }}
                      className="flex flex-col items-center gap-1 group transition-all text-gray-500 hover:text-blue-500"
                    >
                      <Tag size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <span className="text-[11px] font-medium mt-1">Add tag</span>
                    </button>
                    {showTagMenu && (
                       <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-surface-800 border border-gray-100 dark:border-surface-700 rounded-xl shadow-xl p-2 z-[60] min-w-[120px]">
                         {['Design', 'Feedback', 'Bug', 'Feature', 'Blocked'].map(tag => (
                           <div key={tag} onClick={() => { onUpdateField('labels', [...(data.labels || []), tag]); setShowTagMenu(false); }} className="px-3 py-2 text-[10px] font-bold text-gray-600 dark:text-surface-300 hover:bg-gray-50 dark:hover:bg-surface-700 rounded-lg cursor-pointer">{tag}</div>
                         ))}
                       </div>
                    )}
                   </div>

                   <div className="relative">
                    <button 
                      onClick={() => { setShowRepeatMenu(!showRepeatMenu); setShowTagMenu(false); }}
                      className="flex flex-col items-center gap-1 group transition-all text-gray-500 hover:text-blue-500"
                    >
                      <Repeat size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <span className="text-[11px] font-medium mt-1">Repeat task</span>
                    </button>
                    {showRepeatMenu && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl p-2 z-[60] min-w-[140px]">
                        {['Don\'t Repeat', 'Every Day', 'Every Week', 'Every Month', 'Every Year'].map(freq => (
                          <div key={freq} onClick={() => { setShowRepeatMenu(false); alert(`Repeating task ${freq}`); }} className="px-3 py-2 text-[10px] font-bold text-gray-600 hover:bg-gray-50 rounded-lg cursor-pointer">{freq}</div>
                        ))}
                      </div>
                    )}
                   </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-gray-400 font-bold uppercase text-[10px] tracking-widest pt-4">
                     <List size={14} /> Description
                  </div>
                  <textarea 
                     className="w-full text-[15px] text-gray-700 dark:text-surface-300 leading-relaxed bg-[#f9fafb] dark:bg-surface-950/30 p-6 rounded-2xl border border-gray-100 dark:border-surface-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 dark:focus:ring-brand-500/10 min-h-[150px] resize-none transition-all"
                     value={data.description || ''}
                     placeholder="No description provided for this task."
                     onChange={(e) => onUpdateField('description', e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between pt-6">
                     <div className="flex items-center gap-2 text-gray-400 dark:text-surface-500 font-bold uppercase text-[10px] tracking-widest">
                        <Check size={14} /> Subtasks <span className="bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-surface-400 px-2.5 py-0.5 rounded-full ml-1 text-[9px]">{data.subtasks?.length || 0}</span>
                     </div>
                     <ChevronDown size={14} className="text-gray-300 dark:text-surface-700" />
                   </div>
                    <div className="space-y-3 pl-2">
                       {data.subtasks?.map((st: any) => (
                         <div key={st.id} className="flex items-center gap-3 group">
                           <input 
                             type="checkbox" 
                             checked={st.isCompleted} 
                             onChange={(e) => onToggleSubtask(st.id, e.target.checked)}
                             className="rounded border-gray-300 dark:border-surface-700 dark:bg-surface-800 w-4 h-4 text-blue-500 focus:ring-blue-500/20 transition-colors" 
                           />
                           <span className={cn("text-sm transition-colors", st.isCompleted ? "text-gray-400 dark:text-surface-600 line-through" : "text-gray-700 dark:text-surface-200")}>
                             {st.title}
                           </span>
                         </div>
                       ))}
                    <div className="pt-2 flex items-center gap-2">
                      <div className="flex-1 relative">
                        <Plus size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-300" />
                         <input 
                           type="text" 
                           placeholder="Add Subtask" 
                           className="w-full pl-7 py-2 text-sm font-bold placeholder:text-gray-300 dark:placeholder:text-surface-600 border-none bg-transparent dark:text-surface-200 focus:ring-0 outline-none hover:bg-gray-50 dark:hover:bg-surface-800/50 rounded-lg transition-colors"
                           value={newSubtask}
                           onChange={(e) => setNewSubtask(e.target.value)}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter' && newSubtask.trim()) {
                               onAddSubtask(newSubtask);
                               setNewSubtask('');
                             }
                           }}
                         />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                       <Paperclip size={14} /> Files <span className="bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full ml-1 text-[9px]">{data.attachments?.length || 0}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {data.attachments?.map((file: any) => (
                      <div key={file.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-all cursor-pointer group">
                         <div className="w-10 h-10 bg-blue-50 flex items-center justify-center rounded-lg text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <Paperclip size={18} />
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-gray-800 truncate">{file.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">{file.size ? (file.size / 1024).toFixed(1) + ' KB' : 'PDF'}</p>
                         </div>
                      </div>
                    ))}
                    <div 
                      onClick={() => alert('Upload File Clicked')}
                      className="border-2 border-dashed border-gray-100 rounded-xl p-8 flex flex-col items-center justify-center text-gray-300 hover:bg-gray-50 hover:border-gray-200 transition-all cursor-pointer group col-span-2"
                    >
                       <Plus size={24} className="group-hover:text-blue-500 transition-colors" />
                       <span className="text-[11px] font-bold uppercase tracking-widest mt-2 group-hover:text-gray-500">Click to upload files</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Activity / Chat Sidebar */}
          <div className="w-[340px] border-l border-gray-100 bg-[#fbfcff] flex flex-col">
             <div className="p-8 border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                        <AlertCircle size={16} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wide">
                        Activity
                      </span>
                   </div>
                   <div className="flex -space-x-2">
                     <UserAvatar name="M" size="xs" className="border-2 border-white" />
                     <UserAvatar name="S" size="xs" className="border-2 border-white" />
                   </div>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide bg-gray-50/20">
                 <div className="text-center py-2 relative">
                    <span className="bg-white border border-gray-100 text-[#999] text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-widest relative z-10 shadow-sm">Activity & Chat</span>
                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-gray-100/50 -z-10" />
                 </div>
                 
                 {data.comments?.map((c: any) => {
                   const author = users.find(u => u.id === c.authorId);
                   const isMe = c.authorId === user?.id;
                   return (
                     <div key={c.id || c._id} className={cn("flex items-start gap-3", isMe ? "flex-row-reverse" : "")}>
                        <UserAvatar name={author?.name || 'U'} size="xs" color={author?.color} />
                        <div className={cn(
                          "max-w-[80%] rounded-2xl p-3 shadow-sm text-[12px]",
                          isMe ? "bg-blue-500 text-white rounded-tr-none" : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"
                        )}>
                           <div className="flex items-center justify-between gap-4 mb-1">
                              <span className={cn("font-bold text-[10px]", isMe ? "text-blue-100" : "text-gray-400")}>{author?.name}</span>
                              <span className={cn("text-[9px]", isMe ? "text-blue-200" : "text-gray-300")}>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                           </div>
                           <p className="whitespace-pre-wrap leading-relaxed">{c.content}</p>
                        </div>
                     </div>
                   );
                 })}
                 
                 {!data.comments?.length && (
                    <div className="text-center text-gray-300 text-[11px] font-medium py-10 italic">No messages yet. Start the conversation!</div>
                 )}
              </div>

             <div className="p-6 bg-white dark:bg-surface-900 border-t border-gray-100 dark:border-surface-800 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                <div className="relative group">
                  <textarea 
                    placeholder="Type a message..."
                    className="w-full bg-gray-50 dark:bg-surface-950/40 border border-gray-200 dark:border-surface-800 rounded-2xl px-5 py-4 text-sm dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-brand-500/20 focus:bg-white dark:focus:bg-surface-950/60 resize-none transition-all pr-20"
                    rows={2}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                       if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (commentText.trim()) {
                             onPostComment(commentText);
                             setCommentText('');
                          }
                       }
                    }}
                  />
                  <div className="absolute right-4 bottom-4 flex items-center gap-3 text-gray-400">
                    <button className="hover:text-blue-500 transition-colors"><Paperclip size={18} /></button>
                    <button 
                      onClick={() => {
                        if (commentText.trim()) {
                           onPostComment(commentText);
                           setCommentText('');
                        }
                      }}
                      className="hover:text-blue-500 transition-colors"
                    >
                      <MessageSquare size={18} />
                    </button>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const ActivityItem = ({ user: userName, action, time, meta, metaAction }: any) => {
  const { user } = useAuthStore();
  const actualUser = userName === 'You' ? user?.name : userName;
  return (
    <div className="space-y-1.5 pl-1">
      <div className="flex items-baseline gap-1.5 flex-wrap">
         <span className="font-bold text-gray-900 text-[12px]">{actualUser}</span>
         <span className="text-gray-400 text-[11px] leading-tight">{action}</span>
      </div>
      {meta && (
        <div className="flex items-center gap-1">
          <span className="text-blue-500 font-bold text-[11px] italic truncate max-w-[180px]">{meta}</span>
          {metaAction && <span className="text-gray-400 text-[10px] whitespace-nowrap">{metaAction}</span>}
        </div>
      )}
      {time && <span className="text-gray-300 text-[9px] font-bold uppercase block tracking-widest">{time}</span>}
    </div>
  );
};

const TaskRowComponent = ({ task, onClick }: { task: TaskRow, onClick: () => void }) => {
   return (
     <tr 
       onClick={onClick}
       className="hover:bg-blue-50/30 dark:hover:bg-surface-800/50 transition-colors cursor-pointer group animate-in fade-in duration-300"
     >
       <td className="px-5 py-3">
         <div className="flex flex-col">
           <span className="text-[13px] font-bold text-gray-900 dark:text-surface-100 drop-shadow-sm">{task.title}</span>
           {task.projectName !== '-' && (
             <span className="text-[9px] text-blue-500 dark:text-brand-400 font-bold uppercase tracking-[0.1em] mt-0.5">{task.projectName}</span>
           )}
         </div>
       </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <div className={cn("w-1.5 h-1.5 rounded-full", task.status === 'done' ? 'bg-emerald-500' : 'bg-blue-500')} />
          <span className="text-gray-600 font-bold text-[11px] uppercase tracking-tight">{task.status.replace('_', ' ')}</span>
        </div>
      </td>
      <td className="px-3 py-3">
         <div className={cn(
           "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.05em]",
           task.priority === 'urgent' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
           task.priority === 'high' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
           'bg-blue-50 text-blue-600 border border-blue-100'
         )}>
           {task.priority}
         </div>
      </td>
       <td className="px-3 py-3 text-gray-500 dark:text-surface-400 whitespace-nowrap">
         {task.dueDate ? (
           <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 dark:text-surface-500">
             <Calendar size={12} />
             {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
           </div>
         ) : (
           <span className="text-gray-200 dark:text-surface-800">—</span>
         )}
       </td>
       <td className="px-3 py-3 text-[11px] font-bold text-gray-400/80 dark:text-surface-500/80 text-center">
         {task.estimatedHours ? `${task.estimatedHours}h` : '—'}
       </td>
       <td className="px-3 py-3 whitespace-nowrap">
         <div className="flex items-center gap-2">
           <UserAvatar name={task.assignedTo || 'U'} size="xs" />
           <span className="text-gray-700 dark:text-surface-300 font-bold text-[11px]">{task.assignedTo || 'Unassigned'}</span>
         </div>
       </td>
      <td className="px-5 py-3 text-right">
        <MoreHorizontal size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </td>
    </tr>
  );
};

export default TasksManagement;
