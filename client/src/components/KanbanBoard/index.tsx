import React, { useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners, useDroppable
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/helpers';
import { STATUS_CONFIG } from '../../app/constants';
import { useAppStore } from '../../context/appStore';
import { TaskCard } from '../TaskCard';
import type { Task, TaskStatus } from '../../app/types';

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'backlog', title: 'Backlog', color: '#8896b8' },
  { id: 'todo', title: 'New task', color: '#5e72a0' },
  { id: 'scheduled', title: 'Scheduled', color: '#0ea5e9' },
  { id: 'in_progress', title: 'In Progress', color: '#3366ff' },
  { id: 'in_review', title: 'In Review', color: '#7c3aed' },
  { id: 'blocked', title: 'Blocked', color: '#64748b' },
  { id: 'done', title: 'Completed', color: '#10b981' },
];

interface SortableTaskProps {
  task: Task;
  onOpen: (task: Task) => void;
}

const SortableTask: React.FC<SortableTaskProps> = ({ task, onOpen }) => {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onClick={() => onOpen(task)} isDragging={isDragging} />
    </div>
  );
};

interface KanbanColumnProps {
  columnId: TaskStatus;
  title: string;
  color: string;
  tasks: Task[];
  onAddTask?: (status: TaskStatus) => void;
  onOpenTask: (task: Task) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  columnId, title, color, tasks, onAddTask, onOpenTask
}) => {
  const config = STATUS_CONFIG[columnId];
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div ref={setNodeRef} className={cn('flex flex-col w-72 min-w-[288px] rounded-2xl border border-surface-100 dark:border-surface-800', isOver ? 'bg-surface-100 dark:bg-surface-800' : 'bg-surface-50 dark:bg-surface-950/50')}>
      {/* Column Header */}
      <div className="flex items-center gap-2 p-3 pb-2">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex-1">{title}</h3>
        <span className={cn('badge text-[11px]', config.bg, config.text)}>{tasks.length}</span>
        <button className="btn-ghost w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center">
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Tasks */}
      <div className="flex-1 p-2 pt-1 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-260px)]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTask key={task.id} task={task} onOpen={onOpenTask} />
          ))}
        </SortableContext>
      </div>

      {/* Add Task */}
      <div className="p-2 pt-1">
        <button
          onClick={() => onAddTask?.(columnId)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-surface-400',
            'hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-600 dark:hover:text-surface-300',
            'border border-dashed border-surface-200 dark:border-surface-700',
            'transition-all duration-200'
          )}
        >
          <Plus size={14} />
          <span>Add task</span>
        </button>
      </div>
    </div>
  );
};

interface KanbanBoardProps {
  projectId: string;
  onOpenTask: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
  /** When set, Kanban reads these tasks instead of the global store (e.g. To-do page + API). */
  tasksOverride?: Task[];
  /** Persist status change to API; when omitted, uses local store only. */
  onMoveTaskRemote?: (taskId: string, status: TaskStatus) => Promise<void>;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  projectId,
  onOpenTask,
  onAddTask,
  tasksOverride,
  onMoveTaskRemote,
}) => {
  const { tasks: storeTasks, moveTask } = useAppStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const tasks = tasksOverride ?? storeTasks;
  const projectTasks = tasks.filter(t => t.projectId === projectId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = projectTasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const draggedTask = projectTasks.find(t => t.id === active.id);
    if (!draggedTask) return;

    const applyMove = async (next: TaskStatus) => {
      if (draggedTask.status === next) return;
      if (onMoveTaskRemote) {
        await onMoveTaskRemote(draggedTask.id, next);
      } else {
        moveTask(draggedTask.id, next);
      }
    };

    // If dropped on a column container (including empty columns)
    const targetColumn = COLUMNS.find(c => c.id === over.id);
    if (targetColumn && draggedTask.status !== targetColumn.id) {
      await applyMove(targetColumn.id);
      return;
    }

    // If dropped on another task
    const targetTask = projectTasks.find(t => t.id === over.id);
    if (targetTask && targetTask.status !== draggedTask.status) {
      await applyMove(targetTask.status);
      return;
    }

    // Fallback: drop to column where the dragged task currently is
    const currentColumn = COLUMNS.find(c => c.id === draggedTask.status);
    if (currentColumn) {
      await applyMove(currentColumn.id);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 group">
        {COLUMNS.map(col => {
          const colTasks = projectTasks
            .filter(t => t.status === col.id)
            .sort((a, b) => a.order - b.order);

          return (
            <motion.div
              key={col.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: COLUMNS.indexOf(col) * 0.05 }}
            >
              <KanbanColumn
                columnId={col.id}
                title={col.title}
                color={col.color}
                tasks={colTasks}
                onAddTask={onAddTask}
                onOpenTask={onOpenTask}
              />
            </motion.div>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rotate-2 opacity-90 pointer-events-none">
            <TaskCard task={activeTask} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
