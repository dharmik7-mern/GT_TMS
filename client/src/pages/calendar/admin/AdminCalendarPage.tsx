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
        <div className="-m-6 flex h-[calc(100vh-60px)] min-h-[calc(100vh-60px)] w-[calc(100%+3rem)] flex-col bg-white max-md:-m-4 max-md:mb-0 max-md:w-[calc(100%+2rem)] font-inter">
            {/* Perfectly Aligned Bordio Header */}
            <div className="z-20 border-b border-[#e2e8f0] bg-white px-5 py-2.5 sm:px-6">
                <div className="flex items-center justify-between w-full h-10">
                    {/* Left: View Switcher + Navigator + Range */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center rounded-xl bg-[#f1f5f9] p-1">
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
                                            ? 'bg-white text-[#2563EB] shadow-sm ring-1 ring-[#E2E8F0]'
                                            : 'text-[#64748B] hover:text-[#1E293B]'
                                    )}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>

                         <div className="flex items-center gap-1">
                            <button
                                onClick={() => navigate('prev')}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                onClick={() => navigate('next')}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>



                        <h1 className="ml-2 text-[18px] font-black text-[#1E293B] tracking-tight">
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
                                className="h-9 w-[180px] rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pl-9 pr-4 text-[12px] font-medium text-[#1E293B] focus:border-[#2563EB] focus:bg-white focus:outline-none transition-all"
                            />
                        </div>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => { setShowGroupMenu(!showGroupMenu); setShowFilterMenu(false); }}
                                className={cn(
                                    "flex h-9 items-center gap-2 rounded-xl border px-3 text-[12px] font-bold transition-colors",
                                    showGroupMenu ? "border-[#2563EB] bg-blue-50 text-[#2563EB]" : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                                )}
                            >
                                <LayoutGrid size={16} />
                                <span className="hidden lg:inline text-[11px] font-black uppercase tracking-wide">Group</span>
                                <ChevronDown size={12} className={cn("transition-transform", showGroupMenu && "rotate-180")} />
                            </button>

                            {showGroupMenu && (
                                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#E2E8F0] bg-white p-2 shadow-xl z-[60]">
                                    <div className="mb-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Grouping mode</div>
                                    <button
                                        onClick={() => { setGroupBy('time'); setShowGroupMenu(false); }}
                                        className={cn("w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors", groupBy === 'time' ? "bg-blue-50 text-[#2563EB]" : "text-[#475569] hover:bg-[#F8FAFC]")}
                                    >
                                        By Time
                                    </button>
                                    <button
                                        onClick={() => { setGroupBy('user'); setShowGroupMenu(false); }}
                                        className={cn("w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors", groupBy === 'user' ? "bg-blue-50 text-[#2563EB]" : "text-[#475569] hover:bg-[#F8FAFC]")}
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
                                    showFilterMenu ? "border-[#2563EB] bg-blue-50 text-[#2563EB]" : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                                )}
                            >
                                <Filter size={16} />
                                <span className="hidden lg:inline text-[11px] font-black uppercase tracking-wide">Filter</span>
                                <ChevronDown size={12} className={cn("transition-transform", showFilterMenu && "rotate-180")} />
                            </button>

                            {showFilterMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-xl z-[60]">
                                    <div>
                                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                                            <Flag size={10} /> Priority
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['all', 'high', 'medium', 'low'].map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setPriorityFilter(p as any)}
                                                    className={cn(
                                                        "rounded-lg px-2.5 py-1.5 text-[11px] font-bold capitalize border transition-all",
                                                        priorityFilter === p ? "border-brand-500 bg-brand-50 text-brand-700 font-extrabold" : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                                                    )}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4 border-t border-[#F1F5F9] pt-3">
                                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                                            <Info size={10} /> Status
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['all', 'Pending', 'In Progress', 'Done'].map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => setStatusFilter(s as any)}
                                                    className={cn(
                                                        "rounded-lg px-2.5 py-1.5 text-[11px] font-bold border transition-all",
                                                        statusFilter === s ? "border-brand-500 bg-brand-50 text-brand-700 font-extrabold" : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
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
