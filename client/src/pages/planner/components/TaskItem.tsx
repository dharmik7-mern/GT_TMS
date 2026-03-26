import React, { useState, useRef, useEffect } from 'react';
import { 
  CheckCircle2, Pin, Trash2, Calendar, 
  Clock, Flag, Tag, PinOff, MoreVertical, 
  Edit2, Circle, Plus, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDate } from '../../../utils/helpers';
import type { PersonalTask } from '../../../app/types';

interface TaskItemProps {
  task: PersonalTask;
  onToggleDone: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<PersonalTask>) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onToggleDone, onTogglePin, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const editRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) editRef.current?.focus();
  }, [isEditing]);

  useEffect(() => {
    if (showLabelInput) labelInputRef.current?.focus();
  }, [showLabelInput]);

  const handleUpdateTitle = () => {
    if (editValue.trim() && editValue !== task.title) {
       onUpdate({ title: editValue.trim() });
    }
    setIsEditing(false);
  };

  const handleAddLabel = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newLabel.trim()) {
      const labels = [...(task.labels || []), newLabel.trim().toLowerCase()];
      onUpdate({ labels: Array.from(new Set(labels)) });
      setNewLabel('');
      setShowLabelInput(false);
    }
  };

  const removeLabel = (label: string) => {
    onUpdate({ labels: task.labels.filter(l => l !== label) });
  };

  const setPriority = (priority: 'low' | 'medium' | 'high') => {
    onUpdate({ priority });
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
  const isToday = task.dueDate && new Date(task.dueDate).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
  const isTomorrow = task.dueDate && new Date(task.dueDate).toISOString().split('T')[0] === new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const getDueDateLabel = () => {
    if (!task.dueDate) return '--';
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    return formatDate(task.dueDate, 'MMM d');
  };

  const isDone = task.status === 'done';

  return (
    <div className={cn(
      "grid grid-cols-[1fr,150px,180px,80px] items-center px-6 py-2.5 transition-all border-b border-surface-100 dark:border-surface-800 last:border-b-0 group cursor-default",
      isDone ? "bg-green-50/20 dark:bg-green-900/5" : "hover:bg-surface-50 dark:hover:bg-surface-800/20"
    )}>
      {/* 1. Content Section */}
      <div className="flex items-center gap-3 min-w-0 pr-4">
        <button 
          onClick={onToggleDone}
          className={cn(
            "w-5 h-5 rounded-lg flex items-center justify-center transition-all border-2",
            isDone 
              ? "bg-green-500 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]" 
              : "bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-700 hover:border-brand-500"
          )}
        >
          {isDone && <CheckCircle2 size={12} strokeWidth={3} />}
        </button>
        
        <div className="flex-1 min-w-0 flex items-center gap-2">
           {isEditing ? (
             <input
               ref={editRef}
               type="text"
               value={editValue}
               onChange={(e) => setEditValue(e.target.value)}
               onBlur={handleUpdateTitle}
               onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()}
               className="w-full bg-transparent border-none p-0 text-[13px] font-semibold text-surface-900 dark:text-white focus:ring-0 leading-tight"
             />
           ) : (
             <div className="flex flex-col gap-0.5 overflow-hidden">
                <span 
                  onClick={() => setIsEditing(true)}
                  className={cn(
                    "text-[13px] font-semibold truncate transition-colors",
                    isDone ? "text-green-700 dark:text-green-400" : "text-surface-800 dark:text-surface-200"
                  )}
                >
                  {task.title}
                </span>
             </div>
           )}
        </div>
      </div>

      {/* 2. Labels */}
      <div className="flex items-center justify-center gap-1.5 overflow-hidden">
        <AnimatePresence>
          {task.labels && task.labels.slice(0, 2).map(l => (
            <motion.span 
              key={l}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-tight px-2 py-0.5 rounded-full border",
                isDone 
                  ? "bg-green-100/50 dark:bg-green-900/20 text-green-600 border-green-200" 
                  : "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-300 border-brand-100/50"
              )}
            >
              #{l}
            </motion.span>
          ))}
        </AnimatePresence>
        
        {!isDone && (
          showLabelInput ? (
            <form onSubmit={handleAddLabel} className="inline-block">
               <input
                 ref={labelInputRef}
                 type="text"
                 value={newLabel}
                 onChange={(e) => setNewLabel(e.target.value)}
                 onBlur={() => !newLabel && setShowLabelInput(false)}
                 className="w-12 bg-surface-50 dark:bg-surface-800 border-none rounded px-1.5 py-0.5 text-[9px] focus:ring-0"
               />
            </form>
          ) : (
            <button onClick={() => setShowLabelInput(true)} className="opacity-0 group-hover:opacity-100 p-1 text-surface-300 hover:text-brand-600"><Plus size={10} /></button>
          )
        )}
      </div>

      {/* 3. Due Date & Priority */}
      <div className="flex items-center justify-center gap-4">
        <span className={cn(
          "text-[11px] font-bold min-w-[70px] text-center",
          isDone ? "text-green-600/50" : (isOverdue ? "text-rose-500" : isToday ? "text-brand-600" : "text-surface-400")
        )}>
          {getDueDateLabel()}
        </span>
        
        <div className="flex items-center gap-1.5 p-1 bg-surface-50 dark:bg-surface-900/50 rounded-lg border border-surface-100/50 dark:border-surface-800/50 shadow-sm">
           {['high', 'medium', 'low'].map((p) => (
             <button
               key={p}
               onClick={() => !isDone && setPriority(p as any)}
               className={cn(
                 "w-2 h-2 rounded-full transition-all",
                 task.priority === p 
                   ? (p === 'high' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" : p === 'medium' ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "bg-surface-400")
                   : "bg-surface-200 dark:bg-surface-800 opacity-20 hover:opacity-100"
               )}
               title={p}
             />
           ))}
        </div>
      </div>

      {/* 4. Actions Area */}
      <div className="flex items-center justify-end gap-1">
        <button 
          onClick={onTogglePin} 
          className={cn(
            "p-1.5 rounded-lg transition-all", 
            task.isPinned 
              ? "text-amber-500 bg-amber-50 dark:bg-amber-900/20 opacity-100 scale-100" 
              : "text-surface-300 hover:text-amber-500 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
          )}
          title="Pin Task"
        >
          <Pin size={14} fill={task.isPinned ? "currentColor" : "none"} />
        </button>
        <button 
          onClick={onDelete} 
          className="p-1.5 rounded-lg text-surface-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};
