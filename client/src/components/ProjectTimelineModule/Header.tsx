import React from 'react';
import { addDays, buildMonthSegments } from './utils';
import { cn } from '../../utils/helpers';

interface HeaderProps {
  startDate: string;
  totalDays: number;
  dayWidth: number;
  extraRightPadding?: number;
}

export const Header: React.FC<HeaderProps> = ({ startDate, totalDays, dayWidth, extraRightPadding = 80 }) => {
  const months = buildMonthSegments(startDate, totalDays);

  return (
    <div className="sticky top-0 z-40 border-b border-surface-200 bg-white/95 backdrop-blur-md dark:border-surface-800 dark:bg-surface-950/95 shadow-sm">
      <div className="relative h-16" style={{ width: totalDays * dayWidth + extraRightPadding }}>
        <div className="grid h-8 border-b border-surface-100/60 dark:border-surface-800/60" style={{ gridTemplateColumns: `repeat(${totalDays}, ${dayWidth}px)` }}>
          {months.map((segment) => (
            <div
              key={`${segment.label}-${segment.startOffset}`}
              className="flex items-center border-r border-surface-100/40 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-surface-500 bg-surface-50/30 dark:bg-surface-900/10 dark:border-surface-800/40 overflow-hidden"
              style={{ gridColumn: `${segment.startOffset + 1} / span ${segment.span}` }}
            >
              <span className="truncate">{segment.span * dayWidth > 80 ? segment.label : ''}</span>
            </div>
          ))}
        </div>
        <div className="grid h-8" style={{ gridTemplateColumns: `repeat(${totalDays}, ${dayWidth}px)` }}>
          {Array.from({ length: totalDays }).map((_, index) => {
            const dateKey = addDays(startDate, index);
            const date = new Date(`${dateKey}T00:00:00Z`);
            const isWeekend = [0, 6].includes(date.getUTCDay());
            return (
              <div
                key={dateKey}
                className={cn(
                  "flex flex-col items-center justify-center border-r border-surface-100/40 text-[9px] font-bold transition-colors dark:border-surface-800/40",
                  isWeekend ? "bg-surface-50/50 text-surface-400 dark:bg-surface-900/20" : "text-surface-600 dark:text-surface-400"
                )}
              >
                <span className="opacity-50 text-[10px]">{date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}</span>
                <span className="text-[12px] mt-0.5">{date.getUTCDate()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Header;
