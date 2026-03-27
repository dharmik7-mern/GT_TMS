import React, { useEffect, useState } from 'react';
import { reassignService } from '../services/api';
import { useAppStore } from '../context/appStore';
import { UserAvatar } from './UserAvatar';
import { Check, X, Clock } from 'lucide-react';
import { emitSuccessToast } from '../context/toastBus';
import { formatRelativeTime } from '../utils/helpers';

export const ReassignRequestsPanel: React.FC = () => {
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

  if (loading && requests.length === 0) return <div className="p-8 text-center text-surface-400 font-medium">Loading requests...</div>;
  if (requests.length === 0) return null;

  return (
    <div className="card overflow-hidden h-full flex flex-col">
      <div className="bg-amber-50 dark:bg-amber-950/20 px-5 py-3 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-600" />
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
            <div key={req.id} className="p-4 bg-white dark:bg-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-tight">{requester?.name || 'Someone'} requested</span>
                    <span className="text-[10px] text-surface-400">• {formatRelativeTime(req.createdAt)}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-surface-900 dark:text-white truncate mb-2" title={task?.title || req.taskId?.title}>
                    {task?.title || req.taskId?.title || 'Unknown Task'}
                  </h4>
                  <div className="flex items-center gap-3 bg-surface-50 dark:bg-surface-800/50 p-2 rounded-lg border border-surface-100 dark:border-surface-700/50">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserAvatar name={current?.name || ''} color={current?.color} size="xs" />
                      <span className="text-[10px] text-surface-500 truncate max-w-[60px]">{current?.name?.split(' ')[0]}</span>
                    </div>
                    <div className="text-surface-300 text-[10px]">→</div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserAvatar name={target?.name || ''} color={target?.color} size="xs" />
                      <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 truncate max-w-[60px]">{target?.name?.split(' ')[0]}</span>
                    </div>
                  </div>
                  {req.note && (
                    <div className="mt-2 text-[11px] text-surface-500 bg-surface-50 dark:bg-surface-800/30 p-2 rounded leading-relaxed border-l-2 border-surface-200 dark:border-surface-700">
                      "{req.note}"
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => handleAction(req.id, true)}
                    className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 shadow-sm shadow-emerald-500/20 transition-all hover:scale-110 active:scale-95"
                    title="Approve Reassignment"
                  >
                    <Check size={16} />
                  </button>
                  <button 
                    onClick={() => handleAction(req.id, false)}
                    className="w-8 h-8 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all hover:scale-110 active:scale-95"
                    title="Reject Request"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
