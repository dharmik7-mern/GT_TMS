import React, { useState } from 'react';
import { AdminTask } from '../../store/useAdminCalendarStore.ts';
import { differenceInCalendarDays, differenceInMinutes, format } from 'date-fns';
import { cn } from '../../../../../utils/helpers.ts';
import { MoreVertical, Trash2, Copy } from 'lucide-react';
import { userColor } from './BordioCalendar.tsx';

interface BordioTaskCardProps {
    task: AdminTask;
    onClick?: () => void;
    onDelete?: (id: string) => Promise<void>;
    onDuplicate?: (task: AdminTask) => Promise<void>;
}

// ── Strip metadata tags ────────────────────────────────────────────────────
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
    high:     { bg: '#FEF3C7', text: '#92400E' },
    default:  { bg: 'rgba(255,255,255,0.6)', text: '#374151' },
};
function tagStyle(tag: string) {
    return TAG_STYLES[tag.toLowerCase().replace(/\s+/g, '')] ?? TAG_STYLES.default;
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
    if (diff < 0)   return 'Overdue';
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    return `${diff} days left`;
}

// ─────────────────────────────────────────────────────────────────────────────
export const BordioTaskCard: React.FC<BordioTaskCardProps> = ({
    task,
    onClick,
    onDelete,
    onDuplicate,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);

    // Priority-based card color (Bordio Style)
    const cardBg = 
        task.priority === 'high'   ? '#FEE2E2' :
        task.priority === 'medium' ? '#FEF3C7' :
        task.priority === 'low'    ? '#D1FAE5' :
        userColor(task.assignedUser);

    const visibleTags    = cleanTags(task.tags);
    const initials       = (task.assignedUser?.trim()?.charAt(0) ?? '?').toUpperCase();
    const dueText        = dueBadge(task.endDateTime);

    const durationMins =
        task.duration != null
            ? task.duration
            : task.startDateTime && task.endDateTime
                ? Math.max(0, differenceInMinutes(new Date(task.endDateTime), new Date(task.startDateTime)))
                : 60;

    let durationLabel = '';
    if (task.startDateTime) {
        // Format to e.g. "6:00pm to 7:00pm"
        const sTime = format(new Date(task.startDateTime), 'h:mma').toLowerCase();
        const eTime = task.endDateTime ? format(new Date(task.endDateTime), 'h:mma').toLowerCase() : '';
        durationLabel = eTime ? `${sTime} to ${eTime}` : sTime;
    } else {
        durationLabel = fmtDuration(durationMins);
    }

    return (
        <div
            onClick={(e) => {
                if (menuOpen) { setMenuOpen(false); return; }
                e.stopPropagation();
                onClick?.();
            }}
            onMouseLeave={() => setMenuOpen(false)}
            className={cn(
                'group relative cursor-pointer rounded-[12px] w-full select-none',
                'shadow-[0_1px_3px_rgba(0,0,0,0.07)]',
                'transition-all duration-150 hover:shadow-[0_4px_14px_rgba(0,0,0,0.11)] hover:scale-[1.01] active:scale-[0.99]',
            )}
            style={{ backgroundColor: cardBg, padding: '10px 12px 10px' }}
        >
            {/* Row 1: avatar + title */}
            <div className="flex items-start gap-2.5">
                <div
                    className="shrink-0 mt-[1px] h-[26px] w-[26px] rounded-full border-[2px] border-white/80 flex items-center justify-center text-[11px] font-black text-white shadow-sm"
                    style={{ background: 'rgba(0,0,0,0.22)' }}
                >
                    {initials}
                </div>
                <p className="flex-1 text-[13px] font-extrabold leading-[1.35] tracking-[-0.01em] text-[#1C2434] line-clamp-2">
                    {task.title}
                </p>
            </div>

            {/* Row 2: tag badges */}
            {visibleTags.length > 0 && (
                <div className="mt-[7px] flex flex-wrap gap-1">
                    {visibleTags.slice(0, 2).map((tag) => {
                        const s = tagStyle(tag);
                        return (
                            <span
                                key={tag}
                                className="rounded-[5px] px-[7px] py-[2px] text-[9px] font-black uppercase tracking-[0.07em]"
                                style={{ backgroundColor: s.bg, color: s.text }}
                            >
                                {tag}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Row 3: duration | due */}
            <div className="mt-[8px] flex items-center gap-1">
                <span className="text-[10.5px] font-bold text-[#374151]/70">{durationLabel}</span>
                <span className="text-[9.5px] text-[#374151]/35 font-bold">|</span>
                <span className="text-[10px] font-medium text-[#374151]/60">{dueText}</span>
            </div>

            {/* 3-dot hover menu */}
            <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                className="absolute top-2 right-2 p-[3px] rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all z-20"
            >
                <MoreVertical size={13} className="text-[#374151]/40" />
            </button>

            {menuOpen && (
                <div
                    className="absolute right-2 top-8 z-50 w-36 rounded-xl bg-white p-1 shadow-2xl ring-1 ring-black/5"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={async () => { onDuplicate && await onDuplicate(task); setMenuOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-[#475569] hover:bg-[#F1F5F9]"
                    >
                        <Copy size={13} /> Duplicate
                    </button>
                    <button
                        onClick={async () => { onDelete && await onDelete(task._id); setMenuOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50"
                    >
                        <Trash2 size={13} /> Delete
                    </button>
                </div>
            )}
        </div>
    );
};
