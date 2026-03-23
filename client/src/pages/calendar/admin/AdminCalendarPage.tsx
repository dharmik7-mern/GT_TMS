import React, { useEffect, useMemo, useState } from 'react';
import { addDays, addMonths, endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, FolderKanban, LayoutGrid, Plus, Search, Users } from 'lucide-react';
import { cn } from '../../../utils/helpers';
import { useAdminCalendarStore } from './store/useAdminCalendarStore';
import { AdminCalendarBoard } from './components/AdminCalendarBoard.tsx';
import { AdminTaskModal } from './components/AdminTaskModal.tsx';
import { useAuthStore } from '../../../context/authStore';
import { useAppStore } from '../../../context/appStore';

const WEEK_VISIBLE_DAYS = 4;
const WEEK_STARTS_ON = 1;

const getWeekRangeStart = (date: Date) => startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });

export const AdminCalendarPage: React.FC = () => {
    const { view, setView, currentDate, setCurrentDate, fetchTasks, fetchWaitingList, setSelectedTask } = useAdminCalendarStore();
    const { user } = useAuthStore();
    const { projects, users } = useAppStore();
    const canCreate = ['admin', 'super_admin', 'manager', 'team_leader'].includes(user?.role || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [isToolsRailCollapsed, setIsToolsRailCollapsed] = useState(false);

    useEffect(() => {
        let start;
        let end;

        if (view === 'month') {
            start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: WEEK_STARTS_ON });
            end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: WEEK_STARTS_ON });
        } else if (view === 'week') {
            start = startOfDay(currentDate);
            end = addDays(start, WEEK_VISIBLE_DAYS - 1);
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
        <div className="-m-6 flex min-h-[calc(100vh-60px)] w-[calc(100%+3rem)] flex-col bg-[linear-gradient(180deg,#f4f8ff_0%,#eef4ff_100%)] max-md:-m-4 max-md:mb-0 max-md:w-[calc(100%+2rem)]">
            <div className="relative flex min-h-0 flex-1 overflow-hidden border-y border-[#dce6f5] bg-[linear-gradient(180deg,#f6f9ff_0%,#eef4ff_100%)]">
                <div
                    className={cn(
                        'hidden border-r border-[#e4ecf8] bg-white text-surface-700 lg:absolute lg:bottom-0 lg:left-0 lg:top-0 lg:z-10 lg:flex lg:flex-col lg:overflow-hidden',
                        isToolsRailCollapsed ? 'w-[76px]' : 'w-[248px]'
                    )}
                >
                    <div className={cn('flex items-center border-b border-[#edf2fb] px-4 py-4', isToolsRailCollapsed ? 'justify-center' : 'justify-between gap-3')}>
                        {!isToolsRailCollapsed && (
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-surface-900">Calendar Workspace</p>
                                <p className="text-xs text-surface-400">Tools and project lanes</p>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsToolsRailCollapsed((value) => !value)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e5edf9] bg-white text-surface-500 transition hover:bg-surface-50 hover:text-surface-800"
                        >
                            {isToolsRailCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 py-4">
                        <div className="space-y-2">
                            {[
                                { key: 'board', label: 'Board', icon: LayoutGrid, active: true },
                                { key: 'people', label: 'People', icon: Users, active: false },
                                { key: 'filters', label: 'Filters', icon: Filter, active: false },
                            ].map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        className={cn(
                                            'flex w-full items-center rounded-2xl px-3 py-3 text-sm font-medium transition-all',
                                            item.active ? 'bg-brand-50 text-brand-700 shadow-[0_10px_26px_rgba(37,99,235,0.10)]' : 'text-surface-500 hover:bg-surface-50 hover:text-surface-900',
                                            isToolsRailCollapsed ? 'justify-center px-0' : 'gap-3'
                                        )}
                                    >
                                        <Icon size={18} />
                                        {!isToolsRailCollapsed && <span>{item.label}</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {!isToolsRailCollapsed && (
                            <>
                                <div className="mt-6">
                                    <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-surface-400">Team</p>
                                    <div className="space-y-2">
                                        {activeUsers.slice(0, 5).map((member) => (
                                            <button
                                                key={member.id}
                                                type="button"
                                                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-surface-600 transition hover:bg-surface-50 hover:text-surface-900"
                                            >
                                                <span
                                                    className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                                                    style={{ backgroundColor: member.color || '#4f7dff' }}
                                                >
                                                    {member.name.charAt(0).toUpperCase()}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium">{member.name}</span>
                                                    <span className="block truncate text-xs text-surface-400">{member.jobTitle || member.role.replace('_', ' ')}</span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-surface-400">Projects</p>
                                    <div className="space-y-2">
                                        {Object.entries(groupedProjects).slice(0, 4).map(([department, departmentProjects]) => (
                                            <div key={department} className="rounded-2xl border border-[#edf2fb] bg-[#fbfdff] px-3 py-3">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">{department}</span>
                                                    <span className="text-[11px] text-surface-400">{departmentProjects.length}</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {departmentProjects.slice(0, 3).map((project) => (
                                                        <div key={project.id} className="flex items-center gap-2 rounded-xl px-1 py-1.5 text-sm text-surface-600">
                                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
                                                            <span className="truncate">{project.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className={cn('border-t border-[#edf2fb] px-3 py-3', isToolsRailCollapsed ? 'flex justify-center' : 'space-y-2')}>
                        <button
                            type="button"
                            onClick={() => setCurrentDate(new Date())}
                            className={cn(
                                'flex items-center rounded-2xl bg-surface-50 px-3 py-3 text-sm font-medium text-surface-600 transition hover:bg-surface-100 hover:text-surface-900',
                                isToolsRailCollapsed ? 'justify-center px-0 w-10' : 'w-full gap-3'
                            )}
                        >
                            <FolderKanban size={16} />
                            {!isToolsRailCollapsed && <span>Back To Today</span>}
                        </button>
                    </div>
                </div>

                <div className={cn('flex min-w-0 flex-1 flex-col', isToolsRailCollapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]')}>
                    <div className="flex flex-col gap-4 border-b border-[#e4ecf8] bg-white/90 px-5 py-5 backdrop-blur sm:px-6">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <span className="text-sm font-semibold text-surface-600">Tools</span>
                                {canCreate && (
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-2 rounded-full bg-[#1697ff] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(22,151,255,0.28)] transition hover:bg-[#0f8ef3] max-sm:w-full max-sm:justify-center"
                                        onClick={() => setSelectedTask('new')}
                                    >
                                        <Plus size={15} /> Add new
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-2 rounded-full bg-surface-100 px-4 py-2 text-sm font-medium text-surface-600 transition hover:bg-surface-200 max-sm:w-full max-sm:justify-center"
                                    onClick={() => setCurrentDate(new Date())}
                                >
                                    Today <ChevronDown size={14} />
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 max-sm:w-full max-sm:justify-start">
                                <div className="flex items-center rounded-full bg-surface-100 p-1">
                                    <button
                                        onClick={() => setView('month')}
                                        className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all', view === 'month' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500')}
                                    >
                                        Month
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCurrentDate((prev: Date) => startOfDay(getWeekRangeStart(prev)));
                                            setView('week');
                                        }}
                                        className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all', view === 'week' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500')}
                                    >
                                        Week
                                    </button>
                                    <button
                                        onClick={() => setView('day')}
                                        className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all', view === 'day' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500')}
                                    >
                                        Day
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => navigate('prev')} className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#dbe6f7] bg-white text-surface-600 transition hover:text-brand-600">
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button onClick={() => navigate('next')} className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#dbe6f7] bg-white text-surface-600 transition hover:text-brand-600 sm:hidden">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                                <div className="min-w-0 sm:min-w-[220px]">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-surface-400">Calendar</div>
                                    <div className="text-xl font-semibold text-surface-900 sm:text-[30px] sm:leading-[1.1]">{rangeTitle}</div>
                                </div>
                                <button onClick={() => navigate('next')} className="hidden h-12 w-12 items-center justify-center rounded-full border border-[#dbe6f7] bg-white text-surface-600 transition hover:text-brand-600 sm:inline-flex">
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3 md:flex-row md:items-center xl:flex-nowrap">
                                <div className="relative min-w-0 flex-1 md:min-w-[240px] xl:w-[320px]">
                                    <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
                                    <input
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                        placeholder="Search projects, tasks, people..."
                                        className="h-11 w-full rounded-full border border-[#dde7f6] bg-white pl-11 pr-4 text-sm outline-none transition placeholder:text-surface-400 focus:border-brand-300"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <button type="button" className="inline-flex items-center gap-2 rounded-full bg-surface-100 px-4 py-2 text-sm font-medium text-surface-600 max-sm:flex-1 max-sm:justify-center">
                                        <LayoutGrid size={15} /> Group
                                    </button>
                                    <button type="button" className="inline-flex items-center gap-2 rounded-full bg-surface-100 px-4 py-2 text-sm font-medium text-surface-600 max-sm:flex-1 max-sm:justify-center">
                                        <Filter size={15} /> Filter
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden">
                        <AdminCalendarBoard searchQuery={searchQuery} />
                    </div>
                </div>
            </div>

            <AdminTaskModal />
        </div>
    );
};

export default AdminCalendarPage;
