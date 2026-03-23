import React, { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { addDays, addMinutes, differenceInMinutes, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Search, CalendarDays, ChevronDown, User, X, Flag } from 'lucide-react';
import { useAdminCalendarStore, AdminTask } from '../store/useAdminCalendarStore.ts';
import { AdminTaskCard } from './AdminTaskCard.tsx';
import { cn } from '../../../../utils/helpers.ts';
import { useAuthStore } from '../../../../context/authStore';
import { useAppStore } from '../../../../context/appStore';
import { emitErrorToast, emitSuccessToast } from '../../../../context/toastBus.ts';

const WEEK_VISIBLE_DAYS = 4;

// Unused slot logic removed to keep it clean.

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

import { BordioCalendar } from './BordioCalendar/BordioCalendar.tsx';

// ... (existing imports, but remove DayColumnSlot and previous weekDays logic if necessary)

export const AdminCalendarBoard: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
    const { 
        view, currentDate, tasks, waitingList, updateTask, setSelectedTask, createTask,
        priorityFilter, statusFilter 
    } = useAdminCalendarStore();
    const { user } = useAuthStore();
    const { users } = useAppStore();
    
    // Inline add state
    const [isAddingInline, setIsAddingInline] = useState(false);
    const [inlineTitle, setInlineTitle] = useState('');
    const [inlineHrs, setInlineHrs] = useState('');
    const [inlineMins, setInlineMins] = useState('');
    const [inlineDate, setInlineDate] = useState('');
    const [inlineUser, setInlineUser] = useState(user?.name || '');
    const [inlinePriority, setInlinePriority] = useState<AdminTask['priority']>('none');

    const handleInlineSave = async () => {
        if (!inlineTitle.trim()) return;
        const totalMins = (parseInt(inlineHrs) || 0) * 60 + (parseInt(inlineMins) || 0);
        
        const sd = inlineDate ? new Date(`${inlineDate}T09:00:00`).toISOString() : undefined;
        let ed = undefined;
        if (inlineDate) {
            ed = totalMins > 0 
                ? new Date(new Date(`${inlineDate}T09:00:00`).getTime() + totalMins * 60000).toISOString()
                : new Date(`${inlineDate}T10:00:00`).toISOString();
        }

        const saved = await createTask({
            title: inlineTitle.trim(),
            description: '',
            duration: totalMins > 0 ? totalMins : 60,
            assignedUser: inlineUser || user?.name || 'Admin',
            startDateTime: sd,
            endDateTime: ed,
            status: 'Pending',
            priority: inlinePriority,
            tags: [],
        } as any);
        
        if (!saved) {
            emitErrorToast('Failed to create task', 'Server Error');
            return;
        }

        emitSuccessToast('Task created!');
        setInlineTitle('');
        setInlineHrs('');
        setInlineMins('');
        setInlineDate('');
        setInlinePriority('none');
        setIsAddingInline(false);
    };

    const [activeTask, setActiveTask] = useState<AdminTask | null>(null);
    const [isWaitingListOpen, setIsWaitingListOpen] = useState(true);
    const { setNodeRef: setWaitingListRef, isOver: isWaitingListOver } = useDroppable({
        id: 'waiting-list',
        data: { type: 'waiting-list' },
    });

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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

    const filteredWaitingList = waitingList.filter((task) => {
        // 1. Search Query
        const nq = normalizedQuery;
        const matchesSearch = !nq || 
            String(task.title || '').toLowerCase().includes(nq) ||
            String(task.description || '').toLowerCase().includes(nq) ||
            String(task.assignedUser || '').toLowerCase().includes(nq);

        if (!matchesSearch) return false;

        // 2. Priority Filter
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

        // 3. Status Filter
        if (statusFilter !== 'all' && task.status !== statusFilter) return false;

        return true;
    });

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
        if (data.type === 'waiting-list') {
            await updateTask(task._id, { startDateTime: null as any, endDateTime: null as any });
        } else if (data.type === 'calendar-column') {
            const dateStr = data.date; // string like 'yyyy-MM-dd'
            const userName = data.user;
            
            const updates: any = {};
            if (dateStr) {
                updates.startDateTime = new Date(`${dateStr}T09:00:00`).toISOString();
                
                // Keep same duration if possible, else 1 hour
                const dur = task.duration || 60;
                updates.endDateTime = new Date(new Date(`${dateStr}T09:00:00`).getTime() + dur * 60000).toISOString();
            }
            if (userName) {
                updates.assignedUser = userName;
            }
            
            if (Object.keys(updates).length > 0) {
                await updateTask(task._id, updates);
            }
        }
    };

    const WaitingListPanel = () => (
        <div
            ref={setWaitingListRef}
            className={cn(
                'flex w-full flex-col border-t border-[#E2E8F0] bg-[#F8FAFC] xl:w-[320px] xl:min-w-[320px] xl:border-l xl:border-t-0',
                isWaitingListOver && 'bg-blue-50'
            )}
        >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] p-4 bg-white">
                <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-black text-[#1E293B]">Waiting list</h3>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E2E8F0] text-[11px] font-black text-[#64748B]">
                        {filteredWaitingList.length}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-[#64748B]">
                    <button className="p-1 hover:bg-[#F1F5F9] rounded-md transition-colors" onClick={() => setIsAddingInline(true)} title="Create task"><Plus size={16} strokeWidth={3} /></button>
                    <button className="p-1 hover:bg-[#F1F5F9] rounded-md transition-colors"><Search size={16} strokeWidth={3} /></button>
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

            <div className="flex-1 space-y-3 overflow-y-auto p-3 bg-[#F8FAFC]">
                {/* ── INLINE TASK CREATION CARD ── */}
                {isAddingInline && (
                    <div className="relative mb-3 flex flex-col gap-3 rounded-[12px] bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.06)] ring-1 ring-[#e2e8f0]">
                        <button 
                            className="absolute right-2 top-2 rounded-full p-1 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569] transition"
                            onClick={() => setIsAddingInline(false)}
                        >
                            <X size={14} strokeWidth={3} />
                        </button>
                        
                        <input
                            autoFocus
                            type="text"
                            placeholder="Run A/B |"
                            value={inlineTitle}
                            onChange={(e) => setInlineTitle(e.target.value)}
                            className="w-full pr-6 text-[13px] font-extrabold text-[#1e293b] placeholder:text-[#94a3b8] outline-none"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleInlineSave(); }}
                        />

                        <div className="flex items-center gap-2 text-[11px] font-bold text-[#94a3b8]">
                            <span>Estimated time:</span>
                            <div className="flex items-center gap-1">
                                <input 
                                    type="text" placeholder="hh" 
                                    className="w-8 p-0 border-b border-[#e2e8f0] bg-transparent text-center text-[#1e293b] outline-none focus:border-brand-500 placeholder:text-[#cbd5e1]" 
                                    value={inlineHrs} onChange={e => setInlineHrs(e.target.value.replace(/\D/g, ''))} maxLength={2} 
                                />
                                <span>:</span>
                                <input 
                                    type="text" placeholder="mm" 
                                    className="w-8 p-0 border-b border-[#e2e8f0] bg-transparent text-center text-[#1e293b] outline-none focus:border-brand-500 placeholder:text-[#cbd5e1]" 
                                    value={inlineMins} onChange={e => setInlineMins(e.target.value.replace(/\D/g, ''))} maxLength={2} 
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                                {/* Calendar picker */}
                                <label title={inlineDate || "Select Date"} className={cn(
                                    "relative flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full border border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors",
                                    inlineDate ? "bg-brand-50 border-brand-200 text-brand-600" : "text-[#94a3b8]"
                                )}>
                                    <CalendarDays size={13} strokeWidth={2.5} />
                                    <input 
                                        type="date"
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        value={inlineDate}
                                        min={new Date().toISOString().split('T')[0]}
                                        onChange={e => setInlineDate(e.target.value)}
                                    />
                                </label>

                                {/* Tag dropdown visual placeholder */}
                                <button className="flex h-[26px] items-center justify-center gap-1 rounded bg-[#F1F5F9] px-2 text-[#64748b] hover:bg-[#e2e8f0]">
                                    <ChevronDown size={14} strokeWidth={3} />
                                </button>

                                {/* User picker */}
                                <label title={inlineUser || "Assign User"} className="relative flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full bg-[#fcd34d] text-white shadow-sm border-[1.5px] border-white hover:brightness-95">
                                    <User size={13} strokeWidth={3} />
                                    <select 
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        value={inlineUser}
                                        onChange={e => setInlineUser(e.target.value)}
                                    >
                                        <option value="">User...</option>
                                        {(Array.isArray(users) ? users : []).map(u => (
                                            <option key={u.id || (u as any)._id || u.name} value={u.name}>{u.name}</option>
                                        ))}
                                    </select>
                                </label>

                                {/* Priority picker */}
                                <div title="Priority" className={cn(
                                    "relative flex h-[26px] items-center gap-1.5 cursor-pointer rounded-full px-2 border transition-all",
                                    inlinePriority === 'high'   ? "bg-red-50 border-red-200 text-red-600" :
                                    inlinePriority === 'medium' ? "bg-amber-50 border-amber-200 text-amber-600" :
                                    inlinePriority === 'low'    ? "bg-blue-50 border-blue-200 text-blue-600" :
                                    "bg-slate-50 border-slate-200 text-[#94a3b8]"
                                )}>
                                    <Flag size={12} fill={inlinePriority !== 'none' ? 'currentColor' : 'none'} strokeWidth={3} />
                                    <span className="text-[10px] uppercase tracking-wider font-black">
                                        {inlinePriority === 'none' ? 'Prio' : inlinePriority}
                                    </span>
                                    <select 
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        value={inlinePriority}
                                        onChange={e => setInlinePriority(e.target.value as any)}
                                    >
                                        <option value="none">None</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                            </div>
                            <button 
                                onClick={handleInlineSave}
                                className="rounded-[6px] bg-[#2563eb] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#1d4ed8]"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                )}

                {filteredWaitingList.length === 0 && !isAddingInline ? (
                    <p className="py-12 text-center text-xs font-semibold text-surface-400">No waiting tasks</p>
                ) : (
                    filteredWaitingList.map((task) => (
                        <div key={task._id} className="relative">
                            <AdminTaskCard task={task} onClick={() => setSelectedTask(task)} />
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const WaitingListCollapsed = () => (
        <div className="hidden h-full items-center justify-center border-l border-[#e5edf9] bg-white xl:flex xl:w-[60px] xl:min-w-[60px]">
            <button
                type="button"
                onClick={() => setIsWaitingListOpen(true)}
                className="flex h-full w-full flex-col items-center justify-center gap-3 text-surface-400 transition-colors hover:bg-surface-50 hover:text-brand-600"
                title="Open waiting list"
            >
                <ChevronsLeft size={16} />
                <span className="rotate-180 text-[10px] font-bold uppercase tracking-[0.2em] [writing-mode:vertical-rl]">Waiting List</span>
                <span className="rounded-full bg-[#EFF6FF] px-1.5 py-1 text-[10px] font-bold text-[#3B82F6]">
                    {filteredWaitingList.length}
                </span>
            </button>
        </div>
    );

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-full flex-col overflow-hidden bg-white xl:flex-row">
                <div className="flex flex-1 flex-col overflow-hidden">
                    {view === 'month' ? (
                        <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
                            <div className="grid shrink-0 grid-cols-7 border-b border-[#e2e8f0] bg-white">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                                    <div key={label} className="py-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
                                        {label}
                                    </div>
                                ))}
                            </div>

                            <div className="grid w-full min-w-0 flex-1 grid-cols-7 auto-rows-[1fr] overflow-y-auto bg-[#f1f5f9] gap-px border-l border-[#e2e8f0]">
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
                    ) : (
                        <BordioCalendar searchQuery={searchQuery} />
                    )}
                </div>

                {isWaitingListOpen ? <WaitingListPanel /> : <WaitingListCollapsed />}
            </div>

            <DragOverlay>
                {activeTask ? (
                    <div className="cursor-grabbing opacity-95 scale-105 transition-transform">
                        <AdminTaskCard task={activeTask} isOverlay />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default AdminCalendarBoard;
