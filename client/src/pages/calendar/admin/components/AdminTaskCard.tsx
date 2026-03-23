import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { AdminTask } from '../store/useAdminCalendarStore.ts';
import { format } from 'date-fns';
import { cn } from '../../../../utils/helpers.ts';
import { Clock, MessageCircle, Paperclip } from 'lucide-react';

const priorityColors: Record<AdminTask['priority'], string> = {
    red: 'bg-[linear-gradient(135deg,#ffc7bc_0%,#ffe0d7_100%)] text-[#81443a]',
    green: 'bg-[linear-gradient(135deg,#bdeff1_0%,#d7fbff_100%)] text-[#255f69]',
    blue: 'bg-[linear-gradient(135deg,#b7dafc_0%,#d9e9ff_100%)] text-[#294f79]',
    yellow: 'bg-[linear-gradient(135deg,#ffdcae_0%,#ffedd0_100%)] text-[#8f5f1e]',
    none: 'bg-[linear-gradient(135deg,#edf4ff_0%,#fbfdff_100%)] text-surface-800 border border-[#dce7f7]',
};

const statusPillClasses: Record<AdminTask['status'], string> = {
    Pending: 'bg-white/45 text-[#3f6ea8]',
    'In Progress': 'bg-white/50 text-[#8b4a40]',
    Done: 'bg-white/55 text-[#21684e]',
};

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
    const hasTime = Boolean(task.startDateTime) && Boolean(task.endDateTime);
    const start = hasTime ? new Date(task.startDateTime as any) : null;
    const end = hasTime ? new Date(task.endDateTime as any) : null;
    const assigneeInitial = task.assignedUser?.trim()?.charAt(0)?.toUpperCase() || 'U';
    const commentCount = task.comments?.length ?? 0;
    const attachmentCount = task.attachments?.length ?? 0;

    let durationText = 'Waiting';
    if (hasTime && start && end) {
        const durationMinutes = (end.getTime() - start.getTime()) / 60000;
        if (durationMinutes >= 60) {
            const hours = Math.floor(durationMinutes / 60);
            const minutes = Math.floor(durationMinutes % 60);
            durationText = `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
        } else {
            durationText = `${durationMinutes}m`;
        }
    }

    if (isMonthView) {
        return (
            <div
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick?.();
                }}
                className={cn(
                    'mx-1 mb-1 truncate rounded-md px-2 py-1 text-[10px] font-medium shadow-sm cursor-grab active:cursor-grabbing',
                    priorityColors[task.priority]
                )}
                style={{ opacity: isDragging ? 0.4 : 1 }}
            >
                {hasTime ? `${format(new Date(task.startDateTime as any), 'HH:mm')} ` : ''}
                {task.title}
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            className={cn(
                'group relative flex w-full cursor-grab flex-col gap-2 overflow-hidden rounded-[18px] border border-white/50 px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-all hover:shadow-[0_18px_38px_rgba(15,23,42,0.12)]',
                priorityColors[task.priority],
                isOverlay && 'rotate-1'
            )}
            style={{ opacity: isDragging ? 0.5 : 1 }}
        >
            <div className="flex items-start justify-between gap-3 pointer-events-none">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-[11px] font-bold text-surface-800 shadow-sm">
                    {assigneeInitial}
                </div>
                <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold tracking-wide', statusPillClasses[task.status])}>
                    {task.status}
                </span>
            </div>

            <p className="pointer-events-none text-[15px] font-semibold leading-[1.2]">
                {task.title}
            </p>

            {task.description && (
                <p className="pointer-events-none line-clamp-2 text-[11px] opacity-75">
                    {task.description}
                </p>
            )}

            <div className="pointer-events-none flex items-center gap-1.5 text-[12px] font-medium opacity-85">
                <Clock size={12} />
                <span>
                    {hasTime && start ? format(start, 'H:mm') : 'Waiting'} | {durationText}
                </span>
            </div>

            <div className="pointer-events-none flex items-center justify-between text-[11px] opacity-80">
                <div className="flex items-center gap-2">
                    {attachmentCount > 0 && (
                        <span className="flex items-center gap-1">
                            <Paperclip size={11} />
                            {attachmentCount}
                        </span>
                    )}
                    {commentCount > 0 && (
                        <span className="flex items-center gap-1">
                            <MessageCircle size={11} />
                            {commentCount}
                        </span>
                    )}
                </div>
                <div className="h-1.5 w-14 rounded-full bg-white/55" />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-[radial-gradient(circle_at_bottom,rgba(255,255,255,0.24),transparent_70%)]" />
        </div>
    );
};
