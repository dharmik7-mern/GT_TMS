import React, { useState, useEffect } from 'react';
import { Shield, Users, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Modal } from '../Modal';
import { UserAvatar } from '../UserAvatar';
import { usersService } from '../../services/api';
import { emitSuccessToast, emitErrorToast } from '../../context/toastBus';
import { cn } from '../../utils/helpers';
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from '../ui';
import type { User } from '../../app/types';

interface PendingTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  projectId: string;
  projectName: string;
}

interface DeactivationModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onSuccess: () => void;
}

export const DeactivationModal: React.FC<DeactivationModalProps> = ({ open, onClose, user, onSuccess }) => {
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalAssignee, setGlobalAssignee] = useState<string>('');
  const [taskMappings, setTaskMappings] = useState<Record<string, string>>({});
  const [allAvailableUsers, setAllAvailableUsers] = useState<User[]>([]);

  useEffect(() => {
    if (open && user) {
      loadPendingTasks();
      loadUsers();
    } else {
      setTasks([]);
      setGlobalAssignee('');
      setTaskMappings({});
    }
  }, [open, user]);

  const loadPendingTasks = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await usersService.getPendingTasks(user.id);
      setTasks(res.data?.data ?? res.data ?? []);
    } catch (err: any) {
      emitErrorToast('Failed to load pending tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await usersService.getAll();
      const list = res.data?.data ?? res.data ?? [];
      // Filter out the user being deactivated and also filter for active users
      setAllAvailableUsers(list.filter((u: User) => u.id !== user?.id && u.isActive));
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const handleDeactivate = async () => {
    if (!user) return;

    // Build mappings
    const mappings = tasks.map(t => ({
      taskId: t.id,
      newAssigneeId: taskMappings[t.id] || globalAssignee
    }));

    // Validation
    if (tasks.length > 0 && mappings. some(m => !m.newAssigneeId)) {
      emitErrorToast('Please assign all pending tasks to a new user.');
      return;
    }

    setIsSubmitting(true);
    try {
      await usersService.reassignAndDeactivate(user.id, { mappings });
      emitSuccessToast(`${user.name} has been deactivated successfully.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      emitErrorToast(err?.response?.data?.error?.message || 'Failed to deactivate user');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title="Disable User Account" size="lg">
      <div className="p-6">
        {/* Header Warning */}
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <Shield className="text-amber-600" size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Reassignment Required</h3>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              You are about to disable <strong>{user.name}</strong>. Before deactivation, you must reassign their <strong>{tasks.length}</strong> pending task{tasks.length === 1 ? '' : 's'}.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="animate-spin text-surface-400 mb-3" size={24} />
            <p className="text-sm text-surface-500">Checking pending tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="text-emerald-500" size={32} />
            </div>
            <h4 className="text-base font-bold text-surface-900 dark:text-white">Ready for Deactivation</h4>
            <p className="text-sm text-surface-500 mt-1">This user has no pending tasks. They can be disabled immediately.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global Assignee Selector */}
            <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-800 border border-surface-100 dark:border-surface-700">
              <label className="label text-xs font-bold uppercase tracking-wider mb-2">Bulk Assign To</label>
              <div className="flex items-center gap-3">
                <Select
                  value={globalAssignee}
                  onValueChange={(val) => {
                    setGlobalAssignee(val);
                    if (val) setTaskMappings({});
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allAvailableUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-surface-300 italic text-xs">Recommended</div>
              </div>
              <p className="text-[11px] text-surface-400 mt-2 italic">Select a single user to take over all pending tasks, or assign them individually below.</p>
            </div>

            {/* Task Wise Assignment */}
            <div className="space-y-3">
              <h5 className="text-[11px] font-bold text-surface-500 uppercase tracking-widest px-2">Task Details ({tasks.length})</h5>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {tasks.map(task => (
                  <div key={task.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-xl border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500">{task.projectName}</span>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider",
                          task.priority === 'high' || task.priority === 'urgent' ? 'text-rose-500' : 'text-amber-500'
                        )}>{task.priority}</span>
                      </div>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">{task.title}</p>
                    </div>

                    {!globalAssignee && (
                      <div className="w-full sm:w-48">
                        <Select
                          value={taskMappings[task.id] || ''}
                          onValueChange={(val) => setTaskMappings(prev => ({ ...prev, [task.id]: val }))}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Choose User..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allAvailableUsers.map(u => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {globalAssignee && (
                      <div className="flex items-center gap-2 px-3 h-9 bg-brand-50 dark:bg-brand-950/20 rounded-lg text-brand-600 dark:text-brand-300 text-xs font-medium border border-brand-100 dark:border-brand-900/30">
                        <Users size={12} />
                        Bulk Assigned
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-surface-100 dark:border-surface-800">
          <button onClick={onClose} className="btn-ghost btn-md px-6" disabled={isSubmitting}>Cancel</button>
          <button 
            onClick={handleDeactivate} 
            className="btn-primary btn-md px-8 min-w-[160px] shadow-lg shadow-brand-500/20"
            disabled={isSubmitting || (tasks.length > 0 && !globalAssignee && tasks.some(t => !taskMappings[t.id]))}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="animate-spin" size={16} />
                Processing...
              </span>
            ) : (
              'Reassign & Disable'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
