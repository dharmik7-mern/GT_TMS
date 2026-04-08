import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Check, CheckCircle2, Clock3, FolderKanban, ListFilter, MoreHorizontal, Plus, User, X, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [selectedRequest, setSelectedRequest] = useState<TaskCreationRequest | null>(null);
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
          <div className="bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-surface-50/50 dark:bg-surface-800/50 text-surface-400 dark:text-surface-500 font-semibold border-b border-surface-100 dark:border-surface-800">
                  <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider min-w-[240px]">Task Name</th>
                    <th className="px-4 py-4 font-bold uppercase tracking-wider text-center">Status</th>
                    <th className="px-4 py-4 font-bold uppercase tracking-wider text-center">Priority</th>
                    <th className="px-4 py-4 font-bold uppercase tracking-wider text-center">Due Date</th>
                    <th className="px-4 py-4 font-bold uppercase tracking-wider">Requested By</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800/70">
                  {paginatedRequests.map((request) => {
                    const linkedProject = projects.find((item) => item.id === request.projectId);
                    const requester = users.find((u) => u.id === request.requestedBy);
                    const meta = REQUEST_STATUS_META[request.requestStatus];
                    const StatusIcon = meta.icon;
                    const canReview = canReviewRequest(request);
                    const isProcessing = processingRequestId === request.id;

                    return (
                      <tr 
                        key={request.id} 
                        className="group hover:bg-surface-50/50 dark:hover:bg-surface-800/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedRequest(request)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[13px] font-bold text-surface-900 dark:text-white group-hover:text-brand-600 transition-colors truncate max-w-[300px]">
                              {request.title}
                            </span>
                            <div className="flex items-center gap-2">
                              {!isProjectView && linkedProject && (
                                <span className="text-[10px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded font-black tracking-widest uppercase truncate max-w-[120px]">
                                  {linkedProject.name}
                                </span>
                              )}
                              <span className="text-[10px] text-surface-400 dark:text-surface-500 font-medium">
                                Created {formatDate(request.createdAt)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center">
                            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border border-transparent', meta.badge)}>
                              <StatusIcon size={12} />
                              {meta.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center">
                            <span className={cn(
                              'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border border-transparent',
                              request.priority === 'urgent' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/30' :
                              request.priority === 'high' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/30' :
                              request.priority === 'medium' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/30' :
                              'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30'
                            )}>
                              {request.priority}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-[11px] font-bold text-surface-600 dark:text-surface-400">
                            {request.dueDate ? formatDate(request.dueDate) : '---'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={requester?.name || 'User'} color={requester?.color} size="xs" />
                            <span className="text-[11px] font-bold text-surface-700 dark:text-surface-300 truncate max-w-[100px]">
                              {requester?.name || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {request.requestStatus === 'pending' && canReview ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleReview(request.id, 'approve');
                                  }}
                                  disabled={isProcessing}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                                  title="Approve"
                                >
                                  {isProcessing ? <Clock3 size={14} className="animate-spin" /> : <Check size={14} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleReview(request.id, 'reject');
                                  }}
                                  disabled={isProcessing}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                                  title="Reject"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : request.createdTaskId ? (
                              <Link 
                                to="/tasks" 
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white transition-all"
                                title="Open Task"
                              >
                                <Plus size={14} />
                              </Link>
                            ) : (
                              <div className="w-8 h-8 flex items-center justify-center text-surface-300">
                                <MoreHorizontal size={14} />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredRequests.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Request Detail Overlay */}
      <AnimatePresence>
        {selectedRequest && (
          <RequestDetailOverlay
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
            onReview={handleReview}
            isProcessing={processingRequestId === selectedRequest.id}
            canReview={canReviewRequest(selectedRequest)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const RequestDetailOverlay: React.FC<{
  request: TaskCreationRequest;
  onClose: () => void;
  onReview: (id: string, action: 'approve' | 'reject') => Promise<void>;
  isProcessing: boolean;
  canReview: boolean;
}> = ({ request, onClose, onReview, isProcessing, canReview }) => {
  const { users, projects } = useAppStore();
  const linkedProject = projects.find((p) => p.id === request.projectId);
  const requester = users.find((m) => m.id === request.requestedBy);
  const reviewers = users.filter((m) => request.requestedToIds.includes(m.id));
  const assignees = users.filter((m) => request.assigneeIds.includes(m.id));
  const meta = REQUEST_STATUS_META[request.requestStatus];
  const StatusIcon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-[2px] md:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        className="h-[92vh] w-full max-w-[650px] rounded-t-[1.5rem] bg-white shadow-2xl flex flex-col md:h-full md:rounded-none dark:bg-surface-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-2 text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest">
            <span>{linkedProject?.name || 'Project'}</span>
            <span>/</span>
            <span className="text-surface-500">Task Request</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors text-surface-400">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn('badge text-[10px] font-bold uppercase tracking-wider', meta.badge)}>
                <StatusIcon size={12} />
                {meta.label}
              </span>
              <span className="badge badge-blue text-[10px] font-bold uppercase tracking-wider">
                {request.priority}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-white leading-tight">
              {request.title}
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 pt-4 border-t border-surface-100 dark:border-surface-800">
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Requested By</p>
              <div className="flex items-center gap-3">
                <UserAvatar name={requester?.name || 'Unknown'} color={requester?.color} size="sm" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-surface-900 dark:text-white">{requester?.name || 'Unknown'}</span>
                  <span className="text-xs text-surface-400">{requester?.email}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Assignees</p>
              <div className="flex -space-x-2">
                {assignees.map((a) => (
                  <UserAvatar key={a.id} name={a.name} color={a.color} size="sm" className="border-2 border-white dark:border-surface-900" />
                ))}
                {!assignees.length && <span className="text-sm text-surface-400">No assignee selected</span>}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Timeline</p>
              <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300 font-bold">
                <Calendar size={14} className="text-surface-400" />
                <span>{request.startDate ? formatDate(request.startDate) : '---'}</span>
                <span className="text-surface-300">to</span>
                <span>{request.dueDate ? formatDate(request.dueDate) : '---'}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Status Info</p>
              <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300 font-bold">
                <Clock3 size={14} className="text-surface-400" />
                <span>Created on {formatDate(request.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Description</p>
            <div className="prose prose-sm dark:prose-invert max-w-none bg-surface-50 dark:bg-surface-800/40 p-5 rounded-2xl border border-surface-100 dark:border-surface-800">
              {request.description ? (
                <p className="whitespace-pre-wrap text-surface-700 dark:text-surface-300 leading-relaxed font-medium">
                  {request.description}
                </p>
              ) : (
                <p className="italic text-surface-400">No description provided for this request.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Reviewers</p>
            <div className="flex flex-wrap gap-2">
              {reviewers.map((r) => (
                <div key={r.id} className="flex items-center gap-2 bg-surface-50 dark:bg-surface-800 px-3 py-1.5 rounded-full border border-surface-100 dark:border-surface-700">
                  <UserAvatar name={r.name} color={r.color} size="xs" />
                  <span className="text-xs font-bold text-surface-600 dark:text-surface-300">{r.name}</span>
                </div>
              ))}
            </div>
          </div>

          {request.reviewNote && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-400">Review History</p>
              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 p-5 rounded-2xl">
                <div className="flex items-start gap-3">
                  <Clock3 size={16} className="mt-1 text-amber-500" />
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Rejection Note</p>
                    <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-300/80 italic leading-relaxed">"{request.reviewNote}"</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {request.requestStatus === 'pending' && canReview && (
          <div className="p-8 border-t border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30 flex gap-4">
            <button
              onClick={() => onReview(request.id, 'approve')}
              disabled={isProcessing}
              className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white h-12 rounded-xl font-bold transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2"
            >
              {isProcessing ? <Clock3 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Approve Request
            </button>
            <button
              onClick={() => onReview(request.id, 'reject')}
              disabled={isProcessing}
              className="flex-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 h-12 rounded-xl font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center justify-center gap-2"
            >
              <XCircle size={18} />
              Reject Request
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
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
