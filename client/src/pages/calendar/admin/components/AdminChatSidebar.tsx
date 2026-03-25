import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Send, Paperclip, ChevronLeft, MessageCircle, Users, Plus, ChevronDown, Info, UserRound } from 'lucide-react';
import { useAdminChatStore, Conversation, Message } from '../store/useAdminChatStore.ts';
import { useAuthStore } from '../../../../context/authStore.ts';
import { format } from 'date-fns';
import { cn } from '../../../../utils/helpers.ts';
import { useAppStore } from '../../../../context/appStore.ts';
import api from '../../../../services/api';
import type { User } from '../../../../app/types';

const participantId = (participant?: { _id?: string; id?: string } | null) => String(participant?._id || participant?.id || '');
const messageSenderId = (sender?: string | { _id?: string; id?: string } | null) =>
    typeof sender === 'string' ? String(sender) : String(sender?._id || sender?.id || '');
const entityId = (value?: string | { _id?: string; id?: string } | null) =>
    typeof value === 'string' ? String(value) : String(value?._id || value?.id || '');
const sameId = (a?: string | null, b?: string | null) => String(a || '') === String(b || '');
const asUsersArray = (value: unknown): User[] => (Array.isArray(value) ? value as User[] : []);
const isGroupConversation = (conversation?: Conversation | null) =>
    Boolean(conversation?.isGroup || conversation?.groupType === 'project' || conversation?.groupType === 'team' || entityId(conversation?.projectId as string | undefined));
const getOtherParticipant = (convo: Conversation, currentUserId: string) =>
    convo.participants.find((p) => !sameId(participantId(p), currentUserId));

const MessageBubble = ({ message, isMe, showSender }: { message: Message, isMe: boolean, showSender: boolean }) => (
    <div className={cn(
        "flex flex-col mb-4 max-w-full",
        isMe ? "items-end" : "items-start"
    )}>
        {showSender && (
            <span className={cn(
                "mb-1 px-1 text-[11px] font-semibold",
                isMe ? "text-brand-500" : "text-surface-500"
            )}>
                {isMe ? 'You' : (message.senderName || 'Unknown')}
            </span>
        )}
        <div className={cn(
            "max-w-[85%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm break-words",
            isMe
                ? "bg-brand-500 text-white rounded-br-md"
                : "bg-white dark:bg-surface-800 text-surface-900 dark:text-white rounded-bl-md border border-surface-200 dark:border-surface-700"
        )}>
            {message.text}
        </div>
        <span className="text-[11px] text-surface-400 dark:text-surface-500 mt-1 tabular-nums">
            {format(new Date(message.createdAt), 'HH:mm')}
        </span>
    </div>
);

const ConversationItem = ({ convo, isActive, onClick, currentUserId }: { convo: Conversation, isActive: boolean, onClick: () => void, currentUserId: string }) => {
    // For direct chat, the participant is the other guy (not me)
    const isGroup = isGroupConversation(convo);
    const otherParticipant = isGroup ? null : getOtherParticipant(convo, currentUserId);
    const displayName = isGroup ? (convo.groupName || 'Group Chat') : (otherParticipant?.name || 'Inquiry Session');
    const avatar = isGroup ? <Users size={20} className="text-brand-600" /> : (otherParticipant?.avatar ? <img src={otherParticipant.avatar} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-brand-600 font-semibold">{(displayName || 'U')[0]}</span>);

    return (
        <button 
            onClick={onClick}
            className={cn(
                "w-full px-5 py-4 flex items-center gap-3 transition-all border-b border-surface-100 dark:border-surface-800 relative group",
                isActive ? "bg-surface-50 dark:bg-surface-800" : "hover:bg-surface-50/50 dark:hover:bg-surface-800/50"
            )}
        >
            <div className={cn(
                "w-11 h-11 rounded-full border flex items-center justify-center text-sm shrink-0 overflow-hidden transition-colors bg-surface-100 dark:bg-surface-800",
                isActive ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm" : "border-surface-200 dark:border-surface-700"
            )}>
                 {avatar}
            </div>
            <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between mb-0.5">
                    <span className={cn(
                        "text-[14px] font-semibold transition-colors truncate pr-2",
                        isActive ? "text-brand-600" : "text-surface-900 group-hover:text-brand-600"
                    )}>
                        {displayName}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] text-surface-400 tabular-nums">
                            {convo.lastMessage?.createdAt ? format(new Date(convo.lastMessage.createdAt), 'HH:mm') : ''}
                        </span>
                        {(convo.unreadCount || 0) > 0 && (
                            <div className="bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center animate-in zoom-in">
                                {convo.unreadCount}
                            </div>
                        )}
                    </div>
                </div>
                <p className="text-[12px] text-surface-500 truncate font-normal">{convo.lastMessage?.text || 'No messages yet'}</p>
            </div>
            {isActive && <div className="absolute right-0 top-0 bottom-0 w-1 bg-brand-500" />}
        </button>
    );
};

const CreateGroupView = ({ onCancel, onCreate }: { onCancel: () => void, onCreate: (name: string, members: string[]) => void }) => {
    const [name, setName] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const { users } = useAppStore();
    const userList = asUsersArray(users);

    const filteredUsers = userList.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-surface-900">
            <div className="px-6 py-5 border-b border-surface-100 dark:border-surface-800 flex items-center gap-3">
                <button onClick={onCancel} className="p-1 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg text-surface-400 dark:text-surface-500">
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-[18px] font-semibold text-surface-900 dark:text-white">New Group</h1>
            </div>

            <div className="p-5 space-y-5 flex-1 overflow-y-auto">
                <div>
                    <label className="text-[12px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider block mb-2">Group Name</label>
                    <input 
                        type="text" 
                        placeholder="e.g. Design Team" 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-[14px] text-surface-900 dark:text-white outline-none focus:border-brand-500 transition-all font-medium"
                    />
                </div>

                <div>
                    <label className="text-[12px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider block mb-2">Select Members</label>
                    <div className="relative mb-3">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                        <input 
                            type="text" 
                            placeholder="Search people..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl pl-9 pr-4 py-2 text-[13px] text-surface-900 dark:text-white outline-none focus:border-brand-500 transition-all"
                        />
                    </div>
                    
                    <div className="space-y-1">
                        {filteredUsers.map(u => (
                            <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-surface-50 rounded-xl cursor-pointer transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={selected.includes(u.id)}
                                    onChange={e => {
                                        if (e.target.checked) setSelected([...selected, u.id]);
                                        else setSelected(selected.filter(id => id !== u.id));
                                    }}
                                    className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                                />
                                <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-xs font-semibold text-brand-600">
                                    {u.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-surface-900 truncate">{u.name}</p>
                                    <p className="text-[11px] text-surface-400 truncate">{u.jobTitle}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-950/50">
                <button 
                    disabled={!name.trim() || selected.length === 0}
                    onClick={() => onCreate(name, selected)}
                    className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:hover:bg-brand-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98]"
                >
                    Create Group
                </button>
            </div>
        </div>
    );
};

const GroupOverviewPanel = ({
    conversation,
    currentUserId,
    onClose,
}: {
    conversation: Conversation;
    currentUserId: string;
    onClose: () => void;
}) => {
    const members = conversation.participants || [];
    const otherMembers = members.filter((member) => !sameId(participantId(member), currentUserId));

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="absolute inset-y-0 right-0 w-full bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-800 z-10 flex flex-col"
        >
            <div className="px-6 py-5 border-b border-surface-100 dark:border-surface-800 flex items-center gap-3">
                <button onClick={onClose} className="p-1 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg text-surface-400 dark:text-surface-500">
                    <ChevronLeft size={20} />
                </button>
                <div className="min-w-0">
                    <h2 className="text-[18px] font-semibold text-surface-900 dark:text-white truncate">{conversation.groupName || 'Group Overview'}</h2>
                    <p className="text-[12px] text-surface-400 dark:text-surface-500 truncate">{members.length} members</p>
                </div>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 flex items-center justify-center text-brand-600 shadow-sm">
                            <Users size={24} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-base font-semibold text-surface-900 dark:text-white truncate">{conversation.groupName || 'Project Group'}</p>
                            <p className="text-xs text-surface-500 dark:text-surface-400 capitalize">
                                {conversation.groupType || 'group'} {conversation.department ? `• ${conversation.department}` : ''}
                            </p>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-[12px] font-bold text-surface-400 uppercase tracking-wider mb-3">Members</h3>
                    <div className="space-y-2">
                        {members.map((member) => (
                            <div key={participantId(member)} className="flex items-center gap-3 rounded-xl border border-surface-100 px-3 py-3">
                                <div className="w-10 h-10 rounded-full bg-surface-100 flex items-center justify-center text-xs font-semibold text-brand-600">
                                    {member.name?.[0] || 'U'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-surface-900 truncate">
                                        {member.name}
                                        {sameId(participantId(member), currentUserId) ? ' (You)' : ''}
                                    </p>
                                    <p className="text-[11px] text-surface-400 truncate">{member.email}</p>
                                </div>
                                <span className="text-[10px] uppercase tracking-wide text-surface-400">
                                    {member.role?.replace(/_/g, ' ')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {otherMembers.length > 0 && (
                    <div>
                        <h3 className="text-[12px] font-bold text-surface-400 uppercase tracking-wider mb-3">Quick Contacts</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {otherMembers.map((member) => (
                                <div key={`quick-${participantId(member)}`} className="rounded-xl border border-surface-100 px-3 py-3 bg-white">
                                    <p className="text-sm font-medium text-surface-900 truncate">{member.name}</p>
                                    <p className="text-[11px] text-surface-400 truncate">{member.role?.replace(/_/g, ' ')}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const StartDirectView = ({ onCancel, onSelect }: { onCancel: () => void, onSelect: (userId: string) => void }) => {
    const [search, setSearch] = useState('');
    const { users } = useAppStore();
    const { user } = useAuthStore();
    const userList = asUsersArray(users);

    const filteredUsers = userList.filter((item) =>
        item.id !== user?.id &&
        item.isActive &&
        `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-surface-900">
            <div className="px-6 py-5 border-b border-surface-100 dark:border-surface-800 flex items-center gap-3">
                <button onClick={onCancel} className="p-1 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg text-surface-400 dark:text-surface-500">
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-[18px] font-semibold text-surface-900 dark:text-white">New Message</h1>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
                    <input
                        type="text"
                        placeholder="Search people..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl pl-9 pr-4 py-2 text-[13px] text-surface-900 dark:text-white outline-none focus:border-brand-500 transition-all font-medium"
                    />
                </div>

                <div className="space-y-1">
                    {filteredUsers.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onSelect(item.id)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-xl text-left transition-colors"
                        >
                            <div className="w-9 h-9 rounded-full bg-surface-100 flex items-center justify-center text-xs font-semibold text-brand-600">
                                {item.name[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-surface-900 truncate">{item.name}</p>
                                <p className="text-[11px] text-surface-400 truncate">{item.email}</p>
                            </div>
                            <span className="text-[10px] uppercase tracking-wide text-surface-400">
                                {item.role.replace(/_/g, ' ')}
                            </span>
                        </button>
                    ))}
                    {filteredUsers.length === 0 && (
                        <p className="text-sm text-surface-400 text-center py-8">No matching users found.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export const AdminChatSidebar = () => {
    const { isOpen, setOpen, activeConversationId, setActiveConversation, conversations, fetchConversations, messages, sendMessage, createGroup, startConversation, loading } = useAdminChatStore();
    const { user } = useAuthStore();
    const { users } = useAppStore();
    const userList = asUsersArray(users);
    const [projects, setProjects] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [input, setInput] = useState('');
    const [activeTab, setActiveTab] = useState<'direct' | 'projects'>('direct');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isStartingDirect, setIsStartingDirect] = useState(false);
    const [showGroupOverview, setShowGroupOverview] = useState(false);
    const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/projects');
            setProjects(res.data.data ?? res.data);
        } catch (error) {
            console.error('Failed to fetch projects', error);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchConversations();
            fetchProjects();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const interval = window.setInterval(() => {
            fetchConversations();
            if (activeConversationId) {
                useAdminChatStore.getState().fetchMessages(activeConversationId);
            }
        }, 4000);

        return () => {
            window.clearInterval(interval);
        };
    }, [isOpen, activeConversationId, fetchConversations]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const activeConvo = conversations.find(c => c._id === activeConversationId);
    
    const isMeCheck = (senderId: Message['senderId']) => sameId(messageSenderId(senderId), user?.id); 

    const visibleProjects = projects.filter((project) => {
        const members = Array.isArray(project.members) ? project.members : [];
        return members.some((memberId: string) => String(memberId) === String(user?.id));
    });

    // Merged view of Projects and Conversations for the "Project Teams" tab
    const projectList = visibleProjects.map(project => {
        const projectId = entityId(project);
        const convo = conversations.find((c) => {
            if (!isGroupConversation(c)) return false;

            const conversationProjectId = entityId(c.projectId as string | undefined);
            if (projectId && conversationProjectId && sameId(conversationProjectId, projectId)) {
                return true;
            }

            return c.groupType === 'project' && c.groupName === `${project.name} (Project)`;
        });
        return {
            ...project,
            conversation: convo
        };
    });

    const filteredProjectList = projectList.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    const groupedProjects = filteredProjectList.reduce((acc, proj) => {
        const dept = proj.department || 'General';
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(proj);
        return acc;
    }, {} as Record<string, any[]>);

    // Filter conversations for the "Direct" tab
    const directConversations = conversations.filter((c) => {
        if (isGroupConversation(c)) return false;
        const other = getOtherParticipant(c, user?.id || '');
        if (!other) return false;
        return `${other?.name || ''} ${other?.email || ''}`.toLowerCase().includes(search.toLowerCase());
    });

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        await sendMessage(input);
        await fetchConversations();
        if (activeConversationId) {
            await useAdminChatStore.getState().fetchMessages(activeConversationId);
        }
        setInput('');
    };

    const handleCreateGroup = async (name: string, members: string[]) => {
        const res = await createGroup(name, members);
        if (res) {
            setIsCreatingGroup(false);
            setActiveConversation(res._id);
        }
    };

    const handleStartDirect = async (participantId: string) => {
        const res = await startConversation(participantId);
        if (res) {
            setIsStartingDirect(false);
            setActiveConversation(res._id);
            await fetchConversations();
        }
    };

    const handleStartProjectChat = async (project: any) => {
        if (isGroupConversation(project.conversation)) {
            setActiveConversation(project.conversation._id);
        } else {
            // If No conversation, create one
            const res = await createGroup(`${project.name} (Project)`, project.members || [], {
                projectId: project._id || project.id,
                groupType: 'project',
                department: project.department || 'General'
            });
            if (res) {
                // Update projects list locally to include the new convo
                setProjects(prev => prev.map(p => (p._id === project._id || p.id === project.id) ? { ...p, conversation: res } : p));
                setActiveConversation(res._id);
                await fetchConversations();
            }
        }
    };

    const currentRecipient = isGroupConversation(activeConvo)
        ? activeConvo?.groupName 
        : (activeConvo ? getOtherParticipant(activeConvo, user?.id || '')?.name : undefined) || 'Chat Session';

    const availableDirectUsers = userList.filter((item) =>
        item.id !== user?.id &&
        item.isActive &&
        `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 bg-black/5 backdrop-blur-[1px] z-[100]"
                    />

                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.3 }}
                        className="fixed inset-y-0 right-0 w-full xs:w-[340px] sm:w-[380px] bg-white dark:bg-surface-900 shadow-xl z-[110] flex flex-col border-l border-surface-200 dark:border-surface-800 text-surface-900 dark:text-white font-sans overflow-hidden"
                    >
                        {isCreatingGroup ? (
                            <CreateGroupView 
                                onCancel={() => setIsCreatingGroup(false)} 
                                onCreate={handleCreateGroup} 
                            />
                        ) : isStartingDirect ? (
                            <StartDirectView
                                onCancel={() => setIsStartingDirect(false)}
                                onSelect={handleStartDirect}
                            />
                        ) : !activeConversationId ? (
                            <>
                                <div className="px-6 py-5 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between bg-white dark:bg-surface-900 sticky top-0 z-20">
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-[18px] font-semibold text-surface-900 dark:text-white">Messages</h1>
                                        <button
                                            onClick={() => setIsStartingDirect(true)}
                                            className="p-1.5 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-400 dark:text-surface-500 hover:text-brand-600 rounded-lg transition-all"
                                            title="New direct message"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                    <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-400 dark:text-surface-500 hover:text-surface-900 dark:hover:text-white rounded-lg transition-all">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="px-5 pt-4 flex gap-6 border-b border-surface-100 dark:border-surface-800">
                                    <button 
                                        onClick={() => setActiveTab('direct')}
                                        className={cn(
                                            "pb-3 text-sm font-semibold relative transition-colors",
                                            activeTab === 'direct' ? "text-brand-600" : "text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300"
                                        )}
                                    >
                                        Direct
                                        {activeTab === 'direct' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />}
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('projects')}
                                        className={cn(
                                            "pb-3 text-sm font-semibold relative transition-colors",
                                            activeTab === 'projects' ? "text-brand-600" : "text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300"
                                        )}
                                    >
                                        Project Teams
                                        {activeTab === 'projects' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />}
                                    </button>
                                </div>

                                <div className="p-4">
                                    <div className="relative group">
                                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 focus-within:text-brand-500" />
                                        <input 
                                            type="text" 
                                            placeholder={`Search ${activeTab === 'projects' ? 'project teams' : 'direct messages'}...`} 
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl pl-11 pr-4 py-2 text-[14px] text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-surface-700 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center p-12 opacity-50 gap-4">
                                            <div className="w-6 h-6 border-2 border-surface-200 border-t-brand-500 rounded-full animate-spin" />
                                            <span className="text-[12px]">Loading...</span>
                                        </div>
                                    ) : (
                                        <div className="pb-4">
                                            {activeTab === 'projects' ? (
                                                Object.entries(groupedProjects).length > 0 ? (
                                                    (Object.entries(groupedProjects) as any).map(([dept, deptProjs]: any) => (
                                                        <div key={dept} className="mb-2">
                                                            <button 
                                                                onClick={() => setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }))}
                                                                className="w-full px-5 py-2 flex items-center justify-between bg-surface-50/50 dark:bg-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800 border-y border-surface-100/50 dark:border-surface-700/50 transition-colors"
                                                            >
                                                                <span className="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest">{dept} ({deptProjs.length})</span>
                                                                <ChevronDown 
                                                                    size={12} 
                                                                    className={cn('text-surface-400 dark:text-surface-500 transition-transform', collapsedDepts[dept] ? '-rotate-90' : '')} 
                                                                />
                                                            </button>
                                                            {!collapsedDepts[dept] && (
                                                                <div className="divide-y divide-surface-50 dark:divide-surface-800">
                                                                    {deptProjs.map((proj: any) => (
                                                                         <button 
                                                                            key={proj._id || proj.id}
                                                                            onClick={() => handleStartProjectChat(proj)}
                                                                            className={cn(
                                                                                "w-full px-5 py-4 flex items-center gap-3 transition-all border-b border-surface-100 dark:border-surface-800 relative group text-left",
                                                                                activeConversationId === proj.conversation?._id ? "bg-surface-50 dark:bg-surface-800" : "hover:bg-surface-50/50 dark:hover:bg-surface-800/50"
                                                                            )}
                                                                        >
                                                                            <div className={cn(
                                                                                "w-11 h-11 rounded-full border flex items-center justify-center text-sm shrink-0 overflow-hidden transition-colors bg-surface-100 dark:bg-surface-800",
                                                                                activeConversationId === proj.conversation?._id ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm" : "border-surface-200 dark:border-surface-700"
                                                                            )}>
                                                                                <Users size={20} className="text-brand-600 dark:text-brand-400" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center justify-between mb-0.5">
                                                                                    <span className={cn(
                                                                                        "text-[14px] font-semibold transition-colors truncate pr-2",
                                                                                        activeConversationId === proj.conversation?._id ? "text-brand-600 dark:text-brand-400" : "text-surface-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400"
                                                                                    )}>
                                                                                        {proj.name}
                                                                                    </span>
                                                                                    <span className="text-[11px] text-surface-400 dark:text-surface-500 tabular-nums">
                                                                                        {proj.conversation?.lastMessage?.createdAt ? format(new Date(proj.conversation.lastMessage.createdAt), 'HH:mm') : ''}
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-[12px] text-surface-500 dark:text-surface-400 truncate font-normal">
                                                                                    {proj.conversation?.lastMessage?.text || 'No messages yet'}
                                                                                </p>
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center p-12 text-center text-surface-400">
                                                        <Users size={32} className="mb-2 opacity-20" />
                                                        <p className="text-sm">No projects found</p>
                                                    </div>
                                                )
                                            ) : (
                                                <>
                                                    {directConversations.length > 0 && directConversations.map(convo => (
                                                        <ConversationItem 
                                                            key={convo._id} 
                                                            convo={convo} 
                                                            isActive={activeConversationId === convo._id}
                                                            onClick={() => setActiveConversation(convo._id)}
                                                            currentUserId={user?.id || ''}
                                                        />
                                                    ))}
{/* 
                                                    <div className="px-5 py-3 border-t border-surface-100 bg-surface-50/60">
                                                        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-2">All Employees</p>
                                                        <div className="space-y-1 max-h-64 overflow-y-auto">
                                                            {availableDirectUsers.map((item) => (
                                                                <button
                                                                    key={`employee-${item.id}`}
                                                                    onClick={() => handleStartDirect(item.id)}
                                                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white transition-colors text-left"
                                                                >
                                                                    <div className="w-9 h-9 rounded-full bg-surface-100 flex items-center justify-center text-xs font-semibold text-brand-600">
                                                                        {item.name[0]}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-sm font-medium text-surface-900 truncate">{item.name}</p>
                                                                        <p className="text-[11px] text-surface-400 truncate">{item.email}</p>
                                                                    </div>
                                                                    <UserRound size={14} className="text-surface-300 flex-shrink-0" />
                                                                </button>
                                                            ))}
                                                            {availableDirectUsers.length === 0 && directConversations.length === 0 && (
                                                                <div className="flex flex-col items-center justify-center p-8 text-center text-surface-400">
                                                                    <MessageCircle size={32} className="mb-2 opacity-20" />
                                                                    <p className="text-sm">No employees found</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div> */}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {activeTab === 'projects' && ['admin', 'manager', 'team_leader'].includes(user?.role || '') && (
                                    <div className="p-4 border-t border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-950/50">
                                        <button 
                                            onClick={() => setIsCreatingGroup(true)}
                                            className="w-full py-2.5 bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700 text-brand-600 dark:text-brand-400 rounded-xl text-xs font-bold border border-brand-200 dark:border-brand-800 shadow-sm transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus size={14} /> Create New Group
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between bg-white dark:bg-surface-900 shrink-0 shadow-sm">
                                     <div className="flex items-center gap-3 min-w-0">
                                         <button
                                            className="sm:hidden p-2 -ml-2 text-surface-400 dark:text-surface-500 hover:text-surface-900 dark:hover:text-white rounded-lg"
                                            onClick={() => setActiveConversation(null)}
                                         >
                                            <ChevronLeft size={18} />
                                         </button>
                                         <div className="w-14 h-14 rounded-full bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-800 dark:to-surface-900 border border-surface-200 dark:border-surface-700 flex items-center justify-center text-brand-600 dark:text-brand-400 relative shrink-0 shadow-inner">
                                             {isGroupConversation(activeConvo) ? <Users size={24} /> : <span className="text-lg font-semibold">{currentRecipient ? currentRecipient[0] : 'U'}</span>}
                                             <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-surface-900" />
                                         </div>
                                         <div className="flex-1 min-w-0">
                                              <div className="text-[15px] font-semibold text-surface-900 dark:text-white leading-tight truncate">
                                                  {currentRecipient}
                                              </div>
                                              <span className="text-[12px] text-emerald-500 dark:text-emerald-400 font-semibold block mt-0.5 truncate">
                                                  {isGroupConversation(activeConvo) ? `@${activeConvo?.participants.length || 0} members` : 'Online'}
                                              </span>
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-1">
                                         {isGroupConversation(activeConvo) && (
                                             <button
                                                 className="p-2 text-surface-400 dark:text-surface-500 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg"
                                                 onClick={() => setShowGroupOverview(true)}
                                                 title="Group overview"
                                             >
                                                 <Info size={18} />
                                             </button>
                                         )}
                                         <button className="hidden sm:flex p-2 text-surface-400 dark:text-surface-500 hover:text-surface-900 dark:hover:text-white rounded-lg" onClick={() => setActiveConversation(null)}>
                                             <X size={18} />
                                         </button>
                                     </div>
                                </div>

                                <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-surface-50/80 to-white dark:from-surface-950/80 dark:to-surface-900 px-4 py-5 sm:px-5">
                                    {messages.length > 0 ? (
                                        <div className="space-y-1">
                                            {messages.map((msg, index) => {
                                                const previous = messages[index - 1];
                                                const showSender = !previous || messageSenderId(previous.senderId) !== messageSenderId(msg.senderId);
                                                return (
                                                    <MessageBubble
                                                        key={msg._id}
                                                        message={msg}
                                                        isMe={isMeCheck(msg.senderId)}
                                                        showSender={showSender || Boolean(isGroupConversation(activeConvo))}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center text-surface-400 dark:text-surface-500 px-6">
                                            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center shadow-sm mb-4">
                                                <MessageCircle size={24} className="opacity-60" />
                                            </div>
                                            <p className="text-sm font-medium text-surface-600 dark:text-surface-300">No messages yet</p>
                                            <p className="text-xs mt-1 max-w-[220px] dark:text-surface-400">Start the conversation with a quick update or question.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 border-t border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shrink-0">
                                    <form onSubmit={handleSend} className="relative flex items-center gap-2 rounded-3xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-surface-800 px-2 py-1.5 shadow-[0_8px_24px_rgba(51,102,255,0.08)] focus-within:border-brand-400 transition-all">
                                        <button type="button" className="p-2.5 text-surface-400 dark:text-surface-500 hover:text-brand-500 transition-colors rounded-xl">
                                            <Paperclip size={18} />
                                        </button>
                                        <input
                                            type="text"
                                            placeholder="Type a message..."
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            className="flex-1 bg-transparent text-[14px] text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 py-3 outline-none px-1 min-w-0"
                                        />
                                        <button 
                                            type="submit" 
                                            className="p-3 bg-brand-500 text-white rounded-2xl shadow shadow-brand-500/20 hover:bg-brand-600 transition-all active:scale-95 disabled:opacity-30 disabled:scale-100"
                                            disabled={!input.trim()}
                                        >
                                            <Send size={18} />
                                        </button>
                                    </form>
                                </div>

                                <AnimatePresence>
                                    {showGroupOverview && isGroupConversation(activeConvo) && (
                                        <GroupOverviewPanel
                                            conversation={activeConvo as Conversation}
                                            currentUserId={user?.id || ''}
                                            onClose={() => setShowGroupOverview(false)}
                                        />
                                    )}
                                </AnimatePresence>
                            </>
                        )}

                        {!isCreatingGroup && !isStartingDirect && !activeConversationId && (
                            <button
                                type="button"
                                onClick={() => setIsStartingDirect(true)}
                                className="absolute right-5 bottom-5 w-14 h-14 rounded-full bg-brand-500 text-white shadow-[0_18px_40px_rgba(51,102,255,0.35)] flex items-center justify-center hover:bg-brand-600 transition-all z-20"
                                title="New chat"
                            >
                                <Plus size={24} />
                            </button>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
