import React, { useEffect, useState } from 'react';
import { extensionRequestsService } from '../services/api';
import { useAppStore } from '../context/appStore';
import { UserAvatar } from './UserAvatar';
import { Check, X, Calendar, AlertTriangle } from 'lucide-react';
import { emitSuccessToast } from '../context/toastBus';
import { formatRelativeTime, formatDate } from '../utils/helpers';
import type { ExtensionRequest } from '../app/types';

import { useNavigate } from 'react-router-dom';

export const ExtensionRequestsPanel: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ExtensionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { users, bootstrap } = useAppStore();

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await extensionRequestsService.getAll();
      // Only pending requests in this panel for now
      setRequests((res.data.data ?? res.data).filter((r: ExtensionRequest) => r.status === 'pending'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (id: string, approve: boolean) => {
    try {
      if (approve) {
        const comment = window.prompt('Approval comment (optional):');
        await extensionRequestsService.approve(id, comment || undefined);
        emitSuccessToast('Extension request approved.', 'Success');
      } else {
        const comment = window.prompt('Reason for rejection (mandatory):');
        if (!comment) {
           alert('Rejection reason is mandatory.');
           return;
        }
        await extensionRequestsService.reject(id, comment);
        emitSuccessToast('Extension request rejected.', 'Rejected');
      }
      bootstrap();
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && requests.length === 0) return null;
  if (requests.length === 0) return null;

  return (
    <div className="card overflow-hidden flex flex-col">
      <div 
        onClick={() => navigate('/task-requests?type=extension')}
        className="bg-brand-50 dark:bg-brand-950/20 px-5 py-3 border-b border-brand-100 dark:border-brand-900/40 flex items-center justify-between flex-shrink-0 cursor-pointer hover:bg-brand-100/50 dark:hover:bg-brand-900/10 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-brand-600 transition-transform group-hover:scale-110" />
          <h3 className="text-xs font-bold text-brand-800 dark:text-brand-400 uppercase tracking-widest">
            Due Date Extensions
          </h3>
        </div>
        <span className="bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {requests.length} Pending
        </span>
      </div>
      <div className="divide-y divide-surface-100 dark:divide-surface-800 overflow-y-auto flex-1">
        {requests.map((req) => {
          const requester = typeof req.userId === 'object' ? req.userId as any : users.find(u => u.id === req.userId);
          const taskCount = req.taskIds.length;
          const firstTaskName = req.tasks && req.tasks[0] ? req.tasks[0].title : 'Tasks';

          return (
            <div key={req._id || req.id} className="p-4 bg-white dark:bg-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors border-b border-surface-50 dark:border-surface-800 last:border-0">
              <div className="flex gap-3">
                {/* Requester Avatar */}
                <div className="flex-shrink-0 pt-0.5">
                  <UserAvatar 
                    name={requester?.name || 'U'} 
                    avatar={requester?.avatar} 
                    size="sm" 
                    color={requester?.color}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header Row: Name & Actions */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-surface-900 dark:text-surface-100 uppercase tracking-wide truncate">
                        {requester?.name || 'Someone'}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-surface-400 bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded leading-none uppercase tracking-tighter">Request</span>
                        <span className="text-[10px] text-surface-400">{formatRelativeTime(req.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button 
                        onClick={() => handleAction(req._id || req.id, true)}
                        className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all active:scale-90"
                        title="Approve Extension"
                      >
                        <Check size={14} strokeWidth={2.5} />
                      </button>
                      <button 
                        onClick={() => handleAction(req._id || req.id, false)}
                        className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                        title="Reject Request"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {/* Task Info */}
                  <h4 className="text-xs font-bold text-surface-800 dark:text-surface-200 mb-2 leading-tight">
                    {taskCount > 1 ? `${firstTaskName} + ${taskCount - 1} more` : firstTaskName}
                  </h4>

                  {/* Extension Detail Badge */}
                  <div className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-900/20 rounded-lg p-2 mb-2">
                    <div className="flex items-center gap-2">
                       <div className="w-5 h-5 rounded-md bg-rose-500 flex items-center justify-center flex-shrink-0">
                         <Calendar size={10} className="text-white" />
                       </div>
                       <div className="min-w-0">
                         <p className="text-[9px] uppercase font-bold text-rose-500/80 leading-none mb-0.5">Extension To</p>
                         <p className="text-xs font-bold text-rose-700 dark:text-rose-300 leading-none">
                           {formatDate(req.requestedDueDate, 'MMM d, yyyy')}
                         </p>
                       </div>
                    </div>
                  </div>

                  {/* Reason Quote */}
                  {req.reason && (
                    <div className="relative pl-3 py-1 bg-surface-50/50 dark:bg-surface-800/20 rounded-r-md border-l-2 border-brand-500/30">
                      <p className="text-[11px] italic text-surface-500 dark:text-surface-400 line-clamp-3 leading-relaxed">
                        "{req.reason}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
