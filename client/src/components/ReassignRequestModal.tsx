import React, { useState } from 'react';
import { Modal } from './Modal';
import { useAppStore } from '../context/appStore';
import { reassignService } from '../services/api';
import { emitSuccessToast, emitErrorToast } from '../context/toastBus';
import { UserAvatar } from './UserAvatar';
import { Search, UserPlus } from 'lucide-react';
import { cn } from '../utils/helpers';

interface ReassignRequestModalProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  onSubmitted?: () => void;
}

export const ReassignRequestModal: React.FC<ReassignRequestModalProps> = ({
  open,
  onClose,
  taskId,
  taskTitle,
  onSubmitted
}) => {
  const { users } = useAppStore();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedUserId) {
      emitErrorToast('Please select a new assignee.', 'Validation Error');
      return;
    }
    try {
      setIsSubmitting(true);
      await reassignService.create({
        taskId,
        requestedAssigneeId: selectedUserId,
        note
      });
      emitSuccessToast('Reassignment request sent to manager.', 'Request Sent');
      onSubmitted?.();
      onClose();
    } catch (err) {
      console.error('Failed to create reassign request:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Request Task Reassignment" size="md">
      <div className="p-6 space-y-6">
        <div>
          <p className="text-xs text-surface-500 mb-4">
            Since you are an employee, you cannot directly reassign tasks. 
            Please select the person you'd like to reassign <span className="font-semibold text-surface-900 dark:text-white">"{taskTitle}"</span> to.
          </p>
        </div>

        <div className="space-y-2">
          <label className="label">New Assignee</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
              <Search size={14} />
            </div>
            <input 
              type="text"
              placeholder="Search people..."
              className="input pl-9"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto border border-surface-100 dark:border-surface-800 rounded-xl divide-y divide-surface-100 dark:divide-surface-800">
            {filteredUsers.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUserId(u.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  selectedUserId === u.id 
                    ? "bg-brand-50 dark:bg-brand-950/30" 
                    : "hover:bg-surface-50 dark:hover:bg-surface-800/60"
                )}
              >
                <UserAvatar name={u.name} color={u.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{u.name}</p>
                  <p className="text-xs text-surface-500 truncate">{u.role.replace('_', ' ')}</p>
                </div>
                {selectedUserId === u.id && (
                  <div className="w-2 h-2 rounded-full bg-brand-500 shadow-sm shadow-brand-500/50" />
                )}
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <div className="p-4 text-center text-xs text-surface-400 font-medium italic">No people found.</div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="label">Reason / Note</label>
          <textarea 
            className="input min-h-[100px] py-3 resize-none"
            placeholder="Why are you requesting this reassignment?"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancel</button>
          <button 
            type="button" 
            onClick={handleSubmit} 
            disabled={isSubmitting || !selectedUserId}
            className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
          >
            <UserPlus size={16} />
            {isSubmitting ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
