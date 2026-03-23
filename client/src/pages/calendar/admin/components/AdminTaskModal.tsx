import React, { useEffect, useMemo, useState } from 'react';
import { addHours, format, startOfHour } from 'date-fns';
import { Bell, Bookmark, CalendarDays, ChevronDown, Flag, Paperclip, Plus, RefreshCcw, Video, X } from 'lucide-react';
import { Modal } from '../../../../components/Modal/index.tsx';
import { useAdminCalendarStore, AdminTask } from '../store/useAdminCalendarStore.ts';
import { useAuthStore } from '../../../../context/authStore.ts';
import { useAppStore } from '../../../../context/appStore.ts';
import { emitErrorToast, emitSuccessToast } from '../../../../context/toastBus.ts';
import { cn } from '../../../../utils/helpers.ts';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers to read stored tag-encoded values
// ──────────────────────────────────────────────────────────────────────────────
const readTagValue = (tags: string[] | undefined, prefix: string, fallback: string) =>
    tags?.find((tag) => tag.startsWith(prefix))?.replace(prefix, '') || fallback;

const readParticipants = (tags: string[] | undefined) => {
    const raw = tags?.find((tag) => tag.startsWith('Participants: '))?.replace('Participants: ', '');
    if (!raw) return [];
    return raw.split(',').map((n) => n.trim()).filter(Boolean);
};

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────
export const AdminTaskModal = () => {
    const { selectedTask, setSelectedTask, createTask, updateTask, deleteTask, addComment, uploadAttachment } =
        useAdminCalendarStore();
    const { user }   = useAuthStore();
    const { users }  = useAppStore();

    const isNew  = selectedTask === 'new';
    const task   = isNew ? null : (selectedTask as AdminTask);
    const isOpen = selectedTask !== null;

    // ── form state ──────────────────────────────────────────────────────────
    const [eventName,          setEventName]          = useState('');
    const [notes,              setNotes]              = useState('');
    const [priority,           setPriority]           = useState<AdminTask['priority']>('none');
    const [status,             setStatus]             = useState<AdminTask['status']>('Pending');
    const [startTime,          setStartTime]          = useState(startOfHour(addHours(new Date(), 1)));
    const [endTime,            setEndTime]            = useState(addHours(startOfHour(addHours(new Date(), 1)), 1));
    const [repeatEvent,        setRepeatEvent]        = useState(false);
    const [createIn,           setCreateIn]           = useState('Marketing campaign');
    const [eventType,          setEventType]          = useState('Meeting & Interview');
    const [meetingProvider,    setMeetingProvider]    = useState('Google Meet');
    const [participants,       setParticipants]       = useState<string[]>([]);
    const [showParticipants,   setShowParticipants]   = useState(false);
    const [commentText,        setCommentText]        = useState('');
    const [pendingFiles,       setPendingFiles]       = useState<File[]>([]);
    const [taskColor,          setTaskColor]          = useState('#4DA3FF');
    const [recurrenceFrequency, setRecurrenceFrequency] = useState<any>('weekly');

    // ── reminder state ───────────────────────────────────────────────────────
    const [showReminderPicker, setShowReminderPicker] = useState(false);
    const [reminderDate,       setReminderDate]       = useState('');
    const [reminderTime,       setReminderTime]       = useState('');

    const reminderAt: Date | null = useMemo(() => {
        if (!reminderDate || !reminderTime) return null;
        const d = new Date(`${reminderDate}T${reminderTime}`);
        return isNaN(d.getTime()) ? null : d;
    }, [reminderDate, reminderTime]);

    const meetingLinkHint = meetingProvider === 'None' ? 'No meeting link will be created' : 'Link will be generated automatically';

    const availableParticipants = useMemo(() => {
        if (!Array.isArray(users) || users.length === 0) return [];
        return users.filter((u) => u.isActive !== false);
    }, [users]);

    // ── populate form when opening ───────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const defaultStart = task?.startDateTime ? new Date(task.startDateTime as any) : startOfHour(addHours(new Date(), 1));
        const defaultEnd   = task?.endDateTime   ? new Date(task.endDateTime   as any) : addHours(defaultStart, 1);
        const stored       = readParticipants(task?.tags);
        const assigned     = task?.assignedUser  ? [task.assignedUser] : [];

        setEventName(task?.title || '');
        setNotes(task?.description || '');
        setPriority(task?.priority || 'none');
        setStatus(task?.status || 'Pending');
        setStartTime(defaultStart);
        setEndTime(defaultEnd);
        setRepeatEvent(Boolean(task?.tags?.includes('Repeat event')));
        setCreateIn(readTagValue(task?.tags, 'Create in: ', 'Marketing campaign'));
        setEventType(readTagValue(task?.tags, 'Type: ', 'Meeting & Interview'));
        setMeetingProvider(readTagValue(task?.tags, 'Provider: ', 'Google Meet'));
        setParticipants(stored.length > 0 ? stored : assigned);
        setCommentText('');
        setPendingFiles([]);
        setTaskColor(task?.color || '#4DA3FF');
        setRecurrenceFrequency(task?.recurrenceRule?.frequency || 'weekly');
        setShowReminderPicker(false);
        setReminderDate('');
        setReminderTime('');
        setShowParticipants(false);
    }, [isOpen, task]);

    if (!isOpen) return null;

    // ── participant toggle ───────────────────────────────────────────────────
    const toggleParticipant = (name: string) =>
        setParticipants((cur) => cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]);

    // ── save ─────────────────────────────────────────────────────────────────
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventName.trim()) return;
        if (endTime <= startTime) { emitErrorToast('End time must be after start time.', 'Invalid time range'); return; }

        const payload: Partial<AdminTask> & { participants?: string[]; reminderAt?: string } = {
            title:        eventName.trim(),
            description:  notes.trim(),
            priority,
            status,
            assignedUser: participants[0] || user?.name || 'Admin',
            startDateTime: startTime.toISOString(),
            endDateTime:   endTime.toISOString(),
            color:        taskColor,
            isRecurring:  repeatEvent,
            recurrenceRule: repeatEvent ? { frequency: recurrenceFrequency, interval: 1 } : undefined,
            participants,                                       // ← stored on task
            reminderAt: reminderAt ? reminderAt.toISOString() : undefined,  // ← reminder
            tags: [
                `Create in: ${createIn}`,
                `Type: ${eventType}`,
                `Provider: ${meetingProvider}`,
                `Participants: ${participants.join(', ')}`,
            ].filter(Boolean),
        };

        const saved = isNew ? await createTask(payload as any) : task ? await updateTask(task._id, payload as any) : null;

        if (saved && pendingFiles.length > 0) {
            for (const file of pendingFiles) await uploadAttachment(saved._id, file);
        }

        if (!saved) { emitErrorToast(isNew ? 'Failed to create event.' : 'Failed to save event.', 'Calendar action failed'); return; }

        emitSuccessToast(isNew ? 'Event created! Participants notified.' : 'Event updated successfully.');
        if (reminderAt) {
            emitSuccessToast(`Reminder set for ${format(reminderAt, 'dd MMM yyyy, HH:mm')}.`);
        }
        setSelectedTask(null);
    };

    const handleDelete = async () => {
        if (!isNew && task && window.confirm('Are you sure you want to delete this event?')) {
            await deleteTask(task._id);
            setSelectedTask(null);
        }
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || isNew || !task) return;
        await addComment(task._id, { text: commentText, userId: user?.id || 'admin', userName: user?.name || 'Admin' });
        setCommentText('');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        if (isNew || !task) { setPendingFiles((cur) => [...cur, ...files]); return; }
        for (const file of files) await uploadAttachment(task._id, file);
    };

    // ──────────────────────────────────────────────────────────────────────────
    return (
        <Modal
            open={isOpen}
            onClose={() => setSelectedTask(null)}
            size="full"
            showClose={false}
            className="max-w-[860px] h-auto max-h-[90vh] rounded-[24px] border-0 bg-white shadow-2xl overflow-hidden"
        >
            <div className="flex h-full flex-col bg-white">

                {/* ── Header ─────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-[#f1f5f9]">
                    <h2 className="text-[22px] font-bold text-[#1e293b]">
                        {isNew ? 'Create event' : 'Edit event'}
                    </h2>
                    <div className="flex items-center gap-4">
                        {/* Repeat toggle */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setRepeatEvent(!repeatEvent)}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all border',
                                    repeatEvent ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm' : 'text-[#64748b] border-transparent hover:bg-slate-50'
                                )}
                            >
                                <RefreshCcw size={15} /><span>Repeat event</span>
                            </button>
                            {repeatEvent && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#e2e8f0] rounded-xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {['daily', 'weekly', 'monthly'].map((freq) => (
                                        <button
                                            key={freq}
                                            type="button"
                                            onClick={() => setRecurrenceFrequency(freq)}
                                            className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-bold capitalize transition-colors', recurrenceFrequency === freq ? 'bg-brand-50 text-brand-700' : 'text-[#475569] hover:bg-[#f8fafc]')}
                                        >
                                            Every {freq.replace('ly', '')}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button type="button" onClick={() => setSelectedTask(null)} className="p-1 text-[#94a3b8] hover:text-[#1e293b] transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* ── Body ───────────────────────────────────────────────────── */}
                <div className="flex flex-1 min-h-0">

                    {/* Left column */}
                    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

                        {/* Date & Time */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2.5 px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] focus-within:bg-white focus-within:border-brand-300 transition-all">
                                <CalendarDays size={18} className="text-[#94a3b8]" />
                                <input
                                    type="date"
                                    value={format(startTime, 'yyyy-MM-dd')}
                                    onChange={(e) => {
                                        const [y, m, d] = e.target.value.split('-').map(Number);
                                        const nextS = new Date(startTime); nextS.setFullYear(y, m - 1, d);
                                        const nextE = new Date(endTime);   nextE.setFullYear(y, m - 1, d);
                                        setStartTime(nextS); setEndTime(nextE);
                                    }}
                                    className="bg-transparent text-sm font-bold text-[#1e293b] outline-none cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center border border-[#e2e8f0] rounded-xl bg-[#f8fafc] p-1 font-bold text-sm text-[#1e293b]">
                                <input type="time" value={format(startTime, 'HH:mm')} onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); const n = new Date(startTime); n.setHours(h, m); setStartTime(n); }} className="bg-transparent px-2 py-1 outline-none cursor-pointer" />
                                <span className="px-1 text-[#94a3b8]">-</span>
                                <input type="time" value={format(endTime,   'HH:mm')} onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); const n = new Date(endTime);   n.setHours(h, m); setEndTime(n);   }} className="bg-transparent px-2 py-1 outline-none cursor-pointer" />
                            </div>
                        </div>

                        {/* Event title */}
                        <input
                            type="text"
                            placeholder="Project status update meeting"
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)}
                            className="w-full text-[20px] font-bold text-[#1e293b] placeholder:text-[#cbd5e1] outline-none border border-[#e2e8f0] rounded-xl px-4 py-2.5 bg-[#f8fafc] focus:bg-white focus:border-brand-400 transition-all shadow-sm"
                        />

                        {/* Meeting provider */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2.5 px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] flex-1">
                                <Video size={18} className="text-[#34a853]" />
                                <select value={meetingProvider} onChange={(e) => setMeetingProvider(e.target.value)} className="bg-transparent text-sm font-bold text-[#1e293b] outline-none flex-1 cursor-pointer">
                                    <option>Google Meet</option>
                                    <option>Zoom</option>
                                    <option>Teams</option>
                                    <option>None</option>
                                </select>
                                <ChevronDown size={14} className="text-[#94a3b8]" />
                            </div>
                            <span className="text-[13px] text-[#94a3b8] font-medium">{meetingLinkHint}</span>
                        </div>

                        {/* Description */}
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={"Let's discuss:\n• What progress have we made toward the campaign's launch\n• What are the major challenges or obstacles\n• Are we on track to meet our next set of milestones"}
                            className="w-full h-[160px] border border-[#e2e8f0] rounded-2xl bg-[#f8fafc] p-4 text-[14px] leading-relaxed text-[#475569] placeholder:text-[#cbd5e1] outline-none focus:bg-white focus:border-brand-400 transition-all resize-none shadow-inner"
                        />

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 pt-1 flex-wrap">
                            {/* Attach file */}
                            <label className="flex items-center gap-2 text-[#64748b] bg-[#f1f5f9] px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-[#e2e8f0] transition-colors cursor-pointer">
                                <Paperclip size={16} />
                                <span>Attach file</span>
                                <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                            </label>
                            {pendingFiles.length > 0 && (
                                <span className="text-xs font-bold text-[#64748b]">{pendingFiles.length} file(s) ready</span>
                            )}

                            {/* Set reminder */}
                            <button
                                type="button"
                                onClick={() => setShowReminderPicker((v) => !v)}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                                    reminderAt
                                        ? 'bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]'
                                        : 'text-[#2563eb] bg-[#eff6ff] hover:bg-[#dbeafe]'
                                )}
                            >
                                <Bell size={16} />
                                <span>{reminderAt ? `Reminder: ${format(reminderAt, 'dd MMM HH:mm')}` : 'Set reminder'}</span>
                            </button>
                        </div>

                        {/* Reminder picker inline */}
                        {showReminderPicker && (
                            <div className="flex items-center gap-3 p-4 border border-[#bfdbfe] rounded-xl bg-[#eff6ff]">
                                <Bell size={18} className="text-[#2563eb] shrink-0" />
                                <div className="flex flex-col gap-2 flex-1">
                                    <p className="text-[12px] font-bold text-[#2563eb] uppercase tracking-wider">Reminder time</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            value={reminderDate}
                                            onChange={(e) => setReminderDate(e.target.value)}
                                            className="border border-[#bfdbfe] rounded-lg px-3 py-1.5 text-sm font-bold text-[#1e293b] bg-white outline-none focus:border-[#2563eb]"
                                        />
                                        <input
                                            type="time"
                                            value={reminderTime}
                                            onChange={(e) => setReminderTime(e.target.value)}
                                            className="border border-[#bfdbfe] rounded-lg px-3 py-1.5 text-sm font-bold text-[#1e293b] bg-white outline-none focus:border-[#2563eb]"
                                        />
                                    </div>
                                    {reminderAt && (
                                        <p className="text-[11px] text-[#2563eb] font-medium">
                                            Alert fires at: {format(reminderAt, 'dd MMM yyyy, HH:mm')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right sidebar */}
                    <div className="w-[300px] bg-[#f8fafc] border-l border-[#f1f5f9] px-6 py-6 overflow-y-auto space-y-6">

                        {/* Create In */}
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">Create in</p>
                            <select value={createIn} onChange={(e) => setCreateIn(e.target.value)} className="w-full bg-white border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm font-bold text-[#1e293b] outline-none shadow-sm cursor-pointer">
                                <option>Marketing campaign</option>
                                <option>Sales Funnel</option>
                                <option>Internal Sync</option>
                            </select>
                        </div>
                        {/* Type */}
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">Type</p>
                            <div className="flex items-center gap-3 px-3 py-2.5 bg-white border border-[#e2e8f0] rounded-xl shadow-sm">
                                <div className="h-4 w-4 rounded" style={{ backgroundColor: taskColor }} />
                                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="bg-transparent text-sm font-bold text-[#1e293b] outline-none flex-1 cursor-pointer">
                                    <option>Meeting & Interview</option>
                                    <option>Planning</option>
                                    <option>Feedback</option>
                                </select>
                            </div>
                        </div>

                        {/* Priority */}
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">Priority</p>
                            <div className={cn(
                                "flex items-center gap-3 px-3 py-2.5 bg-white border rounded-xl shadow-sm transition-all",
                                priority === 'high'   ? "border-red-200 bg-red-50 text-red-700" :
                                priority === 'medium' ? "border-amber-200 bg-amber-50 text-amber-700" :
                                priority === 'low'    ? "border-blue-200 bg-blue-50 text-blue-700" :
                                "border-[#e2e8f0] bg-white text-[#1e293b]"
                            )}>
                                <Flag size={16} fill={priority !== 'none' ? 'currentColor' : 'none'} className={cn(
                                    priority === 'none' ? "text-[#94a3b8]" : "text-current"
                                )} />
                                <select 
                                    value={priority} 
                                    onChange={(e) => setPriority(e.target.value as any)} 
                                    className="bg-transparent text-sm font-bold outline-none flex-1 cursor-pointer"
                                >
                                    <option value="none" className="text-[#1e293b]">None</option>
                                    <option value="high" className="text-red-700">High</option>
                                    <option value="medium" className="text-amber-700">Medium</option>
                                    <option value="low" className="text-blue-700">Low</option>
                                </select>
                                <ChevronDown size={14} className={priority === 'none' ? "text-[#94a3b8]" : "text-current opacity-70"} />
                            </div>
                        </div>

                        {/* Participants */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">Participants</p>
                            </div>
                            <div className="space-y-2">
                                {/* Currently selected */}
                                {participants.map((name) => {
                                    const found = availableParticipants.find((u) => u.name === name);
                                    return (
                                        <div key={name} className="flex items-center gap-2.5">
                                            <div className="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center text-white font-bold text-xs shadow-sm" style={{ backgroundColor: found?.color || '#4DA3FF' }}>
                                                {name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-sm font-bold text-[#1e293b] flex-1">{name}</span>
                                            <button type="button" onClick={() => toggleParticipant(name)} className="text-[#94a3b8] hover:text-red-500 transition-colors">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    );
                                })}

                                {/* Add participants button */}
                                <button
                                    type="button"
                                    onClick={() => setShowParticipants((v) => !v)}
                                    className="flex items-center gap-2 text-brand-600 text-sm font-bold mt-1 hover:underline"
                                >
                                    <Plus size={15} />
                                    <span>Add participants</span>
                                </button>

                                {/* Participant picker dropdown */}
                                {showParticipants && (
                                    <div className="mt-1 border border-[#e2e8f0] rounded-xl bg-white shadow-lg max-h-[180px] overflow-y-auto">
                                        {availableParticipants.map((p) => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => toggleParticipant(p.name)}
                                                className={cn(
                                                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold transition-colors text-left',
                                                    participants.includes(p.name)
                                                        ? 'bg-brand-50 text-brand-700'
                                                        : 'hover:bg-[#f8fafc] text-[#1e293b]'
                                                )}
                                            >
                                                <div className="h-7 w-7 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: p.color || '#4DA3FF' }}>
                                                    {p.name.charAt(0)}
                                                </div>
                                                <span className="flex-1 truncate">{p.name}</span>
                                                {participants.includes(p.name) && <Bookmark size={12} className="text-brand-500 fill-brand-500" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Footer ────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-8 py-4 border-t border-[#f1f5f9] bg-[#f8fafc]/50">
                    {!isNew ? (
                        <button type="button" onClick={handleDelete} className="text-red-500 text-sm font-bold hover:underline">
                            Delete event
                        </button>
                    ) : <div />}
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setSelectedTask(null)} className="px-6 py-2.5 text-sm font-bold text-[#64748b] hover:text-[#1e293b] transition-all">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="bg-[#2563eb] text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-[#1d4ed8] transition-all"
                        >
                            {isNew ? 'Create event' : 'Save changes'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default AdminTaskModal;
