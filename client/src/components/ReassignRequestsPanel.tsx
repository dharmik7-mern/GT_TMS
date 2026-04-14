import React, { useEffect, useState } from 'react';
import { reassignService } from '../services/api';
import { useAppStore } from '../context/appStore';
import { UserAvatar } from './UserAvatar';
import { Check, X, Clock } from 'lucide-react';
import { emitSuccessToast } from '../context/toastBus';
import { formatRelativeTime } from '../utils/helpers';

import { useNavigate } from 'react-router-dom';

export const ReassignRequestsPanel: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { users, tasks, bootstrap } = useAppStore();

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await reassignService.getAll();
      setRequests(res.data.data);
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
        await reassignService.approve(id);
        emitSuccessToast('Reassignment request approved.', 'Success');
      } else {
        const note = window.prompt('Reason for rejection (optional):');
        await reassignService.reject(id, note || undefined);
        emitSuccessToast('Reassignment request rejected.', 'Rejected');
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
        onClick={() => navigate('/task-requests')}
        className="bg-amber-50 dark:bg-amber-950/20 px-5 py-3 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between flex-shrink-0 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/10 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-600 transition-transform group-hover:scale-110" />
          <h3 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-widest">
            Reassign Requests
          </h3>
        </div>
        <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {requests.length} Pending
        </span>
      </div>
      <div className="divide-y divide-surface-100 dark:divide-surface-800 overflow-y-auto flex-1">
        {requests.map((req) => {
          const requester = users.find(u => u.id === req.requestedBy);
          const current = users.find(u => u.id === req.currentAssigneeId);
          const target = users.find(u => u.id === req.requestedAssigneeId);
          const task = tasks.find(t => t.id === req.taskId);

          return (
            <div key={req.id} className="p-4 bg-white dark:bg-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors border-b border-surface-50 dark:border-surface-800 last:border-0">
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
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded leading-none uppercase tracking-tighter">Reassign</span>
                        <span className="text-[10px] text-surface-400">{formatRelativeTime(req.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button 
                        onClick={() => handleAction(req.id, true)}
                        className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all active:scale-90"
                        title="Approve Reassignment"
                      >
                        <Check size={14} strokeWidth={2.5} />
                      </button>
                      <button 
                        onClick={() => handleAction(req.id, false)}
                        className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                        title="Reject Request"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {/* Task Info */}
                  <h4 className="text-xs font-bold text-surface-800 dark:text-surface-200 mb-2 leading-tight">
                    {task?.title || req.taskId?.title || 'Unknown Task'}
                  </h4>

                  {/* Swap Detail Badge */}
                  <div className="bg-surface-50 dark:bg-surface-800/50 border border-surface-100 dark:border-surface-700/50 rounded-lg p-2 mb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserAvatar name={current?.name || ''} color={current?.color} size="xs" />
                        <span className="text-[10px] text-surface-500 truncate">{current?.name?.split(' ')[0]}</span>
                      </div>
                      <div className="text-surface-300 text-[10px] font-bold">→</div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserAvatar name={target?.name || ''} color={target?.color} size="xs" />
                        <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 truncate">{target?.name?.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reason Quote */}
                  {req.note && (
                    <div className="relative pl-3 py-1 bg-surface-50/50 dark:bg-surface-800/20 rounded-r-md border-l-2 border-amber-500/30">
                      <p className="text-[11px] italic text-surface-500 dark:text-surface-400 line-clamp-3 leading-relaxed">
                        "{req.note}"
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
