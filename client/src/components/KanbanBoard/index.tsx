import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDroppable, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Filter, X as XIcon, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, generateId } from '../../utils/helpers';
import { STATUS_CONFIG } from '../../app/constants';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { TaskCard } from '../TaskCard';
import type { Task, TaskStatus } from '../../app/types';

const BASE_COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'backlog', title: 'Backlog', color: '#8896b8' },
  { id: 'todo', title: 'New task', color: '#5e72a0' },
  { id: 'scheduled', title: 'Scheduled', color: '#0ea5e9' },
  { id: 'in_progress', title: 'In Progress', color: '#3366ff' },
  { id: 'in_review', title: 'In Review', color: '#7c3aed' },
  { id: 'done', title: 'Completed', color: '#10b981' },
];

type CustomColumn = {
  id: string;
  title: string;
  color: string;
};

type BoardCustomization = {
  customColumns: CustomColumn[];
  columnOrder: string[];
  taskStepOverrides: Record<string, string>;
  collapsedColumns?: string[];
};

type BoardColumn = {
  id: string;
  title: string;
  color: string;
  isBuiltIn: boolean;
};

const CUSTOM_COLUMN_COLORS = ['#f97316', '#14b8a6', '#ec4899', '#8b5cf6', '#22c55e', '#f59e0b'];

function getStorageKey(projectId: string) {
  return `kanban-customization:${projectId}`;
}

function isBuiltInColumn(id: string): id is TaskStatus {
  return BASE_COLUMNS.some((column) => column.id === id);
}

function mergeColumnOrder(columns: BoardColumn[], storedOrder: string[]) {
  const available = new Set(columns.map((column) => column.id));
  const ordered = storedOrder.filter((id) => available.has(id));
  const missing = columns.map((column) => column.id).filter((id) => !ordered.includes(id));
  return [...ordered, ...missing];
}

interface SortableTaskProps {
  task: Task;
  onOpen: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
}

const SortableTask: React.FC<SortableTaskProps> = ({ task, onOpen, onDeleteTask }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className="relative group/task"
      {...attributes}
      {...listeners}
    >
      {onDeleteTask && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDeleteTask(task.id);
          }}
          className="absolute right-2 top-2 z-10 hidden h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-rose-500 shadow-sm transition hover:bg-rose-50 group-hover/task:flex"
        >
          <Trash2 size={13} />
        </button>
      )}
      <TaskCard task={task} onClick={() => onOpen(task)} isDragging={isDragging} />
    </div>
  );
};

interface ColumnMenuProps {
  isBuiltIn: boolean;
  onAddProcessStep: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

const ColumnMenu: React.FC<ColumnMenuProps> = ({ isBuiltIn, onAddProcessStep, onRename, onDelete }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="btn-ghost h-7 w-7 rounded-lg text-surface-400">
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 min-w-[190px] rounded-xl border border-surface-200 bg-white p-1 shadow-lg dark:border-surface-700 dark:bg-surface-900">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAddProcessStep();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-surface-700 hover:bg-surface-50 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <Plus size={14} />
            Add process step after
          </button>
          {!isBuiltIn && onRename && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRename();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-surface-700 hover:bg-surface-50 dark:text-surface-200 dark:hover:bg-surface-800"
            >
              <Pencil size={14} />
              Rename step
            </button>
          )}
          {!isBuiltIn && onDelete && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
            >
              <Trash2 size={14} />
              Delete step
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface KanbanColumnProps {
  column: BoardColumn;
  tasks: Task[];
  onAddTask?: (status: TaskStatus) => void;
  onOpenTask: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onAddProcessStep: (columnId: string) => void;
  onRenameStep: (columnId: string) => void;
  onDeleteStep: (columnId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: (columnId: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  tasks,
  onAddTask,
  onOpenTask,
  onDeleteTask,
  onAddProcessStep,
  onRenameStep,
  onDeleteStep,
  isCollapsed,
  onToggleCollapse,
}) => {
  const config = isBuiltInColumn(column.id) ? STATUS_CONFIG[column.id] : null;
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: column.id });
  const { attributes, listeners, setNodeRef: setSortRef, transform, transition, isDragging } = useSortable({ id: `column:${column.id}` });

  const setRefs = (node: HTMLDivElement | null) => {
    setDropRef(node);
    setSortRef(node);
  };

  return (
    <div
      ref={setRefs}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.75 : 1 }}
      className={cn(
        'flex flex-col rounded-2xl border border-surface-100 dark:border-surface-800 transition-all duration-300',
        isCollapsed ? 'w-12 min-w-[48px]' : 'w-72 min-w-[288px]',
        isOver ? 'bg-surface-100 dark:bg-surface-800' : 'bg-surface-50 dark:bg-surface-950/50'
      )}
    >
      {isCollapsed ? (
        <div 
          onClick={() => onToggleCollapse(column.id)}
          className="flex-1 flex flex-col items-center py-6 cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-colors group/collapsed relative"
        >
          <div className="h-2.5 w-2.5 rounded-full mb-8 shadow-sm" style={{ backgroundColor: column.color }} />
          
          <div className="flex-1 relative w-full flex items-center justify-center">
            <h3 className="whitespace-nowrap text-[10px] font-black text-surface-400 dark:text-surface-500 uppercase tracking-[0.2em] transform -rotate-90 origin-center">
              {column.title}
            </h3>
          </div>

          <div className="mt-8 flex flex-col items-center gap-4">
             <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
               {tasks.length}
             </span>
             <div className="p-1 rounded bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 shadow-sm text-brand-600 opacity-0 group-hover/collapsed:opacity-100 transition-opacity">
                <ChevronRight size={10} strokeWidth={3} />
             </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 p-3 pb-2">
            <div className="flex flex-1 items-center gap-2 min-w-0 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
              <h3 className="truncate text-sm font-semibold text-surface-700 dark:text-surface-300">{column.title}</h3>
            </div>
            <span className={cn('badge text-[11px]', config ? `${config.bg} ${config.text}` : 'bg-surface-100 text-surface-500')}>{tasks.length}</span>
            
            <div className="flex items-center gap-1">
              <ColumnMenu
                isBuiltIn={column.isBuiltIn}
                onAddProcessStep={() => onAddProcessStep(column.id)}
                onRename={() => onRenameStep(column.id)}
                onDelete={() => onDeleteStep(column.id)}
              />
              <button 
                onClick={() => onToggleCollapse(column.id)}
                className="p-1 hover:bg-surface-200 dark:hover:bg-surface-800 rounded transition-colors text-surface-400"
                title="Collapse Stage"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-2 pt-1 min-h-[120px] max-h-[calc(100vh-260px)]">
            <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
              {tasks.map((task) => (
                <SortableTask key={task.id} task={task} onOpen={onOpenTask} onDeleteTask={onDeleteTask} />
              ))}
            </SortableContext>
          </div>

          <div className="p-2 pt-1">
          {onAddTask && column.isBuiltIn ? (
            <button
              type="button"
              onClick={() => onAddTask?.(column.id as TaskStatus)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-surface-400',
                'hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-600 dark:hover:text-surface-300',
                'border border-dashed border-surface-200 dark:border-surface-700 transition-all duration-200'
              )}
            >
              <Plus size={14} />
              <span>Add task</span>
            </button>
          ) : !onAddTask && column.isBuiltIn ? null : (
            <div className="rounded-xl border border-dashed border-surface-200 px-3 py-2 text-xs text-surface-400 dark:border-surface-700">
              Drag tasks here.
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
};

interface KanbanBoardProps {
  projectId: string;
  onOpenTask: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
  tasksOverride?: Task[];
  onMoveTaskRemote?: (taskId: string, status: TaskStatus) => Promise<void>;
  onDeleteTask?: (taskId: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  projectId,
  onOpenTask,
  onAddTask,
  tasksOverride,
  onMoveTaskRemote,
  onDeleteTask,
}) => {
  const { tasks: storeTasks, moveTask } = useAppStore();
  const { user } = useAuthStore();
  const canManageTask = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>(BASE_COLUMNS.map((column) => column.id));
  const [taskStepOverrides, setTaskStepOverrides] = useState<Record<string, string>>({});
  const [collapsedColumns, setCollapsedColumns] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const { allLabels } = useAppStore();

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    storeTasks.forEach(t => t.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [storeTasks]);

  const tasks = tasksOverride ?? storeTasks;
  const projectTasks = useMemo(() => {
    let filtered = projectId ? tasks.filter((task) => task.projectId === projectId) : tasks;
    
    if (selectedLabels.length > 0) {
      filtered = filtered.filter(t => 
        t.labels?.some(l => {
          const lId = typeof l === 'object' ? l.id : l;
          return selectedLabels.includes(lId);
        })
      );
    }
    
    if (selectedTags.length > 0) {
      filtered = filtered.filter(t => 
        t.tags?.some(tag => selectedTags.includes(tag))
      );
    }
    
    return filtered;
  }, [tasks, projectId, selectedLabels, selectedTags]);

  const allColumns = useMemo<BoardColumn[]>(
    () => [
      ...BASE_COLUMNS.map((column) => ({ ...column, isBuiltIn: true })),
      ...customColumns.map((column) => ({ ...column, isBuiltIn: false })),
    ],
    [customColumns]
  );

  const orderedColumns = useMemo(() => {
    const order = mergeColumnOrder(allColumns, columnOrder);
    return order
      .map((id) => allColumns.find((column) => column.id === id))
      .filter(Boolean) as BoardColumn[];
  }, [allColumns, columnOrder]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getStorageKey(projectId));
      if (!raw) {
        setCustomColumns([]);
        setColumnOrder(BASE_COLUMNS.map((column) => column.id));
        setTaskStepOverrides({});
        return;
      }

      const parsed = JSON.parse(raw) as Partial<BoardCustomization>;
      const loadedCustomColumns = Array.isArray(parsed.customColumns) ? parsed.customColumns : [];
      setCollapsedColumns(Array.isArray(parsed.collapsedColumns) ? parsed.collapsedColumns : []);
      const mergedColumns = [
        ...BASE_COLUMNS.map((column) => ({ ...column, isBuiltIn: true })),
        ...loadedCustomColumns.map((column) => ({ ...column, isBuiltIn: false })),
      ];

      setCustomColumns(loadedCustomColumns);
      setColumnOrder(mergeColumnOrder(mergedColumns, Array.isArray(parsed.columnOrder) ? parsed.columnOrder : []));
      setTaskStepOverrides(parsed.taskStepOverrides && typeof parsed.taskStepOverrides === 'object' ? parsed.taskStepOverrides : {});
    } catch {
      setCustomColumns([]);
      setColumnOrder(BASE_COLUMNS.map((column) => column.id));
      setTaskStepOverrides({});
      setCollapsedColumns([]);
    }
  }, [projectId]);

  useEffect(() => {
    const payload: BoardCustomization = {
      customColumns,
      columnOrder: mergeColumnOrder(allColumns, columnOrder),
      taskStepOverrides,
      collapsedColumns,
    };
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(payload));
  }, [allColumns, columnOrder, customColumns, projectId, taskStepOverrides, collapsedColumns]);

  const toggleCollapse = (columnId: string) => {
    setCollapsedColumns(prev => 
      prev.includes(columnId) ? prev.filter(c => c !== columnId) : [...prev, columnId]
    );
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getTaskColumnId = (task: Task) => {
    const override = taskStepOverrides[task.id];
    if (override && orderedColumns.some((column) => column.id === override)) return override;
    return task.status;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (activeId.startsWith('column:')) return;
    const task = projectTasks.find((item) => item.id === activeId);
    setActiveTask(task || null);
  };

  const moveTaskToColumn = async (task: Task, columnId: string) => {
    if (isBuiltInColumn(columnId)) {
      setTaskStepOverrides((prev) => {
        if (!prev[task.id]) return prev;
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      if (task.status !== columnId) {
        if (onMoveTaskRemote) {
          await onMoveTaskRemote(task.id, columnId);
        } else {
          moveTask(task.id, columnId);
        }
      }
      return;
    }

    setTaskStepOverrides((prev) => ({ ...prev, [task.id]: columnId }));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('column:')) {
      if (!overId.startsWith('column:')) return;
      const activeColumnId = activeId.replace('column:', '');
      const overColumnId = overId.replace('column:', '');
      if (activeColumnId === overColumnId) return;
      const currentOrder = mergeColumnOrder(allColumns, columnOrder);
      const oldIndex = currentOrder.indexOf(activeColumnId);
      const newIndex = currentOrder.indexOf(overColumnId);
      if (oldIndex === -1 || newIndex === -1) return;
      setColumnOrder(arrayMove(currentOrder, oldIndex, newIndex));
      return;
    }

    const draggedTask = projectTasks.find((task) => task.id === activeId);
    if (!draggedTask) return;

    if (overId.startsWith('column:')) return;

    const targetColumnId = orderedColumns.some((column) => column.id === overId)
      ? overId
      : (() => {
          const targetTask = projectTasks.find((task) => task.id === overId);
          return targetTask ? getTaskColumnId(targetTask) : '';
        })();

    if (!targetColumnId) return;
    if (getTaskColumnId(draggedTask) === targetColumnId) return;
    await moveTaskToColumn(draggedTask, targetColumnId);
  };

  const addProcessStepAfter = (afterColumnId?: string) => {
    const title = window.prompt('Process step name');
    if (!title?.trim()) return;
    const nextId = `custom_${generateId()}`;
    const nextColumn: CustomColumn = {
      id: nextId,
      title: title.trim(),
      color: CUSTOM_COLUMN_COLORS[customColumns.length % CUSTOM_COLUMN_COLORS.length],
    };

    setCustomColumns((prev) => [...prev, nextColumn]);
    setColumnOrder((prev) => {
      const baseOrder = mergeColumnOrder([...allColumns, { ...nextColumn, isBuiltIn: false }], prev);
      const insertAfter = afterColumnId ? baseOrder.indexOf(afterColumnId) : baseOrder.length - 1;
      const withoutNew = baseOrder.filter((id) => id !== nextId);
      withoutNew.splice(insertAfter + 1, 0, nextId);
      return withoutNew;
    });
  };

  const renameProcessStep = (columnId: string) => {
    const column = customColumns.find((item) => item.id === columnId);
    if (!column) return;
    const title = window.prompt('Rename process step', column.title);
    if (!title?.trim()) return;
    setCustomColumns((prev) => prev.map((item) => (item.id === columnId ? { ...item, title: title.trim() } : item)));
  };

  const deleteProcessStep = (columnId: string) => {
    const fallback = BASE_COLUMNS.find((column) => column.id === 'todo')?.id || BASE_COLUMNS[0].id;
    if (!window.confirm('Delete this custom process step? Tasks in this step will move back to New task.')) return;
    setCustomColumns((prev) => prev.filter((column) => column.id !== columnId));
    setColumnOrder((prev) => prev.filter((id) => id !== columnId));
    setTaskStepOverrides((prev) => {
      const next: Record<string, string> = {};
      for (const [taskId, stepId] of Object.entries(prev)) {
        if (stepId !== columnId) next[taskId] = stepId;
      }
      return next;
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between bg-surface-50/50 dark:bg-surface-800/30 p-2 rounded-2xl border border-surface-100 dark:border-surface-800/50">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "btn-secondary btn-sm gap-2 transition-all h-9 px-4 shadow-sm",
                (selectedLabels.length > 0 || selectedTags.length > 0 || isFilterOpen) && "border-brand-500 text-brand-700 bg-brand-50 dark:bg-brand-950/20"
              )}
            >
              <Filter size={15} className={cn(isFilterOpen && "text-brand-600")} />
              <span className="font-semibold">Filters</span>
              {(selectedLabels.length > 0 || selectedTags.length > 0) && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] text-white font-bold">
                  {selectedLabels.length + selectedTags.length}
                </span>
              )}
            </button>

            {canManageTask && (
              <button 
                onClick={() => setIsFilterOpen(true)}
                className="btn-secondary btn-sm gap-2 h-9 px-4 shadow-sm"
                title="Manage Labels"
              >
                <Tag size={15} className="text-brand-600" />
                <span className="font-semibold text-surface-900 border-none outline-none dark:text-white">Labels</span>
              </button>
            )}
            
            {(selectedLabels.length > 0 || selectedTags.length > 0) && (
              <button 
                onClick={() => { setSelectedLabels([]); setSelectedTags([]); }}
                className="text-[11px] font-bold text-surface-400 hover:text-rose-500 transition-colors uppercase tracking-wider ml-1"
              >
                Clear Filters
              </button>
            )}
          </div>

          <button type="button" onClick={() => addProcessStepAfter(orderedColumns[orderedColumns.length - 1]?.id)} className="btn-secondary btn-sm h-9 px-4">
            <Plus size={14} className="text-brand-600" />
            <span className="font-medium">Add Process Step</span>
          </button>
        </div>

        {isFilterOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900 p-4 shadow-sm space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Labels Filter */}
              <div>
                <label className="text-[11px] font-bold text-surface-400 uppercase tracking-widest mb-2.5 block">Filter by Label</label>
                <div className="flex flex-wrap gap-2">
                  {allLabels.map(l => {
                    const isSelected = selectedLabels.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        onClick={() => setSelectedLabels(prev => isSelected ? prev.filter(id => id !== l.id) : [...prev, l.id])}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5",
                          isSelected 
                            ? "border-current shadow-sm" 
                            : "border-surface-100 dark:border-surface-800 text-surface-500 hover:border-surface-200 dark:hover:border-surface-700"
                        )}
                        style={isSelected ? { color: l.color, backgroundColor: `${l.color}15` } : {}}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                        {l.name}
                      </button>
                    );
                  })}
                  {allLabels.length === 0 && <span className="text-xs text-surface-400 italic">No labels available</span>}
                </div>
              </div>

              {/* Tags Filter */}
              <div>
                <label className="text-[11px] font-bold text-surface-400 uppercase tracking-widest mb-2.5 block">Filter by Tag</label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => setSelectedTags(prev => isSelected ? prev.filter(t => t !== tag) : [...prev, tag])}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1",
                          isSelected 
                            ? "bg-surface-800 text-white border-surface-800 dark:bg-white dark:text-surface-900 dark:border-white shadow-md shadow-black/10" 
                            : "border-surface-100 dark:border-surface-800 text-surface-500 hover:border-surface-200 dark:hover:border-surface-700 bg-surface-50 dark:bg-surface-950/30"
                        )}
                      >
                        <Tag size={10} className={cn(isSelected ? "opacity-100" : "opacity-30")} />
                        #{tag}
                      </button>
                    );
                  })}
                  {allTags.length === 0 && <span className="text-xs text-surface-400 italic">No tags available</span>}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <SortableContext items={orderedColumns.map((column) => `column:${column.id}`)} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {orderedColumns.map((column) => {
            const columnTasks = projectTasks
              .filter((task) => getTaskColumnId(task) === column.id)
              .sort((a, b) => a.order - b.order);

            return (
              <motion.div key={column.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <KanbanColumn
                  column={column}
                  tasks={columnTasks}
                  onAddTask={onAddTask}
                  onOpenTask={onOpenTask}
                  onDeleteTask={onDeleteTask}
                  onAddProcessStep={addProcessStepAfter}
                  onRenameStep={renameProcessStep}
                  onDeleteStep={deleteProcessStep}
                  isCollapsed={collapsedColumns.includes(column.id)}
                  onToggleCollapse={toggleCollapse}
                />
              </motion.div>
            );
          })}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeTask && (
          <div className="pointer-events-none rotate-2 opacity-90">
            <TaskCard task={activeTask} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
