import React, { useEffect, useMemo, useState } from 'react';
import { addHours, format, startOfHour } from 'date-fns';
import { CalendarDays, Link2, Paperclip, Plus, RefreshCcw, Send, Trash2, UserPlus, Video, X } from 'lucide-react';
import { Modal } from '../../../../components/Modal/index.tsx';
import { useAdminCalendarStore, AdminTask } from '../store/useAdminCalendarStore.ts';
import { useAuthStore } from '../../../../context/authStore.ts';
import { useAppStore } from '../../../../context/appStore.ts';
import { emitErrorToast, emitSuccessToast } from '../../../../context/toastBus.ts';

const readTagValue = (tags: string[] | undefined, prefix: string, fallback: string) =>
    tags?.find((tag) => tag.startsWith(prefix))?.replace(prefix, '') || fallback;

const readParticipants = (tags: string[] | undefined) => {
    const raw = tags?.find((tag) => tag.startsWith('Participants: '))?.replace('Participants: ', '');
    if (!raw) return [];
    return raw.split(',').map((name) => name.trim()).filter(Boolean);
};

export const AdminTaskModal = () => {
    const { selectedTask, setSelectedTask, createTask, updateTask, deleteTask, addComment, uploadAttachment } = useAdminCalendarStore();
    const { user } = useAuthStore();
    const { users } = useAppStore();

    const isNew = selectedTask === 'new';
    const task = isNew ? null : (selectedTask as AdminTask);
    const isOpen = selectedTask !== null;

    const [eventName, setEventName] = useState('');
    const [notes, setNotes] = useState('');
    const [priority, setPriority] = useState<AdminTask['priority']>('blue');
    const [status, setStatus] = useState<AdminTask['status']>('Pending');
    const [startTime, setStartTime] = useState(startOfHour(addHours(new Date(), 1)));
    const [endTime, setEndTime] = useState(addHours(startOfHour(addHours(new Date(), 1)), 1));
    const [repeatEvent, setRepeatEvent] = useState(false);
    const [createIn, setCreateIn] = useState('Marketing campaign');
    const [eventType, setEventType] = useState('Meeting & Interview');
    const [meetingProvider, setMeetingProvider] = useState('Google Meet');
    const [participants, setParticipants] = useState<string[]>([]);
    const [participantInput, setParticipantInput] = useState('');
    const [commentText, setCommentText] = useState('');
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);

    const meetingLinkHint = useMemo(() => {
        if (meetingProvider === 'None') return 'No meeting link will be created';
        return 'Link will be generated automatically';
    }, [meetingProvider]);

    const availableParticipants = useMemo(() => {
        if (!Array.isArray(users) || users.length === 0) return [];
        return users.filter((item) => item.isActive !== false);
    }, [users]);

    useEffect(() => {
        if (!isOpen) return;

        const defaultStart = task?.startDateTime ? new Date(task.startDateTime as any) : startOfHour(addHours(new Date(), 1));
        const defaultEnd = task?.endDateTime ? new Date(task.endDateTime as any) : addHours(defaultStart, 1);
        const storedParticipants = readParticipants(task?.tags);
        const assigned = task?.assignedUser ? [task.assignedUser] : [];

        setEventName(task?.title || '');
        setNotes(task?.description || '');
        setPriority(task?.priority || 'blue');
        setStatus(task?.status || 'Pending');
        setStartTime(defaultStart);
        setEndTime(defaultEnd);
        setRepeatEvent(Boolean(task?.tags?.includes('Repeat event')));
        setCreateIn(readTagValue(task?.tags, 'Create in: ', 'Marketing campaign'));
        setEventType(readTagValue(task?.tags, 'Type: ', 'Meeting & Interview'));
        setMeetingProvider(readTagValue(task?.tags, 'Provider: ', 'Google Meet'));
        setParticipants(storedParticipants.length > 0 ? storedParticipants : assigned.length > 0 ? assigned : []);
        setParticipantInput('');
        setCommentText('');
        setPendingFiles([]);
    }, [isOpen, task]);

    if (!isOpen) return null;

    const toggleParticipant = (name: string) => {
        setParticipants((current) => (
            current.includes(name)
                ? current.filter((item) => item !== name)
                : [...current, name]
        ));
    };

    const addParticipant = () => {
        const normalized = participantInput.trim();
        if (!normalized) return;
        setParticipants((current) => (current.includes(normalized) ? current : [...current, normalized]));
        setParticipantInput('');
    };

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!eventName.trim()) return;
        if (endTime <= startTime) {
            emitErrorToast('End time must be after start time.', 'Invalid time range');
            return;
        }

        const payload: Partial<AdminTask> = {
            title: eventName.trim(),
            description: notes.trim(),
            priority,
            status,
            assignedUser: participants[0] || user?.name || 'Admin',
            startDateTime: startTime.toISOString(),
            endDateTime: endTime.toISOString(),
            tags: [
                `Create in: ${createIn}`,
                `Type: ${eventType}`,
                `Provider: ${meetingProvider}`,
                `Participants: ${participants.join(', ')}`,
                repeatEvent ? 'Repeat event' : '',
            ].filter(Boolean),
        };

        const saved = isNew
            ? await createTask(payload)
            : task
                ? await updateTask(task._id, payload)
                : null;

        if (saved && pendingFiles.length > 0) {
            for (const file of pendingFiles) {
                await uploadAttachment(saved._id, file);
            }
        }

        if (!saved) {
            emitErrorToast(isNew ? 'Failed to create event.' : 'Failed to save event.', 'Calendar action failed');
            return;
        }

        emitSuccessToast(isNew ? 'Event created successfully.' : 'Event updated successfully.');
        setSelectedTask(null);
    };

    const handleDelete = async () => {
        if (!isNew && task && window.confirm('Are you sure you want to delete this event?')) {
            await deleteTask(task._id);
            setSelectedTask(null);
        }
    };

    const handleComment = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!commentText.trim() || isNew || !task) return;

        await addComment(task._id, {
            text: commentText,
            userId: user?.id || 'admin',
            userName: user?.name || 'Admin',
        });
        setCommentText('');
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        if (isNew || !task) {
            setPendingFiles((current) => [...current, ...files]);
            return;
        }

        for (const file of files) {
            await uploadAttachment(task._id, file);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={() => setSelectedTask(null)}
            size="full"
            showClose={false}
            className="max-w-none h-[100dvh] sm:h-[calc(100dvh-16px)] sm:max-h-[calc(100dvh-16px)] rounded-none sm:rounded-[28px] border-0 sm:border sm:border-surface-200"
        >
            <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f3f7ff_100%)]">
                <div className="flex items-center justify-between border-b border-surface-100 bg-white/90 px-5 py-4 backdrop-blur sm:px-6">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Calendar event</p>
                        <h2 className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">
                            {isNew ? 'Create event' : 'Edit event'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setRepeatEvent((value) => !value)}
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                                repeatEvent
                                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                                    : 'border-surface-200 bg-white text-surface-500'
                            }`}
                        >
                            <RefreshCcw size={15} />
                            Repeat event
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedTask(null)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-surface-200 bg-white text-surface-500 transition hover:text-surface-900"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                    <form onSubmit={handleSave} className="flex-1 overflow-y-auto border-surface-200 p-5 sm:p-6 lg:border-r">
                        <div className="space-y-5">
                            <div className="flex flex-col gap-3 xl:flex-row">
                                <label className="relative flex items-center rounded-2xl border border-surface-200 bg-white px-4 py-3 xl:min-w-[220px]">
                                    <CalendarDays size={16} className="mr-3 text-surface-400" />
                                    <input
                                        type="date"
                                        value={format(startTime, 'yyyy-MM-dd')}
                                        onChange={(e) => {
                                            const next = new Date(startTime);
                                            const [year, month, day] = e.target.value.split('-').map(Number);
                                            next.setFullYear(year, month - 1, day);
                                            setStartTime(next);
                                            const nextEnd = new Date(endTime);
                                            nextEnd.setFullYear(year, month - 1, day);
                                            setEndTime(nextEnd);
                                        }}
                                        className="w-full bg-transparent text-base outline-none"
                                    />
                                </label>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={format(startTime, 'HH:mm')}
                                        onChange={(e) => {
                                            const [hours, minutes] = e.target.value.split(':').map(Number);
                                            const next = new Date(startTime);
                                            next.setHours(hours, minutes, 0, 0);
                                            setStartTime(next);
                                        }}
                                        className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-base outline-none"
                                    />
                                    <span className="text-surface-400">-</span>
                                    <input
                                        type="time"
                                        value={format(endTime, 'HH:mm')}
                                        onChange={(e) => {
                                            const [hours, minutes] = e.target.value.split(':').map(Number);
                                            const next = new Date(endTime);
                                            next.setHours(hours, minutes, 0, 0);
                                            setEndTime(next);
                                        }}
                                        className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-base outline-none"
                                    />
                                </div>
                            </div>

                            <input
                                required
                                type="text"
                                placeholder="Project status update meeting"
                                value={eventName}
                                onChange={(e) => setEventName(e.target.value)}
                                className="w-full rounded-2xl border border-surface-200 bg-white px-4 py-3 text-xl font-medium outline-none placeholder:text-surface-300"
                            />

                            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                                <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 xl:min-w-[240px]">
                                    <Video size={18} className="text-brand-500" />
                                    <select
                                        value={meetingProvider}
                                        onChange={(e) => setMeetingProvider(e.target.value)}
                                        className="w-full bg-transparent text-base outline-none"
                                    >
                                        <option>Google Meet</option>
                                        <option>Zoom</option>
                                        <option>Microsoft Teams</option>
                                        <option>None</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-surface-400">
                                    <Link2 size={15} />
                                    <span>{meetingLinkHint}</span>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as AdminTask['priority'])}
                                    className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-base outline-none"
                                >
                                    <option value="blue">Normal priority</option>
                                    <option value="red">High priority</option>
                                    <option value="yellow">Medium priority</option>
                                    <option value="green">Low priority</option>
                                    <option value="none">No priority</option>
                                </select>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as AdminTask['status'])}
                                    className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-base outline-none"
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Done">Done</option>
                                </select>
                            </div>

                            <textarea
                                placeholder={"Let's discuss:\n- What progress have we made?\n- What are the main blockers?\n- Are we on track?"}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[220px] w-full resize-y rounded-2xl border border-surface-200 bg-white px-4 py-4 text-base outline-none placeholder:text-surface-300"
                            />

                            <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-surface-300 bg-surface-50 px-4 py-2 text-sm text-surface-500 transition hover:border-brand-300 hover:text-brand-600">
                                <Paperclip size={16} />
                                {isNew ? 'Attach files' : 'Attach file'}
                                <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                            </label>
                            <div className="inline-flex items-center gap-2 rounded-xl bg-surface-50 px-4 py-2 text-sm text-surface-400">
                                <RefreshCcw size={16} />
                                {repeatEvent ? 'Repeats enabled' : 'Set reminder'}
                            </div>
                            {pendingFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {pendingFiles.map((file, index) => (
                                        <span key={`${file.name}-${index}`} className="rounded-full bg-surface-100 px-3 py-1 text-xs text-surface-600">
                                            {file.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                            <div className="flex flex-col-reverse justify-between gap-3 border-t border-surface-100 pt-5 sm:flex-row sm:items-center">
                                {!isNew ? (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
                                    >
                                        <Trash2 size={16} /> Delete
                                    </button>
                                ) : <div />}

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTask(null)}
                                        className="rounded-xl px-5 py-3 text-sm font-medium text-surface-500 transition hover:bg-surface-100"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="rounded-xl bg-[#1697ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(22,151,255,0.28)] transition hover:bg-[#0f8ef3]"
                                    >
                                        {isNew ? 'Create event' : 'Save event'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>

                    <div className="w-full overflow-y-auto border-surface-200 bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] p-5 sm:p-6 lg:w-[320px] lg:border-l">
                        <div className="space-y-6">
                            <div>
                                <p className="mb-2 text-sm text-surface-400">Create in</p>
                                <select
                                    value={createIn}
                                    onChange={(e) => setCreateIn(e.target.value)}
                                    className="w-full rounded-2xl border border-surface-200 bg-white px-4 py-3 text-base outline-none"
                                >
                                    <option>Marketing campaign</option>
                                    <option>Product launch</option>
                                    <option>Internal sync</option>
                                    <option>Client project</option>
                                </select>
                            </div>

                            <div>
                                <p className="mb-2 text-sm text-surface-400">Type</p>
                                <select
                                    value={eventType}
                                    onChange={(e) => setEventType(e.target.value)}
                                    className="w-full rounded-2xl border border-surface-200 bg-white px-4 py-3 text-base outline-none"
                                >
                                    <option>Meeting & Interview</option>
                                    <option>Planning session</option>
                                    <option>Review</option>
                                    <option>Deadline</option>
                                </select>
                            </div>

                            <div>
                                <p className="mb-3 text-sm text-surface-400">Participants</p>
                                <div className="space-y-2">
                                    {availableParticipants.map((participant) => {
                                        const name = participant.name;
                                        const selected = participants.includes(name);
                                        return (
                                            <button
                                                key={participant.id}
                                                type="button"
                                                onClick={() => toggleParticipant(name)}
                                                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${
                                                    selected ? 'bg-brand-50 text-brand-700' : 'bg-white text-surface-700 hover:bg-surface-50'
                                                }`}
                                            >
                                                <div
                                                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                                                    style={{ backgroundColor: participant.color || '#f7a85b' }}
                                                >
                                                    {name.charAt(0)}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-base">{name}</div>
                                                    <div className="text-xs text-surface-400">{participant.jobTitle || participant.email}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {availableParticipants.length === 0 && (
                                        <p className="rounded-2xl bg-white px-3 py-3 text-sm text-surface-400">
                                            No active users found in this workspace.
                                        </p>
                                    )}
                                </div>

                                <div className="mt-3 flex gap-2">
                                    <input
                                        type="text"
                                        value={participantInput}
                                        onChange={(e) => setParticipantInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addParticipant();
                                            }
                                        }}
                                        placeholder="Add participant"
                                        className="flex-1 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={addParticipant}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-medium text-surface-500 transition hover:border-brand-300 hover:text-brand-600"
                                    >
                                        <UserPlus size={16} />
                                    </button>
                                </div>

                                {participants.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {participants.map((name) => (
                                            <span key={name} className="rounded-full bg-surface-100 px-3 py-1 text-xs text-surface-600">
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {!isNew && task && (
                                <>
                                    <div className="border-t border-surface-100 pt-5">
                                        <p className="mb-3 text-sm text-surface-400">Attachments</p>
                                        <div className="space-y-2">
                                            {task.attachments?.length ? task.attachments.map((attachment: any) => (
                                                <a
                                                    key={attachment._id}
                                                    href={attachment.fileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-600 transition hover:border-brand-300"
                                                >
                                                    <Paperclip size={14} />
                                                    <span className="truncate">{attachment.fileName}</span>
                                                </a>
                                            )) : (
                                                <p className="text-sm text-surface-400">No attachments yet</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="border-t border-surface-100 pt-5">
                                        <p className="mb-3 text-sm text-surface-400">Comments</p>
                                        <div className="mb-3 max-h-48 space-y-3 overflow-y-auto pr-1">
                                            {task.comments?.length ? task.comments.map((comment: any) => (
                                                <div key={comment._id} className="rounded-2xl border border-surface-200 bg-white px-3 py-3">
                                                    <div className="mb-1 flex items-center justify-between text-xs">
                                                        <span className="font-semibold text-surface-700">{comment.userName}</span>
                                                        <span className="text-surface-400">{format(new Date(comment.createdAt), 'MMM d, HH:mm')}</span>
                                                    </div>
                                                    <p className="text-sm text-surface-600">{comment.text}</p>
                                                </div>
                                            )) : (
                                                <p className="text-sm text-surface-400">No comments yet</p>
                                            )}
                                        </div>

                                        <form onSubmit={handleComment} className="relative">
                                            <input
                                                type="text"
                                                value={commentText}
                                                onChange={(e) => setCommentText(e.target.value)}
                                                placeholder="Write a comment..."
                                                className="h-11 w-full rounded-2xl border border-surface-200 bg-white pl-4 pr-12 text-sm outline-none"
                                            />
                                            <button
                                                type="submit"
                                                disabled={!commentText.trim()}
                                                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-brand-600 transition hover:bg-brand-50 disabled:opacity-40"
                                            >
                                                <Send size={14} />
                                            </button>
                                        </form>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default AdminTaskModal;
