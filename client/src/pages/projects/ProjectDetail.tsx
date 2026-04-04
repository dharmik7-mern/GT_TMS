import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, List, BarChart3, Settings2, Plus, ListTodo,
  ArrowLeft, Edit3, Calendar, Flag,
  Users
} from 'lucide-react';
import { cn, formatDate, getProgressColor } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { KanbanBoard } from '../../components/KanbanBoard';
import { TaskModal } from '../../components/TaskModal';
import { TaskCard } from '../../components/TaskCard';
import { UserAvatar, AvatarGroup } from '../../components/UserAvatar';
import { ProgressBar, EmptyState, Tabs, TabsContent } from '../../components/ui';
import type { Task, TaskStatus, TimelinePhase, TaskCreationRequest, Priority } from '../../app/types';
import { projectsService, tasksService, timelineService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';
import { ProjectTimelineModule } from '../../components/ProjectTimelineModule';
import { ProjectTaskCreateModal, type ProjectTaskCreateValues } from '../../components/ProjectTaskCreateModal';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, tasks, users, workspaces, addTask, updateProject, bootstrap } = useAppStore();
  const { user } = useAuthStore();
  const [activeView, setActiveView] = useState('kanban');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [editingName, setEditingName] = useState(false);
  const [timelinePhases, setTimelinePhases] = useState<TimelinePhase[]>([]);
  const [taskRequests, setTaskRequests] = useState<TaskCreationRequest[]>([]);
  const [loadingTaskRequests, setLoadingTaskRequests] = useState(false);
  const notificationTaskId = searchParams.get('taskId');
  const notificationTab = searchParams.get('tab') === 'activity' ? 'activity' : 'details';

  const project = projects.find(p => p.id === id);
  const workspacePermissions = workspaces[0]?.settings?.permissions || {};
  const canEditOtherProjects = Boolean(workspacePermissions?.editOtherProjects?.[user?.role || 'team_member']);
  const projectTasks = tasks.filter(t => t.projectId === id);
  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;
  const members = users.filter(u => project?.members.includes(u.id) && !['super_admin', 'admin'].includes(u.role));
  const canCreateTask = user?.role !== 'team_member' || (project?.reportingPersonIds || []).includes(user?.id);
  const canEditProject = user?.role !== 'team_member' || canEditOtherProjects;
  const canRequestTask = Boolean(user?.id && project?.members.includes(user.id) && !canCreateTask);
  const canReviewTaskRequests = Boolean(
    user?.id &&
    ((project?.reportingPersonIds || []).includes(user.id) || ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || ''))
  );
  const reportingPersons = users.filter(u => project?.reportingPersonIds?.includes(u.id));
  const categories = project?.subcategories || [];
  const filteredProjectTasks = selectedCategoryId === 'all'
    ? projectTasks
    : projectTasks.filter((task) => task.subcategoryId === selectedCategoryId);

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

  useEffect(() => {
    if (!notificationTaskId) return;
    const targetTask = tasks.find((task) => task.id === notificationTaskId && task.projectId === project?.id);
    if (!targetTask) return;
    setSelectedTaskId(targetTask.id);
    setShowTaskModal(true);
  }, [notificationTaskId, project?.id, tasks]);

  useEffect(() => {
    if (selectedCategoryId === 'all') return;
    if ((project?.subcategories || []).some((category) => category.id === selectedCategoryId)) return;
    setSelectedCategoryId('all');
  }, [project?.subcategories, selectedCategoryId]);

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        setLoadingTaskRequests(true);
        const response = await tasksService.getRequests({ projectId: project.id });
        if (!cancelled) setTaskRequests(response.data?.data ?? response.data ?? []);
      } catch {
        if (!cancelled) setTaskRequests([]);
      } finally {
        if (!cancelled) setLoadingTaskRequests(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
    setShowAddTask(true);
  };

  const handleCreatePhase = async (newPhase: { id: string; name: string; order: number; color: string }) => {
    if (!project?.id) return;
    try {
      await timelineService.upsert(project.id, {
        phases: [
          ...timelinePhases.map(({ id, name, order, color }) => ({ id, name, order, color })),
          newPhase,
        ],
      });
      const response = await timelineService.get(project.id);
      const phases = (response.data?.data?.phases || []).filter((phase: TimelinePhase) => phase.id !== 'ungrouped');
      setTimelinePhases(phases);
      return phases.find((phase: TimelinePhase) => phase.name === newPhase.name)?.id;
    } catch (error: any) {
      emitErrorToast(error?.response?.data?.error?.message || error?.response?.data?.message || 'Phase could not be created.', 'Phase');
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

  const onCreateTask = async (data: ProjectTaskCreateValues) => {
    try {
      const payload = {
        title: data.title,
        description: data.description || undefined,
        taskType: data.taskType,
        priority: data.priority,
        status: data.status,
        projectId: project.id,
        assigneeIds: data.assigneeIds,
        startDate: data.startDate,
        dueDate: data.dueDate,
        durationDays: data.durationDays,
        phaseId: data.phaseId || undefined,
        subcategoryId: data.subcategoryId || undefined,
        estimatedHours: data.estimatedHours || undefined,
        labels: data.labels,
        tags: data.tags,
        order: projectTasks.filter((task) => task.status === data.status).length,
      };

      if (canCreateTask) {
        const response = await tasksService.create(payload);
        const createdTask = response.data.data ?? response.data;
        addTask(createdTask);
        updateProject(project.id, { tasksCount: project.tasksCount + 1 });
        if (createdTask?.id && data.files.length) {
          await tasksService.uploadAttachments(createdTask.id, data.files);
        }
        await bootstrap();
        emitSuccessToast('Task created successfully.', 'Task Added');
      } else {
        const response = await tasksService.createRequest(payload);
        const createdRequest = response.data.data ?? response.data;
        setTaskRequests((prev) => [createdRequest, ...prev]);
        emitSuccessToast('Task request sent to the reporting person.', 'Request Sent');
      }

      setShowAddTask(false);
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Task could not be created.';
      emitErrorToast(message, canCreateTask ? 'Task creation failed' : 'Task request failed');
    }
  };

  const handleReviewTaskRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const reviewNote = action === 'reject' ? window.prompt('Add rejection note (optional):') || '' : '';
      const response = await tasksService.reviewRequest(requestId, { action, reviewNote });
      const result = response.data?.data ?? response.data;
      if (result?.request) {
        setTaskRequests((prev) => prev.map((request) => (
          request.id === requestId ? result.request : request
        )));
      }
      await bootstrap();
      emitSuccessToast(
        action === 'approve' ? 'Task request approved and created.' : 'Task request rejected.',
        action === 'approve' ? 'Request Approved' : 'Request Rejected'
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Request review failed.';
      emitErrorToast(message, 'Task Request');
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



  const handleMoveTaskRemote = async (taskId: string, status: TaskStatus) => {
    try {
      await tasksService.update(taskId, { status });
      await bootstrap(); 
    } catch (error: any) {
      if (error?.config?.suppressErrorToast) return;
      const message = error?.response?.data?.error?.message || error?.response?.data?.message || 'Movement failed';
      emitErrorToast(message, 'Board sync error');
    }
  };

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, key) => {
    acc[key as TaskStatus] = filteredProjectTasks.filter(t => t.status === key).length;
    return acc;
  }, {} as Record<TaskStatus, number>);

  const TAB_ITEMS = [
    { value: 'kanban', label: 'Board', icon: <LayoutDashboard size={14} /> },
    { value: 'list', label: 'List', icon: <List size={14} /> },
    { value: 'timeline', label: 'Timeline', icon: <Calendar size={14} /> },
    { value: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { value: 'team', label: 'Team', icon: <Users size={14} /> },
  ];

  return (
    <div className="max-w-full">
      {/* Project Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3"
      >
        <button onClick={() => navigate('/projects')} className="flex items-center gap-1 text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors mb-3">
          <ArrowLeft size={14} />
          All projects
        </button>

        <div className="flex items-center gap-4 flex-wrap">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-display font-bold text-base flex-shrink-0"
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
                className="input text-xl font-display font-semibold h-auto py-0.5 max-w-sm"
              />
            ) : (
              <h1
                className="font-display font-bold text-xl text-surface-900 dark:text-white cursor-pointer hover:text-brand-700 dark:hover:text-brand-300 transition-colors flex items-center gap-2 group"
                onClick={() => canEditProject && setEditingName(true)}
              >
                {project.name}
                {canEditProject ? <Edit3 size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-400" /> : null}
              </h1>
            )}
            <p className="text-[11px] text-surface-400 mt-0">{project.description}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0 ml-auto">
            {/* Progress */}
            <div className="text-right hidden lg:block border-r border-surface-100 dark:border-surface-800 pr-3 mr-1">
              <p className="text-[10px] text-surface-400 mb-0 font-bold uppercase tracking-tighter">Progress</p>
              <div className="flex items-center gap-2">
                <ProgressBar value={project.progress} color={getProgressColor(project.progress)} size="sm" className="w-16" />
                <span className="text-xs font-black text-surface-700 dark:text-surface-300">{project.progress}%</span>
              </div>
            </div>

            {/* Team */}
            <div className="hidden lg:block text-right border-r border-surface-100 dark:border-surface-800 pr-3 mr-1">
              <p className="text-[10px] text-surface-400 mb-0 font-bold uppercase tracking-tighter">Team</p>
              <AvatarGroup users={members} max={3} size="xs" />
            </div>

            {/* Due date */}
            {project.endDate && (
              <div className="hidden xl:block text-right border-r border-surface-100 dark:border-surface-800 pr-3 mr-1">
                <p className="text-[10px] text-surface-400 mb-0 font-bold uppercase tracking-tighter">Due date</p>
                <p className="text-xs font-black text-surface-700 dark:text-surface-300">{formatDate(project.endDate)}</p>
              </div>
            )}

            <div className="flex items-center gap-1.5 ml-1">
              <Link to={`/projects/${project.id}/todo`} className="btn-secondary btn-sm whitespace-nowrap">
                <ListTodo size={14} />
                <span className="hidden sm:inline">To-do</span>
              </Link>
              <Link to={`/projects/${project.id}/requests`} className="btn-secondary btn-sm whitespace-nowrap">
                <Settings2 size={14} />
                <span className="hidden sm:inline text-[11px]">Requests</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG.todo][]).map(([key, cfg]) => (
            <div key={key} className={cn('flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tight border transition-colors', 
              key === 'todo' && 'bg-surface-50 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700',
              key === 'in_progress' && 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
              key === 'done' && 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
            )}>
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: cfg.color }} />
              {cfg.label.split(' ')[0]}
              <span className="ml-0.5 opacity-60">{statusCounts[key]}</span>
            </div>
          ))}
        </div>

        {categories.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('all')}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
                selectedCategoryId === 'all'
                  ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/50 dark:bg-brand-950/30 dark:text-brand-300'
                  : 'border-surface-200 text-surface-500 dark:border-surface-800 dark:text-surface-400'
              )}
            >
              All categories
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryId(category.id)}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
                  selectedCategoryId === category.id
                    ? 'text-surface-900 dark:text-white border-transparent'
                    : 'border-surface-200 text-surface-500 dark:border-surface-800 dark:text-surface-400'
                )}
                style={selectedCategoryId === category.id ? { backgroundColor: `${category.color || '#6366f1'}20`, borderColor: category.color || '#6366f1' } : undefined}
              >
                {category.name}
              </button>
            ))}
          </div>
        ) : null}
      </motion.div>

      {/* Views */}
      <Tabs value={activeView} onValueChange={setActiveView} items={TAB_ITEMS} variant="underline">
        <TabsContent value="kanban" className="pt-4">
          <KanbanBoard 
            projectId={project.id} 
            tasksOverride={filteredProjectTasks}
            onOpenTask={openTask} 
            onAddTask={canCreateTask || canRequestTask ? handleAddTask : undefined} 
            onDeleteTask={canCreateTask ? handleDeleteTask : undefined} 
            onMoveTaskRemote={handleMoveTaskRemote}
          />
        </TabsContent>

        <TabsContent value="list" className="pt-4">
            <div className="space-y-2">
            {filteredProjectTasks.length === 0 ? (
                <EmptyState
                  icon={<List size={24} />}
                  title={selectedCategoryId === 'all' ? 'No tasks yet' : 'No tasks in this category'}
                  description={canCreateTask ? "Create your first task to get started" : canRequestTask ? "Request a task from the reporting person for this project." : "Tasks will appear here once created by a manager."}
                  action={canCreateTask || canRequestTask ? <button onClick={() => handleAddTask()} className="btn-primary btn-md"><Plus size={14} /> {canCreateTask ? 'Add Task' : 'Request Task'}</button> : null}
                />
              ) : (
              filteredProjectTasks.map(task => (
                  <div key={task.id} className="group">
                    <TaskCard task={task} compact onClick={() => openTask(task)} />
                  </div>
                ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="pt-2">
          <ProjectTimelineModule projectId={project.id} />
        </TabsContent>

        <TabsContent value="overview" className="pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-5 md:col-span-2">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display font-semibold text-surface-900 dark:text-white">Task Requests</h3>
                    <p className="text-xs text-surface-400">
                      {canReviewTaskRequests ? 'Review requested tasks before they are created.' : 'Track task requests raised for this project.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link to={`/projects/${project.id}/requests`} className="text-xs font-medium text-brand-600 dark:text-brand-400">
                      Open full page
                    </Link>
                    {loadingTaskRequests ? <span className="text-xs text-surface-400">Loading...</span> : null}
                  </div>
                </div>
              <div className="space-y-3">
                {taskRequests.length === 0 ? (
                  <p className="text-sm text-surface-400">No task requests found for this project.</p>
                ) : (
                  taskRequests.slice(0, 8).map((request) => {
                    const requester = users.find((member) => member.id === request.requestedBy);
                    const assignees = users.filter((member) => request.assigneeIds.includes(member.id));
                    return (
                      <div key={request.id} className="rounded-2xl border border-surface-100 dark:border-surface-800 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">{request.title}</p>
                            <p className="mt-1 text-xs text-surface-400">
                              Requested by {requester?.name || 'Unknown user'} on {formatDate(request.createdAt)}
                            </p>
                            {request.description ? (
                              <p className="mt-2 text-sm text-surface-600 dark:text-surface-300">{request.description}</p>
                            ) : null}
                            <p className="mt-2 text-xs text-surface-500">
                              Assignees: {assignees.length ? assignees.map((member) => member.name).join(', ') : 'Not assigned yet'}
                            </p>
                            {request.reviewNote ? <p className="mt-2 text-xs text-surface-500">Note: {request.reviewNote}</p> : null}
                          </div>
                          <span className={cn(
                            'badge text-[10px]',
                            request.requestStatus === 'approved' && 'badge-green',
                            request.requestStatus === 'rejected' && 'badge-rose',
                            request.requestStatus === 'pending' && 'badge-amber'
                          )}>
                            {request.requestStatus}
                          </span>
                        </div>
                        {canReviewTaskRequests && request.requestStatus === 'pending' ? (
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => { void handleReviewTaskRequest(request.id, 'approve'); }} className="btn-primary btn-sm">
                              Approve
                            </button>
                            <button onClick={() => { void handleReviewTaskRequest(request.id, 'reject'); }} className="btn-secondary btn-sm">
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Task Distribution</h3>
              <div className="space-y-3">
                  {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG.todo][]).map(([key, cfg]) => {
                  const count = statusCounts[key];
                    const total = filteredProjectTasks.length || 1;
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

        <TabsContent value="team" className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {members.map(member => {
              const memberTasks = projectTasks.filter(t => t.assigneeIds.includes(member.id));
              const doneTasks = memberTasks.filter(t => t.status === 'done').length;
              const activeTasks = memberTasks.filter(t => t.status !== 'done');
              const isReportingPerson = (project?.reportingPersonIds || []).includes(member.id);
              const progress = memberTasks.length > 0 ? (doneTasks / memberTasks.length) * 100 : 0;
              
              return (
                <div key={member.id} className="card p-5 flex flex-col h-full bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={member.name} avatar={member.avatar} color={member.color} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-display font-bold text-surface-900 dark:text-white">{member.name}</h4>
                          {isReportingPerson && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
                              Lead
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-surface-500">{member.jobTitle || 'Team Member'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-display font-bold text-surface-900 dark:text-white">{Math.round(progress)}%</p>
                      <p className="text-[10px] text-surface-400 font-bold uppercase tracking-tight">Completion</p>
                    </div>
                  </div>

                  <div className="mb-5">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-surface-500 font-medium">Monthly Workload</span>
                      <span className="text-surface-700 dark:text-surface-300 font-bold">{doneTasks} / {memberTasks.length} Tasks</span>
                    </div>
                    <div className="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: member.color || '#3b82f6' }}
                      />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h5 className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-3">Active Tasks ({activeTasks.length})</h5>
                    {activeTasks.length > 0 ? (
                      <div className="space-y-2">
                        {activeTasks.slice(0, 3).map(task => (
                          <div key={task.id} className="group p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-transparent hover:border-surface-200 dark:hover:border-surface-700 transition-all cursor-pointer" onClick={() => openTask(task)}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-xs font-semibold text-surface-800 dark:text-surface-200 truncate flex-1">{task.title}</p>
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                                (STATUS_CONFIG[task.status] || STATUS_CONFIG.todo).bg,
                                (STATUS_CONFIG[task.status] || STATUS_CONFIG.todo).text
                              )}>
                                {(STATUS_CONFIG[task.status] || STATUS_CONFIG.todo).label.split(' ')[0]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-surface-400 font-medium flex items-center gap-1">
                                <Calendar size={10} />
                                {task.dueDate ? formatDate(task.dueDate) : 'No date'}
                              </span>
                              <span className="text-[10px] text-surface-400 font-medium px-1.5 py-0.5 rounded-md bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 shadow-sm">
                                {task.priority.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ))}
                        {activeTasks.length > 3 && (
                          <p className="text-[11px] text-surface-400 text-center font-medium pt-1">
                            + {activeTasks.length - 3} more tasks
                          </p>
                        )}
                      </div>
                    ) : memberTasks.length > 0 ? (
                      <div className="text-center py-5 rounded-xl border border-dashed border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-900/10">
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">All assigned tasks completed</p>
                      </div>
                    ) : (
                      <div className="text-center py-5 rounded-xl border border-dashed border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/20">
                        <p className="text-[11px] text-surface-400 font-medium">No tasks assigned yet</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Detail Modal */}
      <TaskModal
        task={selectedTask}
        open={showTaskModal}
        initialTab={notificationTab}
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTaskId(null);
          if (notificationTaskId) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('taskId');
            nextParams.delete('tab');
            setSearchParams(nextParams, { replace: true });
          }
        }}
      />

      <ProjectTaskCreateModal
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        onSubmit={onCreateTask}
        project={project}
        members={members}
        phases={timelinePhases}
        defaultStatus={defaultStatus}
        submitLabel={canCreateTask ? 'Create Task' : 'Send Request'}
        title={canCreateTask ? 'New Task' : 'Request Task'}
        onCreatePhase={handleCreatePhase}
      />
    </div>
  );
};

export default ProjectDetailPage;
