import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  Plus, Search, LayoutGrid, List,
  FolderKanban, Calendar, MoreVertical, Trash2, Edit3, Archive, ChevronDown, Upload,
  Users, UserCheck, DollarSign, Workflow, Clock, X, Check, SearchIcon
} from 'lucide-react';
import { cn, formatDate, getProgressColor } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { PROJECT_COLORS } from '../../app/constants';
import { ColorPicker } from '../../components/ColorPicker';
import { UserAvatar, AvatarGroup } from '../../components/UserAvatar';
import { ProgressBar, EmptyState, Dropdown, DatePicker } from '../../components/ui';
import { Modal } from '../../components/Modal';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { Project, ProjectStatus } from '../../app/types';
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

const DEPARTMENTS = ['General', 'Development', 'Design', 'Marketing', 'Product'];
const INITIAL_SDLC = [
  { name: 'Requirement', durationDays: 0, enabled: true },
  { name: 'Analysis', durationDays: 0, enabled: true },
  { name: 'Design', durationDays: 0, enabled: true },
  { name: 'Development', durationDays: 0, enabled: true },
  { name: 'Testing', durationDays: 0, enabled: true },
  { name: 'Deployment', durationDays: 0, enabled: true },
  { name: 'Maintenance', durationDays: 0, enabled: false }
];

interface ProjectFormData {
  name: string;
  description: string;
  color: string;
  startDate: string;
  endDate: string;
  department: string;
  budget: number;
  budgetCurrency: string;
  sdlcPlan: { name: string; durationDays: number; enabled: boolean }[];
}

const ProjectCard = React.forwardRef<HTMLDivElement, {
  project: Project;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onEdit: (project: Project) => void;
}>(({ project, onDelete, onArchive, onEdit }, ref) => {
  const navigate = useNavigate();
  const { users, workspaces } = useAppStore();
  const members = users.filter(u => project.members.includes(u.id));
  const { user } = useAuthStore();
  const workspacePermissions = workspaces[0]?.settings?.permissions || {};
  const canEditOtherProjects = Boolean(workspacePermissions?.editOtherProjects?.[user?.role || 'team_member']);
  const canManageProjects = user?.role !== 'team_member' || canEditOtherProjects;
  const badge = PROJECT_STATUS_BADGES[project.status];
  const isArchived = project.status === 'archived';

  return (
    <motion.div
      ref={ref} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} whileHover={{ y: -2 }}
      className={cn("card p-5 cursor-pointer hover:shadow-card-hover transition-all relative overflow-hidden", isArchived && "opacity-75 grayscale-[0.3]")}
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold text-base flex-shrink-0" style={{ backgroundColor: project.color }}>
            {project.name[0]}
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-surface-900 dark:text-white truncate">{project.name}</h3>
            <span className={cn('badge text-[10px] mt-0.5', badge.className)}>{badge.label}</span>
          </div>
        </div>
        {canManageProjects && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button onClick={e => e.stopPropagation()} className="btn w-7 h-7 rounded-lg opacity group-hover:opacity-100"><MoreVertical size={14} /></button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content onClick={e => e.stopPropagation()} className="z-50 min-w-[160px] bg-white dark:bg-surface-900 rounded-xl shadow-modal border border-surface-100 dark:border-surface-800 p-1" sideOffset={4} align="end">
                <DropdownMenu.Item onClick={() => onEdit(project)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer text-surface-700 dark:text-surface-300 outline-none"><Edit3 size={14} /> Edit</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => onArchive(project.id)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer text-surface-700 dark:text-surface-300 outline-none"><Archive size={14} /> Archive</DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-surface-100 dark:bg-surface-800 my-1" />
                <DropdownMenu.Item onClick={() => onDelete(project.id)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer text-rose-600 outline-none"><Trash2 size={14} /> Delete</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>
      {project.description && <p className="text-xs text-surface-400 mb-3 line-clamp-2 leading-relaxed">{project.description}</p>}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] text-surface-500 mb-2">
          <span className="font-semibold uppercase tracking-wider opacity-60">Progress</span>
          <span className="font-bold text-surface-700 dark:text-surface-300">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} color={getProgressColor(project.progress)} size="md" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-surface-50 dark:border-surface-800/50 mt-1">
        <AvatarGroup users={members} max={3} size="xs" />
        {project.endDate && <span className="flex items-center gap-1 text-[10px] font-bold text-surface-400 uppercase tracking-tight"><Calendar size={10} /> {formatDate(project.endDate, 'MMM d')}</span>}
      </div>
    </motion.div>
  );
});

const ProjectRow: React.FC<{ project: Project; onDelete: (id: string) => void; onArchive: (id: string) => void; onEdit: (project: Project) => void }> = ({ project, onDelete, onArchive, onEdit }) => {
  const navigate = useNavigate();
  const { users, workspaces } = useAppStore();
  const members = users.filter(u => project.members.includes(u.id));
  const badge = PROJECT_STATUS_BADGES[project.status];
  const { user } = useAuthStore();
  const workspacePermissions = workspaces[0]?.settings?.permissions || {};
  const canEditOtherProjects = Boolean(workspacePermissions?.editOtherProjects?.[user?.role || 'team_member']);
  const canManageProjects = user?.role !== 'team_member' || canEditOtherProjects;
  const isArchived = project.status === 'archived';

  return (
    <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={cn("flex items-center gap-4 px-5 py-3.5 border-b border-surface-50 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors group", isArchived && "opacity-60 grayscale-[0.2]")} onClick={() => navigate(`/projects/${project.id}`)}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: project.color }}>{project.name[0]}</div>
      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{project.name}</p></div>
      <div className="hidden sm:flex items-center w-24"><span className={cn('badge text-[10px] font-bold uppercase tracking-wider', badge.className)}>{badge.label}</span></div>
      <div className="hidden md:flex items-center gap-3 w-40"><ProgressBar value={project.progress} color={getProgressColor(project.progress)} size="sm" className="flex-1" /><span className="text-[10px] font-bold text-surface-500 w-8 text-right">{project.progress}%</span></div>
      <div className="hidden sm:flex items-center justify-center w-24"><AvatarGroup users={members} max={3} size="xs" /></div>
      <div className="hidden lg:flex items-center w-28">{project.endDate && <span className="text-[11px] font-medium text-surface-400 whitespace-nowrap">{formatDate(project.endDate)}</span>}</div>
      {canManageProjects && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button title="Archive" onClick={e => { e.stopPropagation(); onArchive(project.id); }} className="btn-ghost w-8 h-8 rounded-lg text-surface-300 hover:text-amber-500 flex items-center justify-center"><Archive size={13} /></button>
          <button onClick={e => { e.stopPropagation(); onEdit(project); }} className="btn-ghost w-8 h-8 rounded-lg text-surface-300 hover:text-brand-600 flex items-center justify-center"><Edit3 size={13} /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(project.id); }} className="btn-ghost w-8 h-8 rounded-lg text-surface-300 hover:text-rose-500 dark:hover:bg-rose-950/30 flex items-center justify-center transition-all"><Trash2 size={13} /></button>
        </div>
      )}
    </motion.div>
  );
};

export const ProjectsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { projects, updateProject, deleteProject, addProject, bootstrap, users } = useAppStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>(() => {
    const incoming = searchParams.get('status');
    return ['active', 'on_hold', 'completed', 'archived'].includes(incoming as any) ? incoming as any : 'all';
  });
  
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

  // Team & Reporting Selection
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);
  const [showMemberDrop, setShowMemberDrop] = useState(false);
  const [showReporterDrop, setShowReporterDrop] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [reporterQuery, setReporterQuery] = useState('');
  
  const memberRef = useRef<HTMLDivElement>(null);
  const reporterRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, reset, watch, setValue, control } = useForm<ProjectFormData>({
    defaultValues: {
      budgetCurrency: 'INR',
      department: 'General',
      startDate: new Date().toISOString().split('T')[0],
      sdlcPlan: INITIAL_SDLC
    }
  });

  const { fields: sdlcFields } = useFieldArray({ control, name: 'sdlcPlan' });

  const watchSdlc = watch('sdlcPlan');
  const watchStart = watch('startDate');
  
  const totalDays = useMemo(() => {
    return watchSdlc?.reduce((acc, s) => s.enabled ? acc + (Number(s.durationDays) || 0) : acc, 0) || 0;
  }, [watchSdlc]);

  useEffect(() => {
    if (watchStart) {
      if (totalDays > 0) {
        const start = new Date(watchStart);
        const end = new Date(start);
        end.setDate(start.getDate() + totalDays);
        setValue('endDate', end.toISOString().split('T')[0]);
      } else {
        // If no phase days, default end date to start date so they stay in sync
        setValue('endDate', watchStart);
      }
    }
  }, [watchStart, totalDays, setValue]);

  useEffect(() => {
    const clickOut = (e: MouseEvent) => {
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) setShowMemberDrop(false);
      if (reporterRef.current && !reporterRef.current.contains(e.target as Node)) setShowReporterDrop(false);
    };
    document.addEventListener('mousedown', clickOut);
    return () => document.removeEventListener('mousedown', clickOut);
  }, []);

  const filteredUsers = (q: string) => users.filter(u => 
    u.name.toLowerCase().includes(q.toLowerCase()) || 
    u.email.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 10);

  const canCreateProjects = user?.role !== 'team_member';
  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || p.status === statusFilter));

  const openModal = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setValue('name', project.name);
      setValue('description', project.description || '');
      setValue('department', project.department || 'General');
      setValue('startDate', project.startDate || '');
      setValue('endDate', project.endDate || '');
      setValue('budget', project.budget || 0);
      setValue('budgetCurrency', project.budgetCurrency || 'INR');
      setSelectedColor(project.color);
      setSelectedMembers(project.members);
      setSelectedReporters(project.reportingPersonIds);
      const mappedSdlc = INITIAL_SDLC.map(base => {
        const existing = project.sdlcPlan?.find(p => p.name === base.name);
        return existing ? { name: existing.name, durationDays: existing.durationDays, enabled: true } : { ...base, enabled: false };
      });
      setValue('sdlcPlan', mappedSdlc);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setEditingProject(null);
      reset({
        startDate: today,
        endDate: today,
        department: 'General',
        budgetCurrency: 'INR',
        sdlcPlan: INITIAL_SDLC
      });
      setSelectedColor(PROJECT_COLORS[0]);
      setSelectedMembers([]);
      setSelectedReporters(user?.id ? [user.id] : []);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProject(null);
    reset();
  };

  const onSaveProject = async (data: ProjectFormData) => {
    setIsSavingProject(true);
    try {
      const payload = {
        ...data,
        color: selectedColor,
        members: selectedMembers,
        reportingPersonIds: selectedReporters,
        budget: Number(data.budget) || 0,
        sdlcPlan: data.sdlcPlan.filter(s => s.enabled).map(s => ({
          name: s.name,
          durationDays: Number(s.durationDays) || 0
        }))
      };

      if (editingProject) {
        const res = await projectsService.update(editingProject.id, payload);
        updateProject(editingProject.id, res.data?.data ?? res.data);
        emitSuccessToast('Project updated successfully.');
      } else {
        const res = await projectsService.create(payload);
        addProject(res.data?.data ?? res.data);
        emitSuccessToast('Project created successfully.');
      }
      closeModal();
      await bootstrap();
    } catch (error: any) {
      emitErrorToast(error.response?.data?.message || 'Failed to save project');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleArchiveProject = async (id: string) => {
    try {
      const res = await projectsService.update(id, { status: 'archived' });
      updateProject(id, res.data.data ?? res.data);
      await bootstrap(); emitSuccessToast('Project archived successfully.');
    } catch (e) { emitErrorToast('Failed to archive project'); }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await projectsService.delete(id); deleteProject(id);
      await bootstrap(); emitSuccessToast('Project deleted successfully.');
    } catch (e) { emitErrorToast('Failed to delete project'); }
  };

  return (
    <div className="max-w-full mx-auto font-sans">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="input pl-9" />
        </div>
        <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-xl p-1 gap-1">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)} className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition-all', statusFilter === f.value ? 'bg-white dark:bg-surface-900 text-surface-900 dark:text-white shadow-sm' : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300')}>{f.label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-nowrap">
          {canCreateProjects && <button onClick={() => openModal()} className="btn-primary btn-sm px-4"><Plus size={14} /> New Project</button>}
          <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
            <button onClick={() => setView('grid')} className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all', view === 'grid' ? 'bg-white dark:bg-surface-900 shadow-sm text-surface-900 dark:text-white' : 'text-surface-400')}><LayoutGrid size={14} /></button>
            <button onClick={() => setView('list')} className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all', view === 'list' ? 'bg-white dark:bg-surface-900 shadow-sm text-surface-900 dark:text-white' : 'text-surface-400')}><List size={14} /></button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<FolderKanban size={28} />} title="No projects found" description={search ? `No matching projects` : 'Start by creating your first project'} />
      ) : (
        <div className="space-y-8 pb-10">
          {Object.entries(filtered.reduce((acc, p) => { const dept = p.department || 'General'; if (!acc[dept]) acc[dept] = []; acc[dept].push(p); return acc; }, {} as Record<string, Project[]>)).map(([dept, deptProjects]) => (
            <div key={dept} className="space-y-4">
              <div onClick={() => setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }))} className="flex items-center gap-2 group cursor-pointer">
                <div className="h-px flex-1 bg-surface-100 dark:bg-surface-800" />
                <div className="flex items-center gap-2 px-3 py-1 bg-surface-50 dark:bg-surface-800 rounded-lg group-hover:bg-surface-100 dark:group-hover:bg-surface-700 transition-colors">
                  <span className="text-xs font-bold text-surface-400 uppercase tracking-widest leading-none">{dept} ({deptProjects.length})</span>
                  <ChevronDown size={12} className={cn('text-surface-400 transition-transform', collapsedDepts[dept] ? 'rotate-270' : 'rotate-180')} />
                </div>
                <div className="h-px flex-1 bg-surface-100 dark:bg-surface-800" />
              </div>
              <AnimatePresence>
                {!collapsedDepts[dept] && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {view === 'grid' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {deptProjects.map(p => <ProjectCard key={p.id} project={p} onDelete={handleDeleteProject} onArchive={handleArchiveProject} onEdit={openModal} />)}
                      </div>
                    ) : (
                      <div className="card overflow-hidden">
                        <div className="flex items-center gap-4 px-5 py-2.5 bg-surface-50 dark:bg-surface-900 border-b border-surface-100 dark:border-surface-800">
                          <div className="w-8" /><p className="flex-1 text-[10px] font-bold text-surface-400 uppercase tracking-widest leading-none">Project</p>
                          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest hidden sm:block w-24">Status</p>
                          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest hidden md:block w-40">Progress</p>
                          <div className="w-8" />
                        </div>
                        {deptProjects.map(p => <ProjectRow key={p.id} project={p} onDelete={handleDeleteProject} onArchive={handleArchiveProject} onEdit={openModal} />)}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Main Modal */}
      <Modal open={showModal} onClose={closeModal} title={editingProject ? "Edit Project" : "New Project"} size="xl">
        <form onSubmit={handleSubmit(onSaveProject)} className="p-6 space-y-6 max-h-[85vh] overflow-y-auto font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div><label className="label">Project Name *</label><input {...register('name', { required: true })} className="input" placeholder="e.g. Website Redesign" /></div>
              <div><label className="label">Description</label><textarea {...register('description')} className="input h-24 resize-none" placeholder="What is this project about?" /></div>
              <div><label className="label">Department</label>
                <Dropdown 
                  value={watch('department')} 
                  onChange={(v) => setValue('department', v)}
                  items={DEPARTMENTS.map(d => ({ id: d, label: d }))} 
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DatePicker 
                  label="Start Date"
                  value={watch('startDate')}
                  onChange={(v) => setValue('startDate', v)}
                  minDate={new Date().toISOString().split('T')[0]}
                />
                <DatePicker 
                  label="Due Date"
                  value={watch('endDate')}
                  onChange={(v) => setValue('endDate', v)}
                  minDate={watch('startDate')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Budget</label><input type="number" {...register('budget')} className="input" placeholder="0.00" /></div>
                <div><label className="label">Currency</label>
                  <Dropdown 
                    value={watch('budgetCurrency')} 
                    onChange={(v) => setValue('budgetCurrency', v)}
                    items={['INR', 'USD', 'EUR', 'GBP'].map(c => ({ id: c, label: c }))} 
                  />
                </div>
              </div>
              <div className="space-y-2"><label className="label">Brand Color</label><ColorPicker value={selectedColor} onChange={setSelectedColor} palette={PROJECT_COLORS} /></div>
            </div>
          </div>

          {/* New Team & Reporter Selection - More obvious & functional */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <label className="label flex items-center gap-1.5"><Users size={14} className="text-brand-500" /> Project Members (Employees)</label>
              <div ref={memberRef} className="relative">
                <div onClick={() => setShowMemberDrop(true)} className="min-h-[44px] bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl p-1.5 flex flex-wrap gap-1.5 cursor-pointer hover:border-brand-300 transition-all">
                  {selectedMembers.map(id => {
                    const u = users.find(x => x.id === id);
                    return (
                      <div key={id} className="flex items-center gap-1.5 bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 rounded-lg pl-1 pr-1.5 py-0.5 shadow-sm">
                        <UserAvatar name={u?.name || ''} avatar={u?.avatar} size="xs" />
                        <span className="text-[10px] font-bold text-surface-700 dark:text-surface-200">{u?.name.split(' ')[0]}</span>
                        <X size={10} className="text-surface-400 hover:text-rose-500 transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedMembers(prev => prev.filter(x => x !== id)); }} />
                      </div>
                    );
                  })}
                  {selectedMembers.length === 0 && <span className="text-surface-400 text-[11px] px-2 py-1.5">Add employees to project...</span>}
                  <div className="ml-auto pr-1 flex items-center"><Plus size={12} className="text-surface-300" /></div>
                </div>
                <AnimatePresence>
                  {showMemberDrop && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute z-[60] left-0 right-0 mt-1 bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-xl shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-surface-50 dark:border-surface-800">
                        <div className="relative">
                          <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
                          <input autoFocus value={memberQuery} onChange={e => setMemberQuery(e.target.value)} placeholder="Search employees..." className="w-full bg-surface-50 dark:bg-surface-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] outline-none" />
                        </div>
                      </div>
                      <div className="max-h-40 overflow-y-auto py-1">
                        {filteredUsers(memberQuery).length === 0 ? <p className="text-[10px] text-center py-4 text-surface-400 italic">No users found</p> : filteredUsers(memberQuery).map(u => (
                          <div key={u.id} onClick={() => setSelectedMembers(p => p.includes(u.id) ? p.filter(x => x !== u.id) : [...p, u.id])} className={cn("px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors", selectedMembers.includes(u.id) && "bg-brand-50 dark:bg-brand-950/20")}>
                            <UserAvatar name={u.name} avatar={u.avatar} size="xs" />
                            <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-surface-900 dark:text-surface-100 truncate">{u.name}</p><p className="text-[9px] text-surface-400 truncate">{u.email}</p></div>
                            {selectedMembers.includes(u.id) && <Check size={12} className="text-brand-500" />}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="space-y-2">
              <label className="label flex items-center gap-1.5"><UserCheck size={14} className="text-brand-500" /> Reporting Heads</label>
              <div ref={reporterRef} className="relative">
                <div onClick={() => setShowReporterDrop(true)} className="min-h-[44px] bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl p-1.5 flex flex-wrap gap-1.5 cursor-pointer hover:border-brand-300 transition-all">
                  {selectedReporters.map(id => {
                    const u = users.find(x => x.id === id);
                    return (
                      <div key={id} className="flex items-center gap-1.5 bg-brand-50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/40 rounded-lg pl-1 pr-1.5 py-0.5 shadow-sm">
                        <UserAvatar name={u?.name || ''} avatar={u?.avatar} size="xs" />
                        <span className="text-[10px] font-bold text-brand-700 dark:text-brand-300">{u?.name.split(' ')[0]}</span>
                        <X size={10} className="text-brand-400 hover:text-rose-500 transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedReporters(prev => prev.filter(x => x !== id)); }} />
                      </div>
                    );
                  })}
                  {selectedReporters.length === 0 && <span className="text-surface-400 text-[11px] px-2 py-1.5">Select reporting head...</span>}
                  <div className="ml-auto pr-1 flex items-center"><Plus size={12} className="text-surface-300" /></div>
                </div>
                <AnimatePresence>
                  {showReporterDrop && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute z-[60] left-0 right-0 mt-1 bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-xl shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-surface-50 dark:border-surface-800">
                        <div className="relative">
                          <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
                          <input autoFocus value={reporterQuery} onChange={e => setReporterQuery(e.target.value)} placeholder="Search managers..." className="w-full bg-surface-50 dark:bg-surface-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] outline-none" />
                        </div>
                      </div>
                      <div className="max-h-40 overflow-y-auto py-1">
                        {filteredUsers(reporterQuery).length === 0 ? <p className="text-[10px] text-center py-4 text-surface-400 italic">No users found</p> : filteredUsers(reporterQuery).map(u => (
                          <div key={u.id} onClick={() => setSelectedReporters(p => p.includes(u.id) ? p.filter(x => x !== u.id) : [...p, u.id])} className={cn("px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors", selectedReporters.includes(u.id) && "bg-brand-50 dark:bg-brand-950/20")}>
                            <UserAvatar name={u.name} avatar={u.avatar} size="xs" />
                            <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-surface-900 dark:text-surface-100 truncate">{u.name}</p><p className="text-[9px] text-surface-400 truncate">{u.email}</p></div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className="label flex items-center gap-1.5"><Workflow size={14} className="text-brand-500" /> SDLC Workflow Setup</label>
              <div className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{totalDays} Total Days Estimated</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {sdlcFields.map((field, index) => {
                const isEnabled = watch(`sdlcPlan.${index}.enabled`);
                return (
                  <div key={field.id} className={cn("p-2.5 rounded-xl border transition-all flex flex-col gap-2", isEnabled ? "bg-brand-50/20 dark:bg-brand-950/10 border-brand-500/30 ring-1 ring-brand-500/10" : "bg-surface-50/50 dark:bg-surface-900/40 border-surface-100 dark:border-surface-800 opacity-60")}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register(`sdlcPlan.${index}.enabled`)} className="w-3.5 h-3.5 rounded-md border-surface-300 text-brand-600 focus:ring-brand-500" />
                      <span className="text-[10px] font-black text-surface-700 dark:text-surface-200 uppercase truncate leading-none">{field.name}</span>
                    </label>
                    {isEnabled && (
                      <div className="relative">
                        <Clock size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
                        <input type="number" {...register(`sdlcPlan.${index}.durationDays`)} className="w-full bg-white dark:bg-surface-900 border border-brand-200 dark:border-brand-900/50 rounded-lg pl-6 pr-2 h-8 text-[11px] font-bold text-brand-600 outline-none focus:ring-1 focus:ring-brand-500 font-mono" placeholder="0" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-6 sticky bottom-0 bg-white dark:bg-surface-950 pb-2 border-t border-surface-50 dark:border-surface-900/50">
            <button type="button" onClick={closeModal} className="btn-secondary btn-md flex-1 uppercase tracking-widest text-[11px] font-black">Cancel</button>
            <button type="submit" disabled={isSavingProject} className="btn-primary btn-md flex-1 uppercase tracking-widest text-[11px] font-black shadow-lg shadow-brand-500/20">
              {isSavingProject ? 'Processing...' : (editingProject ? 'Save Changes' : 'Create Project')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
