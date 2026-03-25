import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { AdminTask } from '../store/useAdminCalendarStore.ts';
import { differenceInCalendarDays, differenceInMinutes } from 'date-fns';
import { cn } from '../../../../utils/helpers.ts';
import { userColor } from './BordioCalendar/BordioCalendar.tsx';

// ── Per-user avatar color (matches BordioTaskCard palette) ─────────────────
const AVATAR_PALETTE = [
    '#F87171', '#FB923C', '#FBBF24', '#4ADE80',
    '#34D399', '#22D3EE', '#60A5FA', '#A78BFA',
    '#F472B6', '#E879F9', '#2DD4BF', '#F97316',
];
function avatarColor(name?: string): string {
    if (!name) return '#94A3B8';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// Card color is derived from priority OR task.assignedUser via userColor()
const getCardStyles = (task: AdminTask, isDark: boolean) => {
    let color = userColor(task.assignedUser);
    if (task.priority === 'high')   color = '#F87171'; // Red-400
    if (task.priority === 'medium') color = '#FBBF24'; // Amber-400
    if (task.priority === 'low')    color = '#34D399'; // Emerald-400

    if (!isDark) {
        // Light mode: use pastel version of the color
        if (task.priority === 'high')   return { bg: '#FEE2E2', text: '#1C2434', border: 'transparent' };
        if (task.priority === 'medium') return { bg: '#FEF3C7', text: '#1C2434', border: 'transparent' };
        if (task.priority === 'low')    return { bg: '#D1FAE5', text: '#1C2434', border: 'transparent' };
        return { bg: color, text: '#1C2434', border: 'transparent' };
    }

    // Dark mode: use dark surface with colored border
    return { bg: '#1E293B', text: '#F1F5F9', border: color };
};

// ── Strip backend noise from tags ───────────────────────────────────────────
function cleanTags(tags?: string[]): string[] {
    if (!tags) return [];
    return tags.filter((t) => {
        const u = t.toUpperCase();
        if (u.startsWith('CREATE IN:'))    return false;
        if (u.startsWith('TYPE:'))         return false;
        if (u.startsWith('PROVIDER:'))     return false;
        if (u.startsWith('PARTICIPANTS:')) return false;
        if (u.startsWith('PROJECT:'))      return false;
        if (t.length > 24)                 return false;
        return true;
    });
}

const TAG_STYLES: Record<string, { bg: string; text: string }> = {
    feedback: { bg: '#D1FAE5', text: '#065F46' },
    blocked:  { bg: '#FEE2E2', text: '#991B1B' },
    bug:      { bg: '#FEE2E2', text: '#991B1B' },
    review:   { bg: '#EDE9FE', text: '#5B21B6' },
    urgent:   { bg: '#FEF3C7', text: '#92400E' },
    default:  { bg: 'rgba(255,255,255,0.65)', text: '#374151' },
};
const getTagStyle = (tag: string, isDark: boolean) => {
    const key = tag.toLowerCase().replace(/\s+/g, '');
    const style = TAG_STYLES[key] ?? TAG_STYLES.default;
    
    if (!isDark) return style;
    
    // Adjusted dark mode tag colors
    const darkStyles: Record<string, { bg: string; text: string }> = {
        feedback: { bg: 'rgba(52, 211, 153, 0.2)', text: '#34D399' },
        blocked:  { bg: 'rgba(239, 68, 68, 0.2)',  text: '#F87171' },
        bug:      { bg: 'rgba(239, 68, 68, 0.2)',  text: '#F87171' },
        review:   { bg: 'rgba(167, 139, 250, 0.2)', text: '#A78BFA' },
        urgent:   { bg: 'rgba(251, 191, 36, 0.2)',  text: '#FBBF24' },
        default:  { bg: 'rgba(255, 255, 255, 0.1)', text: '#94A3B8' },
    };
    return darkStyles[key] ?? darkStyles.default;
}

function fmtDuration(mins: number): string {
    if (mins <= 0) return '0:30h';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${m < 10 ? '0' : ''}${m}h`;
}

function dueBadge(endDateTime?: string | null): string {
    if (!endDateTime) return 'Due today';
    const diff = differenceInCalendarDays(new Date(endDateTime), new Date());
    if (diff < 0)  return 'Overdue';
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    return `${diff} days left`;
}

// ─────────────────────────────────────────────────────────────────────────────
export const AdminTaskCard = ({
    task,
    isOverlay = false,
    onClick,
    isMonthView = false,
}: {
    task: AdminTask;
    isOverlay?: boolean;
    onClick?: () => void;
    isMonthView?: boolean;
}) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task._id, data: task });
    const isDark = document.documentElement.classList.contains('dark');

    const cardStyle = getCardStyles(task, isDark);

    const initials  = (task.assignedUser?.trim()?.charAt(0) ?? 'U').toUpperCase();
    const avColor   = avatarColor(task.assignedUser);
    const dueText   = dueBadge(task.endDateTime);
    const visibleTags = cleanTags(task.tags);

    const durationMins =
        task.duration != null
            ? task.duration
            : task.startDateTime && task.endDateTime
                ? Math.max(0, differenceInMinutes(new Date(task.endDateTime), new Date(task.startDateTime)))
                : 60;

    const durationLabel = fmtDuration(durationMins);

    // ── Month-strip view ────────────────────────────────────────────────────
    if (isMonthView) {
        return (
            <div
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                className={cn(
                    "mx-1 mb-1 truncate rounded px-2 py-0.5 text-[11px] font-bold cursor-grab transition-all hover:brightness-95",
                    isDark && "border-l-2"
                )}
                style={{
                    opacity: isDragging ? 0.4 : 1,
                    backgroundColor: cardStyle.bg,
                    color: cardStyle.text,
                    borderLeftColor: cardStyle.border !== 'transparent' ? cardStyle.border : undefined,
                }}
            >
                {task.title}
            </div>
        );
    }

    // ── Full card view ──────────────────────────────────────────────────────
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            className={cn(
                'group relative w-full cursor-grab rounded-[12px] transition-all',
                'hover:shadow-md hover:brightness-[0.97] active:scale-[0.99]',
                isOverlay && 'rotate-1 z-50 shadow-xl',
                isDark && 'border-l-[4px]'
            )}
            style={{
                opacity: isDragging ? 0.45 : 1,
                backgroundColor: cardStyle.bg,
                borderLeftColor: cardStyle.border !== 'transparent' ? cardStyle.border : undefined,
                padding: '10px 12px',
            }}
        >
            {/* Avatar + title */}
            <div className="flex items-start gap-2.5">
                <div
                    className="shrink-0 mt-[1px] h-[26px] w-[26px] rounded-full border-[2px] border-white dark:border-surface-800 flex items-center justify-center text-[11px] font-black text-white shadow-sm"
                    style={{ backgroundColor: avColor }}
                >
                    {initials}
                </div>
                <p className={cn(
                    "flex-1 text-[13px] font-extrabold leading-[1.35] tracking-[-0.01em] line-clamp-2 transition-colors",
                    isDark ? "text-slate-100" : "text-[#1C2434]"
                )}>
                    {task.title}
                </p>
            </div>

            {/* Tag badges */}
            {visibleTags.length > 0 && (
                <div className="mt-[7px] flex flex-wrap gap-1">
                     {visibleTags.slice(0, 2).map((tag) => {
                        const s = getTagStyle(tag, isDark);
                        return (
                            <span
                                key={tag}
                                className="rounded-[5px] px-[7px] py-[2px] text-[9px] font-black uppercase tracking-[0.07em] transition-colors"
                                style={{ backgroundColor: s.bg, color: s.text }}
                            >
                                {tag}
                            </span>
                        );
                    })}
                </div>
            )}

             {/* Duration | due badge */}
            <div className="mt-[8px] flex items-center gap-1 transition-colors">
                <span className={cn("text-[10.5px] font-bold", isDark ? "text-slate-400" : "text-[#374151]/70")}>{durationLabel}</span>
                <span className={cn("text-[9.5px] font-bold", isDark ? "text-slate-600" : "text-[#374151]/35")}>|</span>
                <span className={cn("text-[10px] font-medium", isDark ? "text-slate-400" : "text-[#374151]/60")}>{dueText}</span>
            </div>
        </div>
    );
};
