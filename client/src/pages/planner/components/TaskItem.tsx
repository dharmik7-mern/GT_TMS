import React, { useState, useRef, useEffect } from 'react';
import { 
  CheckCircle2, Pin, Trash2, Calendar, 
  Clock, Flag, Tag, PinOff, MoreVertical, 
  Edit2, Circle, Plus, X, ListTodo, ChevronDown, ChevronUp, AlignLeft, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { cn, formatDate, getTodayDateKey, isDueDateOverdue } from '../../../utils/helpers';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(task.description || '');
  const [newSubtask, setNewSubtask] = useState('');
  
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

  const handleUpdateDescription = () => {
    if (descriptionValue !== (task.description || '')) {
       onUpdate({ description: descriptionValue.trim() });
    }
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

  const handleAddSubtask = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newSubtask.trim()) return;
    const subtasks = [...(task.subtasks || []), {
      id: Math.random().toString(36).substr(2, 9),
      title: newSubtask.trim(),
      isCompleted: false,
      order: (task.subtasks?.length || 0) + 1
    }];
    onUpdate({ subtasks });
    setNewSubtask('');
  };

  const toggleSubtask = (subtaskId: string) => {
    const subtasks = task.subtasks?.map(s => 
      s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
    );
    onUpdate({ subtasks });
  };

  const deleteSubtask = (subtaskId: string) => {
    const subtasks = task.subtasks?.filter(s => s.id !== subtaskId);
    onUpdate({ subtasks });
  };

  const completedSubtasks = task.subtasks?.filter(s => s.isCompleted).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  const isOverdue = isDueDateOverdue(task.dueDate, task.status);
  const isToday = task.dueDate && task.dueDate === getTodayDateKey();
  const isTomorrow = task.dueDate && task.dueDate === format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');

  const getDueDateLabel = () => {
    if (!task.dueDate) return '--';
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    return formatDate(task.dueDate, 'MMM d');
  };

  const isDone = task.status === 'done';

  return (
    <div className={cn("flex flex-col border-b border-surface-100 dark:border-surface-800 last:border-b-0", isDone ? "bg-green-50/10 dark:bg-green-900/5 shadow-inner" : "hover:bg-surface-50/50 dark:hover:bg-surface-800/10")}>
      <div className={cn(
        "grid grid-cols-[1fr,150px,120px,120px,80px] items-center px-6 py-3 transition-all group cursor-default",
      )}>
        {/* 1. Content Section */}
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <button 
            onClick={onToggleDone}
            className={cn(
              "w-5 h-5 rounded-lg flex items-center justify-center transition-all border-2 flex-shrink-0",
              isDone 
                ? "bg-green-500 border-green-500 text-white" 
                : "bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-700 hover:border-brand-500"
            )}
          >
            {isDone && <CheckCircle2 size={12} strokeWidth={3} />}
          </button>
          
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex-1 min-w-0 flex flex-col gap-0.5 overflow-hidden">
               {isEditing ? (
                 <input
                   ref={editRef}
                   type="text"
                   value={editValue}
                   onChange={(e) => setEditValue(e.target.value)}
                   onBlur={handleUpdateTitle}
                   onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()}
                   className="w-full bg-transparent border-none p-0 text-[13px] font-bold text-surface-900 dark:text-white focus:ring-0 leading-tight"
                 />
               ) : (
                 <div className="flex flex-col gap-1 overflow-hidden">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span 
                        onClick={() => setIsEditing(true)}
                        className={cn(
                          "text-[13px] font-bold truncate transition-colors cursor-pointer",
                          isDone ? "text-green-700/60 dark:text-green-400 font-medium" : "text-surface-800 dark:text-surface-200"
                        )}
                      >
                        {task.title}
                      </span>
                      {totalSubtasks > 0 && (
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-400 inline-flex items-center gap-1">
                            {completedSubtasks}/{totalSubtasks}
                          </span>
                          <div className="w-12 h-1 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden hidden sm:block">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                              className="h-full bg-brand-500 rounded-full"
                            />
                          </div>
                        </div>
                      )}
                      {task.description && !showDescription && (
                        <AlignLeft size={10} className="text-surface-300 flex-shrink-0" />
                      )}
                    </div>
                    {(totalSubtasks > 0 || task.description) && (
                      <div className="flex items-center gap-3">
                        {totalSubtasks > 0 && (
                          <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-1 text-[9px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest hover:text-brand-700 w-fit"
                          >
                            {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            Checklist
                          </button>
                        )}
                        <button 
                          onClick={() => setShowDescription(!showDescription)}
                          className={cn(
                            "flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest transition-colors w-fit",
                            showDescription ? "text-brand-600 dark:text-brand-400" : "text-surface-400 hover:text-surface-600"
                          )}
                        >
                          {showDescription ? (
                            <>
                              <ChevronUp size={10} />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <AlignLeft size={10} />
                              {task.description ? 'Edit Details' : 'Add Details'}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    {task.description && !showDescription && (
                      <p className="text-[11px] text-surface-400 mt-1 line-clamp-1 italic">
                        {task.description}
                      </p>
                    )}
                 </div>
               )}
            </div>
            
            {showDescription && (
              <div className="mt-2 w-full px-1 flex flex-col gap-2">
                <textarea
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  onBlur={handleUpdateDescription}
                  placeholder="Add a detailed description..."
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg p-2 text-xs text-surface-700 dark:text-surface-300 focus:ring-1 focus:ring-brand-500/20 focus:border-brand-500 outline-none min-h-[80px] resize-none font-medium leading-relaxed"
                />
                <div className="flex justify-end">
                   <button 
                     onClick={() => setShowDescription(false)}
                     className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-200 bg-surface-100 dark:bg-surface-800 rounded-lg transition-all"
                   >
                     <ArrowLeft size={12} />
                     Back to list
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Labels */}
        <div className="flex items-center justify-center gap-1.5 overflow-hidden px-2">
          <div className="flex -space-x-1 hover:space-x-1.5 transition-all">
            {task.labels && task.labels.map(l => (
              <motion.span 
                key={l}
                className={cn(
                  "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-tight px-2 py-0.5 rounded-full border group/label relative transition-all",
                  isDone 
                    ? "bg-green-100/30 dark:bg-green-900/20 text-green-600/70 border-green-200/50" 
                    : "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border-brand-100 shadow-sm"
                )}
              >
                #{l}
                {!isDone && (
                  <button onClick={() => removeLabel(l)} className="opacity-0 group-hover/label:opacity-100 hover:text-rose-600 ml-0.5">
                    <X size={8} />
                  </button>
                )}
              </motion.span>
            ))}
          </div>
          
          {!isDone && (
            showLabelInput ? (
              <form onSubmit={handleAddLabel} className="inline-block flex-shrink-0">
                 <input
                   ref={labelInputRef}
                   type="text"
                   value={newLabel}
                   onChange={(e) => setNewLabel(e.target.value)}
                   onBlur={() => !newLabel && setShowLabelInput(false)}
                   className="w-16 bg-surface-100 dark:bg-surface-800 border-none rounded-full px-2 py-0.5 text-[9px] font-bold focus:ring-0"
                   placeholder="new..."
                 />
              </form>
            ) : (
              <button 
                onClick={() => setShowLabelInput(true)} 
                className="opacity-0 group-hover:opacity-100 p-1 text-surface-400 hover:text-brand-600 transition-opacity"
              >
                <Plus size={12} />
              </button>
            )
          )}
        </div>

        {/* 3. Due Date */}
        <div className="flex items-center justify-center px-2">
          <span className={cn(
            "text-[11px] font-black tracking-wider uppercase text-center",
            isDone ? "text-green-600/30 font-medium" : (isOverdue ? "text-rose-500" : isToday ? "text-brand-600" : "text-surface-400")
          )}>
            {getDueDateLabel()}
          </span>
        </div>

        {/* 4. Status (Priority) */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1.5 p-1 bg-surface-50 dark:bg-surface-900/50 rounded-lg border border-surface-100/50 dark:border-surface-800/50 shadow-sm">
             {['high', 'medium', 'low'].map((p) => (
               <button
                 key={p}
                 onClick={() => !isDone && setPriority(p as any)}
                 className={cn(
                   "w-2.5 h-2.5 rounded-full transition-all",
                   task.priority === p 
                     ? (p === 'high' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" : p === 'medium' ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "bg-surface-500 shadow-[0_0_8px_rgba(100,100,100,0.4)]")
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
            onClick={() => setIsExpanded(!isExpanded)} 
            className={cn(
              "p-1.5 rounded-lg transition-all", 
              totalSubtasks > 0 || isExpanded
                ? "text-brand-600 bg-brand-50 dark:bg-brand-900/20 opacity-100" 
                : "text-surface-300 hover:text-brand-600 opacity-0 group-hover:opacity-100"
            )}
            title="Checklist"
          >
            <ListTodo size={14} />
          </button>
          <button 
            onClick={onTogglePin} 
            className={cn(
              "p-1.5 rounded-lg transition-all", 
              task.isPinned 
                ? "text-amber-500 bg-amber-50 dark:bg-amber-900/20 opacity-100 scale-100" 
                : "text-surface-300 hover:text-amber-500 opacity-0 group-hover:opacity-100"
            )}
            title="Pin Task"
          >
            <Pin size={14} fill={task.isPinned ? "currentColor" : "none"} />
          </button>
          <button 
            onClick={onDelete} 
            className="p-1.5 rounded-lg text-surface-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 opacity-0 group-hover:opacity-100 transition-all"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Subtasks Section */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-surface-50/50 dark:bg-surface-900/20 border-t border-surface-100 dark:border-surface-800 px-6 py-4 space-y-3"
          >
            <div className="space-y-2">
              {task.subtasks?.map(sub => (
                <div key={sub.id} className="flex items-center gap-3 group/sub">
                  <button 
                    onClick={() => toggleSubtask(sub.id)}
                    className={cn(
                      "w-4 h-4 rounded border transition-colors flex items-center justify-center",
                      sub.isCompleted ? "bg-brand-500 border-brand-500 text-white" : "border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800"
                    )}
                  >
                    {sub.isCompleted && <CheckCircle2 size={10} strokeWidth={3} />}
                  </button>
                  <span className={cn(
                    "text-xs flex-1",
                    sub.isCompleted ? "line-through text-surface-400 font-medium" : "text-surface-700 dark:text-surface-300 font-semibold"
                  )}>
                    {sub.title}
                  </span>
                  <button 
                    onClick={() => deleteSubtask(sub.id)}
                    className="opacity-0 group-hover/sub:opacity-100 text-surface-300 hover:text-rose-600 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2 bg-white/50 dark:bg-surface-900/50 px-3 py-2 rounded-xl transition-all border border-surface-100 dark:border-surface-800 focus-within:border-brand-500/30 focus-within:bg-white">
               <Plus size={14} className="text-surface-300" />
               <input 
                 type="text"
                 value={newSubtask}
                 onChange={(e) => setNewSubtask(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask(e)}
                 placeholder="Add subtask..."
                 className="flex-1 bg-transparent border-none p-0 text-xs font-semibold focus:ring-0 placeholder-surface-400 outline-none"
               />
               {newSubtask && (
                 <button type="submit" className="text-[10px] font-bold text-brand-600 uppercase tracking-widest bg-brand-50 px-2 py-1 rounded-md">Add</button>
               )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
