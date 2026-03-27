import React, { useMemo } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragEndEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreVertical, Plus, Clock, Target, CheckCircle2, AlignLeft } from 'lucide-react';
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

interface SortableTaskProps {
  task: PersonalTask;
}

const SortableTask: React.FC<SortableTaskProps> = ({ task }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id, data: { type: 'Task', task } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-4 rounded-xl shadow-sm group cursor-grab active:cursor-grabbing border-l-4",
        task.status === 'done' ? "border-l-green-500" : task.status === 'in_progress' ? "border-l-amber-500" : "border-l-brand-600",
        task.status === 'done' && "bg-green-50/10 dark:bg-green-900/5 shadow-inner opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className={cn(
          "text-sm font-bold text-surface-800 dark:text-surface-200 leading-tight",
          task.status === 'done' && "line-through opacity-50 font-normal"
        )}>
          {task.title}
        </p>
        <button className="text-surface-300 hover:text-surface-500 transition-colors">
          <MoreVertical size={14} />
        </button>
      </div>

      {task.description && (
        <p className="text-[11px] text-surface-500 dark:text-surface-400 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}
      
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.labels.map(l => (
            <span key={l} className="text-[9px] font-black uppercase bg-brand-50/50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-300 px-1.5 py-0.5 rounded border border-brand-100/30">#{l}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-50 dark:border-surface-800">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className={cn(
              "text-[10px] font-semibold flex items-center gap-1",
              new Date(task.dueDate).toDateString() === new Date().toDateString() ? "text-brand-600" : "text-surface-400"
            )}>
              <Clock size={10} />
              {formatDate(task.dueDate, 'MMM d')}
            </span>
          )}
          {task.priority === 'high' && (
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" title="High Priority" />
          )}
          {task.description && (
            <AlignLeft size={10} className="text-surface-300" />
          )}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="text-[9px] font-bold text-surface-400 flex items-center gap-1 bg-surface-50 dark:bg-surface-800 px-1.5 py-0.5 rounded">
              <CheckCircle2 size={10} /> {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const KanbanView: React.FC<KanbanViewProps> = ({ tasks, onMove }) => {
  const [activeTask, setActiveTask] = React.useState<PersonalTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = active.data.current?.task as PersonalTask;
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const task = active.data.current?.task as PersonalTask;
    
    // Check if dropping into a column
    let newStatus: string | null = null;
    if (over.data.current?.type === 'Column') {
      newStatus = over.id as string;
    } else if (over.data.current?.type === 'Task') {
      newStatus = over.data.current.task.status;
    }

    if (newStatus && task && newStatus !== task.status) {
      onMove(taskId, newStatus as any);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // This could be used for sorting within columns if needed
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-[500px]">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id);
          return (
            <div key={col.id} className="flex flex-col gap-4 bg-surface-50/50 dark:bg-surface-900/50 rounded-2xl p-4 border border-surface-100 dark:border-surface-800">
              <header className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    col.id === 'todo' ? "bg-brand-600" : col.id === 'in_progress' ? "bg-amber-500" : "bg-green-500"
                  )} />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-surface-500">
                    {col.label}
                  </h3>
                  <span className="text-[9px] font-black text-surface-400 bg-white dark:bg-surface-800 px-1.5 py-0.5 rounded border border-surface-100 dark:border-surface-700 shadow-sm min-w-[1.5rem] text-center">
                    {colTasks.length}
                  </span>
                </div>
                <button className="text-surface-300 hover:text-surface-500 transition-colors p-1 hover:bg-white dark:hover:bg-surface-800 rounded-md">
                  <Plus size={14} />
                </button>
              </header>

              <DroppableColumn id={col.id} tasks={colTasks} />
            </div>
          );
        })}
      </div>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.0',
            },
          },
        }),
      }}>
        {activeTask ? (
          <div className={cn(
            "bg-white dark:bg-surface-900 border border-brand-500/20 p-4 rounded-xl shadow-xl w-[calc(var(--column-width)-2rem)] rotate-2",
            "border-l-4",
            activeTask.status === 'done' ? "border-l-green-500" : activeTask.status === 'in_progress' ? "border-l-amber-500" : "border-l-brand-600"
          )}>
            <p className="text-sm font-bold text-surface-800 dark:text-surface-200">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

interface DroppableColumnProps {
  id: string;
  tasks: PersonalTask[];
}

const DroppableColumn: React.FC<DroppableColumnProps> = ({ id, tasks }) => {
  const { setNodeRef } = useSortable({
    id,
    data: {
      type: 'Column',
    },
  });

  return (
    <div ref={setNodeRef} className="flex-1 space-y-3 min-h-[150px]">
      <SortableContext id={id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map(task => (
          <SortableTask key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="h-24 border-2 border-dashed border-surface-100 dark:border-surface-800 rounded-xl flex items-center justify-center text-surface-200 text-[10px] font-black uppercase tracking-widest bg-white/30 dark:bg-surface-900/10">
            Drop here
          </div>
        )}
      </SortableContext>
    </div>
  );
};
