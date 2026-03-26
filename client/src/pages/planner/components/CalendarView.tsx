import React from 'react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameMonth, isToday, startOfWeek, endOfWeek 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../../../utils/helpers';
import type { PersonalTask } from '../../../app/types';

interface CalendarViewProps {
  tasks: PersonalTask[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks }) => {
  const [currentDate, setCurrentDate] = React.useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const nextMonth = () => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));
  const prevMonth = () => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
  const setToday = () => setCurrentDate(new Date());

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-950 overflow-hidden">
      {/* 
        Ultra-compact calendar header 
        Removed large icons and excess padding
      */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-100 dark:border-surface-800 bg-surface-50/30 dark:bg-surface-900/40">
        <div className="flex items-center gap-3">
          <CalendarIcon size={14} className="text-brand-600" />
          <h3 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-2">
            {format(currentDate, 'MMMM')} <span className="text-surface-400 font-medium">{format(currentDate, 'yyyy')}</span>
          </h3>
        </div>
        
        <div className="flex items-center gap-1">
           <button onClick={prevMonth} className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded transition-colors text-surface-400"><ChevronLeft size={16} /></button>
           <button onClick={setToday} className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-surface-600 hover:text-brand-600 dark:text-surface-400">TODAY</button>
           <button onClick={nextMonth} className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded transition-colors text-surface-400"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Days of week - Compact row */}
      <div className="grid grid-cols-7 border-b border-surface-100 dark:border-surface-800">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-surface-400 py-1.5 border-r border-surface-100 dark:border-surface-800 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid - Drastically reduced min-height */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto no-scrollbar auto-rows-fr h-full">
        {days.map((day, idx) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayTasks = tasks.filter(t => t.dueDate === dayStr);
          const dayIsToday = isToday(day);
          const dayIsSameMonth = isSameMonth(day, monthStart);

          return (
            <div 
              key={idx} 
              className={cn(
                "min-h-[85px] p-1.5 border-r border-b border-surface-100 dark:border-surface-800 transition-all flex flex-col gap-1",
                !dayIsSameMonth && "bg-surface-50/20 dark:bg-surface-900/10 opacity-40",
                dayIsToday && "bg-brand-50/40 dark:bg-brand-900/10"
              )}
            >
              <div className="flex items-center justify-between">
                 <span className={cn(
                   "text-[11px] font-bold",
                   dayIsToday ? "text-brand-600" : "text-surface-400"
                 )}>
                   {format(day, 'd')}
                 </span>
                 {dayTasks.length > 0 && (
                   <div className="w-1 h-1 bg-brand-500 rounded-full" />
                 )}
              </div>
              
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayTasks.slice(0, 3).map(task => (
                  <div key={task.id} className={cn(
                    "text-[9px] font-semibold px-1.5 py-0.5 rounded truncate",
                    task.status === 'done' 
                      ? "bg-surface-100 text-surface-400 line-through" 
                      : "bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-100/50 dark:border-brand-800/50"
                  )}>
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                   <p className="text-[8px] font-bold text-surface-400 px-1">+{dayTasks.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
