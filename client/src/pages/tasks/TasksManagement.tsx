import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Search, Filter, List, LayoutGrid, Plus, MoreHorizontal,
  Calendar, Clock, User, ChevronDown, Check, Mail, AlertCircle,
  Hash, Paperclip, MessageSquare, Tag, Repeat, X as XIcon, SlidersHorizontal,
  Zap, Briefcase, Clock3, Activity, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { STATUS_CONFIG } from '../../app/constants';
import { addDaysToDateKey, cn, formatDate } from '../../utils/helpers';
import { UserAvatar } from '../../components/UserAvatar';
import { KanbanBoard } from '../../components/KanbanBoard';

interface TaskRow {
  id: string;
  _id?: string;
  title: string;
  assignedTo: string;
  assigneeAvatar?: string;
  assigneeIds?: string[];
  projectId: string | null;
  projectName: string;
  type: 'project' | 'quick' | 'personal';
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedHours?: number;
  subtasks?: any[];
  attachments?: any[];
  description?: string;
  reporterId?: string;
  reporterName?: string;
}

interface SearchableSelectOption {
  id: string;
  label: string;
  meta?: string;
}

const SearchableSelect: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder: string;
}> = ({ label, value, onChange, options, placeholder, searchPlaceholder }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const selected = options.find((option) => option.id === value);
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.meta || ''}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div ref={rootRef} className="relative">
      <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-surface-500 ml-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'w-full bg-[#f8f9fc] dark:bg-surface-800 border border-gray-100 dark:border-surface-700 rounded-2xl px-4 py-3 text-[13px] font-semibold flex items-center justify-between gap-3 text-left transition-all',
          open && 'ring-2 ring-blue-500/15 dark:ring-brand-500/15 border-blue-300 dark:border-brand-500/40'
        )}
      >
        <span className={cn('truncate', !selected && 'text-gray-400 dark:text-surface-500')}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={16} className={cn('text-gray-400 dark:text-surface-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-2xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-2 shadow-xl">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-surface-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-[#f8f9fc] dark:bg-surface-800 border border-gray-100 dark:border-surface-700 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/15 dark:focus:ring-brand-500/15 text-gray-900 dark:text-surface-100"
            />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-100 dark:border-surface-800 bg-gray-50/60 dark:bg-surface-950/30 p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-400 dark:text-surface-500">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full rounded-xl px-3 py-2.5 text-left transition-colors',
                    value === option.id
                      ? 'bg-blue-50 text-blue-700 dark:bg-brand-950/30 dark:text-brand-300'
                      : 'text-gray-700 dark:text-surface-200 hover:bg-white dark:hover:bg-surface-800'
                  )}
                >
                  <div className="truncate text-sm font-medium">{option.label}</div>
                  {option.meta ? <div className="truncate text-xs text-gray-400 dark:text-surface-500">{option.meta}</div> : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const TasksManagement: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { users, projects } = useAppStore();
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [projectTasks, setProjectTasks] = useState<TaskRow[]>([]);
  const [quickTasks, setQuickTasks] = useState<TaskRow[]>([]);
  const [personalTasks, setPersonalTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [fullTaskData, setFullTaskData] = useState<any>(null);
  const [fullTaskLoading, setFullTaskLoading] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const canCreateTask = user?.role !== 'team_member';
  const [filterStatus, setFilterStatus] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [projectsPage, setProjectsPage] = useState(1);
  const [quickPage, setQuickPage] = useState(1);
  const [personalPage, setPersonalPage] = useState(1);
  const [tasksPerPage] = useState(10);
  const [activeSections, setActiveSections] = useState<string[]>(['active', 'projects', 'quick', 'personal', 'overdue', 'completed']);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const notificationTaskId = searchParams.get('taskId');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'active' | 'project' | 'quick' | 'overdue' | 'done' | null>(null);

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const filter = params.get('filter');
    const mine = params.get('mine');

    if (filter === 'overdue') {
      setSelectedCategory('overdue');
    } else if (filter === 'active') {
      setSelectedCategory('active');
    } else if (filter === 'project') {
      setSelectedCategory('project');
    } else if (filter === 'quick') {
      setSelectedCategory('quick');
    } else if (filter === 'done') {
      setSelectedCategory('done');
    }

    if (mine === 'true' && user?.id) {
      setPersonFilter(user.id);
    }
  }, [location.search, user?.id]);

  useEffect(() => {
    if (selectedTask) {
      fetchFullTask(selectedTask.id);
    } else {
      setFullTaskData(null);
    }
  }, [selectedTask]);

  useEffect(() => {
    setCurrentPage(1);
    setProjectsPage(1);
    setQuickPage(1);
  }, [searchTerm, filterStatus, departmentFilter, personFilter]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.relative')) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFullTask = async (id: string) => {
    if (!id) return;
    try {
      setFullTaskLoading(true);
      console.log(`[TasksManagement] Initiating fetch for Task ID: ${id}`);
      // Unified detail endpoint
      const res = await api.get(`/tasks/${id}`);
      if (res.data?.success) {
        setFullTaskData(res.data.data);
      }
    } catch (err) {
      console.error('Fetch task details failed:', err);
    } finally {
      setFullTaskLoading(false);
    }
  };

  const handleUpdateTaskField = async (field: string, value: any) => {
    if (!selectedTask) return;
    try {
      const endpoint = selectedTask.type === 'project' ? `/tasks/${selectedTask.id}` :
        selectedTask.type === 'quick' ? `/quick-tasks/${selectedTask.id}` :
          `/personal-tasks/${selectedTask.id}`;
      // Use put for full update or patch if API supports it
      if (selectedTask.type === 'personal') {
        await api.put(endpoint, { [field]: value });
      } else {
        await api.put(endpoint, { [field]: value });
      }
      fetchFullTask(selectedTask.id);
      fetchTasks(); // Refresh list
    } catch (err) {
      console.error(`Update ${field} failed:`, err);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    if (!selectedTask || selectedTask.type !== 'project') return;
    try {
      await api.patch(`/tasks/${selectedTask.id}/subtasks/${subtaskId}`, { isCompleted });
      await fetchFullTask(selectedTask.id);
      fetchTasks();
    } catch (err) {
      console.error('Toggle subtask failed:', err);
    }
  };

  const handleAddSubtask = async (title: string, assigneeId?: string | null) => {
    if (!selectedTask || selectedTask.type !== 'project' || !title.trim()) return;
    try {
      await api.post(`/tasks/${selectedTask.id}/subtasks`, { title, assigneeId: assigneeId || undefined });
      await fetchFullTask(selectedTask.id);
      fetchTasks();
    } catch (err) {
      console.error('Add subtask failed:', err);
    }
  };

  const handleAssignSubtask = async (subtaskId: string, assigneeId: string | null) => {
    if (!selectedTask || selectedTask.type !== 'project') return;
    try {
      await api.patch(`/tasks/${selectedTask.id}/subtasks/${subtaskId}`, { assigneeId });
      await fetchFullTask(selectedTask.id);
      fetchTasks();
    } catch (err) {
      console.error('Assign subtask failed:', err);
    }
  };

  const handlePostComment = async (content: string) => {
    if (!selectedTask || !content.trim()) return;
    const taskId = selectedTask.id;
    try {
      // Use the resolved type from fullData if available, fallback to selectedTask
      const taskType = fullTaskData?.type || selectedTask.type;
      if (taskType === 'personal') {
        console.warn("Personal tasks do not support comments.");
        return;
      }
      const url = taskType === 'project' ? `/tasks/${taskId}/comments` : `/quick-tasks/${taskId}/comments`;

      try {
        await api.post(url, { content });
      } catch (err: any) {
        if (err.response?.status === 404) {
          const altUrl = taskType === 'project' ? `/quick-tasks/${taskId}/comments` : `/tasks/${taskId}/comments`;
          await api.post(altUrl, { content });
        } else {
          throw err;
        }
      }

      await fetchFullTask(taskId);
      fetchTasks();
    } catch (err) {
      console.error('Post comment failed:', err);
    }
  };

  // Kanban columns data
  const kanbanTasks = [...projectTasks, ...quickTasks];
  const userMap = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);
  const departmentOptions = useMemo(
    () => Array.from(new Set(users.map((item) => item.department?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [users]
  );
  const personOptions = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (!notificationTaskId) return;
    const targetTask =
      projectTasks.find((task) => task.id === notificationTaskId) ||
      quickTasks.find((task) => task.id === notificationTaskId) ||
      personalTasks.find((task) => task.id === notificationTaskId) ||
      null;
    if (!targetTask) return;
    setSelectedTask(targetTask);
  }, [notificationTaskId, personalTasks, projectTasks, quickTasks]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks/all');
      if (res.data?.success) {
        setProjectTasks(res.data.data.projectTasks || []);
        setQuickTasks(res.data.data.quickTasks || []);
        setPersonalTasks(res.data.data.personalTasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeProjectTasks = useMemo(() => {
    return projectTasks.filter(t => {
      const p = projects.find(proj => proj.id === t.projectId);
      return p ? p.status !== 'archived' : true;
    });
  }, [projectTasks, projects]);

  const summaryStats = useMemo(() => {
    // Respect person filter for counts if one is selected (e.g., when coming from 'My Open Tasks' dashboard)
    const baseProjectTasks = personFilter !== 'all' 
      ? activeProjectTasks.filter(t => t.reporterId === personFilter || (t.assigneeIds || []).includes(personFilter))
      : activeProjectTasks;
    const baseQuickTasks = personFilter !== 'all' 
      ? quickTasks.filter(t => t.reporterId === personFilter || (t.assigneeIds || []).includes(personFilter))
      : quickTasks;
    
    const all = [...baseProjectTasks, ...baseQuickTasks];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return {
      active: all.filter(t => t.status !== 'done').length,
      projects: baseProjectTasks.length,
      quick: baseQuickTasks.length,
      overdue: all.filter(t => {
        if (!t.dueDate || t.status === 'done') return false;
        const d = new Date(t.dueDate);
        d.setHours(0, 0, 0, 0);
        return d < now;
      }).length,
      done: all.filter(t => t.status === 'done').length
    };
  }, [projectTasks, quickTasks, personFilter]);

  const filteredTasks = (list: TaskRow[]) => {
    const query = searchTerm.trim().toLowerCase();
    let filtered = list.filter((task) => {
      if (!query) return true;
      const reporter = task.reporterId ? userMap.get(task.reporterId) : null;
      const assignees = (task.assigneeIds || [])
        .map((id) => userMap.get(id)?.name || '')
        .filter(Boolean)
        .join(' ');
      return [
        task.title,
        task.assignedTo,
        task.projectName,
        task.description || '',
        reporter?.name || '',
        assignees,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    if (selectedCategory === 'active') {
      filtered = filtered.filter(t => t.status !== 'done');
    } else if (selectedCategory === 'project') {
      filtered = filtered.filter(t => t.type === 'project');
    } else if (selectedCategory === 'quick') {
      filtered = filtered.filter(t => t.type === 'quick');
    } else if (selectedCategory === 'overdue') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      filtered = filtered.filter(t => {
        if (!t.dueDate || t.status === 'done') return false;
        const d = new Date(t.dueDate);
        d.setHours(0, 0, 0, 0);
        return d < now;
      });
    } else if (selectedCategory === 'done') {
      filtered = filtered.filter(t => t.status === 'done');
    }

    // Restore existing dropdown filters
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    if (departmentFilter !== 'all') {
      filtered = filtered.filter((task) => {
        const reporter = task.reporterId ? userMap.get(task.reporterId) : null;
        const assignees = (task.assigneeIds || []).map((id) => userMap.get(id)).filter(Boolean);
        const departments = Array.from(new Set([
          reporter?.department?.trim() || '',
          ...assignees.map((assignee) => assignee?.department?.trim() || ''),
        ].filter(Boolean)));
        return departments.includes(departmentFilter);
      });
    }

    if (personFilter !== 'all') {
      filtered = filtered.filter((task) => task.reporterId === personFilter || (task.assigneeIds || []).includes(personFilter));
    }

    return filtered;
  };

  const toggleSection = (section: string) => {
    setActiveSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const filteredProjectTasks = useMemo(() => filteredTasks(activeProjectTasks), [activeProjectTasks, searchTerm, filterStatus, departmentFilter, personFilter, userMap, selectedCategory]);
  const filteredQuickTasks = useMemo(() => filteredTasks(quickTasks), [quickTasks, searchTerm, filterStatus, departmentFilter, personFilter, userMap, selectedCategory]);
  const allFilteredTasks = useMemo(() => [...filteredProjectTasks, ...filteredQuickTasks], [filteredProjectTasks, filteredQuickTasks]);
  const activeTasksPageCount = Math.max(1, Math.ceil(allFilteredTasks.length / tasksPerPage));
  const projectTasksPageCount = Math.max(1, Math.ceil(filteredProjectTasks.length / tasksPerPage));
  const quickTasksPageCount = Math.max(1, Math.ceil(filteredQuickTasks.length / tasksPerPage));
  const paginatedActiveTasks = allFilteredTasks.slice((currentPage - 1) * tasksPerPage, currentPage * tasksPerPage);
  const paginatedProjectTasks = filteredProjectTasks.slice((projectsPage - 1) * tasksPerPage, projectsPage * tasksPerPage);
  const paginatedQuickTasks = filteredQuickTasks.slice((quickPage - 1) * tasksPerPage, quickPage * tasksPerPage);
  const activeFilterCount = [filterStatus !== 'all', departmentFilter !== 'all', personFilter !== 'all'].filter(Boolean).length;

  useEffect(() => {
    if (currentPage > activeTasksPageCount) setCurrentPage(activeTasksPageCount);
  }, [activeTasksPageCount, currentPage]);

  useEffect(() => {
    if (projectsPage > projectTasksPageCount) setProjectsPage(projectTasksPageCount);
  }, [projectTasksPageCount, projectsPage]);

  useEffect(() => {
    if (quickPage > quickTasksPageCount) setQuickPage(quickTasksPageCount);
  }, [quickTasksPageCount, quickPage]);

  const StatusIcon = ({ status }: { status: string }) => {
    const s = status.toLowerCase().replace('_', '');
    if (s === 'done' || s === 'completed') return <Check size={14} className="text-emerald-500" />;
    return <Mail size={14} className="text-gray-400" />;
  };

  const TypePill = ({ type, priority }: { type: string, priority: string }) => {
    let color = 'bg-blue-100 text-blue-600';
    if (priority === 'urgent' || priority === 'high') color = 'bg-rose-100 text-rose-600';
    if (priority === 'medium') color = 'bg-amber-100 text-amber-600';

    return (
      <div className="flex items-center gap-2">
        <span className={cn('w-2.5 h-2.5 rounded-full', color.split(' ')[0])} />
        <span className="capitalize">{priority}</span>
      </div>
    );
  };

  return (
    <div className="min-h-full flex flex-col bg-[#fcfdfe] dark:bg-surface-950 p-4 sm:p-5 lg:p-6 overflow-x-hidden">
      {/* 1. Minimal Summary Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4 lg:mb-6">
        <SummaryCard 
          title="Active Tasks"
          count={summaryStats.active}
          icon={Activity}
          color="blue"
          isActive={selectedCategory === 'active'}
          onClick={() => setSelectedCategory(selectedCategory === 'active' ? null : 'active')}
        />
        <SummaryCard 
          title="Project Tasks"
          count={summaryStats.projects}
          icon={Briefcase}
          color="purple"
          isActive={selectedCategory === 'project'}
          onClick={() => setSelectedCategory(selectedCategory === 'project' ? null : 'project')}
        />
        <SummaryCard 
          title="Quick Tasks"
          count={summaryStats.quick}
          icon={Zap}
          color="emerald"
          isActive={selectedCategory === 'quick'}
          onClick={() => setSelectedCategory(selectedCategory === 'quick' ? null : 'quick')}
        />
        <SummaryCard 
          title="Overdue Tasks"
          count={summaryStats.overdue}
          icon={Clock3}
          color="rose"
          isActive={selectedCategory === 'overdue'}
          onClick={() => setSelectedCategory(selectedCategory === 'overdue' ? null : 'overdue')}
        />
        <SummaryCard 
          title="Completed Tasks"
          count={summaryStats.done}
          icon={CheckCircle2}
          color="emerald"
          isActive={selectedCategory === 'done'}
          onClick={() => setSelectedCategory(selectedCategory === 'done' ? null : 'done')}
        />
      </div>

      {/* Bordio Style Top Header */}
      <div className="mb-4 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {canCreateTask && (
            <button
              onClick={() => setIsAddingTask(true)}
              className="bg-[#00a3ff] hover:bg-[#0082cc] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-colors shadow-sm w-full sm:w-auto"
            >
              <Plus size={18} />
              Add new
            </button>
          )}

          <div className="flex items-center bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-800 rounded-lg p-1 shadow-sm w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setView('table')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                view === 'table' ? "bg-gray-100 dark:bg-surface-800 text-gray-900 dark:text-surface-100 shadow-sm" : "text-gray-500 dark:text-surface-400 hover:text-gray-700 dark:hover:text-surface-200"
              )}
            >
              <List size={14} />
              Table view
            </button>
            <button
              onClick={() => setView('kanban')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                view === 'kanban' ? "bg-gray-100 dark:bg-surface-800 text-gray-900 dark:text-surface-100 shadow-sm" : "text-gray-500 dark:text-surface-400 hover:text-gray-700 dark:hover:text-surface-200"
              )}
            >
              <LayoutGrid size={14} />
              Kanban board
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-surface-500" size={16} />
            <input
              type="text"
              placeholder="Search projects, tasks, people..."
              className="bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-800 rounded-full pl-9 pr-4 py-2 text-sm w-full sm:w-64 lg:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-brand-500/20 transition-all shadow-sm text-gray-900 dark:text-surface-100"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>



          <div className="relative w-full sm:w-auto">
            <div
              onClick={() => setOpenDropdown(openDropdown === 'filter' ? null : 'filter')}
              className="flex items-center justify-center gap-2 bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-800 rounded-lg px-3 py-2 shadow-sm text-xs font-bold text-gray-600 dark:text-surface-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800 uppercase tracking-tight transition-all w-full sm:w-auto"
            >
              <SlidersHorizontal size={14} />
              Filter
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-[#00a3ff] px-1.5 py-0.5 text-[10px] font-bold text-white">{activeFilterCount}</span>
              )}
            </div>
            {openDropdown === 'filter' && (
              <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-[1.25rem] shadow-xl p-4 z-50 w-full sm:w-[340px] max-w-[calc(100vw-1.5rem)] animate-in fade-in zoom-in-95 duration-100">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-surface-200">Task Filters</p>
                    <p className="text-xs text-gray-400 dark:text-surface-500">Use the same filtering flow as quick tasks.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(null)}
                    className="text-gray-400 dark:text-surface-500 hover:text-gray-600 dark:hover:text-surface-300"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
                <div className="space-y-4">
                  <SearchableSelect
                    label="Person"
                    value={personFilter}
                    onChange={setPersonFilter}
                    placeholder="All people"
                    searchPlaceholder="Search people..."
                    options={[
                      { id: 'all', label: 'All people' },
                      ...personOptions.map((person) => ({
                        id: person.id,
                        label: person.name,
                        meta: [person.employeeId, person.department].filter(Boolean).join(' • '),
                      })),
                    ]}
                  />
                  <SearchableSelect
                    label="Department"
                    value={departmentFilter}
                    onChange={setDepartmentFilter}
                    placeholder="All departments"
                    searchPlaceholder="Search departments..."
                    options={[
                      { id: 'all', label: 'All departments' },
                      ...departmentOptions.map((department) => ({ id: department, label: department })),
                    ]}
                  />
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-surface-500 ml-1">Status</label>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {['all', 'todo', 'in_progress', 'done', 'in_review'].map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFilterStatus(f)}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-[11px] font-bold capitalize transition-all',
                            filterStatus === f
                              ? 'border-[#00a3ff] bg-blue-50 text-[#0082cc] dark:border-brand-500 dark:bg-brand-950/30 dark:text-brand-300'
                              : 'border-gray-100 bg-[#f8f9fc] text-gray-600 hover:bg-gray-50 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700'
                          )}
                        >
                          {f.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>





                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus('all');
                      setDepartmentFilter('all');
                      setPersonFilter('all');
                    }}
                    className="w-full rounded-2xl bg-[#f1f4fb] dark:bg-surface-800 px-4 py-3 text-sm font-bold text-[#2c4e87] dark:text-surface-200 hover:bg-[#e7edf8] dark:hover:bg-surface-700 transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end overflow-visible pl-2 sm:pl-0">
            <div className="flex -space-x-1.5 sm:-space-x-2">
              {users.slice(0, 5).map((u) => (
                <UserAvatar key={u.id} name={u.name} size="xs" color={u.color} className="border-2 border-white dark:border-surface-950 ring-1 ring-[#f8f9fc] dark:ring-surface-950" />
              ))}
              {users.length > 5 && (
                <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-surface-800 border-2 border-white dark:border-surface-950 ring-1 ring-[#f8f9fc] dark:ring-surface-950 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-surface-300">
                  +{users.length - 5}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 mt-2 flex flex-wrap items-center gap-2">
        {filterStatus !== 'all' && (
          <span className="rounded-full bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-800 px-3 py-1 text-[11px] font-bold text-gray-600 dark:text-surface-300 capitalize">
            Status: {filterStatus.replace('_', ' ')}
          </span>
        )}
        {departmentFilter !== 'all' && (
          <span className="rounded-full bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-800 px-3 py-1 text-[11px] font-bold text-gray-600 dark:text-surface-300">
            Department: {departmentFilter}
          </span>
        )}
        {personFilter !== 'all' && (
          <span className="rounded-full bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-800 px-3 py-1 text-[11px] font-bold text-gray-600 dark:text-surface-300">
            Person: {userMap.get(personFilter)?.name || 'Selected'}
          </span>
        )}
      </div>

      <div className="relative flex-1">
        <AnimatePresence mode="wait">
          {view === 'table' ? (
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col"
            >
              <div className="flex flex-col gap-6 overflow-visible lg:overflow-auto custom-scrollbar">
                {/* 1. Active Tasks Section */}
                {(selectedCategory === 'active' || !selectedCategory) && (
                <div className="bg-white dark:bg-surface-900 rounded-xl border border-gray-200 dark:border-surface-800 shadow-sm overflow-hidden flex flex-col shrink-0 ring-1 ring-black/5">
                  <div
                    onClick={() => toggleSection('active')}
                    className="px-5 py-3 border-b border-gray-100 dark:border-surface-800 flex items-center justify-between bg-white dark:bg-surface-950/20 sticky top-0 z-10 backdrop-blur-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown size={14} className={cn("text-gray-400 transition-transform", !activeSections.includes('active') && "-rotate-90")} />
                      <span className="text-sm font-bold text-gray-700 dark:text-surface-200">Active tasks</span>
                      <span className="bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-surface-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{allFilteredTasks.length}</span>
                    </div>
                  </div>

                  {activeSections.includes('active') && (
                    <div className="overflow-x-auto border-t border-gray-100 dark:border-surface-800">
                      <table className="min-w-[760px] w-full text-xs text-left border-collapse">
                        <colgroup>
                          <col style={{ width: '32%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '6%' }} />
                        </colgroup>
                        <thead className="bg-white dark:bg-surface-900 text-gray-400 dark:text-surface-500 font-semibold border-b border-gray-50 dark:border-surface-800">
                          <tr>
                            <th className="px-5 py-3 font-semibold min-w-[300px]">Task Name</th>
                            <th className="px-3 py-3 font-semibold">Status</th>
                            <th className="px-3 py-3 font-semibold">Type</th>
                            <th className="px-3 py-3 font-semibold">Due date</th>
                            <th className="px-3 py-3 font-semibold">Est. time</th>
                            <th className="px-3 py-3 font-semibold">Responsible</th>
                            <th className="px-5 py-3 w-10 text-right"><MoreHorizontal size={14} className="text-gray-300 dark:text-surface-700" /></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-surface-800">
                          {loading ? (
                            <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Loading your tasks...</td></tr>
                          ) : allFilteredTasks.length > 0 ? (
                            paginatedActiveTasks.map((task, idx) => (
                              <TaskRowComponent key={task.id || idx} task={task} onClick={() => setSelectedTask(task)} />
                            ))
                          ) : (
                            <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No active tasks found matching your search.</td></tr>
                          )}
                        </tbody>
                      </table>

                      {/* Pagination Controls */}
                      {allFilteredTasks.length > tasksPerPage && (
                        <PaginationControls
                          currentPage={currentPage}
                          totalPages={activeTasksPageCount}
                          totalItems={allFilteredTasks.length}
                          itemsPerPage={tasksPerPage}
                          onPageChange={setCurrentPage}
                        />
                      )}
                    </div>
                  )}
                </div>
                )}

                {/* 2. Projects Section */}
                {(selectedCategory === 'project' || !selectedCategory) && (
                <div className="bg-white dark:bg-surface-900 rounded-xl border border-gray-200 dark:border-surface-800 shadow-sm overflow-hidden flex flex-col shrink-0 ring-1 ring-black/5">
                  <div
                    onClick={() => toggleSection('projects')}
                    className="px-5 py-3 border-b border-gray-100 dark:border-surface-800 flex items-center justify-between bg-white dark:bg-surface-950/20 sticky top-0 z-10 backdrop-blur-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown size={14} className={cn("text-gray-400 transition-transform", !activeSections.includes('projects') && "-rotate-90")} />
                      <span className="text-sm font-bold text-gray-700 dark:text-surface-200 uppercase tracking-tight">Projects</span>
                      <span className="bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-surface-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{allFilteredTasks.filter(t => t.type === 'project').length}</span>
                    </div>
                  </div>

                  {activeSections.includes('projects') && (
                    <div className="overflow-x-auto border-t border-gray-100 dark:border-surface-800">
                      <table className="min-w-[760px] w-full text-xs text-left border-collapse">
                        <colgroup>
                          <col style={{ width: '32%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '6%' }} />
                        </colgroup>
                        <tbody className="divide-y divide-gray-50 dark:divide-surface-800">
                          {allFilteredTasks.filter(t => t.type === 'project').length === 0 ? (
                            <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No project tasks found.</td></tr>
                          ) : (
                            (() => {
                              const groups: Record<string, TaskRow[]> = {};
                              allFilteredTasks.filter(t => t.projectName !== '-').forEach(t => {
                                if (!groups[t.projectName]) groups[t.projectName] = [];
                                groups[t.projectName].push(t);
                              });

                              const pTasks = allFilteredTasks.filter(t => t.projectName !== '-');
                              const paginatedPTasks = pTasks.slice((projectsPage - 1) * tasksPerPage, projectsPage * tasksPerPage);

                              // Re-group paginated tasks
                              const paginatedGroups: Record<string, TaskRow[]> = {};
                              paginatedProjectTasks.forEach(t => {
                                if (!paginatedGroups[t.projectName]) paginatedGroups[t.projectName] = [];
                                paginatedGroups[t.projectName].push(t);
                              });

                              return (
                                <>
                                  {Object.entries(paginatedGroups).map(([groupName, tasks]) => (
                                    <React.Fragment key={groupName}>
                                      <tr className="bg-gray-50/50 dark:bg-surface-950/30">
                                        <td colSpan={7} className="px-5 py-2 text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-widest border-y border-gray-100 dark:border-surface-800">
                                          {groupName} - {tasks.length} tasks
                                        </td>
                                      </tr>
                                      {tasks.map((task, idx) => (
                                        <TaskRowComponent key={task.id || idx} task={task} onClick={() => setSelectedTask(task)} />
                                      ))}
                                    </React.Fragment>
                                  ))}

                                  {filteredProjectTasks.length > tasksPerPage && (
                                    <tr>
                                      <td colSpan={7} className="px-5 py-4 border-t border-gray-100 dark:border-surface-800 bg-gray-50/30 dark:bg-surface-950/20">
                                        <PaginationControls
                                          currentPage={projectsPage}
                                          totalPages={projectTasksPageCount}
                                          totalItems={filteredProjectTasks.length}
                                          itemsPerPage={tasksPerPage}
                                          onPageChange={setProjectsPage}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            })()
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                )}

                {/* 3. Quick Tasks Section */}
                {(selectedCategory === 'quick' || !selectedCategory) && (
                  <div className="bg-white dark:bg-surface-900 rounded-xl border border-gray-200 dark:border-surface-800 shadow-sm overflow-hidden flex flex-col shrink-0 ring-1 ring-black/5">
                    <div
                      onClick={() => toggleSection('quick')}
                      className="px-5 py-3 border-b border-gray-100 dark:border-surface-800 flex items-center justify-between bg-white dark:bg-surface-950/20 sticky top-0 z-10 backdrop-blur-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDown size={14} className={cn("text-gray-400 transition-transform", !activeSections.includes('quick') && "-rotate-90")} />
                        <span className="text-sm font-bold text-gray-700 dark:text-surface-200 uppercase tracking-tight">Quick Tasks</span>
                        <span className="bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-surface-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{filteredQuickTasks.length}</span>
                      </div>
                    </div>

                    {activeSections.includes('quick') && (
                      <div className="overflow-x-auto border-t border-gray-100 dark:border-surface-800">
                        <table className="min-w-[760px] w-full text-xs text-left border-collapse">
                          <colgroup>
                            <col style={{ width: '32%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '6%' }} />
                          </colgroup>
                          <tbody className="divide-y divide-gray-50 dark:divide-surface-800">
                            {filteredQuickTasks.length === 0 ? (
                              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No quick tasks found.</td></tr>
                            ) : (
                              <>
                                {paginatedQuickTasks.map((task, idx) => (
                                  <TaskRowComponent key={task.id || idx} task={task} onClick={() => setSelectedTask(task)} />
                                ))}
                                {filteredQuickTasks.length > tasksPerPage && (
                                  <tr>
                                    <td colSpan={7} className="px-5 py-4 border-t border-gray-100 dark:border-surface-800 bg-gray-50/30 dark:bg-surface-950/20">
                                      <PaginationControls
                                        currentPage={quickPage}
                                        totalPages={quickTasksPageCount}
                                        totalItems={filteredQuickTasks.length}
                                        itemsPerPage={tasksPerPage}
                                        onPageChange={setQuickPage}
                                      />
                                    </td>
                                  </tr>
                                )}
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Overdue Tasks Section */}
                {(selectedCategory === 'overdue' || !selectedCategory) && (
                <div className="bg-white dark:bg-surface-900 rounded-xl border border-gray-200 dark:border-surface-800 shadow-sm overflow-hidden flex flex-col shrink-0 ring-1 ring-black/5">
                  <div
                    onClick={() => toggleSection('overdue')}
                    className="px-5 py-3 border-b border-gray-100 dark:border-surface-800 flex items-center justify-between bg-white dark:bg-surface-950/20 sticky top-0 z-10 backdrop-blur-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown size={14} className={cn("text-gray-400 transition-transform", !activeSections.includes('overdue') && "-rotate-90")} />
                      <span className="text-sm font-bold text-gray-700 dark:text-surface-200 uppercase tracking-tight">Overdue Tasks</span>
                      <span className="bg-rose-100 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{allFilteredTasks.length}</span>
                    </div>
                  </div>

                  {activeSections.includes('overdue') && (
                    <div className="overflow-x-auto border-t border-gray-100 dark:border-surface-800">
                      <table className="min-w-[760px] w-full text-xs text-left border-collapse">
                        <colgroup>
                          <col style={{ width: '32%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '6%' }} />
                        </colgroup>
                        <thead className="bg-white dark:bg-surface-900 text-gray-400 dark:text-surface-500 font-semibold border-b border-gray-50 dark:border-surface-800">
                          <tr>
                            <th className="px-5 py-3 font-semibold min-w-[300px]">Task Name</th>
                            <th className="px-3 py-3 font-semibold">Status</th>
                            <th className="px-3 py-3 font-semibold">Type</th>
                            <th className="px-3 py-3 font-semibold">Due date</th>
                            <th className="px-3 py-3 font-semibold">Est. time</th>
                            <th className="px-3 py-3 font-semibold">Responsible</th>
                            <th className="px-5 py-3 w-10 text-right"><MoreHorizontal size={14} className="text-gray-300 dark:text-surface-700" /></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-surface-800">
                          {allFilteredTasks.length === 0 ? (
                            <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No overdue tasks found. Great job!</td></tr>
                          ) : (
                            allFilteredTasks.map((task, idx) => (
                              <TaskRowComponent key={task.id || idx} task={task} onClick={() => setSelectedTask(task)} />
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                )}
                {/* 5. Completed Tasks Section */}
                {(selectedCategory === 'done' || !selectedCategory) && (
                <div className="bg-white dark:bg-surface-900 rounded-xl border border-gray-200 dark:border-surface-800 shadow-sm overflow-hidden flex flex-col shrink-0 ring-1 ring-black/5">
                  <div
                    onClick={() => toggleSection('completed')}
                    className="px-5 py-3 border-b border-gray-100 dark:border-surface-800 flex items-center justify-between bg-white dark:bg-surface-950/20 sticky top-0 z-10 backdrop-blur-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown size={14} className={cn("text-gray-400 transition-transform", !activeSections.includes('completed') && "-rotate-90")} />
                      <span className="text-sm font-bold text-gray-700 dark:text-surface-200 uppercase tracking-tight">Completed Tasks</span>
                      <span className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-500 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{allFilteredTasks.filter(t => t.status === 'done').length}</span>
                    </div>
                  </div>

                  {activeSections.includes('completed') && (
                    <div className="overflow-x-auto border-t border-gray-100 dark:border-surface-800">
                      <table className="min-w-[760px] w-full text-xs text-left border-collapse">
                        <colgroup>
                          <col style={{ width: '32%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '6%' }} />
                        </colgroup>
                        <thead className="bg-white dark:bg-surface-900 text-gray-400 dark:text-surface-500 font-semibold border-b border-gray-50 dark:border-surface-800">
                          <tr>
                            <th className="px-5 py-3 font-semibold min-w-[300px]">Task Name</th>
                            <th className="px-3 py-3 font-semibold">Status</th>
                            <th className="px-3 py-3 font-semibold">Type</th>
                            <th className="px-3 py-3 font-semibold">Due date</th>
                            <th className="px-3 py-3 font-semibold">Est. time</th>
                            <th className="px-3 py-3 font-semibold">Responsible</th>
                            <th className="px-5 py-3 w-10 text-right"><MoreHorizontal size={14} className="text-gray-300 dark:text-surface-700" /></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-surface-800">
                          {allFilteredTasks.filter(t => t.status === 'done').length === 0 ? (
                            <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No completed tasks yet. Keep up the good work!</td></tr>
                          ) : (
                            allFilteredTasks.filter(t => t.status === 'done').map((task, idx) => (
                              <TaskRowComponent key={task.id || idx} task={task} onClick={() => setSelectedTask(task)} />
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="kanban"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="h-full"
            >
              {/* Fixed KanbanBoard props if they differ */}
              <KanbanBoard
                tasksOverride={allFilteredTasks as any}
                projectId=""
                onOpenTask={(t) => setSelectedTask(t as any)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Task Overlay - Bordio Style Full Pop-up */}
      <AnimatePresence>
        {isAddingTask && (
          <CreateTaskOverlay
            onClose={() => setIsAddingTask(false)}
            onCreated={fetchTasks}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTask && (
          <TaskDetailOverlay
            task={selectedTask}
            fullData={fullTaskData}
            loading={fullTaskLoading}
            onClose={() => {
              setSelectedTask(null);
              if (notificationTaskId) {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.delete('taskId');
                nextParams.delete('tab');
                setSearchParams(nextParams, { replace: true });
              }
            }}
            onToggleSubtask={handleToggleSubtask}
            onAddSubtask={handleAddSubtask}
            onUpdateField={handleUpdateTaskField}
            onPostComment={handlePostComment}
            onAssignSubtask={handleAssignSubtask}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const CreateTaskOverlay: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const { users, projects } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    projectId: '',
    status: 'todo',
    priority: 'normal',
    startDate: new Date().toISOString().split('T')[0],
    durationDays: 1,
    dueDate: '',
    assignedToId: '',
    description: ''
  });
  const selectedProject = projects.find(p => p.id === formData.projectId);
  const assignableUsers = useMemo(() => {
    if (!formData.projectId) return users;
    if (!selectedProject) return users;
    return users.filter((user) =>
      selectedProject.members.includes(user.id) &&
      !selectedProject.reportingPersonIds.includes(user.id)
    );
  }, [formData.projectId, users, selectedProject]);

  useEffect(() => {
    if (!formData.assignedToId) return;
    if (assignableUsers.some((user) => user.id === formData.assignedToId)) return;
    setFormData((prev) => ({ ...prev, assignedToId: '' }));
  }, [assignableUsers, formData.assignedToId]);

  const handleCreate = async () => {
    if (!formData.title.trim()) return;
    try {
      setLoading(true);
      const isQuickTask = !formData.projectId;
      const endpoint = isQuickTask ? '/quick-tasks' : '/tasks';
      const normalizedPriority = formData.priority === 'normal' ? 'medium' : formData.priority;
      const payload = isQuickTask
        ? { title: formData.title, priority: normalizedPriority, assigneeIds: formData.assignedToId ? [formData.assignedToId] : [], status: 'todo' }
        : {
          ...formData,
          priority: normalizedPriority,
          dueDate: addDaysToDateKey(formData.startDate, formData.durationDays - 1),
          assigneeIds: formData.assignedToId ? [formData.assignedToId] : [],
        };

      const res = await api.post(endpoint, payload);
      if (res.data?.success) {
        onCreated();
        onClose();
      }
    } catch (err) {
      console.error('Create task failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="mt-4 w-full max-w-2xl rounded-[1.75rem] bg-white p-5 shadow-2xl sm:mt-10 sm:p-10 dark:bg-surface-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-[28px] font-bold text-gray-900 dark:text-surface-50">Create New Task</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-full"><XIcon size={24} className="text-gray-400 dark:text-surface-500" /></button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">Task Title</label>
            <input
              type="text"
              placeholder="What needs to be done?"
              className="w-full bg-[#f8f9fc] dark:bg-surface-800 border border-gray-100 dark:border-surface-700 rounded-2xl p-5 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-brand-500/20 dark:text-surface-100 transition-all placeholder:text-gray-300 dark:placeholder:text-surface-600"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-surface-500 ml-1">Project</label>
              <select
                className="w-full bg-[#f8f9fc] dark:bg-surface-800 border border-gray-100 dark:border-surface-700 rounded-2xl p-4 text-[13px] font-semibold appearance-none focus:outline-none dark:text-surface-200"
                value={formData.projectId}
                onChange={e => setFormData({ ...formData, projectId: e.target.value })}
              >
                <option value="" className="dark:bg-surface-900">No project (Quick Task)</option>
                {projects.map(p => <option key={p.id} value={p.id} className="dark:bg-surface-900">{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-surface-500 ml-1">Assign To</label>
              <select
                className="w-full bg-[#f8f9fc] dark:bg-surface-800 border border-gray-100 dark:border-surface-700 rounded-2xl p-4 text-[13px] font-semibold appearance-none focus:outline-none dark:text-surface-200"
                value={formData.assignedToId}
                onChange={e => setFormData({ ...formData, assignedToId: e.target.value })}
              >
                <option value="" className="dark:bg-surface-900">Unassigned</option>
                {assignableUsers.map(u => <option key={u.id} value={u.id} className="dark:bg-surface-900">{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">
                {formData.projectId ? 'Start Date' : 'Due Date'}
              </label>
              <input
                type="date"
                className="w-full bg-[#f8f9fc] border border-gray-100 rounded-2xl p-4 text-[13px] font-semibold focus:outline-none"
                value={formData.projectId ? formData.startDate : formData.dueDate}
                onChange={e => {
                  const val = e.target.value;
                  if (formData.projectId) {
                    setFormData({ ...formData, startDate: val });
                  } else {
                    setFormData({ ...formData, dueDate: val });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">Duration (days)</label>
              <input
                type="number"
                min={1}
                step={1}
                disabled={!formData.projectId}
                className="w-full bg-[#f8f9fc] border border-gray-100 rounded-2xl p-4 text-[13px] font-semibold focus:outline-none disabled:opacity-50"
                value={formData.durationDays}
                onChange={e => setFormData({ ...formData, durationDays: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">Priority</label>
              <select
                className="w-full bg-[#f8f9fc] border border-gray-100 rounded-2xl p-4 text-[13px] font-semibold appearance-none focus:outline-none"
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">Description</label>
            <textarea
              placeholder="Add more details about this task..."
              className="w-full bg-[#f8f9fc] border border-gray-100 rounded-2xl p-5 text-[14px] min-h-[120px] resize-none focus:outline-none"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <button onClick={onClose} className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700">Discard</button>
            <button
              onClick={handleCreate}
              disabled={loading || !formData.title}
              className="bg-[#00a3ff] hover:bg-[#0082cc] text-white px-8 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const TaskDetailOverlay: React.FC<{
  task: TaskRow;
  fullData: any;
  loading: boolean;
  onClose: () => void;
  onToggleSubtask: (id: string, completed: boolean) => void;
  onAddSubtask: (title: string, assigneeId?: string | null) => void;
  onAssignSubtask: (id: string, assigneeId: string | null) => void;
  onUpdateField: (field: string, value: any) => void;
  onPostComment: (content: string) => void;
}> = ({ task, fullData, loading, onClose, onToggleSubtask, onAddSubtask, onAssignSubtask, onUpdateField, onPostComment }) => {
  const { users, projects } = useAppStore();
  const { user } = useAuthStore();
  const [newSubtask, setNewSubtask] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('');
  const [commentText, setCommentText] = useState('');
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showRepeatMenu, setShowRepeatMenu] = useState(false);

  const project = projects.find(p => p.id === task.projectId);
  const data = fullData || task;
  const responsible = users.find(u => (data.assigneeIds || []).includes(u.id)) || { name: task.assignedTo || 'Unassigned', color: 'gray' };
  const reporter = users.find(u => u.id === data.reporterId) || { name: data.reporterName || 'System', color: 'gray' };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 backdrop-blur-[2px] md:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        className="h-[92vh] w-full max-w-[950px] rounded-t-[1.5rem] bg-white shadow-2xl flex flex-col md:h-full md:rounded-none dark:bg-surface-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Detail Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-widest">
            <span className="hover:text-blue-500 cursor-pointer">{project?.name || 'Workspace'}</span>
            <span>/</span>
            <span className="text-gray-500 font-bold">{task.projectName !== '-' ? task.projectName : 'General Task'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><MoreHorizontal size={18} /></button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><XIcon size={20} /></button>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Main Content Side */}
          <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar sm:p-8 lg:p-10">
            {loading && !fullData ? (
              <div className="flex items-center justify-center h-40 text-gray-400">Loading task details...</div>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-surface-100 leading-tight">{data.title}</h1>

                <div className="grid max-w-lg grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
                  <div className="flex items-center gap-6">
                    <span className="text-[13px] text-gray-400 dark:text-surface-500 font-medium w-24">Status</span>
                    <select
                      className="bg-transparent text-[13px] font-bold text-gray-800 dark:text-surface-200 focus:outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800 px-2 py-1 rounded transition-colors"
                      value={data.status}
                      onChange={(e) => onUpdateField('status', e.target.value)}
                    >
                      <option value="todo" className="dark:bg-surface-900">Todo</option>
                      <option value="in_progress" className="dark:bg-surface-900">In Progress</option>
                      <option value="in_review" className="dark:bg-surface-900">In Review</option>
                      <option value="done" className="dark:bg-surface-900">Completed</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className="text-[13px] text-gray-400 dark:text-surface-500 font-medium w-24">Type</span>
                    <select
                      className="bg-transparent text-[13px] font-bold text-gray-800 dark:text-surface-200 focus:outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800 px-2 py-1 rounded transition-colors"
                      value={data.priority}
                      onChange={(e) => onUpdateField('priority', e.target.value)}
                    >
                      <option value="low" className="dark:bg-surface-900">Low</option>
                      <option value="normal" className="dark:bg-surface-900">Normal</option>
                      <option value="medium" className="dark:bg-surface-900">Medium</option>
                      <option value="high" className="dark:bg-surface-900">High</option>
                      {data.type !== 'personal' && <option value="urgent" className="dark:bg-surface-900">Urgent</option>}
                    </select>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className="text-[13px] text-gray-400 dark:text-surface-500 font-medium w-24">Due date</span>
                    <input
                      type="date"
                      className="bg-transparent text-[13px] font-bold text-gray-800 dark:text-surface-200 focus:outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800 px-1 rounded transition-colors"
                      min={data.startDate ? data.startDate.split('T')[0] : new Date().toISOString().split('T')[0]}
                      value={data.dueDate ? data.dueDate.split('T')[0] : ''}
                      onChange={(e) => onUpdateField('dueDate', e.target.value)}
                    />
                  </div>

                  {data.type !== 'personal' && (
                    <>
                      <div className="flex items-center gap-6">
                        <span className="text-[13px] text-gray-400 dark:text-surface-500 font-medium w-24">Responsible</span>
                        <div className="flex items-center gap-2">
                          <UserAvatar 
                            name={responsible.name} 
                            avatar={(responsible as any).avatar} 
                            size="xs" 
                            color={(responsible as any).color} 
                          />
                          <select
                            className="bg-transparent text-[13px] font-bold text-gray-800 dark:text-surface-200 focus:outline-none cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-800 px-2 py-1 rounded appearance-none transition-colors"
                            value={(responsible as any).id || ''}
                            onChange={(e) => onUpdateField('assigneeIds', e.target.value ? [e.target.value] : [])}
                          >
                            <option value="" className="dark:bg-surface-900">Unassigned</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id} className="dark:bg-surface-900">{u.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <span className="text-[13px] text-gray-400 dark:text-surface-500 font-medium w-24">Reporter</span>
                        <div className="flex items-center gap-2 text-[13px] font-bold text-gray-800 dark:text-surface-200">
                          <UserAvatar name={reporter.name} size="xs" color={(reporter as any).color} />
                          {reporter.name}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-10 pt-4 px-1">
                  <div className="relative">
                    <button
                      onClick={() => { setShowTagMenu(!showTagMenu); setShowRepeatMenu(false); }}
                      className="flex flex-col items-center gap-1 group transition-all text-gray-500 hover:text-blue-500"
                    >
                      <Tag size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <span className="text-[11px] font-medium mt-1">Add tag</span>
                    </button>
                    {showTagMenu && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-surface-800 border border-gray-100 dark:border-surface-700 rounded-xl shadow-xl p-2 z-[60] min-w-[120px]">
                        {['Design', 'Feedback', 'Bug', 'Feature', 'Blocked'].map(tag => (
                          <div key={tag} onClick={() => { onUpdateField('labels', [...(data.labels || []), tag]); setShowTagMenu(false); }} className="px-3 py-2 text-[10px] font-bold text-gray-600 dark:text-surface-300 hover:bg-gray-50 dark:hover:bg-surface-700 rounded-lg cursor-pointer">{tag}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => { setShowRepeatMenu(!showRepeatMenu); setShowTagMenu(false); }}
                      className="flex flex-col items-center gap-1 group transition-all text-gray-500 hover:text-blue-500"
                    >
                      <Repeat size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <span className="text-[11px] font-medium mt-1">Repeat task</span>
                    </button>
                    {showRepeatMenu && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl p-2 z-[60] min-w-[140px]">
                        {['Don\'t Repeat', 'Every Day', 'Every Week', 'Every Month', 'Every Year'].map(freq => (
                          <div key={freq} onClick={() => { setShowRepeatMenu(false); alert(`Repeating task ${freq}`); }} className="px-3 py-2 text-[10px] font-bold text-gray-600 hover:bg-gray-50 rounded-lg cursor-pointer">{freq}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-gray-400 font-bold uppercase text-[10px] tracking-widest pt-4">
                    <List size={14} /> Description
                  </div>
                  <textarea
                    className="w-full text-[15px] text-gray-700 dark:text-surface-300 leading-relaxed bg-[#f9fafb] dark:bg-surface-950/30 p-6 rounded-2xl border border-gray-100 dark:border-surface-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 dark:focus:ring-brand-500/10 min-h-[150px] resize-none transition-all"
                    value={data.description || ''}
                    placeholder="No description provided for this task."
                    onChange={(e) => onUpdateField('description', e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between pt-6">
                    <div className="flex items-center gap-2 text-gray-400 dark:text-surface-500 font-bold uppercase text-[10px] tracking-widest">
                      <Check size={14} /> Subtasks <span className="bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-surface-400 px-2.5 py-0.5 rounded-full ml-1 text-[9px]">{data.subtasks?.length || 0}</span>
                    </div>
                    <ChevronDown size={14} className="text-gray-300 dark:text-surface-700" />
                  </div>
                  <div className="space-y-3 pl-2">
                    {data.subtasks?.map((st: any) => {
                      const assignee = users.find(u => u.id === st.assigneeId) || st.assignee;
                      return (
                        <div key={st.id} className="flex items-center gap-3 group">
                          <input
                            type="checkbox"
                            checked={st.isCompleted}
                            onChange={(e) => onToggleSubtask(st.id, e.target.checked)}
                            className="rounded border-gray-300 dark:border-surface-700 dark:bg-surface-800 w-4 h-4 text-blue-500 focus:ring-blue-500/20 transition-colors"
                          />
                          <div className="flex-1 flex items-center justify-between gap-3">
                            <span className={cn("text-sm transition-colors", st.isCompleted ? "text-gray-400 dark:text-surface-600 line-through" : "text-gray-700 dark:text-surface-200")}>
                              {st.title}
                            </span>
                            <div className="flex items-center gap-2">
                              {assignee ? (
                                <>
                                  <UserAvatar name={assignee.name} avatar={assignee.avatar} color={assignee.color} size="xs" />
                                  <span className="text-[12px] text-gray-500 dark:text-surface-400">{assignee.name}</span>
                                </>
                              ) : (
                                <span className="text-[12px] text-gray-300 italic">Unassigned</span>
                              )}
                              <select
                                className="text-[11px] bg-white dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-lg px-2 py-1 focus:outline-none"
                                value={st.assigneeId || ''}
                                onChange={(e) => onAssignSubtask(st.id, e.target.value || null)}
                              >
                                <option value="">Unassigned</option>
                                {users.map(u => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 flex items-center gap-2 flex-wrap">
                      <div className="flex-1 min-w-[200px] relative">
                        <Plus size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input
                          type="text"
                          placeholder="Add Subtask"
                          className="w-full pl-7 py-2 text-sm font-bold placeholder:text-gray-300 dark:placeholder:text-surface-600 border-none bg-transparent dark:text-surface-200 focus:ring-0 outline-none hover:bg-gray-50 dark:hover:bg-surface-800/50 rounded-lg transition-colors"
                          value={newSubtask}
                          onChange={(e) => setNewSubtask(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newSubtask.trim()) {
                              onAddSubtask(newSubtask, newSubtaskAssignee || null);
                              setNewSubtask('');
                              setNewSubtaskAssignee('');
                            }
                          }}
                        />
                      </div>
                      <select
                        className="text-[12px] bg-white dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-lg px-3 py-2 focus:outline-none"
                        value={newSubtaskAssignee}
                        onChange={(e) => setNewSubtaskAssignee(e.target.value)}
                      >
                        <option value="">Assign to…</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (newSubtask.trim()) {
                            onAddSubtask(newSubtask, newSubtaskAssignee || null);
                            setNewSubtask('');
                            setNewSubtaskAssignee('');
                          }
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold px-3 py-2 rounded-lg transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                      <Paperclip size={14} /> Files <span className="bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full ml-1 text-[9px]">{data.attachments?.length || 0}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {data.attachments?.map((file: any) => (
                      <div key={file.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-all cursor-pointer group">
                        <div className="w-10 h-10 bg-blue-50 flex items-center justify-center rounded-lg text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                          <Paperclip size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-gray-800 truncate">{file.name}</p>
                          <p className="text-[10px] text-gray-400 uppercase font-bold">{file.size ? (file.size / 1024).toFixed(1) + ' KB' : 'PDF'}</p>
                        </div>
                      </div>
                    ))}
                    <div
                      onClick={() => alert('Upload File Clicked')}
                      className="border-2 border-dashed border-gray-100 rounded-xl p-8 flex flex-col items-center justify-center text-gray-300 hover:bg-gray-50 hover:border-gray-200 transition-all cursor-pointer group col-span-2"
                    >
                      <Plus size={24} className="group-hover:text-blue-500 transition-colors" />
                      <span className="text-[11px] font-bold uppercase tracking-widest mt-2 group-hover:text-gray-500">Click to upload files</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Activity / Chat Sidebar */}
          <div className="flex w-full flex-col border-t border-gray-100 bg-[#fbfcff] lg:w-[340px] lg:border-l lg:border-t-0 dark:border-surface-800 dark:bg-surface-950/40">
            <div className="border-b border-gray-100 bg-white p-5 sm:p-6 dark:border-surface-800 dark:bg-surface-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                    <AlertCircle size={16} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wide">
                    Activity
                  </span>
                </div>
                <div className="flex -space-x-2">
                  <UserAvatar name="M" size="xs" className="border-2 border-white" />
                  <UserAvatar name="S" size="xs" className="border-2 border-white" />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide bg-gray-50/20">
              <div className="text-center py-2 relative">
                <span className="bg-white border border-gray-100 text-[#999] text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-widest relative z-10 shadow-sm">Activity & Chat</span>
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-gray-100/50 -z-10" />
              </div>

              {data.comments?.map((c: any) => {
                const author = users.find(u => u.id === c.authorId);
                const isMe = c.authorId === user?.id;
                return (
                  <div key={c.id || c._id} className={cn("flex items-start gap-3", isMe ? "flex-row-reverse" : "")}>
                    <UserAvatar name={author?.name || 'U'} size="xs" color={author?.color} />
                    <div className={cn(
                      "max-w-[80%] rounded-2xl p-3 shadow-sm text-[12px]",
                      isMe ? "bg-blue-500 text-white rounded-tr-none" : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"
                    )}>
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <span className={cn("font-bold text-[10px]", isMe ? "text-blue-100" : "text-gray-400")}>{author?.name}</span>
                        <span className={cn("text-[9px]", isMe ? "text-blue-200" : "text-gray-300")}>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                );
              })}

              {!data.comments?.length && (
                <div className="text-center text-gray-300 text-[11px] font-medium py-10 italic">No messages yet. Start the conversation!</div>
              )}
            </div>

            <div className="p-6 bg-white dark:bg-surface-900 border-t border-gray-100 dark:border-surface-800 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
              <div className="relative group">
                <textarea
                  placeholder="Type a message..."
                  className="w-full bg-gray-50 dark:bg-surface-950/40 border border-gray-200 dark:border-surface-800 rounded-2xl px-5 py-4 text-sm dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-brand-500/20 focus:bg-white dark:focus:bg-surface-950/60 resize-none transition-all pr-20"
                  rows={2}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (commentText.trim()) {
                        onPostComment(commentText);
                        setCommentText('');
                      }
                    }
                  }}
                />
                <div className="absolute right-4 bottom-4 flex items-center gap-3 text-gray-400">
                  <button className="hover:text-blue-500 transition-colors"><Paperclip size={18} /></button>
                  <button
                    onClick={() => {
                      if (commentText.trim()) {
                        onPostComment(commentText);
                        setCommentText('');
                      }
                    }}
                    className="hover:text-blue-500 transition-colors"
                  >
                    <MessageSquare size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const ActivityItem = ({ user: userName, action, time, meta, metaAction }: any) => {
  const { user } = useAuthStore();
  const actualUser = userName === 'You' ? user?.name : userName;
  return (
    <div className="space-y-1.5 pl-1">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="font-bold text-gray-900 text-[12px]">{actualUser}</span>
        <span className="text-gray-400 text-[11px] leading-tight">{action}</span>
      </div>
      {meta && (
        <div className="flex items-center gap-1">
          <span className="text-blue-500 font-bold text-[11px] italic truncate max-w-[180px]">{meta}</span>
          {metaAction && <span className="text-gray-400 text-[10px] whitespace-nowrap">{metaAction}</span>}
        </div>
      )}
      {time && <span className="text-gray-300 text-[9px] font-bold uppercase block tracking-widest">{time}</span>}
    </div>
  );
};

const PaginationControls = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalItems <= itemsPerPage) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((page) => {
    if (totalPages <= 5) return true;
    return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
  });

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
        Showing {Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(totalItems, currentPage * itemsPerPage)} of {totalItems}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-[11px] font-bold text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-400 dark:hover:bg-surface-800"
        >
          Prev
        </button>
        {pages.map((page, index) => {
          const prevPage = pages[index - 1];
          const showGap = prevPage && page - prevPage > 1;
          return (
            <React.Fragment key={page}>
              {showGap ? <span className="px-1 text-xs font-bold text-gray-300 dark:text-surface-600">...</span> : null}
              <button
                type="button"
                onClick={() => onPageChange(page)}
                className={cn(
                  'h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition-all',
                  currentPage === page
                    ? 'bg-[#00a3ff] text-white shadow-lg shadow-blue-500/20'
                    : 'border border-gray-100 bg-white text-gray-500 hover:bg-gray-100 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-400 dark:hover:bg-surface-800'
                )}
              >
                {page}
              </button>
            </React.Fragment>
          );
        })}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-[11px] font-bold text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-400 dark:hover:bg-surface-800"
        >
          Next
        </button>
      </div>
    </div>
  );
};

const TaskRowComponent = ({ task, onClick }: { task: TaskRow, onClick: () => void }) => {
  const isOverdue = useMemo(() => {
    if (!task.dueDate || task.status === 'done') return false;
    const d = new Date(task.dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d < now;
  }, [task.dueDate, task.status]);

  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];
  const statusLabel = isOverdue ? 'OVER DUE' : (statusConfig?.label || task.status.replace('_', ' '));
  const statusColor = isOverdue ? '#f43f5e' : (statusConfig?.color);

  return (
    <tr
      onClick={onClick}
      className="hover:bg-blue-50/30 dark:hover:bg-surface-800/50 transition-colors cursor-pointer group animate-in fade-in duration-300"
    >
      <td className="px-5 py-4 align-middle">
        <div className="flex items-center gap-3 min-w-0">
          <span className="truncate text-sm font-bold text-gray-900 dark:text-surface-100">{task.title}</span>
          {task.projectName !== '-' && (
            <span className="whitespace-nowrap rounded-full bg-blue-50/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:bg-brand-950/30 dark:text-brand-300 border border-blue-100/50 dark:border-brand-500/20">{task.projectName}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-4 align-middle whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
          <span 
            className={cn(
              "font-bold text-[11px] uppercase tracking-wide",
              isOverdue ? "text-rose-500" : "text-gray-600 dark:text-surface-300"
            )}
          >
            {statusLabel}
          </span>
        </div>
      </td>
      <td className="px-3 py-4 align-middle whitespace-nowrap">
        <div className={cn(
          "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
          task.priority === 'urgent' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
            task.priority === 'high' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
              'bg-blue-50 text-blue-600 border border-blue-100'
        )}>
          {task.priority}
        </div>
      </td>
      <td className="px-3 py-4 align-middle text-gray-500 dark:text-surface-400 whitespace-nowrap">
        {task.dueDate ? (
          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 dark:text-surface-500">
            <Calendar size={13} className="opacity-70" />
            {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </div>
        ) : (
          <span className="text-gray-300 dark:text-surface-700">-</span>
        )}
      </td>
      <td className="px-3 py-4 align-middle text-[11px] font-bold text-gray-400 dark:text-surface-500 text-center whitespace-nowrap">
        {task.estimatedHours ? `${task.estimatedHours}h` : '-'}
      </td>
      <td className="px-3 py-4 align-middle whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <UserAvatar name={task.assignedTo || 'U'} avatar={task.assigneeAvatar} size="xs" />
          <span className="text-gray-700 dark:text-surface-200 font-bold text-[11px]">{task.assignedTo || 'Unassigned'}</span>
        </div>
      </td>
      <td className="px-5 py-4 align-middle text-right">
        <MoreHorizontal size={14} className="text-gray-300 dark:text-surface-700 opacity-0 group-hover:opacity-100 transition-opacity" />
      </td>
    </tr>
  );
};

const SummaryCard: React.FC<{
  title: string;
  count: number;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  color: 'blue' | 'purple' | 'emerald' | 'rose';
  isActive: boolean;
  onClick: () => void;
}> = ({ title, count, icon: Icon, color, isActive, onClick }) => {
  const colors = {
    blue: { bg: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-500', group: 'group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40' },
    purple: { bg: 'bg-purple-500', light: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-500', group: 'group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40' },
    emerald: { bg: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-500', group: 'group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40' },
    rose: { bg: 'bg-rose-500', light: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-500', group: 'group-hover:bg-rose-100 dark:group-hover:bg-rose-900/40' },
  };
  
  const c = colors[color];

  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "flex-1 min-w-[120px] p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 text-left relative overflow-hidden group",
        isActive 
          ? "bg-white dark:bg-surface-900 border-blue-500 shadow-md ring-1 ring-blue-500/10" 
          : "bg-white dark:bg-surface-900 border-gray-100 dark:border-surface-800 hover:border-gray-200 dark:hover:border-surface-700 shadow-sm"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center mb-2 transition-colors",
        isActive ? `${c.bg} text-white` : `${c.light} ${c.text} ${c.group}`
      )}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-wider mb-0.5">{title}</p>
        <p className="text-2xl font-black text-gray-900 dark:text-surface-50 leading-tight">{count}</p>
      </div>
      {isActive && (
        <motion.div 
          layoutId="active-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
    </motion.button>
  );
};

export default TasksManagement;
