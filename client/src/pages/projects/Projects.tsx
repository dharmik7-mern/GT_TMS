import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  Plus, Search, LayoutGrid, List, Filter, SortAsc,
  FolderKanban, Users, Calendar, MoreHorizontal, Trash2, Edit3, Archive, ChevronDown
} from 'lucide-react';
import { cn, formatDate, getProgressColor, generateId } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { PROJECT_COLORS, STATUS_CONFIG } from '../../app/constants';
import { UserAvatar, AvatarGroup } from '../../components/UserAvatar';
import { ProgressBar, EmptyState, Dropdown } from '../../components/ui';
import { Modal } from '../../components/Modal';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { Project, ProjectStatus, ProjectSdlcPhase } from '../../app/types';
import { projectsService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';

const STATUS_FILTERS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const PROJECT_STATUS_BADGES: Record<ProjectStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'badge-green' },
  on_hold: { label: 'On Hold', className: 'badge-amber' },
  completed: { label: 'Completed', className: 'badge-blue' },
  archived: { label: 'Archived', className: 'badge-gray' },
};

interface ProjectFormData {
  name: string;
  description: string;
  color: string;
  startDate: string;
  endDate: string;
  department: string;
  budget?: number;
  budgetCurrency: string;
}

const DEFAULT_SDLC_PLAN: ProjectSdlcPhase[] = [
  { name: 'Planning', durationDays: 3, notes: '' },
  { name: 'Requirement Analysis', durationDays: 5, notes: '' },
  { name: 'Design', durationDays: 4, notes: '' },
  { name: 'Development', durationDays: 10, notes: '' },
  { name: 'Testing', durationDays: 5, notes: '' },
  { name: 'Deployment', durationDays: 2, notes: '' },
  { name: 'Maintenance', durationDays: 3, notes: '' },
];

const ProjectCard = React.forwardRef<HTMLDivElement, {
  project: Project;
  onDelete: (id: string) => void;
}>(({ project, onDelete }, ref) => {
  const navigate = useNavigate();
  const { users } = useAppStore();
  const members = users.filter(u => project.members.includes(u.id));
  const badge = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.todo;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -2 }}
      className="card p-5 cursor-pointer hover:shadow-card-hover transition-all"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold text-base flex-shrink-0"
            style={{ backgroundColor: project.color }}
          >
            {project.name[0]}
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-surface-900 dark:text-white truncate">{project.name}</h3>
            <span className={cn('badge text-[10px] mt-0.5', badge.bg, badge.text)}>{badge.label}</span>
          </div>
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              onClick={e => e.stopPropagation()}
              className="btn-ghost w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              onClick={e => e.stopPropagation()}
              className="z-50 min-w-[160px] bg-white dark:bg-surface-900 rounded-xl shadow-modal border border-surface-100 dark:border-surface-800 p-1"
              sideOffset={4} align="end"
            >
              <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer text-surface-700 dark:text-surface-300 outline-none">
                <Edit3 size={14} /> Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer text-surface-700 dark:text-surface-300 outline-none">
                <Archive size={14} /> Archive
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-surface-100 dark:bg-surface-800 my-1" />
              <DropdownMenu.Item
                onClick={() => onDelete(project.id)}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer text-rose-600 outline-none"
              >
                <Trash2 size={14} /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {project.description && (
        <p className="text-xs text-surface-400 mb-3 line-clamp-2 leading-relaxed">{project.description}</p>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] text-surface-500 mb-2">
          <span className="font-semibold uppercase tracking-wider opacity-60">Progress</span>
          <span className="font-bold text-surface-700 dark:text-surface-300">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} color={getProgressColor(project.progress)} size="md" />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-surface-50 dark:border-surface-800/50 mt-1">
        <AvatarGroup users={members} max={3} size="xs" />
        <div className="flex flex-col items-end">
          {project.endDate && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-surface-400 uppercase tracking-tight">
              <Calendar size={10} />
              {formatDate(project.endDate, 'MMM d')}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});

const ProjectRow: React.FC<{ project: Project; onDelete: (id: string) => void }> = ({ project, onDelete }) => {
  const navigate = useNavigate();
  const { users } = useAppStore();
  const members = users.filter(u => project.members.includes(u.id));
  const badge = PROJECT_STATUS_BADGES[project.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4 px-5 py-3.5 border-b border-surface-50 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors group"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{ backgroundColor: project.color }}>
        {project.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{project.name}</p>
      </div>
      <div className="hidden sm:flex items-center w-24">
         <span className={cn('badge text-[10px] font-bold uppercase tracking-wider', badge.className)}>{badge.label}</span>
      </div>
      <div className="hidden md:flex items-center gap-3 w-40">
        <ProgressBar value={project.progress} color={getProgressColor(project.progress)} size="sm" className="flex-1" />
        <span className="text-[10px] font-bold text-surface-500 w-8 text-right">{project.progress}%</span>
      </div>
      <div className="hidden sm:flex items-center justify-center w-24">
        <AvatarGroup users={members} max={3} size="xs" />
      </div>
      <div className="hidden lg:flex items-center w-28">
        {project.endDate && (
          <span className="text-[11px] font-medium text-surface-400 whitespace-nowrap">{formatDate(project.endDate)}</span>
        )}
      </div>
      <button onClick={e => { e.stopPropagation(); onDelete(project.id); }}
        className="btn-ghost w-8 h-8 rounded-lg text-surface-300 hover:text-rose-500 dark:hover:bg-rose-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
        <Trash2 size={13} />
      </button>
    </motion.div>
  );
};

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { projects, users, addProject, deleteProject, bootstrap } = useAppStore();
  const { user } = useAuthStore();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedReportingPersons, setSelectedReportingPersons] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [reportingSearch, setReportingSearch] = useState('');
  const [sdlcPlan, setSdlcPlan] = useState<ProjectSdlcPhase[]>(DEFAULT_SDLC_PLAN);
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});
  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<ProjectFormData>({
    defaultValues: { budgetCurrency: 'INR' }
  });

  const budgetCurrency = watch('budgetCurrency');

  const filteredAssignableUsers = users.filter((candidate) => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return true;
    return [candidate.name, candidate.email, candidate.jobTitle, candidate.department]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const filteredReportingUsers = users.filter((candidate) => {
    const query = reportingSearch.trim().toLowerCase();
    if (!query) return true;
    return [candidate.name, candidate.email, candidate.jobTitle, candidate.department]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const totalPlannedDurationDays = sdlcPlan.reduce((sum, phase) => sum + (Number(phase.durationDays) || 0), 0);

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const closeCreateModal = () => {
    setShowModal(false);
    setSelectedMembers([]);
    setSelectedReportingPersons([]);
    setMemberSearch('');
    setReportingSearch('');
    setSdlcPlan(DEFAULT_SDLC_PLAN);
    reset();
  };

  const onCreateProject = async (data: ProjectFormData) => {
    try {
      const fallbackMembers = user?.id ? [user.id] : [];
      const payload = {
        name: data.name,
        description: data.description,
        color: selectedColor,
        status: 'active' as const,
        department: data.department || 'General',
        members: selectedMembers.length > 0 ? selectedMembers : fallbackMembers,
        reportingPersonIds: selectedReportingPersons,
        startDate: data.startDate || new Date().toISOString().split('T')[0],
        endDate: data.endDate || undefined,
        budget: typeof data.budget === 'number' && !Number.isNaN(data.budget) ? data.budget : undefined,
        budgetCurrency: data.budgetCurrency || 'INR',
        sdlcPlan: sdlcPlan.filter((phase) => phase.name.trim()),
      };

      const res = await projectsService.create(payload);
      const created = res.data.data ?? res.data;

      addProject(created);
      setShowModal(false);
      setSelectedMembers([]);
      setSelectedReportingPersons([]);
      setMemberSearch('');
      setReportingSearch('');
      setSdlcPlan(DEFAULT_SDLC_PLAN);
      reset();
      emitSuccessToast('Project created successfully.');
      navigate(`/projects/${created.id}`);
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Project could not be saved to the database.';
      emitErrorToast(message, 'Project creation failed');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await projectsService.delete(projectId);
      deleteProject(projectId);
      await bootstrap();
      emitSuccessToast('Project deleted successfully.', 'Project Deleted');
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Project could not be deleted.';
      emitErrorToast(message, 'Project delete failed');
    }
  };

  return (
    <div className="max-w-full mx-auto">
      {/* Header Actions */}
      <div className="flex justify-end pt-2">
        <button onClick={() => setShowModal(true)} className="btn-primary btn-md">
          <Plus size={16} />
          New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="input pl-9"
          />
        </div>

        <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-xl p-1 gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                statusFilter === f.value
                  ? 'bg-white dark:bg-surface-900 text-surface-900 dark:text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className="btn-secondary btn-sm">
            <SortAsc size={14} /> Sort
          </button>
          <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
            <button
              onClick={() => setView('grid')}
              className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all', view === 'grid' ? 'bg-white dark:bg-surface-900 shadow-sm text-surface-900 dark:text-white' : 'text-surface-400')}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all', view === 'list' ? 'bg-white dark:bg-surface-900 shadow-sm text-surface-900 dark:text-white' : 'text-surface-400')}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid/List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={28} />}
          title="No projects found"
          description={search ? `No projects matching "${search}"` : 'Create your first project to get started'}
          action={
            <button onClick={() => setShowModal(true)} className="btn-primary btn-md">
              <Plus size={15} /> Create Project
            </button>
          }
        />
      ) : (
        <div className="space-y-8 pb-10">
          {Object.entries(
            filtered.reduce((acc, p) => {
              const dept = p.department || 'General';
              if (!acc[dept]) acc[dept] = [];
              acc[dept].push(p);
              return acc;
            }, {} as Record<string, Project[]>)
          ).map(([dept, deptProjects]) => (
            <div key={dept} className="space-y-4">
              <div 
                onClick={() => setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }))}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <div className="h-px flex-1 bg-surface-100 dark:bg-surface-800" />
                <div className="flex items-center gap-2 px-3 py-1 bg-surface-50 dark:bg-surface-800 rounded-lg group-hover:bg-surface-100 dark:group-hover:bg-surface-700 transition-colors">
                  <span className="text-xs font-bold text-surface-400 uppercase tracking-widest">{dept} ({deptProjects.length})</span>
                  <ChevronDown size={12} className={cn('text-surface-400 transition-transform', !collapsedDepts[dept] ? 'rotate-180' : 'rotate-270')} />
                </div>
                <div className="h-px flex-1 bg-surface-100 dark:bg-surface-800" />
              </div>

              <AnimatePresence>
                {!collapsedDepts[dept] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {view === 'grid' ? (
                      <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        <AnimatePresence mode="popLayout">
                          {deptProjects.map(project => (
                            <ProjectCard key={project.id} project={project} onDelete={handleDeleteProject} />
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    ) : (
                      <div className="card overflow-hidden group">
                        <div className="flex items-center gap-4 px-5 py-2.5 bg-surface-50 dark:bg-surface-900 border-b border-surface-100 dark:border-surface-800">
                          <div className="w-8 flex-shrink-0" />
                          <p className="flex-1 text-[10px] font-bold text-surface-400 uppercase tracking-widest">Project</p>
                          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest hidden sm:block w-24">Status</p>
                          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest hidden md:block w-40">Progress</p>
                          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest hidden sm:block w-24 text-center">Team</p>
                          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest hidden lg:block w-28">Due Date</p>
                          <div className="w-8 flex-shrink-0" />
                        </div>
                        <AnimatePresence mode="popLayout">
                          {deptProjects.map(project => (
                            <ProjectRow key={project.id} project={project} onDelete={handleDeleteProject} />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal open={showModal} onClose={closeCreateModal} title="New Project" description="Create a new project for your team">
        <form onSubmit={handleSubmit(onCreateProject)} className="p-6 space-y-5">
          <div>
            <label className="label">Project name *</label>
            <input {...register('name', { required: 'Name is required' })} placeholder="e.g. Website Redesign" className={cn('input', errors.name && 'border-rose-400')} />
            {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} placeholder="What is this project about?" className="input h-auto py-2 resize-none" rows={3} />
          </div>

          <div>
            <label className="label">Department</label>
            <input
              {...register('department')}
              className="input bg-white dark:bg-surface-900"
              defaultValue="General"
              list="department-options"
              placeholder="e.g. General, Development, Design..."
            />
            <datalist id="department-options">
              <option value="General" />
              <option value="Development" />
              <option value="Design" />
              <option value="Marketing" />
              <option value="Product" />
            </datalist>
          </div>

          <div>
            <label className="label">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    'w-7 h-7 rounded-lg transition-all',
                    selectedColor === color && 'ring-2 ring-offset-2 ring-brand-500 scale-110'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start date</label>
              <input {...register('startDate')} type="date" className="input" min={new Date().toISOString().split('T')[0]} defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="label">Due date</label>
              <input {...register('endDate')} type="date" className="input" min={new Date().toISOString().split('T')[0]} />
            </div>

          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Project budget</label>
              <input
                {...register('budget', { valueAsNumber: true })}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 250000"
                className="input"
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <Dropdown 
                value={budgetCurrency}
                onChange={(val) => setValue('budgetCurrency', val)}
                items={[
                  { id: 'INR', label: 'INR (₹)' },
                  { id: 'USD', label: 'USD ($)' },
                  { id: 'EUR', label: 'EUR (€)' },
                  { id: 'GBP', label: 'GBP (£)' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="label">Assign Employees</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search employees..."
                className="input pl-9 h-9"
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-surface-100 dark:border-surface-800 rounded-xl p-2 space-y-1">
              {filteredAssignableUsers.map(u => (
                <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    checked={selectedMembers.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMembers([...selectedMembers, u.id]);
                      } else {
                        setSelectedMembers(selectedMembers.filter(id => id !== u.id));
                      }
                    }}
                  />
                  <UserAvatar name={u.name} color={u.color} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{u.name}</p>
                    <p className="text-[10px] text-surface-400 truncate">{u.jobTitle}</p>
                  </div>
                </label>
              ))}
              {filteredAssignableUsers.length === 0 && <p className="p-2 text-xs text-surface-400">No employees match this search.</p>}
            </div>
          </div>

          <div>
            <label className="label">Reporting Persons</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                value={reportingSearch}
                onChange={(e) => setReportingSearch(e.target.value)}
                placeholder="Search reporting persons..."
                className="input pl-9 h-9"
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-surface-100 dark:border-surface-800 rounded-xl p-2 space-y-1">
              {filteredReportingUsers.map(u => (
                <label key={`reporting-${u.id}`} className="flex items-center gap-3 p-2 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    checked={selectedReportingPersons.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedReportingPersons([...selectedReportingPersons, u.id]);
                      } else {
                        setSelectedReportingPersons(selectedReportingPersons.filter(id => id !== u.id));
                      }
                    }}
                  />
                  <UserAvatar name={u.name} color={u.color} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{u.name}</p>
                    <p className="text-[10px] text-surface-400 truncate">{u.jobTitle}</p>
                  </div>
                </label>
              ))}
              {filteredReportingUsers.length === 0 && <p className="p-2 text-xs text-surface-400">No reporting persons match this search.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-surface-100 p-4 dark:border-surface-800">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="label mb-0">SDLC Planning</p>
                <p className="text-xs text-surface-400">Define each delivery phase and its planned duration in days.</p>
              </div>
              <span className="badge-gray text-xs">{totalPlannedDurationDays} days planned</span>
            </div>
            <div className="space-y-3">
              {sdlcPlan.map((phase, index) => (
                <div key={`${phase.name}-${index}`} className="grid grid-cols-[minmax(0,1.5fr)_120px] gap-3">
                  <div>
                    <input
                      value={phase.name}
                      onChange={(e) => {
                        const next = [...sdlcPlan];
                        next[index] = { ...next[index], name: e.target.value };
                        setSdlcPlan(next);
                      }}
                      className="input"
                      placeholder="SDLC step name"
                    />
                  </div>
                  <div>
                    <input
                      value={phase.durationDays}
                      onChange={(e) => {
                        const next = [...sdlcPlan];
                        next[index] = { ...next[index], durationDays: Math.max(0, Number(e.target.value) || 0) };
                        setSdlcPlan(next);
                      }}
                      type="number"
                      min="0"
                      className="input"
                      placeholder="Days"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeCreateModal} className="btn-secondary btn-md flex-1">Cancel</button>
            <button type="submit" className="btn-primary btn-md flex-1">Create Project</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
