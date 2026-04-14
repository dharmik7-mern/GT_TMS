import React, { useState } from 'react';
import { Modal } from './Modal';
import { extensionRequestsService } from '../services/api';
import { emitSuccessToast, emitErrorToast } from '../context/toastBus';
import { Calendar, Clock, Send, Info } from 'lucide-react';
import { cn } from '../utils/helpers';

interface ExtensionRequestModalProps {
  open: boolean;
  onClose: () => void;
  taskIds: string[];
  taskTitles: string[];
  onSubmitted?: () => void;
}

export const ExtensionRequestModal: React.FC<ExtensionRequestModalProps> = ({
  open,
  onClose,
  taskIds,
  taskTitles,
  onSubmitted
}) => {
  const [reason, setReason] = useState('');
  const [requestedDueDate, setRequestedDueDate] = useState('');
  const [isExplanationOnly, setIsExplanationOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      emitErrorToast('Please provide a reason.', 'Validation Error');
      return;
    }
    if (!isExplanationOnly && !requestedDueDate) {
      emitErrorToast('Please select a requested due date.', 'Validation Error');
      return;
    }

    try {
      setIsSubmitting(true);
      await extensionRequestsService.create({
        taskIds,
        reason,
        requestedDueDate: isExplanationOnly ? undefined : requestedDueDate,
        isExplanationOnly
      });
      
      emitSuccessToast(
        isExplanationOnly 
          ? 'Explanation sent successfully.' 
          : 'Extension request sent for approval.', 
        'Success'
      );
      
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      // Error is handled by interceptor, but we catch to stop loading
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isExplanationOnly ? "Explain Overdue Task" : "Request Due Date Extension"} size="md">
      <div className="p-6 space-y-6">
        <div className="bg-surface-50 dark:bg-surface-800/50 p-3 rounded-xl border border-surface-100 dark:border-surface-700/50">
          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Info size={10} />
            Affected Tasks ({taskIds.length})
          </p>
          <div className="max-h-24 overflow-y-auto space-y-1">
            {taskTitles.map((title, i) => (
              <p key={i} className="text-xs font-medium text-surface-700 dark:text-surface-300 truncate">• {title}</p>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 bg-brand-50/50 dark:bg-brand-950/20 p-1.5 rounded-xl border border-brand-100/50 dark:border-brand-900/30">
          <button
            onClick={() => setIsExplanationOnly(false)}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
              !isExplanationOnly 
                ? "bg-white dark:bg-surface-900 text-brand-700 dark:text-brand-300 shadow-sm" 
                : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            )}
          >
            <Calendar size={14} />
            Request Extension
          </button>
          <button
            onClick={() => setIsExplanationOnly(true)}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
              isExplanationOnly 
                ? "bg-white dark:bg-surface-900 text-brand-700 dark:text-brand-300 shadow-sm" 
                : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            )}
          >
            <Clock size={14} />
            Just Explanation
          </button>
        </div>

        {!isExplanationOnly && (
          <div className="space-y-2">
            <label className="label">New Requested Due Date</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
                <Calendar size={14} />
              </div>
              <input 
                type="date"
                min={new Date().toISOString().split('T')[0]}
                className="input pl-9"
                value={requestedDueDate}
                onChange={e => setRequestedDueDate(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="label">{isExplanationOnly ? "Explanation" : "Reason for Extension"}</label>
          <textarea 
            className="input min-h-[120px] py-3 resize-none"
            placeholder={isExplanationOnly ? "Why is this task overdue?" : "Please explain why you need more time..."}
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 font-bold">Cancel</button>
          <button 
            type="button" 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 font-bold shadow-lg shadow-brand-500/20"
          >
            <Send size={16} />
            {isSubmitting ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
