import React, { useState } from 'react';
import { X, Plus, Trash2, Tag as TagIcon, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../context/appStore';
import { labelsService } from '../../services/api';
import { cn } from '../../utils/helpers';
import { emitSuccessToast, emitErrorToast } from '../../context/toastBus';

interface LabelManagementModalProps {
  open: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', 
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', 
  '#f43f5e', '#71717a'
];

export const LabelManagementModal: React.FC<LabelManagementModalProps> = ({ open, onClose }) => {
  const { allLabels, bootstrap } = useAppStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[10]);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await labelsService.create({ name: newName.trim(), color: newColor });
      await bootstrap();
      setNewName('');
      setIsCreating(false);
      emitSuccessToast('Label created successfully');
    } catch (error: any) {
      emitErrorToast(error?.response?.data?.error?.message || 'Failed to create label');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this label? It will be removed from all tasks.')) return;
    try {
      await labelsService.delete(id);
      await bootstrap();
      emitSuccessToast('Label deleted successfully');
    } catch (error: any) {
      emitErrorToast(error?.response?.data?.error?.message || 'Failed to delete label');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-surface-950/40 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-white dark:bg-surface-900 rounded-3xl shadow-modal overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 dark:border-surface-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/30 rounded-xl">
              <TagIcon size={18} className="text-brand-600 dark:text-brand-400" />
            </div>
            <h2 className="text-lg font-bold text-surface-900 dark:text-white font-display">Manage Labels</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl text-surface-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {!isCreating ? (
              <motion.button
                key="add-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-surface-200 dark:border-surface-800 text-surface-500 hover:border-brand-500 hover:text-brand-600 transition-all group"
              >
                <Plus size={18} className="group-hover:scale-110 transition-transform" />
                <span className="font-semibold">Create New Label</span>
              </motion.button>
            ) : (
              <motion.div
                key="create-form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-2xl border border-surface-100 dark:border-surface-800 space-y-4"
              >
                <div>
                  <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest block mb-1.5">Label Name</label>
                  <input
                    autoFocus
                    className="input w-full bg-white dark:bg-surface-900"
                    placeholder="e.g. High Priority, Design, Bug"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest block mb-2">Color Palette</label>
                  <div className="grid grid-cols-6 gap-2">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={cn(
                          "h-8 rounded-lg flex items-center justify-center transition-all",
                          newColor === c ? "ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-surface-900" : "hover:scale-105"
                        )}
                        style={{ backgroundColor: c }}
                      >
                        {newColor === c && <Check size={14} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    className="btn-ghost flex-1 py-2.5"
                    onClick={() => { setIsCreating(false); setNewName(''); }}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn-primary flex-1 py-2.5"
                    onClick={handleCreate}
                    disabled={submitting || !newName.trim()}
                  >
                    {submitting ? 'Creating...' : 'Create Label'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest block mb-1">Existing Labels ({allLabels.length})</label>
            {allLabels.length === 0 ? (
              <p className="text-sm text-surface-400 py-8 text-center italic">No labels created yet.</p>
            ) : (
              allLabels.map((l) => (
                <div 
                  key={l.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 group hover:border-surface-200 dark:hover:border-surface-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">{l.name}</span>
                  </div>
                  <button 
                    onClick={() => handleDelete(l.id)}
                    className="p-1.5 opacity-0 group-hover:opacity-100 rounded-lg text-surface-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                    title="Delete label"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
