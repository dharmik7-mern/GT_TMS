import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Plus, Search, Calendar, Clock, Flag, Sparkles, CornerDownLeft, AlignLeft, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../utils/helpers';
import { parseSmartInput, ParsedTask } from '../../../utils/nlp';

interface SmartInputProps {
  onAdd: (data: { input: string; description?: string }) => void;
}

export const SmartInput = forwardRef<{ addValue: (val: string) => void }, SmartInputProps>(({ onAdd }, ref) => {
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    addValue: (val: string) => {
      setValue(prev => {
        const newValue = prev + (prev.endsWith(' ') || !prev ? '' : ' ') + val + ' ';
        return newValue;
      });
      inputRef.current?.focus();
    }
  }));

  useEffect(() => {
    if (value.trim()) {
      setParsed(parseSmartInput(value));
    } else {
      setParsed(null);
    }
  }, [value]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim()) return;
    onAdd({ input: value, description: showDescription ? description : undefined });
    setValue('');
    setDescription('');
    setShowDescription(false);
    setParsed(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Enter' && !showDescription) {
      // Allow enter to submit if no description field is open
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative group flex-1">
      <div className={cn(
        "flex flex-col gap-0 px-1 py-1 bg-white dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-800 rounded-xl transition-all overflow-hidden",
        isFocused ? "border-brand-500 bg-white shadow-lg shadow-brand-500/10" : "hover:border-surface-300 dark:hover:border-surface-700 shadow-none bg-surface-50/50"
      )}>
        <div className="flex items-center gap-3 px-3 py-2">
          <Plus size={18} strokeWidth={3} className={cn("transition-colors flex-shrink-0", isFocused ? "text-brand-600" : "text-surface-300")} />
          
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="What's next? (e.g. Call team tomorrow 10am)"
            className="flex-1 bg-transparent border-none !outline-none focus:!outline-none focus:!ring-0 text-sm font-semibold text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 p-0"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDescription(!showDescription)}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                showDescription ? "bg-brand-50 text-brand-600 dark:bg-brand-950/30" : "text-surface-300 hover:text-surface-500"
              )}
              title="Add Description"
            >
              <AlignLeft size={16} />
            </button>

            <AnimatePresence>
              {isFocused && value.trim() && (
                <motion.button
                  type="button"
                  onClick={handleSubmit}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-brand-600 text-white p-1.5 rounded-lg shadow-md shadow-brand-500/20 hover:bg-brand-700 transition-colors"
                >
                  <CornerDownLeft size={14} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {showDescription && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 pb-3 pt-1 border-t border-surface-50 dark:border-surface-800"
            >
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add task details..."
                className="w-full bg-surface-50/50 dark:bg-surface-800/30 border-none rounded-lg p-2 text-xs font-medium text-surface-700 dark:text-surface-300 focus:ring-0 outline-none min-h-[60px] resize-none"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isFocused && value.trim() && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="absolute left-0 right-0 top-full bg-white dark:bg-surface-900 border-x border-b border-surface-200 dark:border-surface-800 rounded-b-lg shadow-xl z-20"
          >
            <div className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-surface-400">
               <span className="flex items-center gap-1 text-brand-500"><Sparkles size={10} /> DETECTED:</span>
               
             <div className="flex flex-wrap gap-2">
               {parsed?.dueDate && (
                 <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md">
                    {parsed.dueDate}
                 </div>
               )}

               {parsed?.dueTime && (
                 <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md">
                    {parsed.dueTime}
                 </div>
               )}

               {parsed?.priority && (
                 <div className={cn(
                   "flex items-center gap-1.5 px-1.5 py-0.5 rounded-md",
                   parsed.priority === 'high' ? "text-rose-600 bg-rose-50" : "text-amber-600 bg-amber-50"
                 )}>
                    {parsed.priority}
                 </div>
               )}

               {parsed?.labels && parsed.labels.length > 0 && (
                 <div className="flex items-center gap-1">
                   {parsed.labels.map(l => (
                     <span key={l} className="text-[10px] text-brand-600 dark:text-brand-300 bg-brand-50/50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded-md font-bold">#{l}</span>
                   ))}
                 </div>
               )}
             </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
