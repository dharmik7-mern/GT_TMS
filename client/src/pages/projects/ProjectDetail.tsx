import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  LayoutDashboard, List, BarChart3, Settings2, Plus, ListTodo,
  Users, Calendar, Flag, ChevronDown, ArrowLeft, Edit3
} from 'lucide-react';
import { addDaysToDateKey, cn, formatDate, getProgressColor, generateId } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { KanbanBoard } from '../../components/KanbanBoard';
import { TaskModal } from '../../components/TaskModal';
import { TaskCard } from '../../components/TaskCard';
import { UserAvatar, AvatarGroup } from '../../components/UserAvatar';
import { ProgressBar, EmptyState, Tabs, TabsContent, Dropdown } from '../../components/ui';
import { Modal } from '../../components/Modal';
import type { Task, TaskStatus, Priority, TimelinePhase } from '../../app/types';
import { projectsService, tasksService, timelineService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';
import { ProjectTimelineModule } from '../../components/ProjectTimelineModule';


interface TaskFormData {
  title: string;
  description: string;
  priority: Priority;
  startDate: string;
  durationDays: number;
  phaseId: string;
  assigneeId: string;
  status: TaskStatus;
  estimatedHours: number;
}

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, tasks, users, addTask, updateProject, bootstrap } = useAppStore();
  const { user } = useAuthStore();
  const [activeView, setActiveView] = useState('kanban');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  const [editingName, setEditingName] = useState(false);
  const [timelinePhases, setTimelinePhases] = useState<TimelinePhase[]>([]);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [isCreatingPhase, setIsCreatingPhase] = useState(false);

  const project = projects.find(p => p.id === id);
  const projectTasks = tasks.filter(t => t.projectId === id);
  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;
  const members = users.filter(u => project?.members.includes(u.id));
  const canCreateTask = user?.role !== 'team_member';
  const reportingPersons = users.filter(u => project?.reportingPersonIds?.includes(u.id));
  const todayDate = new Date().toISOString().split('T')[0];

  const { register, handleSubmit, reset, setValue, watch } = useForm<TaskFormData>({
    defaultValues: { priority: 'medium', status: defaultStatus, startDate: todayDate, durationDays: 1, phaseId: '' }
  });

  const watchPriority = watch('priority');
  const watchAssignee = watch('assigneeId');

  useEffect(() => {
    if (!project?.id) return;
    void (async () => {
      try {
        const response = await timelineService.get(project.id);
        setTimelinePhases((response.data?.data?.phases || []).filter((phase: TimelinePhase) => phase.id !== 'ungrouped'));
      } catch {
        setTimelinePhases([]);
      }
    })();
  }, [project?.id]);

  if (!project) {
    return (
      <EmptyState
        icon={<LayoutDashboard size={28} />}
        title="Project not found"
        description="This project doesn't exist or was deleted"
        action={<button onClick={() => navigate('/projects')} className="btn-secondary btn-md"><ArrowLeft size={14} /> Back to projects</button>}
      />
    );
  }

  const openTask = (task: Task) => {
    setSelectedTaskId(task.id);
    setShowTaskModal(true);
  };

  const handleAddTask = (status: TaskStatus = 'todo') => {
    setDefaultStatus(status);
    setValue('startDate', project?.startDate || todayDate);
    setValue('durationDays', 1);
    setValue('phaseId', '');
    setShowAddTask(true);
  };

  const handleCreatePhase = async () => {
    const trimmedName = newPhaseName.trim();
    if (!trimmedName || !project?.id) return;

    try {
      setIsCreatingPhase(true);
      const palette = ['#2563eb', '#0f766e', '#7c3aed', '#ea580c', '#dc2626', '#0891b2'];
      await timelineService.upsert(project.id, {
        phases: [
          ...timelinePhases.map(({ id, name, order, color }) => ({ id, name, order, color })),
          {
            name: trimmedName,
            order: timelinePhases.length,
            color: palette[timelinePhases.length % palette.length],
          },
        ],
      });
      const response = await timelineService.get(project.id);
      const phases = (response.data?.data?.phases || []).filter((phase: TimelinePhase) => phase.id !== 'ungrouped');
      setTimelinePhases(phases);
      const createdPhase = phases.find((phase: TimelinePhase) => phase.name === trimmedName);
      if (createdPhase) {
        setValue('phaseId', createdPhase.id);
      }
      setNewPhaseName('');
    } catch (error: any) {
      emitErrorToast(error?.response?.data?.error?.message || error?.response?.data?.message || 'Phase could not be created.', 'Phase');
    } finally {
      setIsCreatingPhase(false);
    }
  };

  const handleProjectNameUpdate = async (nextName: string) => {
    const trimmedName = nextName.trim();
    if (!trimmedName || trimmedName === project.name) {
      setEditingName(false);
      return;
    }

    try {
      const response = await projectsService.update(project.id, { name: trimmedName });
      updateProject(project.id, response.data.data ?? response.data);
      await bootstrap();
      emitSuccessToast('Project updated successfully.', 'Project Updated');
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Project name could not be updated.';
      emitErrorToast(message, 'Project update failed');
    } finally {
      setEditingName(false);
    }
  };

  const onCreateTask = async (data: TaskFormData) => {
    try {
      const startDate = data.startDate || project.startDate || todayDate;
      const durationDays = Math.max(1, Number(data.durationDays) || 1);
      const response = await tasksService.create({
        title: data.title,
        description: data.description || undefined,
        priority: data.priority,
        status: defaultStatus,
        projectId: project.id,
        assigneeIds: data.assigneeId ? [data.assigneeId] : [],
        startDate,
        dueDate: addDaysToDateKey(startDate, durationDays - 1),
        durationDays,
        phaseId: data.phaseId || undefined,
        estimatedHours: data.estimatedHours || undefined,
        order: projectTasks.filter((task) => task.status === defaultStatus).length,
      });

      const createdTask = response.data.data ?? response.data;
      addTask(createdTask);
      updateProject(project.id, { tasksCount: project.tasksCount + 1 });
      await bootstrap();
      setShowAddTask(false);
      reset();
      emitSuccessToast('Task created successfully.', 'Task Added');
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Task could not be created.';
      emitErrorToast(message, 'Task creation failed');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await tasksService.delete(taskId);
      await bootstrap();
      emitSuccessToast('Task removed from the board.', 'Task Deleted');
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Task could not be deleted.';
      emitErrorToast(message, 'Task delete failed');
    }
  };

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, key) => {
    acc[key as TaskStatus] = projectTasks.filter(t => t.status === key).length;
    return acc;
  }, {} as Record<TaskStatus, number>);

  const TAB_ITEMS = [
    { value: 'kanban', label: 'Board', icon: <LayoutDashboard size={14} /> },
    { value: 'list', label: 'List', icon: <List size={14} /> },
    { value: 'timeline', label: 'Timeline', icon: <Calendar size={14} /> },
    { value: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
  ];

  return (
    <div className="max-w-full">
      {/* Project Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <button onClick={() => navigate('/projects')} className="flex items-center gap-1 text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors mb-3">
          <ArrowLeft size={14} />
          All projects
        </button>

        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-display font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: project.color }}
          >
            {project.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                defaultValue={project.name}
                autoFocus
                onBlur={e => { void handleProjectNameUpdate(e.target.value); }}
                className="input text-2xl font-display font-semibold h-auto py-1 max-w-md"
              />
            ) : (
              <h1
                className="font-display font-bold text-2xl text-surface-900 dark:text-white cursor-pointer hover:text-brand-700 dark:hover:text-brand-300 transition-colors flex items-center gap-2 group"
                onClick={() => setEditingName(true)}
              >
                {project.name}
                <Edit3 size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-400" />
              </h1>
            )}
            <p className="text-sm text-surface-400 mt-0.5">{project.description}</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap flex-shrink-0 ml-auto pt-2 sm:pt-0">
            {/* Progress */}
            <div className="text-right hidden lg:block">
              <p className="text-xs text-surface-400 mb-1">Progress</p>
              <div className="flex items-center gap-2">
                <ProgressBar value={project.progress} color={getProgressColor(project.progress)} size="md" className="w-20 xl:w-24" />
                <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">{project.progress}%</span>
              </div>
            </div>

            {/* Team */}
            <div className="hidden lg:block text-right">
              <p className="text-xs text-surface-400 mb-1">Team</p>
              <AvatarGroup users={members} max={3} size="sm" />
            </div>

            {/* Due date */}
            {project.endDate && (
              <div className="hidden xl:block text-right">
                <p className="text-xs text-surface-400 mb-1">Due date</p>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">{formatDate(project.endDate)}</p>
              </div>
            )}

            <Link to={`/projects/${project.id}/todo`} className="btn-secondary btn-sm sm:btn-md whitespace-nowrap">
              <ListTodo size={15} />
              <span className="hidden sm:inline">To-do table</span>
              <span className="sm:hidden">To-do</span>
            </Link>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG.todo][]).map(([key, cfg]) => (
            <div key={key} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wide border transition-colors', 
              key === 'todo' && 'bg-surface-50 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700',
              key === 'in_progress' && 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
              key === 'done' && 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
              key === 'blocked' && 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
            )}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
              {cfg.label}
              <span className="ml-0.5 opacity-60">{statusCounts[key]}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Views */}
      <Tabs value={activeView} onValueChange={setActiveView} items={TAB_ITEMS} variant="underline">
        <TabsContent value="kanban" className="pt-4">
          <KanbanBoard 
            projectId={project.id} 
            onOpenTask={openTask} 
            onAddTask={canCreateTask ? handleAddTask : undefined} 
            onDeleteTask={canCreateTask ? handleDeleteTask : undefined} 
          />
        </TabsContent>

        <TabsContent value="list" className="pt-4">
          <div className="space-y-2">
            {projectTasks.length === 0 ? (
              <EmptyState
                icon={<List size={24} />}
                title="No tasks yet"
                description={canCreateTask ? "Create your first task to get started" : "Tasks will appear here once created by a manager."}
                action={canCreateTask ? <button onClick={() => handleAddTask()} className="btn-primary btn-md"><Plus size={14} /> Add Task</button> : null}
              />
            ) : (
              projectTasks.map(task => (
                <div key={task.id} className="group">
                  <TaskCard task={task} compact onClick={() => openTask(task)} />
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="pt-4">
          <ProjectTimelineModule projectId={project.id} />
        </TabsContent>

        <TabsContent value="overview" className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Task Distribution</h3>
              <div className="space-y-3">
                {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG.todo][]).map(([key, cfg]) => {
                  const count = statusCounts[key];
                  const total = projectTasks.length || 1;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className={cn('w-24 text-xs font-medium', cfg.text)}>{cfg.label}</span>
                      <div className="flex-1 h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / total) * 100}%` }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: cfg.color }}
                        />
                      </div>
                      <span className="text-xs text-surface-500 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Team Members</h3>
              <div className="space-y-3">
                {members.map(member => {
                  const memberTasks = projectTasks.filter(t => t.assigneeIds.includes(member.id));
                  const doneTasks = memberTasks.filter(t => t.status === 'done').length;
                  return (
                    <div key={member.id} className="flex items-center gap-3">
                      <UserAvatar name={member.name} color={member.color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{member.name}</p>
                        <ProgressBar
                          value={doneTasks}
                          max={memberTasks.length || 1}
                          size="sm"
                          color={member.color}
                          className="mt-1"
                        />
                      </div>
                      <span className="text-xs text-surface-500">{doneTasks}/{memberTasks.length}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Reporting Persons</h3>
              <div className="space-y-3">
                {reportingPersons.length > 0 ? reportingPersons.map(person => (
                  <div key={person.id} className="flex items-center gap-3">
                    <UserAvatar name={person.name} color={person.color} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{person.name}</p>
                      <p className="text-xs text-surface-400 truncate">{person.jobTitle || person.role.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-surface-400">No reporting persons assigned.</p>
                )}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Priority Breakdown</h3>
              <div className="space-y-3">
                {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG.low][]).map(([key, cfg]) => {
                  const count = projectTasks.filter(t => t.priority === key).length;
                  const total = projectTasks.length || 1;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-20">
                        <Flag size={12} style={{ color: cfg.color }} />
                        <span className="text-xs font-medium text-surface-600 dark:text-surface-400">{cfg.label}</span>
                      </div>
                      <div className="flex-1 h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / total) * 100}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: cfg.color }}
                        />
                      </div>
                      <span className="text-xs text-surface-500 w-4 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Delivery Planning</h3>
              {project.sdlcPlan && project.sdlcPlan.length > 0 ? (
                <div className="space-y-3">
                  {project.sdlcPlan.map((phase) => (
                    <div key={`${phase.name}-${phase.durationDays}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface-50 dark:bg-surface-800/60 px-4 py-3 border border-transparent dark:border-surface-700/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{phase.name}</p>
                        {phase.notes ? <p className="text-xs text-surface-400 mt-0.5 line-clamp-1">{phase.notes}</p> : null}
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-surface-900 text-surface-500 dark:text-surface-400 text-[10px] font-bold border border-surface-100 dark:border-surface-700 whitespace-nowrap shadow-sm">
                        {phase.durationDays}d
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-surface-100 dark:border-surface-800 pt-3 mt-1 text-sm">
                    <span className="text-surface-500 text-xs uppercase tracking-widest font-bold">Planned duration</span>
                    <span className="font-bold text-brand-600 dark:text-brand-400">{project.totalPlannedDurationDays || 0} days</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-surface-400">No SDLC delivery plan has been defined for this project yet.</p>
              )}
            </div>

            <div className="card p-5">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Recent Activity</h3>
              <div className="space-y-2.5">
                {projectTasks.slice(0, 6).map(task => (
                  <div key={task.id} className="flex items-center gap-2.5 text-xs text-surface-500">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: (STATUS_CONFIG[task.status] || STATUS_CONFIG.todo).color }} />
                    <span className="flex-1 truncate text-surface-700 dark:text-surface-300">{task.title}</span>
                    <span className={cn('badge text-[10px]', (STATUS_CONFIG[task.status] || STATUS_CONFIG.todo).bg, (STATUS_CONFIG[task.status] || STATUS_CONFIG.todo).text)}>
                      {(STATUS_CONFIG[task.status] || STATUS_CONFIG.todo).label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Detail Modal */}
      <TaskModal
        task={selectedTask}
        open={showTaskModal}
        onClose={() => { setShowTaskModal(false); setSelectedTaskId(null); }}
      />

      {/* Add Task Modal */}
      <Modal open={showAddTask} onClose={() => setShowAddTask(false)} title="New Task">
        <form onSubmit={handleSubmit(onCreateTask)} className="p-6 space-y-4">
          <div>
            <label className="label">Title *</label>
            <input {...register('title', { required: true })} placeholder="Task title" className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} placeholder="Optional description" className="input h-auto py-2 resize-none" rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <Dropdown 
                value={watchPriority} 
                onChange={(val) => setValue('priority', val as Priority)}
                items={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ 
                  id: k, 
                  label: v.label,
                  icon: <Flag size={12} style={{ color: v.color }} />
                }))}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <Dropdown 
                value={defaultStatus} 
                onChange={(val) => setDefaultStatus(val as TaskStatus)}
                items={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ 
                  id: k, 
                  label: v.label,
                  icon: <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: v.color }} />
                }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Assignee</label>
              <Dropdown 
                value={watchAssignee} 
                onChange={(val) => setValue('assigneeId', val)}
                placeholder="Unassigned"
                items={members.map(u => ({ 
                  id: u.id, 
                  label: u.name,
                  icon: <UserAvatar name={u.name} color={u.color} size="xs" />
                }))}
              />
            </div>
            <div>
              <label className="label">Phase</label>
              <select {...register('phaseId')} className="input">
                <option value="">Ungrouped</option>
                {timelinePhases.map((phase) => (
                  <option key={phase.id} value={phase.id}>{phase.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="label">Add New Phase</label>
              <input value={newPhaseName} onChange={(e) => setNewPhaseName(e.target.value)} placeholder="e.g. Development" className="input" />
            </div>
            <button type="button" onClick={() => void handleCreatePhase()} disabled={isCreatingPhase || !newPhaseName.trim()} className="btn-secondary btn-md">
              {isCreatingPhase ? 'Adding...' : 'Add Phase'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date *</label>
              <input {...register('startDate', { required: true })} type="date" className="input" min={todayDate} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Duration (days) *</label>
              <input {...register('durationDays', { required: true, valueAsNumber: true, min: 1 })} type="number" min={1} step={1} className="input" />
            </div>
            <div>
              <label className="label">Estimated hours</label>
              <input {...register('estimatedHours', { valueAsNumber: true })} type="number" placeholder="0" className="input" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowAddTask(false)} className="btn-secondary btn-md flex-1">Cancel</button>
            <button type="submit" className="btn-primary btn-md flex-1">Create Task</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProjectDetailPage;
