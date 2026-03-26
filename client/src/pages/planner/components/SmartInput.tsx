import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, Calendar, Clock, Flag, Sparkles, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../utils/helpers';
import { parseSmartInput, ParsedTask } from '../../../utils/nlp';

interface SmartInputProps {
  onAdd: (input: string) => void;
}

export const SmartInput: React.FC<SmartInputProps> = ({ onAdd }) => {
  const [value, setValue] = useState('');
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    onAdd(value);
    setValue('');
    setParsed(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative group flex-1">
      <div className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg transition-all",
        isFocused ? "border-brand-500/50 bg-white" : "hover:border-surface-300 dark:hover:border-surface-700 shadow-none bg-surface-50/50"
      )}>
        <Plus size={14} strokeWidth={3} className={cn("transition-colors", isFocused ? "text-brand-600" : "text-surface-300")} />
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="What's next? (e.g. Call team tomorrow 10am)"
          className="w-full bg-transparent border-none !outline-none focus:!outline-none focus:!ring-0 text-[13px] font-semibold text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 p-0"
        />

        <AnimatePresence>
          {isFocused && value.trim() && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-surface-400 bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0"
            >
              <span>CMD+Enter</span>
               <CornerDownLeft size={10} />
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
};
