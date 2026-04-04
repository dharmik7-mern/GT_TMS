import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MessageSquare, Paperclip, Clock } from 'lucide-react';
import { cn, formatDate, isDueDateOverdue } from '../../utils/helpers';
import { PRIORITY_CONFIG } from '../../app/constants';
import { UserAvatar, AvatarGroup } from '../UserAvatar';
import { SubtaskBar } from '../SubtaskBar';
import { useAppStore } from '../../context/appStore';
import type { Task } from '../../app/types';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
  compact?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, isDragging, compact }) => {
  const priority = PRIORITY_CONFIG[task.priority];
  const { users, projects, allLabels } = useAppStore();
  const assignees = users.filter(u => task.assigneeIds.includes(u.id));
  const isOverdue = isDueDateOverdue(task.dueDate, task.status);
  const project = projects.find((item) => item.id === task.projectId);
  const category = project?.subcategories?.find((item) => item.id === task.subcategoryId);

  if (compact) {
    return (
      <motion.div
        layout
        onClick={onClick}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border border-surface-100 dark:border-surface-800',
          'bg-white dark:bg-surface-900 hover:border-brand-200 dark:hover:border-brand-800 transition-all cursor-pointer',
          isDragging && 'shadow-modal opacity-90 rotate-1'
        )}
      >
        <span className="priority-dot" style={{ backgroundColor: priority.color }} />
        <span className="text-sm text-surface-700 dark:text-surface-300 flex-1 truncate">{task.title}</span>
        {category && (
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: `${category.color || '#6366f1'}20`, color: category.color || '#6366f1' }}
          >
            {category.name}
          </span>
        )}
        {task.dueDate && (
          <span className={cn('text-[11px]', isOverdue ? 'text-rose-500' : 'text-surface-400')}>
            {formatDate(task.dueDate, 'MMM d')}
          </span>
        )}
        {assignees[0] && <UserAvatar name={assignees[0].name} color={assignees[0].color} size="xs" />}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      whileHover={{ y: -1 }}
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-surface-900 rounded-2xl border border-surface-100 dark:border-surface-800',
        'p-3.5 cursor-pointer transition-all duration-200 group',
        'hover:border-brand-200 dark:hover:border-surface-700 hover:shadow-card-hover',
        isDragging && 'shadow-modal rotate-1 opacity-95 scale-105'
      )}
    >
      {/* Priority, Labels & Categories */}
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        <span
          className={cn('badge text-[10px]', priority.bg, priority.text)}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priority.color }} />
          {priority.label}
        </span>
        
        {/* Structured Labels */}
        {task.labels?.map((label) => {
          const l = typeof label === 'object' ? label : allLabels.find(al => al.id === label);
          if (!l) return null;
          return (
            <span 
              key={l.id} 
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
              style={{ backgroundColor: `${l.color}20`, color: l.color }}
            >
              {l.name}
            </span>
          );
        })}

        {category && (
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: `${category.color || '#6366f1'}20`, color: category.color || '#6366f1' }}
          >
            {category.name}
          </span>
        )}
      </div>

      {/* Title */}
      {task.isReassignPending && (
        <div className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-900/40 mb-2 w-fit">
          <Clock size={10} />
          {task.reassignRequestedBy && task.requestedAssigneeId 
             ? `${users.find(u => u.id === task.reassignRequestedBy)?.name?.split(' ')[0]} requested reassign to ${users.find(u => u.id === task.requestedAssigneeId)?.name?.split(' ')[0]}`
             : task.requestedAssigneeId
               ? `Reassigning to ${users.find(u => u.id === task.requestedAssigneeId)?.name || '...'}`
               : 'Reassign Pending'}
        </div>
      )}
      <h4 className="text-sm font-medium text-surface-800 dark:text-surface-200 leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
        {task.title}
      </h4>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 mb-1">
          {task.tags.map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-surface-50 dark:bg-surface-800/50 text-surface-500 dark:text-surface-400 rounded-md border border-surface-100 dark:border-surface-800 flex items-center gap-1">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {task.description && (
        <p className="mt-1 text-[11px] text-surface-400 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}
      <div className="mb-3" />

      {/* Subtasks progress (GW-style bar) */}
      {((task.subtaskTotal ?? task.subtasks?.length ?? 0) > 0) && (
        <div className="mb-3">
          <SubtaskBar
            completed={task.subtaskCompleted ?? task.subtasks?.filter((s) => s.isCompleted).length ?? 0}
            total={task.subtaskTotal ?? task.subtasks?.length ?? 0}
            className="w-full max-w-[140px]"
          />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-3 text-surface-400">
          {task.dueDate && (
            <span className={cn('flex items-center gap-1 text-[11px]', isOverdue ? 'text-rose-500 font-medium' : '')}>
              <Calendar size={11} />
              {isOverdue ? 'Overdue' : formatDate(task.dueDate, 'MMM d')}
            </span>
          )}
          {task.estimatedHours && (
            <span className="flex items-center gap-1 text-[11px]">
              <Clock size={11} />
              {task.estimatedHours}h
            </span>
          )}
          {(task.comments?.length || 0) > 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <MessageSquare size={11} />
              {task.comments!.length}
            </span>
          )}
          {(task.attachments?.length || 0) > 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <Paperclip size={11} />
              {task.attachments!.length}
            </span>
          )}
        </div>

        {assignees.length > 0 && (
          <AvatarGroup users={assignees} max={3} size="xs" />
        )}
      </div>
    </motion.div>
  );
};

export default TaskCard;
