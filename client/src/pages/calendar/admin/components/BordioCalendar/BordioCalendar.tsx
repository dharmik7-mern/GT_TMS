import React, { useMemo } from 'react';
import { useAdminCalendarStore, AdminTask } from '../../store/useAdminCalendarStore.ts';
import { format, isToday, addDays, isSameDay, addWeeks, addMonths, isBefore, differenceInMinutes } from 'date-fns';
import { cn } from '../../../../../utils/helpers.ts';
import { BordioTaskCard } from './BordioTaskCard';
import { Trash2, User, ChevronLeft, ChevronRight, X, Copy, Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';

// ── Deterministic pastel color per user (team color) ─────────────────────
const USER_COLORS = [
    '#B8D8FF', // blue
    '#F4B8B8', // coral
    '#F9C8D2', // pink
    '#C9B8F4', // lavender
    '#B8EAD0', // mint
    '#FFE0A0', // peach
    '#FADADD', // rose
    '#A8F0E0', // teal
];
export function userColor(name?: string): string {
    if (!name) return USER_COLORS[0];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}

// ── Recurrence expansion ─────────────────────────────────────────────────
const expandRecurringTasks = (tasks: AdminTask[], rangeStart: Date, rangeEnd: Date): AdminTask[] => {
    const all: AdminTask[] = [];
    tasks.forEach(task => {
        if (!task.isRecurring || !task.recurrenceRule || !task.startDateTime) {
            all.push(task); return;
        }
        let cStart = new Date(task.startDateTime);
        let cEnd   = task.endDateTime ? new Date(task.endDateTime) : cStart;
        const dur  = cEnd.getTime() - cStart.getTime();
        const freq = task.recurrenceRule.frequency;
        const endAt = task.recurrenceRule.endAt ? new Date(task.recurrenceRule.endAt) : rangeEnd;
        const limit = isBefore(endAt, rangeEnd) ? endAt : rangeEnd;
        let n = 0;
        while (isBefore(cStart, limit) && n < 365) {
            if (!isBefore(cEnd, rangeStart)) {
                all.push({ ...task, _id: n === 0 ? task._id : `${task._id}-${cStart.getTime()}`, startDateTime: cStart.toISOString(), endDateTime: cEnd.toISOString() });
            }
            switch (freq) {
                case 'daily':   cStart = addDays(cStart, 1); break;
                case 'weekly':  cStart = addWeeks(cStart, 1); break;
                case 'monthly': cStart = addMonths(cStart, 1); break;
                default: n = 1000;
            }
            cEnd = new Date(cStart.getTime() + dur);
            n++;
        }
    });
    return all;
};

const fmtTotal = (mins: number) => {
    if (mins <= 0) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
};

const DroppableColumn = ({ item, colTasks, getColumnTasks, setSelectedTask, deleteTask, handleDuplicate, groupBy, view, currentDate }: any) => {
    const isUserGroup = groupBy === 'user';
    const id = isUserGroup ? `user-${item.name}` : `date-${format(item as Date, 'yyyy-MM-dd')}`;
    
    const { setNodeRef, isOver } = useDroppable({
        id,
        data: { 
            type: 'calendar-column', 
            date: !isUserGroup ? format(item as Date, 'yyyy-MM-dd') : format(currentDate, 'yyyy-MM-dd'),
            user: isUserGroup ? item.name : undefined 
        }
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex flex-col overflow-y-auto scrollbar-hide border-r border-surface-200 dark:border-surface-800 last:border-r-0 transition-colors",
                isOver ? "bg-surface-50 dark:bg-surface-800/50" : "bg-white dark:bg-surface-900"
            )}
            style={{ padding: '10px 8px', gap: 9 }}
        >
            {colTasks.map((task: any) => (
                <BordioTaskCard
                    key={task._id}
                    task={task}
                    onClick={() => setSelectedTask(task)}
                    onDelete={deleteTask}
                    onDuplicate={handleDuplicate}
                />
            ))}

            <button
                onClick={() => setSelectedTask('new')}
                className="mt-1 flex w-full items-center justify-center rounded-lg border border-dashed border-surface-300 dark:border-surface-600 py-3 text-surface-400 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-900/20 hover:text-brand-600 transition-all"
                title="Add task to this column"
            >
                <Plus size={18} strokeWidth={2.5} />
            </button>
        </div>
    );
};

export const BordioCalendar: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
    const { 
        tasks, selectedTask, setSelectedTask, view, groupBy, currentDate, setCurrentDate, deleteTask, createTask,
        priorityFilter, statusFilter 
    } = useAdminCalendarStore();

    // State for the modal (assuming these are needed for the modal content provided)
    const isOpen = !!selectedTask;
    const isNewTask = selectedTask === 'new';
    const taskToEdit = selectedTask !== 'new' ? selectedTask : null;

    const [eventName, setEventName] = React.useState(taskToEdit?.title || '');
    const [startTime, setStartTime] = React.useState(taskToEdit?.startDateTime ? new Date(taskToEdit.startDateTime) : new Date());
    const [endTime, setEndTime] = React.useState(taskToEdit?.endDateTime ? new Date(taskToEdit.endDateTime) : addHours(new Date(), 1)); // Assuming addHours is available or needs to be imported
    const [repeatEvent, setRepeatEvent] = React.useState(taskToEdit?.isRecurring || false);

    // Helper for addHours if not imported
    function addHours(date: Date, hours: number) {
        const newDate = new Date(date);
        newDate.setHours(date.getHours() + hours);
        return newDate;
    }

    const normalizedQuery = (searchQuery || '').trim().toLowerCase();

    const filteredTasks = tasks.filter((task) => {
        // 1. Search Query
        const nq = normalizedQuery;
        const matchesSearch = !nq || 
            String(task.title || '').toLowerCase().includes(nq) ||
            String(task.description || '').toLowerCase().includes(nq) ||
            String(task.assignedUser || '').toLowerCase().includes(nq) ||
            (task.tags || []).some(t => String(t).toLowerCase().includes(nq));

        if (!matchesSearch) return false;

        // 2. Priority Filter
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

        // 3. Status Filter
        if (statusFilter !== 'all' && task.status !== statusFilter) return false;

        return true;
    });

    const handleDuplicate = async (task: AdminTask) => {
        const { _id, comments, attachments, ...rest } = task;
        await createTask({ ...rest, title: `${task.title} (Copy)` });
    };

    const columns = useMemo(() => {
        if (groupBy === 'user') {
            const map = new Map<string, { id: string; name: string }>();
            filteredTasks.forEach(t => { if (t.assignedUser) map.set(t.assignedUser, { id: t.assignedUser, name: t.assignedUser }); });
            return Array.from(map.values());
        }
        if (view === 'day') return [currentDate];
        return Array.from({ length: 4 }, (_, i) => addDays(currentDate, i));
    }, [view, currentDate, groupBy, tasks]);

    const expandedTasks = useMemo(() => {
        const start = columns[0] instanceof Date ? (columns[0] as Date) : currentDate;
        const end   = columns[columns.length - 1] instanceof Date ? addDays(columns[columns.length - 1] as Date, 1) : addDays(currentDate, 4);
        return expandRecurringTasks(filteredTasks, start, end);
    }, [filteredTasks, columns, currentDate]);

    const getColumnTasks = (item: Date | { id: string; name: string }) => {
        if (groupBy === 'user') return expandedTasks.filter(t => t.assignedUser === (item as any).name);
        return expandedTasks.filter(t => t.startDateTime && isSameDay(new Date(t.startDateTime), item as Date));
    };

    const colCount = groupBy === 'user' ? columns.length : (view === 'day' ? 1 : 4);

    // No left spacer — grid is just the day columns
    const gridTemplate = `repeat(${colCount}, 1fr)`;
    const MIN_WIDTH    = view === 'day' ? 320 : groupBy === 'user' ? 560 : 520;

    return (
        <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-surface-900">
            <div className="flex flex-1 flex-col overflow-x-auto overflow-y-hidden">
                <div style={{ minWidth: MIN_WIDTH }}>

                    {/* ════ HEADER ══════════════════════════════════════════ */}
                    <div style={{ display: 'grid', gridTemplateColumns: gridTemplate }} className="bg-white dark:bg-surface-900 border-b border-surface-100 dark:border-surface-800">
                        {columns.map((item: any, idx) => {
                            if (groupBy === 'user') {
                                return (
                                    <div key={item.id} className="flex flex-col items-center py-3 border-r border-surface-200 dark:border-surface-800 last:border-r-0">
                                        <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: userColor(item.name) }}>
                                            {item.name.charAt(0)}
                                        </div>
                                        <span className="mt-1 text-[11px] font-bold text-surface-900 dark:text-white truncate px-2 text-center">{item.name}</span>
                                    </div>
                                );
                            }

                            const day   = item as Date;
                            const today = isToday(day);
                            const colTasks = getColumnTasks(day);
                            const totalMins = colTasks.reduce((acc, t) => {
                                const s = new Date(t.startDateTime || '');
                                const e = new Date(t.endDateTime   || '');
                                return acc + Math.max(0, differenceInMinutes(e, s));
                            }, 0);
                            const isFirst = idx === 0;
                            const isLast  = idx === colCount - 1;

                            return (
                                <div
                                    key={day.toISOString()}
                                    className="relative flex flex-col items-center py-[14px] border-r border-surface-200 dark:border-surface-800 last:border-r-0"
                                    style={{ backgroundColor: today ? 'rgba(51, 102, 255, 0.05)' : 'transparent' }}
                                >
                                    {totalMins > 0 && (
                                        <span className="absolute top-1.5 right-3 text-[9.5px] font-bold text-surface-400 dark:text-surface-500">{fmtTotal(totalMins)}</span>
                                    )}

                                    <div className="flex flex-wrap items-baseline justify-center gap-1.5 px-2 text-center">
                                        <span className={cn('text-[15px] font-black tracking-tight sm:text-[17px]', today ? 'text-brand-600 dark:text-brand-400' : 'text-surface-900 dark:text-white')}>
                                            {format(day, 'd')}
                                        </span>
                                        <span className={cn('text-[11px] font-medium sm:text-[13px]', today ? 'text-brand-600 dark:text-brand-400' : 'text-surface-500 dark:text-surface-400')}>
                                            {format(day, 'EEE')}
                                        </span>
                                    </div>
                                    {today && <div className="mt-1 h-[2.5px] w-[44px] rounded-full bg-brand-600 dark:bg-brand-500" />}
                                </div>
                            );
                        })}
                    </div>

                    {/* ════ BODY ════════════════════════════════════════════ */}
                    <div
                        className="h-[calc(100vh-300px)] overflow-y-auto bg-white dark:bg-surface-900 lg:h-[calc(100vh-220px)]"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: gridTemplate,         // exactly matches header
                        }}
                    >
                        {columns.map((item: any, idx) => {
                            const colTasks = getColumnTasks(item);
                            return (
                                <DroppableColumn
                                    key={idx}
                                    item={item}
                                    colTasks={colTasks}
                                    getColumnTasks={getColumnTasks}
                                    setSelectedTask={setSelectedTask}
                                    deleteTask={deleteTask}
                                    handleDuplicate={handleDuplicate}
                                    groupBy={groupBy}
                                    view={view}
                                    currentDate={currentDate}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
