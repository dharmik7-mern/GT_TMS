import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  LayoutDashboard, List, BarChart3, Settings2, Plus, ListTodo,
  Users, Calendar, Flag, ChevronDown, ArrowLeft, Edit3
} from 'lucide-react';
import { cn, formatDate, getProgressColor, generateId } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { KanbanBoard } from '../../components/KanbanBoard';
import { TaskModal } from '../../components/TaskModal';
import { TaskCard } from '../../components/TaskCard';
import { UserAvatar, AvatarGroup } from '../../components/UserAvatar';
import { ProgressBar, EmptyState, Tabs, TabsContent } from '../../components/ui';
import { Modal } from '../../components/Modal';
import type { Task, TaskStatus, Priority } from '../../app/types';
import { projectsService, tasksService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';

interface TaskFormData {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  const [editingName, setEditingName] = useState(false);

  const project = projects.find(p => p.id === id);
  const projectTasks = tasks.filter(t => t.projectId === id);
  const members = users.filter(u => project?.members.includes(u.id));
  const reportingPersons = users.filter(u => project?.reportingPersonIds?.includes(u.id));

  const { register, handleSubmit, reset } = useForm<TaskFormData>({
    defaultValues: { priority: 'medium', status: defaultStatus }
  });

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
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleAddTask = (status: TaskStatus = 'todo') => {
    setDefaultStatus(status);
    setShowAddTask(true);
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
      const response = await tasksService.create({
        title: data.title,
        description: data.description || undefined,
        priority: data.priority,
        status: defaultStatus,
        projectId: project.id,
        assigneeIds: data.assigneeId ? [data.assigneeId] : [],
        dueDate: data.dueDate || undefined,
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

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, key) => {
    acc[key as TaskStatus] = projectTasks.filter(t => t.status === key).length;
    return acc;
  }, {} as Record<TaskStatus, number>);

  const TAB_ITEMS = [
    { value: 'kanban', label: 'Board', icon: <LayoutDashboard size={14} /> },
    { value: 'list', label: 'List', icon: <List size={14} /> },
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

          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Progress */}
            <div className="text-right hidden sm:block">
              <p className="text-xs text-surface-400 mb-1">Progress</p>
              <div className="flex items-center gap-2">
                <ProgressBar value={project.progress} color={getProgressColor(project.progress)} size="md" className="w-24" />
                <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">{project.progress}%</span>
              </div>
            </div>

            {/* Team */}
            <div className="hidden sm:block text-right">
              <p className="text-xs text-surface-400 mb-1">Team</p>
              <AvatarGroup users={members} max={5} size="sm" />
            </div>

            {/* Due date */}
            {project.endDate && (
              <div className="hidden md:block text-right">
                <p className="text-xs text-surface-400 mb-1">Due date</p>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">{formatDate(project.endDate)}</p>
              </div>
            )}

            <Link to={`/projects/${project.id}/todo`} className="btn-secondary btn-md">
              <ListTodo size={15} />
              To-do table
            </Link>
            <button onClick={() => handleAddTask()} className="btn-primary btn-md">
              <Plus size={15} />
              Add Task
            </button>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG.todo][]).map(([key, cfg]) => (
            <div key={key} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium', cfg.bg, cfg.text)}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
              {cfg.label}
              <span className="font-bold ml-0.5">{statusCounts[key]}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Views */}
      <Tabs value={activeView} onValueChange={setActiveView} items={TAB_ITEMS} variant="underline">
        <TabsContent value="kanban" className="pt-4">
          <KanbanBoard projectId={project.id} onOpenTask={openTask} onAddTask={handleAddTask} />
        </TabsContent>

        <TabsContent value="list" className="pt-4">
          <div className="space-y-2">
            {projectTasks.length === 0 ? (
              <EmptyState
                icon={<List size={24} />}
                title="No tasks yet"
                description="Create your first task to get started"
                action={<button onClick={() => handleAddTask()} className="btn-primary btn-md"><Plus size={14} /> Add Task</button>}
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
        onClose={() => { setShowTaskModal(false); setSelectedTask(null); }}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <div className="relative">
                <select {...register('priority')} className="input pr-8 appearance-none">
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <div className="relative">
                <select value={defaultStatus} onChange={e => setDefaultStatus(e.target.value as TaskStatus)} className="input pr-8 appearance-none">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Assignee</label>
              <div className="relative">
                <select {...register('assigneeId')} className="input pr-8 appearance-none">
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input {...register('dueDate')} type="date" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Estimated hours</label>
            <input {...register('estimatedHours', { valueAsNumber: true })} type="number" placeholder="0" className="input" />
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
