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
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
      if (priorityFilter !== 'all' && request.priority.toLowerCase() !== priorityFilter) return false;
      if (!query) return true;

      const requesterName = users.find((member) => member.id === request.requestedBy)?.name || '';
      const reviewerNames = users
        .filter((member) => request.requestedToIds?.includes(member.id))
        .map((member) => member.name)
        .join(' ');
      const assigneeNames = users
        .filter((member) => request.assigneeIds?.includes(member.id))
        .map((member) => member.name)
        .join(' ');
      const projectName = projects.find((item) => item.id === request.projectId)?.name || '';

      return [
        request.title,
        request.description || '',
        requesterName,
        reviewerNames,
        assigneeNames,
        projectName,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [isProjectView, projectFilter, priorityFilter, projects, requests, search, users]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = useMemo(() => {
    return filteredRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredRequests, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, projectFilter, priorityFilter, search]);

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
    <div className="max-w-7xl mx-auto space-y-4">
      {isProjectView && (
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-surface-400 transition-colors hover:text-surface-600 dark:hover:text-surface-300 mb-2"
        >
          <ArrowLeft size={14} />
          Back to project
        </Link>
      )}

      {/* 1. Header Toolbar (Search + Combined Filters) */}
      <div className="bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-2xl p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search Box */}
          <div className="relative flex-1 group">
            <ListFilter size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-brand-500 transition-colors" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search task requests by name, requester, project..."
              className="w-full bg-surface-50/50 dark:bg-surface-800/30 border border-surface-100 dark:border-surface-800 focus:border-brand-500/50 focus:bg-white dark:focus:bg-surface-800 rounded-xl pl-11 pr-4 py-2 text-[13px] transition-all focus:outline-none focus:ring-4 focus:ring-brand-500/10 placeholder:text-surface-400 dark:placeholder:text-surface-500 font-medium"
            />
          </div>

          {/* Inline Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Dropdown */}
            <div className="flex items-center bg-surface-50/50 dark:bg-surface-800/30 rounded-xl px-1 border border-surface-100 dark:border-surface-800 focus-within:border-brand-500/50 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as RequestStatusFilter)}
                className="bg-transparent border-none py-2 px-3 text-[13px] font-bold text-surface-600 dark:text-surface-300 focus:ring-0 cursor-pointer hover:text-brand-600 transition-colors outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Project Dropdown */}
            {!isProjectView && (
              <div className="flex items-center bg-surface-50/50 dark:bg-surface-800/30 rounded-xl px-1 border border-surface-100 dark:border-surface-800 focus-within:border-brand-500/50 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all max-w-[200px]">
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="bg-transparent border-none py-2 px-3 text-[13px] font-bold text-surface-600 dark:text-surface-300 focus:ring-0 cursor-pointer hover:text-brand-600 transition-colors truncate outline-none"
                >
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Priority Dropdown */}
            <div className="flex items-center bg-surface-50/50 dark:bg-surface-800/30 rounded-xl px-1 border border-surface-100 dark:border-surface-800 focus-within:border-brand-500/50 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-transparent border-none py-2 px-3 text-[13px] font-bold text-surface-600 dark:text-surface-300 focus:ring-0 cursor-pointer hover:text-brand-600 transition-colors outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Stats Section (MINIMALIST DESIGN) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ['all', 'All Tasks'],
          ['pending', 'Pending'],
          ['approved', 'Approved'],
          ['rejected', 'Rejected'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={cn(
              'group rounded-xl border p-4 text-left transition-all duration-200',
              statusFilter === key
                ? 'border-brand-500 bg-white shadow-sm ring-1 ring-brand-500/10'
                : 'border-surface-100 bg-white dark:border-surface-800 dark:bg-surface-900 hover:border-surface-200 dark:hover:border-surface-700'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.15em] transition-colors",
                  statusFilter === key ? "text-brand-600" : "text-surface-400"
                )}>{label}</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-white leading-none">
                  {summary[key]}
                </p>
              </div>
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                statusFilter === key 
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40" 
                  : "bg-surface-50 dark:bg-surface-800 text-surface-400"
              )}>
                {key === 'all' ? <FolderKanban size={16} /> : key === 'pending' ? <Clock3 size={16} /> : key === 'approved' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              </div>
            </div>
          </button>
        ))}
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
          {paginatedRequests.map((request) => {
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

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredRequests.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
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
    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-100 dark:border-surface-800 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-sm">
      <span className="text-[11px] font-bold uppercase tracking-widest text-surface-400">
        Showing {Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(totalItems, currentPage * itemsPerPage)} of {totalItems}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-xl border border-surface-100 bg-white px-4 py-2 text-[11px] font-bold text-surface-500 transition-colors hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-400 dark:hover:bg-surface-800"
        >
          Prev
        </button>
        {pages.map((page, index) => {
          const prevPage = pages[index - 1];
          const showGap = prevPage && page - prevPage > 1;
          return (
            <React.Fragment key={page}>
              {showGap ? <span className="px-1 text-xs font-bold text-surface-300 dark:text-surface-600">...</span> : null}
              <button
                type="button"
                onClick={() => onPageChange(page)}
                className={cn(
                  'h-9 min-w-9 rounded-xl px-2 text-xs font-bold transition-all',
                  currentPage === page
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20'
                    : 'border border-surface-100 bg-white text-surface-500 hover:bg-surface-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-400 dark:hover:bg-surface-800'
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
          className="rounded-xl border border-surface-100 bg-white px-4 py-2 text-[11px] font-bold text-surface-500 transition-colors hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-400 dark:hover:bg-surface-800"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default TaskRequestsPage;
