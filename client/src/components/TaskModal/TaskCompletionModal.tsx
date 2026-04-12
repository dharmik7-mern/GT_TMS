import React, { useState, useRef } from 'react';
import { Modal } from '../Modal';
import { MessageSquare, Send, AlertCircle, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../utils/helpers';

interface TaskCompletionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (remark: string, files: File[]) => Promise<void>;
  taskTitle: string;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({ 
  open, 
  onClose, 
  onSubmit, 
  taskTitle 
}) => {
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!remark.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(remark.trim(), selectedFiles);
      setRemark('');
      setSelectedFiles([]);
      onClose();
    } catch (error) {
      console.error('Failed to submit completion remark:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Complete Task" size="md">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
          <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-bold">Review Required</p>
            <p className="opacity-80">This task will be sent to the reporting person for review before being marked as Done.</p>
          </div>
        </div>

        <div className="mb-5">
          <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1 mb-2 block">
            Completion Remark
          </label>
          <div className="relative group">
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={`Describe what you did for "${taskTitle}"...`}
              className="input h-32 py-3 px-4 resize-none transition-all focus:ring-2 focus:ring-brand-500/20"
              autoFocus
            />
            <MessageSquare size={16} className="absolute top-3.5 right-4 text-surface-300 pointer-events-none group-focus-within:text-brand-500 transition-colors" />
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest block">
              Deliverables / Proof (Optional)
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-[11px] font-bold text-brand-600 hover:text-brand-700 transition-colors"
            >
              <Paperclip size={12} />
              Attach Files
            </button>
          </div>

          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {selectedFiles.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-xl border border-surface-100 bg-surface-50 dark:border-surface-800 dark:bg-surface-950/50 group/file">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-surface-900 flex items-center justify-center text-surface-400 shadow-sm border border-surface-100 dark:border-surface-800">
                    {file.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-surface-700 dark:text-surface-200 truncate">{file.name}</p>
                    <p className="text-[10px] text-surface-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-1 px-2 text-surface-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all opacity-0 group-hover/file:opacity-100"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-surface-100 dark:border-surface-800 rounded-2xl py-6 flex flex-col items-center justify-center cursor-pointer hover:border-brand-200 dark:hover:border-brand-900/40 hover:bg-brand-50/10 transition-all group"
            >
              <Paperclip size={20} className="text-surface-300 group-hover:text-brand-400 transition-colors mb-2" />
              <p className="text-xs text-surface-400">Upload any files or screenshots as proof</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-surface-50 dark:border-surface-800/50">
          <button 
            onClick={onClose} 
            className="btn-ghost px-6 h-11"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={!remark.trim() || isSubmitting}
            className={cn(
               "btn-primary h-11 min-w-[180px] px-8 rounded-xl shadow-lg transition-all duration-300",
               !remark.trim() || isSubmitting 
                 ? "opacity-50 grayscale shadow-none" 
                 : "shadow-brand-500/25 hover:shadow-brand-500/40 active:scale-95 translate-y-0 hover:-translate-y-0.5"
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2 font-bold tracking-tight">
                <Send size={15} />
                Submit for Review
              </span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
