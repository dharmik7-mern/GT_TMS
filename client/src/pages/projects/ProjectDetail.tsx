import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, List, BarChart3, Settings2, Plus, ListTodo,
  ArrowLeft, Edit3, Calendar, Flag, Users, ChevronDown, Clock, Activity
} from 'lucide-react';
import { cn, formatDate, getProgressColor } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { KanbanBoard, type KanbanBoardHandle } from '../../components/KanbanBoard';
import { TaskModal } from '../../components/TaskModal';
import { TaskCompletionModal } from '../../components/TaskModal/TaskCompletionModal';
import { TaskCard } from '../../components/TaskCard';
import { UserAvatar, AvatarGroup } from '../../components/UserAvatar';
import { ProgressBar, EmptyState, Tabs, TabsContent } from '../../components/ui';
import type { Task, TaskStatus, TimelinePhase, TaskCreationRequest, Priority, ProjectSdlcPhase } from '../../app/types';
import { projectsService, tasksService, timelineService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';
import { ProjectTimelineModule } from '../../components/ProjectTimelineModule';
import { Modal } from '../../components/Modal';
import { ProjectTaskCreateModal, type ProjectTaskCreateValues } from '../../components/ProjectTaskCreateModal';
import { HighDensityTaskList } from '../../components/HighDensityTaskList';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, tasks, users, workspaces, addTask, updateProject, bootstrap } = useAppStore();
  const { user } = useAuthStore();
  const [activeView, setActiveView] = useState('kanban');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const kanbanRef = useRef<KanbanBoardHandle>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [editingName, setEditingName] = useState(false);
  const [timelinePhases, setTimelinePhases] = useState<TimelinePhase[]>([]);
  const [taskRequests, setTaskRequests] = useState<TaskCreationRequest[]>([]);
  const [loadingTaskRequests, setLoadingTaskRequests] = useState(false);
  const [isRequestsCollapsed, setIsRequestsCollapsed] = useState(false);
  const [isSdlcEditorOpen, setIsSdlcEditorOpen] = useState(false);
  const [editingSdlcPlan, setEditingSdlcPlan] = useState<ProjectSdlcPhase[]>([]);
  const [isSavingSdlc, setIsSavingSdlc] = useState(false);
  const [completionModal, setCompletionModal] = useState<{ open: boolean; taskId: string; title: string } | null>(null);
  const notificationTaskId = searchParams.get('taskId');

  const project = projects.find(p => p.id === id);
  const workspacePermissions = workspaces[0]?.settings?.permissions || {};
  const canEditOtherProjects = Boolean(workspacePermissions?.editOtherProjects?.[user?.role || 'team_member']);
  const projectTasks = tasks.filter(t => {
    const pid = typeof t.projectId === 'string' ? t.projectId : (t.projectId as any)?._id || (t.projectId as any)?.id;
    return String(pid) === String(id);
  });
  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;
  const members = users.filter(u => project?.members.includes(u.id) && !['super_admin', 'admin'].includes(u.role));
  const canCreateTask = user?.role !== 'team_member' || (project?.reportingPersonIds || []).includes(user?.id);
  const canEditProject = user?.role !== 'team_member' || canEditOtherProjects;
  const canRequestTask = Boolean(user?.id && project?.members.includes(user.id) && !canCreateTask);
  const canReviewTaskRequests = Boolean(
    user?.id &&
    ((project?.reportingPersonIds || []).includes(user.id) || ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || ''))
  );
  const isAdmin = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
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
    const fetchProjectTasks = async () => {
      try {
        const res = await tasksService.getAll({ projectId: project.id, limit: 1000 });
        const items = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
        if (items.length > 0) {
          useAppStore.getState().mergeTasks(items);
        }
      } catch (err) {
        console.error('[ProjectDetail] Failed to fetch project tasks:', err);
      }
    };
    void fetchProjectTasks();
  }, [project?.id]);

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

  const handleSdlcUpdate = async () => {
    if (!project) return;
    try {
      setIsSavingSdlc(true);
      await projectsService.update(project.id, { sdlcPlan: editingSdlcPlan });
      emitSuccessToast('Delivery plan updated successfully', 'Project');
      setIsSdlcEditorOpen(false);
    } catch (error: any) {
      emitErrorToast(error?.response?.data?.message || 'Failed to update delivery plan', 'Project');
    } finally {
      setIsSavingSdlc(false);
    }
  };

  const handleAddSdlcPhase = () => {
    setEditingSdlcPlan([...editingSdlcPlan, { name: '', durationDays: 1 }]);
  };

  const handleRemoveSdlcPhase = (index: number) => {
    setEditingSdlcPlan(editingSdlcPlan.filter((_, i) => i !== index));
  };

  const updateSdlcPhase = (index: number, field: keyof ProjectSdlcPhase, value: any) => {
    const next = [...editingSdlcPlan];
    next[index] = { ...next[index], [field]: value };
    setEditingSdlcPlan(next);
  };

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
      const task = projectTasks.find(t => t.id === taskId);
      
      // If user is moving to 'done' and is NOT a manager, intercept with popup
      if (status === 'done' && !isAdmin && task) {
        setCompletionModal({ open: true, taskId, title: task.title });
        return;
      }

      await tasksService.update(taskId, { status });
      await bootstrap(); 
    } catch (error: any) {
      if (error?.config?.suppressErrorToast) return;
      const message = error?.response?.data?.error?.message || error?.response?.data?.message || 'Movement failed';
      emitErrorToast(message, 'Board sync error');
    }
  };

  const handleCompletionSubmit = async (remark: string, files: File[]) => {
    if (!completionModal) return;
    try {
      const response = await tasksService.update(completionModal.taskId, { 
        status: 'in_review', 
        completionRemark: remark 
      });
      
      if (files.length > 0) {
        await tasksService.uploadAttachments(completionModal.taskId, files);
      }

      await bootstrap();
      emitSuccessToast('Task submitted for review.', 'Review Pending');
    } catch (error: any) {
       const message = error?.response?.data?.error?.message || error?.response?.data?.message || 'Submission failed';
       emitErrorToast(message, 'Review Request');
       throw error;
    }
  };

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, key) => {
    acc[key as TaskStatus] = filteredProjectTasks.filter(t => t.status === key).length;
    return acc;
  }, {} as Record<TaskStatus, number>);

  const TAB_ITEMS = [
    { value: 'kanban', label: 'Board', icon: <LayoutDashboard size={14} /> },
    { value: 'list', label: 'Activity', icon: <Activity size={14} /> },
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
      <Tabs 
        value={activeView} 
        onValueChange={setActiveView} 
        items={TAB_ITEMS} 
        variant="underline"
        actions={activeView === 'kanban' && canCreateTask ? (
          <button 
            type="button" 
            onClick={() => kanbanRef.current?.addProcessStep()}
            className="btn-secondary btn-sm h-8 px-3 gap-1.5"
          >
            <Plus size={14} className="text-brand-600" />
            <span className="font-semibold text-[11px]">Add Step</span>
          </button>
        ) : null}
      >
        <TabsContent value="kanban" className="pt-4">
          <KanbanBoard 
            ref={kanbanRef}
            projectId={project.id} 
            tasksOverride={filteredProjectTasks}
            onOpenTask={openTask} 
            onAddTask={canCreateTask || canRequestTask ? handleAddTask : undefined} 
            onDeleteTask={canCreateTask ? handleDeleteTask : undefined} 
            onMoveTaskRemote={handleMoveTaskRemote}
            hideHeader
          />
        </TabsContent>

        <TabsContent value="list" className="pt-4">
          <div className="space-y-2">
            <HighDensityTaskList
               projectId={project.id}
               categoryId={selectedCategoryId}
               onOpenTask={openTask}
            />
          </div>
        </TabsContent>
        <TabsContent value="timeline" className="pt-4">
          <ProjectTimelineModule projectId={project.id} />
        </TabsContent>


        <TabsContent value="overview" className="pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 md:col-span-3">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display font-semibold text-surface-900 dark:text-white">Task Requests</h3>
                    <p className="text-xs text-surface-400">
                      {canReviewTaskRequests ? 'Review requested tasks before they are created.' : 'Track task requests raised for this project.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsRequestsCollapsed(!isRequestsCollapsed)} 
                      className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                      title={isRequestsCollapsed ? 'Expand' : 'Collapse'}
                    >
                      <ChevronDown size={18} className={cn("transition-transform duration-200", isRequestsCollapsed && "-rotate-90")} />
                    </button>
                    <Link to={`/projects/${project.id}/requests`} className="text-xs font-medium text-brand-600 dark:text-brand-400">
                      Open full page
                    </Link>
                    {loadingTaskRequests ? <span className="text-xs text-surface-400">Loading...</span> : null}
                  </div>
                </div>
              {!isRequestsCollapsed && (
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
              )}
            </div>
            <div className="card p-4">
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

            <div className="card p-4">
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

            <div className="card p-4">
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

            <div className="card p-4">
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

            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-surface-900 dark:text-white">Delivery Planning</h3>
                {user?.role !== 'team_member' && (
                  <button 
                    onClick={() => {
                      setEditingSdlcPlan(project.sdlcPlan || []);
                      setIsSdlcEditorOpen(true);
                    }}
                    className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors text-surface-400 hover:text-brand-600"
                    title="Configure Delivery Plan"
                  >
                    <Settings2 size={16} />
                  </button>
                )}
              </div>
              {project.sdlcPlan && project.sdlcPlan.length > 0 ? (
                <div className="space-y-3">
                  {project.sdlcPlan.map((phase, idx) => (
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

            <div className="card p-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {members.map(member => {
              const memberTasks = projectTasks.filter(t => t.assigneeIds.includes(member.id));
              const doneTasks = memberTasks.filter(t => t.status === 'done').length;
              const activeTasks = memberTasks.filter(t => t.status !== 'done');
              const isReportingPerson = (project?.reportingPersonIds || []).includes(member.id);
              const progress = memberTasks.length > 0 ? (doneTasks / memberTasks.length) * 100 : 0;
              
              return (
                <div key={member.id} className="card p-3 flex flex-col items-center text-center bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                  <div className="relative mb-3">
                    <UserAvatar name={member.name} avatar={member.avatar} color={member.color} size="lg" />
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-surface-800 rounded-full px-1.5 py-0.5 shadow-sm border border-surface-100 dark:border-surface-700">
                      <p className="text-[9px] font-black text-brand-600 dark:text-brand-400">{Math.round(progress)}%</p>
                    </div>
                  </div>
                  
                  <div className="w-full mb-3">
                    <h4 className="font-display font-bold text-sm text-surface-900 dark:text-white truncate">{member.name}</h4>
                    <p className="text-[10px] text-surface-400 truncate mt-0.5 font-medium">{member.jobTitle || 'Team Member'}</p>
                  </div>

                  <div className="w-full space-y-2.5">
                    <div className="flex flex-col gap-1">
                       <div className="flex justify-between items-center text-[9px] font-bold text-surface-400 uppercase tracking-tighter">
                         <span>Workload</span>
                         <span className="text-surface-600 dark:text-surface-300">{doneTasks}/{memberTasks.length}</span>
                       </div>
                       <div className="h-1 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                         <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: member.color || '#3b82f6' }} />
                       </div>
                    </div>

                    <div className="pt-2 border-t border-surface-50 dark:border-surface-800/50">
                       <p className="text-[9px] font-bold text-surface-400 uppercase tracking-tighter text-left mb-1.5 flex justify-between">
                         <span>Active Tasks</span>
                         <span className="text-brand-500">{activeTasks.length}</span>
                       </p>
                       <div className="flex flex-wrap gap-1 justify-start">
                         {activeTasks.slice(0, 3).map(task => (
                           <div key={task.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: (STATUS_CONFIG[task.status] || STATUS_CONFIG.todo).color }} title={task.title} />
                         ))}
                         {activeTasks.length > 3 && <span className="text-[8px] text-surface-400">+{activeTasks.length - 3}</span>}
                         {activeTasks.length === 0 && <span className="text-[9px] text-surface-300 italic">Idle</span>}
                       </div>
                    </div>
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
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTaskId(null);
          if (notificationTaskId) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('taskId');
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

      {completionModal && (
        <TaskCompletionModal
          open={completionModal.open}
          onClose={() => setCompletionModal(null)}
          onSubmit={handleCompletionSubmit}
          taskTitle={completionModal.title}
        />
      )}

      <Modal
        open={isSdlcEditorOpen}
        onClose={() => setIsSdlcEditorOpen(false)}
        title="Customize Delivery Plan"
        description="Define the phases and duration for this project's lifecycle."
        size="lg"
      >
        <div className="p-6">
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {editingSdlcPlan.map((phase, idx) => (
              <div key={idx} className="flex items-end gap-3 p-4 rounded-2xl bg-surface-50 dark:bg-surface-900/50 border border-surface-100 dark:border-surface-800">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Phase Name</label>
                  <input 
                    type="text" 
                    value={phase.name} 
                    onChange={(e) => updateSdlcPhase(idx, 'name', e.target.value)}
                    placeholder="e.g. Design, Testing..."
                    className="w-full h-10 rounded-xl border border-surface-200 bg-white px-3 text-sm focus:ring-2 focus:ring-brand-500/20 dark:border-surface-800 dark:bg-surface-950"
                  />
                </div>
                <div className="w-32 space-y-1.5">
                  <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Duration (days)</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={phase.durationDays} 
                    onChange={(e) => updateSdlcPhase(idx, 'durationDays', parseInt(e.target.value) || 0)}
                    className="w-full h-10 rounded-xl border border-surface-200 bg-white px-3 text-sm focus:ring-2 focus:ring-brand-500/20 dark:border-surface-800 dark:bg-surface-950"
                  />
                </div>
                <button 
                  onClick={() => handleRemoveSdlcPhase(idx)}
                  className="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <Plus size={18} className="rotate-45" />
                </button>
              </div>
            ))}

            <button 
              onClick={handleAddSdlcPhase}
              className="w-full py-3 border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-2xl text-surface-400 hover:text-brand-600 hover:border-brand-300 dark:hover:border-surface-700 transition-all flex items-center justify-center gap-2 group"
            >
              <Plus size={18} className="group-hover:scale-110 transition-transform" />
              <span className="text-sm font-semibold">Add New Phase</span>
            </button>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <button 
              onClick={() => setIsSdlcEditorOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              onClick={handleSdlcUpdate}
              disabled={isSavingSdlc}
              className="btn-primary"
            >
              {isSavingSdlc ? 'Saving Changes...' : 'Save Plan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectDetailPage;
