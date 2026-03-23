import React, { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { addDays, addMinutes, differenceInMinutes, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Search } from 'lucide-react';
import { useAdminCalendarStore, AdminTask } from '../store/useAdminCalendarStore.ts';
import { AdminTaskCard } from './AdminTaskCard.tsx';
import { cn } from '../../../../utils/helpers.ts';
import { useAuthStore } from '../../../../context/authStore';

const WEEK_VISIBLE_DAYS = 4;

const DayColumnSlot = ({
    day,
    tasks,
    onTaskClick,
}: {
    day: Date;
    tasks: AdminTask[];
    onTaskClick: (t: AdminTask | 'new') => void;
}) => {
    const id = `col-${format(day, 'yyyy-MM-dd')}`;
    const { setNodeRef, isOver } = useDroppable({ id, data: { day, type: 'daycolumn' } });
    const { user } = useAuthStore();
    const canCreate = ['admin', 'super_admin', 'manager', 'team_leader'].includes(user?.role || '');

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'relative flex min-h-[420px] flex-col gap-3 border-r border-[#e5edf9] bg-white/90 p-3 transition-colors sm:min-h-[540px] sm:p-4',
                isOver && 'bg-brand-50/70 ring-2 ring-inset ring-brand-400'
            )}
        >
            {tasks.map((task) => (
                <div key={task._id} className="w-full">
                    <AdminTaskCard task={task} onClick={() => onTaskClick(task)} />
                </div>
            ))}

            {canCreate && (
                <button
                    onClick={() => onTaskClick('new')}
                    className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#d7e4f8] bg-[#f9fbff] py-3 text-xs font-semibold text-surface-400 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
                >
                    <Plus size={14} /> Add task
                </button>
            )}
        </div>
    );
};

const MonthDaySlot = ({
    day,
    isCurrentMonth,
    tasks,
    onTaskClick,
}: {
    day: Date;
    isCurrentMonth: boolean;
    tasks: AdminTask[];
    onTaskClick: (t: AdminTask) => void;
}) => {
    const id = format(day, 'yyyy-MM-dd');
    const { setNodeRef, isOver } = useDroppable({ id, data: { day, type: 'monthday' } });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'relative flex min-h-[120px] flex-col border-b border-r border-[#e5edf9] bg-white p-1.5 transition-colors',
                !isCurrentMonth && 'bg-surface-50/50',
                isToday(day) && 'bg-brand-50/25 ring-1 ring-inset ring-brand-200',
                isOver && 'bg-brand-50/70 ring-2 ring-inset ring-brand-400'
            )}
        >
            <div className="mb-1 flex items-center justify-between">
                <span
                    className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                        isToday(day) ? 'bg-brand-600 text-white' : 'text-surface-600'
                    )}
                >
                    {format(day, 'd')}
                </span>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto">
                {tasks.map((task) => (
                    <div key={task._id} className="relative h-6">
                        <AdminTaskCard task={task} isMonthView onClick={() => onTaskClick(task)} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export const AdminCalendarBoard: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
    const { view, currentDate, tasks, waitingList, updateTask, setSelectedTask } = useAdminCalendarStore();
    const [activeTask, setActiveTask] = useState<AdminTask | null>(null);
    const [isWaitingListOpen, setIsWaitingListOpen] = useState(true);
    const { setNodeRef: setWaitingListRef, isOver: isWaitingListOver } = useDroppable({
        id: 'waiting-list',
        data: { type: 'waiting-list' },
    });

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, WEEK_VISIBLE_DAYS - 1) });

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const normalizedQuery = (searchQuery || '').trim().toLowerCase();
    const filteredTasks = normalizedQuery
        ? tasks.filter((task) => {
            const assigned = task.assignedUser ? String(task.assignedUser).toLowerCase() : '';
            return (
                String(task.title || '').toLowerCase().includes(normalizedQuery) ||
                String(task.description || '').toLowerCase().includes(normalizedQuery) ||
                assigned.includes(normalizedQuery) ||
                (task.tags || []).some((tag) => String(tag).toLowerCase().includes(normalizedQuery))
            );
        })
        : tasks;

    const filteredWaitingList = normalizedQuery
        ? waitingList.filter((task) => {
            const assigned = task.assignedUser ? String(task.assignedUser).toLowerCase() : '';
            return (
                String(task.title || '').toLowerCase().includes(normalizedQuery) ||
                String(task.description || '').toLowerCase().includes(normalizedQuery) ||
                assigned.includes(normalizedQuery)
            );
        })
        : waitingList;

    const allTasks = [...tasks, ...waitingList];

    const handleDragStart = (event: any) => {
        const task = allTasks.find((item) => item._id === event.active.id);
        if (task) setActiveTask(task);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTask(null);
        if (!over) return;

        const task = allTasks.find((item) => item._id === active.id);
        if (!task) return;

        const data = over.data.current as any;
        const hasTime = Boolean(task.startDateTime) && Boolean(task.endDateTime);

        if (data.type === 'waiting-list') {
            await updateTask(task._id, { startDateTime: null as any, endDateTime: null as any });
            return;
        }

        if (data.type === 'daycolumn' || data.type === 'monthday') {
            const { day } = data;
            const oldStart = hasTime ? new Date(task.startDateTime as any) : null;
            const oldEnd = hasTime ? new Date(task.endDateTime as any) : null;
            const duration = oldStart && oldEnd ? differenceInMinutes(oldEnd, oldStart) : 60;

            const newStart = new Date(day);
            if (oldStart) newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
            else newStart.setHours(9, 0, 0, 0);

            const newEnd = addMinutes(newStart, duration);
            await updateTask(task._id, { startDateTime: newStart.toISOString(), endDateTime: newEnd.toISOString() });
        }
    };

    const getDayDurationText = (day: Date) => {
        const totalMinutes = filteredTasks
            .filter((task) => task.startDateTime && format(new Date(task.startDateTime), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
            .reduce((sum, task) => {
                if (!task.startDateTime || !task.endDateTime) return sum;
                return sum + Math.max(0, differenceInMinutes(new Date(task.endDateTime), new Date(task.startDateTime)));
            }, 0);

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${minutes}m`;
    };

    const WaitingListPanel = () => (
        <div
            ref={setWaitingListRef}
            className={cn(
                'flex w-full flex-col border-t border-[#e5edf9] bg-[linear-gradient(180deg,#ffffff_0%,#f6fbff_100%)] xl:w-[320px] xl:min-w-[320px] xl:border-l xl:border-t-0',
                isWaitingListOver && 'bg-brand-50/70'
            )}
        >
            <div className="flex items-center justify-between border-b border-[#edf2fb] px-4 py-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-surface-900">Waiting list</h3>
                    <span className="rounded-full bg-surface-100 px-1.5 py-0.5 text-[11px] text-surface-500">
                        {filteredWaitingList.length}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="btn-ghost btn-sm p-1"
                        onClick={() => setSelectedTask('new')}
                        title="Create task"
                    >
                        <Plus size={14} />
                    </button>
                    <button type="button" className="btn-ghost btn-sm p-1 text-surface-400" title="Search (top bar)">
                        <Search size={14} />
                    </button>
                    <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-surface-500 transition hover:bg-surface-100 hover:text-surface-800 xl:inline-flex"
                        onClick={() => setIsWaitingListOpen(false)}
                        title="Close waiting list"
                    >
                        <ChevronsRight size={14} />
                    </button>
                </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {filteredWaitingList.length === 0 ? (
                    <p className="py-4 text-center text-xs text-surface-400">No waiting tasks</p>
                ) : (
                    filteredWaitingList.map((task) => (
                        <AdminTaskCard key={task._id} task={task} onClick={() => setSelectedTask(task)} />
                    ))
                )}
            </div>
        </div>
    );

    const WaitingListCollapsed = () => (
        <div className="hidden items-center justify-center border-l border-[#e5edf9] bg-[linear-gradient(180deg,#ffffff_0%,#f6fbff_100%)] xl:flex xl:w-[74px] xl:min-w-[74px]">
            <button
                type="button"
                onClick={() => setIsWaitingListOpen(true)}
                className="flex h-full w-full min-h-20 flex-col items-center justify-center gap-2 text-surface-500 transition-colors hover:bg-brand-50/60 hover:text-brand-600"
                title="Open waiting list"
            >
                <ChevronsLeft size={16} />
                <span className="rotate-180 text-[10px] font-semibold uppercase tracking-[0.18em] [writing-mode:vertical-rl]">Waiting list</span>
                <span className="rounded-full bg-surface-100 px-1.5 py-0.5 text-[10px] text-surface-600">
                    {filteredWaitingList.length}
                </span>
            </button>
        </div>
    );

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {view === 'month' && (
                <div className="flex h-full flex-col overflow-hidden bg-white xl:flex-row">
                    <div className="flex flex-1 flex-col overflow-hidden">
                        <div className="grid shrink-0 grid-cols-7 border-b border-[#e5edf9] bg-white">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                                <div key={label} className="py-2.5 text-center text-xs font-semibold uppercase tracking-widest text-surface-500">
                                    {label}
                                </div>
                            ))}
                        </div>

                        <div className="grid w-full min-w-0 flex-1 shrink-0 grid-cols-7 auto-rows-[minmax(120px,1fr)] overflow-y-auto bg-white">
                            {calendarDays.map((day) => (
                                <MonthDaySlot
                                    key={day.toISOString()}
                                    day={day}
                                    isCurrentMonth={isSameMonth(day, currentDate)}
                                    tasks={filteredTasks.filter((task) => task.startDateTime && format(new Date(task.startDateTime), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))}
                                    onTaskClick={setSelectedTask}
                                />
                            ))}
                        </div>
                    </div>

                    {isWaitingListOpen ? <WaitingListPanel /> : <WaitingListCollapsed />}
                </div>
            )}

            {(view === 'week' || view === 'day') && (
                <div className="flex h-full flex-col overflow-hidden bg-white xl:flex-row">
                    <div className="flex flex-1 flex-col overflow-hidden">
                        <div className="border-b border-[#edf2fb] bg-white">
                            <div className="px-4 pb-2 pt-4 text-sm text-surface-400 sm:px-6">
                                {format(weekStart, 'MMMM')}
                            </div>
                            <div className={cn('grid', view === 'week' ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-1')}>
                                {(view === 'week' ? weekDays : [currentDate]).map((day) => (
                                    <div key={day.toISOString()} className="border-r border-[#edf2fb] px-4 pb-3 last:border-r-0 sm:px-6">
                                        <div className="flex items-center justify-between text-sm text-surface-400">
                                            <div className={cn('inline-flex items-baseline gap-2 border-b-2 pb-2', isToday(day) ? 'border-brand-500 text-brand-600' : 'border-transparent text-surface-700')}>
                                                <span className="text-xl font-semibold">{format(day, 'd')}</span>
                                                <span className="text-sm font-medium">{format(day, 'EEE')}</span>
                                            </div>
                                            <span className="text-xs font-medium">{getDayDurationText(day)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)]">
                            <div className={cn('grid min-h-full', view === 'week' ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-1')}>
                                {(view === 'week' ? weekDays : [currentDate]).map((day) => {
                                    const dayTasks = filteredTasks
                                        .filter((task) => task.startDateTime && format(new Date(task.startDateTime), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
                                        .sort((a, b) => new Date(a.startDateTime as any).getTime() - new Date(b.startDateTime as any).getTime());

                                    return (
                                        <DayColumnSlot
                                            key={day.toISOString()}
                                            day={day}
                                            tasks={dayTasks}
                                            onTaskClick={setSelectedTask}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {isWaitingListOpen ? <WaitingListPanel /> : <WaitingListCollapsed />}
                </div>
            )}

            <DragOverlay>
                {activeTask ? (
                    <div className="cursor-grabbing opacity-90">
                        <AdminTaskCard task={activeTask} isOverlay />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default AdminCalendarBoard;
