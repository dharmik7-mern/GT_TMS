import React from 'react';
import { MoreVertical, Plus, Clock, Target, CheckCircle2 } from 'lucide-react';
import { cn, formatDate } from '../../../utils/helpers';
import type { PersonalTask } from '../../../app/types';

interface KanbanViewProps {
  tasks: PersonalTask[];
  onMove: (id: string, status: 'todo' | 'in_progress' | 'done') => void;
}

const COLUMNS: { id: 'todo' | 'in_progress' | 'done'; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' }
];

export const KanbanView: React.FC<KanbanViewProps> = ({ tasks, onMove }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-[500px]">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id);
        return (
          <div key={col.id} className="flex flex-col gap-4 bg-surface-50/50 dark:bg-surface-900/50 rounded-xl p-4 border border-surface-100 dark:border-surface-800">
            <header className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                 <h3 className="text-[10px] font-bold uppercase tracking-widest text-surface-500">
                   {col.label}
                 </h3>
                 <span className="text-[10px] font-bold text-surface-400 bg-white dark:bg-surface-800 px-1.5 py-0.5 rounded border border-surface-100 dark:border-surface-700">
                   {colTasks.length}
                 </span>
              </div>
              <button className="text-surface-300 hover:text-surface-500 transition-colors">
                <Plus size={14} />
              </button>
            </header>

            <div className="flex-1 space-y-3">
               {colTasks.map(task => (
                 <div
                   key={task.id}
                   className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-4 rounded-lg shadow-none group cursor-grab active:cursor-grabbing border-l-4 border-l-brand-600"
                 >
                   <p className={cn(
                     "text-sm font-semibold text-surface-800 dark:text-surface-200 leading-tight mb-3",
                     task.status === 'done' && "line-through opacity-50 font-normal"
                   )}>
                     {task.title}
                   </p>
                   
                   {task.labels && task.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {task.labels.map(l => (
                          <span key={l} className="text-[9px] font-black uppercase bg-brand-50/50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-300 px-1.5 py-0.5 rounded border border-brand-100/30">#{l}</span>
                        ))}
                      </div>
                    )}

                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         {task.dueDate && (
                           <span className={cn(
                             "text-[10px] font-semibold",
                             new Date(task.dueDate).toDateString() === new Date().toDateString() ? "text-brand-600" : "text-surface-400"
                           )}>
                              {formatDate(task.dueDate, 'MMM d')}
                           </span>
                         )}
                         {task.priority === 'high' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                         )}
                         {task.subtasks && task.subtasks.length > 0 && (
                            <span className="text-[9px] font-bold text-surface-400 flex items-center gap-1">
                               <CheckCircle2 size={10} /> {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length}
                            </span>
                         )}
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-300 hover:text-surface-500">
                        <MoreVertical size={14} />
                      </button>
                   </div>
                </div>
               ))}
               
               {colTasks.length === 0 && (
                 <div className="h-24 border-2 border-dashed border-surface-100 dark:border-surface-800 rounded-lg flex items-center justify-center text-surface-200 text-[10px] font-bold uppercase tracking-widest">
                   No tasks
                 </div>
               )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
