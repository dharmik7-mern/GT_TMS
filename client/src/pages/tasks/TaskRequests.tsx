import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, FolderKanban, ListFilter, XCircle } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { UserAvatar } from '../../components/UserAvatar';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';
import type { TaskCreationRequest } from '../../app/types';
import { cn, formatDate } from '../../utils/helpers';
import { tasksService } from '../../services/api';

type RequestStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const REQUEST_STATUS_META = {
  pending: {
    label: 'Pending',
    badge: 'badge-amber',
    icon: Clock3,
  },
  approved: {
    label: 'Approved',
    badge: 'badge-green',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    badge: 'badge-rose',
    icon: XCircle,
  },
} as const;

const TaskRequestsPage: React.FC = () => {
  const { id: projectId } = useParams<{ id?: string }>();
  const { projects, users, bootstrap } = useAppStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<TaskCreationRequest[]>([]);
  const [allRequests, setAllRequests] = useState<TaskCreationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const isProjectView = Boolean(projectId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const response = await tasksService.getRequests({
          ...(projectId ? { projectId } : {}),
        });
        const rows = response.data?.data ?? response.data ?? [];
        if (!cancelled) {
          setAllRequests(rows);
        }
      } catch (error: any) {
        if (!cancelled) {
          setAllRequests([]);
          setRequests([]);
        }
        emitErrorToast(
          error?.response?.data?.error?.message ||
            error?.response?.data?.message ||
            'Task requests could not be loaded.',
          'Task Requests'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    setRequests(
      statusFilter === 'all'
        ? allRequests
        : allRequests.filter((request) => request.requestStatus === statusFilter)
    );
  }, [allRequests, statusFilter]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) => {
      if (!isProjectView && projectFilter !== 'all' && request.projectId !== projectFilter) return false;
      if (!query) return true;
      const requester = users.find((member) => member.id === request.requestedBy);
      const projectName = projects.find((item) => item.id === request.projectId)?.name || '';
      const assigneeNames = users
        .filter((member) => request.assigneeIds.includes(member.id))
        .map((member) => member.name)
        .join(' ');
      return [
        request.title,
        request.description || '',
        requester?.name || '',
        projectName,
        assigneeNames,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [isProjectView, projectFilter, projects, requests, search, users]);

  const summary = useMemo(
    () => ({
      all: allRequests.length,
      pending: allRequests.filter((request) => request.requestStatus === 'pending').length,
      approved: allRequests.filter((request) => request.requestStatus === 'approved').length,
      rejected: allRequests.filter((request) => request.requestStatus === 'rejected').length,
    }),
    [allRequests]
  );

  const handleReview = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      setProcessingRequestId(requestId);
      const reviewNote = action === 'reject' ? window.prompt('Add rejection note (optional):') || '' : '';
      const response = await tasksService.reviewRequest(requestId, { action, reviewNote });
      const result = response.data?.data ?? response.data;
      if (result?.request) {
        setAllRequests((prev) => prev.map((request) => (request.id === requestId ? result.request : request)));
      }
      await bootstrap();
      emitSuccessToast(
        action === 'approve' ? 'Task request approved and created successfully.' : 'Task request rejected successfully.',
        action === 'approve' ? 'Request Approved' : 'Request Rejected'
      );
    } catch (error: any) {
      emitErrorToast(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          'Task request action failed.',
        'Task Requests'
      );
    } finally {
      setProcessingRequestId(null);
    }
  };

  const canReviewRequest = (request: TaskCreationRequest) => {
    const privileged = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
    return privileged || request.requestedToIds.includes(user?.id || '');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          {isProjectView ? (
            <Link
              to={`/projects/${projectId}`}
              className="inline-flex items-center gap-1 text-sm text-surface-400 transition-colors hover:text-surface-600 dark:hover:text-surface-300"
            >
              <ArrowLeft size={14} />
              Back to project
            </Link>
          ) : null}
          {['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '') ? (
            <button
              type="button"
              onClick={() => navigate('/logs?module=task_request')}
              className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 self-start"
            >
              Open task request activity logs
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ['all', 'All'],
            ['pending', 'Pending'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={cn(
                'rounded-2xl border px-4 py-3 text-left transition-colors',
                statusFilter === key
                  ? 'border-brand-200 bg-brand-50 dark:border-brand-900/50 dark:bg-brand-950/20'
                  : 'border-surface-100 bg-white dark:border-surface-800 dark:bg-surface-900'
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">{label}</p>
              <p className="mt-1 text-2xl font-display font-bold text-surface-900 dark:text-white">
                {summary[key]}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requests by task, project, requester, or assignee..."
              className="input pl-11"
            />
            <ListFilter size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
          </div>
          {!isProjectView ? (
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="input min-w-[240px]"
            >
              <option value="all">All projects</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm text-surface-400">Loading task requests...</div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={28} />}
          title="No task requests found"
          description={
            isProjectView
              ? 'This project does not have any matching task creation requests yet.'
              : 'No task creation requests matched the current filters.'
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const requester = users.find((member) => member.id === request.requestedBy);
            const reviewers = users.filter((member) => request.requestedToIds.includes(member.id));
            const assignees = users.filter((member) => request.assigneeIds.includes(member.id));
            const linkedProject = projects.find((item) => item.id === request.projectId);
            const meta = REQUEST_STATUS_META[request.requestStatus];
            const StatusIcon = meta.icon;
            return (
              <div key={request.id} className="card p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('badge text-[10px]', meta.badge)}>
                        <StatusIcon size={12} />
                        {meta.label}
                      </span>
                      <span className="badge badge-blue text-[10px]">{request.priority}</span>
                      {!isProjectView ? (
                        <Link
                          to={`/projects/${request.projectId}/requests`}
                          className="rounded-full border border-surface-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-surface-500 transition-colors hover:border-brand-200 hover:text-brand-600 dark:border-surface-700 dark:text-surface-300 dark:hover:border-brand-800 dark:hover:text-brand-400"
                        >
                          {linkedProject?.name || 'Project'}
                        </Link>
                      ) : null}
                    </div>

                    <div>
                      <h3 className="text-lg font-display font-semibold text-surface-900 dark:text-white">
                        {request.title}
                      </h3>
                      {request.description ? (
                        <p className="mt-1 text-sm leading-6 text-surface-500 dark:text-surface-400">{request.description}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 text-sm text-surface-500 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-400">Requested By</p>
                        <div className="mt-2 flex items-center gap-2">
                          <UserAvatar name={requester?.name || 'Unknown'} color={requester?.color} size="xs" />
                          <span>{requester?.name || 'Unknown user'}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-400">Reviewers</p>
                        <p className="mt-2">{reviewers.length ? reviewers.map((member) => member.name).join(', ') : 'Not assigned'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-400">Assignees</p>
                        <p className="mt-2">{assignees.length ? assignees.map((member) => member.name).join(', ') : 'No assignee selected'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-400">Timeline</p>
                        <p className="mt-2">
                          {request.startDate ? formatDate(request.startDate) : 'Not set'} to {request.dueDate ? formatDate(request.dueDate) : 'Not set'}
                        </p>
                      </div>
                    </div>

                    {request.reviewNote ? (
                      <div className="rounded-2xl bg-surface-50 px-4 py-3 text-sm text-surface-600 dark:bg-surface-800/70 dark:text-surface-300">
                        <span className="font-medium text-surface-800 dark:text-surface-100">Review note:</span> {request.reviewNote}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex min-w-[220px] flex-col gap-3 xl:items-end">
                    <div className="text-sm text-surface-500 xl:text-right">
                      <p>Created {formatDate(request.createdAt)}</p>
                      {request.reviewedAt ? <p className="mt-1">Reviewed {formatDate(request.reviewedAt)}</p> : null}
                    </div>

                    {request.createdTaskId ? (
                      <Link to={`/tasks`} className="btn-secondary btn-sm">
                        Open tasks
                      </Link>
                    ) : null}

                    {request.requestStatus === 'pending' && canReviewRequest(request) ? (
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            void handleReview(request.id, 'approve');
                          }}
                          disabled={processingRequestId === request.id}
                          className="btn-primary btn-sm"
                        >
                          {processingRequestId === request.id ? 'Working...' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleReview(request.id, 'reject');
                          }}
                          disabled={processingRequestId === request.id}
                          className="btn-secondary btn-sm"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TaskRequestsPage;
