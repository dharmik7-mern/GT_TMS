import React, { useEffect, useMemo, useState } from 'react';
import { addDays, addMonths, endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Search, LayoutGrid, Filter, ChevronDown, Flag, Info } from 'lucide-react';
import { cn } from '../../../utils/helpers';
import { useAdminCalendarStore } from './store/useAdminCalendarStore';
import { AdminCalendarBoard } from './components/AdminCalendarBoard.tsx';
import AdminTaskModal from './components/AdminTaskModal.tsx';
import ReminderPoller from './hooks/useReminderPoller.tsx';
import { useAuthStore } from '../../../context/authStore';
import { useAppStore } from '../../../context/appStore';

const WEEK_VISIBLE_DAYS = 4;
const WEEK_STARTS_ON = 1;

const getWeekRangeStart = (date: Date) => startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });

export const AdminCalendarPage: React.FC = () => {
    const {
        view, setView, groupBy, setGroupBy,
        currentDate, setCurrentDate,
        fetchTasks, fetchWaitingList, setSelectedTask,
        priorityFilter, setPriorityFilter,
        statusFilter, setStatusFilter
    } = useAdminCalendarStore();
    const { user } = useAuthStore();
    const { projects, users } = useAppStore();
    const canCreate = ['admin', 'super_admin', 'manager', 'team_leader'].includes(user?.role || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [showGroupMenu, setShowGroupMenu] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    useEffect(() => {
        let start;
        let end;

        if (view === 'month') {
            start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: WEEK_STARTS_ON });
            end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: WEEK_STARTS_ON });
        } else if (view === 'week') {
            start = startOfDay(currentDate);
            end = addDays(start, 3);
        } else {
            start = startOfDay(currentDate);
            end = endOfDay(currentDate);
        }

        fetchTasks(start, end);
        fetchWaitingList();
    }, [currentDate, view, fetchTasks, fetchWaitingList]);

    const navigate = (direction: 'prev' | 'next') => {
        if (view === 'month') {
            setCurrentDate((prev: Date) => (direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1)));
        } else if (view === 'week') {
            setCurrentDate((prev: Date) => (direction === 'next' ? addDays(prev, WEEK_VISIBLE_DAYS) : subDays(prev, WEEK_VISIBLE_DAYS)));
        } else {
            setCurrentDate((prev: Date) => (direction === 'next' ? addDays(prev, 1) : subDays(prev, 1)));
        }
    };

    const rangeTitle =
        view === 'month'
            ? format(currentDate, 'MMMM yyyy')
            : view === 'week'
                ? `${format(currentDate, 'MMM d')} - ${format(addDays(currentDate, WEEK_VISIBLE_DAYS - 1), 'MMM d, yyyy')}`
                : format(currentDate, 'EEEE, MMM d, yyyy');

    const groupedProjects = useMemo(() => {
        return projects.reduce<Record<string, typeof projects>>((acc, project) => {
            const department = project.department || 'General';
            if (!acc[department]) acc[department] = [];
            acc[department].push(project);
            return acc;
        }, {});
    }, [projects]);

    const activeUsers = useMemo(() => users.filter((member) => member.isActive), [users]);

    return (
        <div className="-m-6 flex h-[calc(100vh-60px)] min-h-[calc(100vh-60px)] w-[calc(100%+3rem)] flex-col bg-surface-50 dark:bg-surface-950 max-md:-m-4 max-md:mb-0 max-md:w-[calc(100%+2rem)] font-inter">
            {/* Perfectly Aligned Bordio Header */}
            <div className="z-20 border-b border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900 px-5 py-2.5 sm:px-6">
                <div className="flex items-center justify-between w-full h-10">
                    {/* Left: View Switcher + Navigator + Range */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center rounded-xl bg-surface-100 dark:bg-surface-800 p-1">
                            {['month', 'week', 'day'].map((v) => (
                                <button
                                    key={v}
                                    onClick={() => {
                                        if (v === 'week') setCurrentDate((prev) => startOfDay(getWeekRangeStart(prev)));
                                        setView(v as any);
                                    }}
                                    className={cn(
                                        'rounded-md px-4 py-1.5 text-[12px] font-black uppercase tracking-wider transition-all',
                                        view === v
                                            ? 'bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm ring-1 ring-surface-200 dark:ring-surface-600'
                                            : 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200'
                                    )}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>

                         <div className="flex items-center gap-1">
                            <button
                                onClick={() => navigate('prev')}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                onClick={() => navigate('next')}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>



                        <h1 className="ml-2 text-[18px] font-black text-surface-900 dark:text-white tracking-tight">
                            {rangeTitle}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative hidden lg:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={15} />
                             <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-9 w-[180px] rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 pl-9 pr-4 text-[12px] font-medium text-surface-900 dark:text-white focus:border-brand-500 focus:bg-white dark:focus:bg-surface-700 focus:outline-none transition-all"
                            />
                        </div>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => { setShowGroupMenu(!showGroupMenu); setShowFilterMenu(false); }}
                                 className={cn(
                                    "flex h-9 items-center gap-2 rounded-xl border px-3 text-[12px] font-bold transition-colors",
                                    showGroupMenu ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400" : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700"
                                )}
                            >
                                <LayoutGrid size={16} />
                                <span className="hidden lg:inline text-[11px] font-black uppercase tracking-wide">Group</span>
                                <ChevronDown size={12} className={cn("transition-transform", showGroupMenu && "rotate-180")} />
                            </button>

                             {showGroupMenu && (
                                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-2 shadow-xl z-[60]">
                                    <div className="mb-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-surface-400">Grouping mode</div>
                                    <button
                                        onClick={() => { setGroupBy('time'); setShowGroupMenu(false); }}
                                        className={cn("w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors", groupBy === 'time' ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400" : "text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700")}
                                    >
                                        By Time
                                    </button>
                                    <button
                                        onClick={() => { setGroupBy('user'); setShowGroupMenu(false); }}
                                        className={cn("w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors", groupBy === 'user' ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400" : "text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700")}
                                    >
                                        By Member
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => { setShowFilterMenu(!showFilterMenu); setShowGroupMenu(false); }}
                                 className={cn(
                                    "flex h-9 items-center gap-2 rounded-xl border px-3 text-[12px] font-bold transition-colors",
                                    showFilterMenu ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400" : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700"
                                )}
                            >
                                <Filter size={16} />
                                <span className="hidden lg:inline text-[11px] font-black uppercase tracking-wide">Filter</span>
                                <ChevronDown size={12} className={cn("transition-transform", showFilterMenu && "rotate-180")} />
                            </button>

                             {showFilterMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-3 shadow-xl z-[60]">
                                    <div>
                                         <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-surface-400">
                                            <Flag size={10} /> Priority
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['all', 'high', 'medium', 'low'].map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setPriorityFilter(p as any)}
                                                     className={cn(
                                                        "rounded-lg px-2.5 py-1.5 text-[11px] font-bold capitalize border transition-all",
                                                        priorityFilter === p ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-extrabold" : "border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700"
                                                    )}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4 border-t border-surface-200 dark:border-surface-700 pt-3">
                                         <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-surface-400">
                                            <Info size={10} /> Status
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['all', 'Pending', 'In Progress', 'Done'].map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => setStatusFilter(s as any)}
                                                     className={cn(
                                                        "rounded-lg px-2.5 py-1.5 text-[11px] font-bold border transition-all",
                                                        statusFilter === s ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-extrabold" : "border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700"
                                                    )}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => { setPriorityFilter('all'); setStatusFilter('all'); }}
                                        className="mt-4 w-full rounded-lg py-2 text-[11px] font-black uppercase text-[#EF4444] hover:bg-red-50 transition-colors"
                                    >
                                        Reset Filters
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="min-h-0 flex-1 overflow-hidden">
                <AdminCalendarBoard searchQuery={searchQuery} />
            </div>

            <AdminTaskModal />
            <ReminderPoller />
        </div>
    );
};

export default AdminCalendarPage;
