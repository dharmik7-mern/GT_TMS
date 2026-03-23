import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Send, Paperclip, ChevronLeft, MessageCircle, Users, Plus, ChevronDown } from 'lucide-react';
import { useAdminChatStore, Conversation, Message } from '../store/useAdminChatStore.ts';
import { useAuthStore } from '../../../../context/authStore.ts';
import { format } from 'date-fns';
import { cn } from '../../../../utils/helpers.ts';
import { useAppStore } from '../../../../context/appStore.ts';
import api from '../../../../services/api';

const MessageBubble = ({ message, isMe }: { message: Message, isMe: boolean }) => (
    <div className={cn(
        "flex flex-col mb-4 max-w-full",
        isMe ? "items-end" : "items-start"
    )}>
        <div className={cn(
            "max-w-[85%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm break-words",
            isMe
                ? "bg-brand-500 text-white rounded-br-md"
                : "bg-white text-surface-900 rounded-bl-md border border-surface-200"
        )}>
            {message.text}
        </div>
        <span className="text-[11px] text-surface-400 mt-1 tabular-nums">
            {format(new Date(message.createdAt), 'HH:mm')}
        </span>
    </div>
);

const ConversationItem = ({ convo, isActive, onClick, currentUserId }: { convo: Conversation, isActive: boolean, onClick: () => void, currentUserId: string }) => {
    // For direct chat, the participant is the other guy (not me)
    const otherParticipant = convo.isGroup ? null : convo.participants.find(p => p._id !== currentUserId) || convo.participants[0];
    const displayName = convo.isGroup ? (convo.groupName || 'Group Chat') : (otherParticipant?.name || 'Inquiry Session');
    const avatar = convo.isGroup ? <Users size={20} className="text-brand-600" /> : (otherParticipant?.avatar ? <img src={otherParticipant.avatar} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-brand-600 font-semibold">{(displayName || 'U')[0]}</span>);

    return (
        <button 
            onClick={onClick}
            className={cn(
                "w-full px-5 py-4 flex items-center gap-3 transition-all border-b border-surface-100 relative group",
                isActive ? "bg-surface-50" : "hover:bg-surface-50/50"
            )}
        >
            <div className={cn(
                "w-11 h-11 rounded-full border flex items-center justify-center text-sm shrink-0 overflow-hidden transition-colors bg-surface-100",
                isActive ? "border-brand-500 bg-brand-50 shadow-sm" : "border-surface-200"
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
                    <span className="text-[11px] text-surface-400 tabular-nums">
                        {convo.lastMessage?.createdAt ? format(new Date(convo.lastMessage.createdAt), 'HH:mm') : ''}
                    </span>
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

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="px-6 py-5 border-b border-surface-100 flex items-center gap-3">
                <button onClick={onCancel} className="p-1 hover:bg-surface-50 rounded-lg text-surface-400">
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-[18px] font-semibold text-surface-900">New Group</h1>
            </div>

            <div className="p-5 space-y-5 flex-1 overflow-y-auto">
                <div>
                    <label className="text-[12px] font-bold text-surface-400 uppercase tracking-wider block mb-2">Group Name</label>
                    <input 
                        type="text" 
                        placeholder="e.g. Design Team" 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-brand-500 transition-all font-medium"
                    />
                </div>

                <div>
                    <label className="text-[12px] font-bold text-surface-400 uppercase tracking-wider block mb-2">Select Members</label>
                    <div className="relative mb-3">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                        <input 
                            type="text" 
                            placeholder="Search people..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-9 pr-4 py-2 text-[13px] outline-none focus:border-brand-500 transition-all"
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

            <div className="p-4 border-t border-surface-100 bg-surface-50/50">
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

export const AdminChatSidebar = () => {
    const { isOpen, setOpen, activeConversationId, setActiveConversation, conversations, fetchConversations, messages, sendMessage, createGroup, loading } = useAdminChatStore();
    const { user } = useAuthStore();
    const [projects, setProjects] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [input, setInput] = useState('');
    const [activeTab, setActiveTab] = useState<'direct' | 'projects'>('direct');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
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
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const activeConvo = conversations.find(c => c._id === activeConversationId);
    
    // Role-based isMe logic
    const isMeCheck = (senderId: string) => senderId === user?.id || senderId === 'admin'; 

    // Merged view of Projects and Conversations for the "Project Teams" tab
    const projectList = projects.map(project => {
        const convo = conversations.find(c => c.projectId === project._id || c.projectId === project.id || (c.isGroup && c.groupName === `${project.name} (Project)`));
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
    const directConversations = conversations.filter(c => !c.isGroup && c.participants.some(p => p.name.toLowerCase().includes(search.toLowerCase())));

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        await sendMessage(input);
        setInput('');
    };

    const handleCreateGroup = async (name: string, members: string[]) => {
        const res = await createGroup(name, members);
        if (res) {
            setIsCreatingGroup(false);
            setActiveConversation(res._id);
        }
    };

    const handleStartProjectChat = async (project: any) => {
        if (project.conversation) {
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
            }
        }
    };

    const currentRecipient = activeConvo?.isGroup 
        ? activeConvo.groupName 
        : activeConvo?.participants.find(p => p._id !== user?.id)?.name || 'Chat Session';

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
                        className="fixed inset-y-0 right-0 w-full xs:w-[340px] sm:w-[380px] bg-white shadow-xl z-[110] flex flex-col border-l border-surface-200 text-surface-900 font-sans"
                    >
                        {isCreatingGroup ? (
                            <CreateGroupView 
                                onCancel={() => setIsCreatingGroup(false)} 
                                onCreate={handleCreateGroup} 
                            />
                        ) : !activeConversationId ? (
                            <>
                                <div className="px-6 py-5 border-b border-surface-100 flex items-center justify-between bg-white sticky top-0 z-20">
                                    <h1 className="text-[18px] font-semibold text-surface-900">Messages</h1>
                                    <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-surface-50 text-surface-400 hover:text-surface-900 rounded-lg transition-all">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="px-5 pt-4 flex gap-6 border-b border-surface-100">
                                    <button 
                                        onClick={() => setActiveTab('direct')}
                                        className={cn(
                                            "pb-3 text-sm font-semibold relative transition-colors",
                                            activeTab === 'direct' ? "text-brand-600" : "text-surface-400 hover:text-surface-600"
                                        )}
                                    >
                                        Direct
                                        {activeTab === 'direct' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />}
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('projects')}
                                        className={cn(
                                            "pb-3 text-sm font-semibold relative transition-colors",
                                            activeTab === 'projects' ? "text-brand-600" : "text-surface-400 hover:text-surface-600"
                                        )}
                                    >
                                        Project Teams
                                        {activeTab === 'projects' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />}
                                    </button>
                                </div>

                                <div className="p-4">
                                    <div className="relative group">
                                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 focus-within:text-brand-500" />
                                        <input 
                                            type="text" 
                                            placeholder={`Search ${activeTab === 'projects' ? 'project teams' : 'direct messages'}...`} 
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-11 pr-4 py-2 text-[14px] text-surface-900 placeholder:text-surface-400 outline-none focus:border-brand-500 focus:bg-white transition-all shadow-sm"
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
                                                                className="w-full px-5 py-2 flex items-center justify-between bg-surface-50/50 hover:bg-surface-50 border-y border-surface-100/50 transition-colors"
                                                            >
                                                                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{dept} ({deptProjs.length})</span>
                                                                <ChevronDown 
                                                                    size={12} 
                                                                    className={cn('text-surface-400 transition-transform', collapsedDepts[dept] ? '-rotate-90' : '')} 
                                                                />
                                                            </button>
                                                            {!collapsedDepts[dept] && (
                                                                <div className="divide-y divide-surface-50">
                                                                    {deptProjs.map((proj: any) => (
                                                                         <button 
                                                                            key={proj._id || proj.id}
                                                                            onClick={() => handleStartProjectChat(proj)}
                                                                            className={cn(
                                                                                "w-full px-5 py-4 flex items-center gap-3 transition-all border-b border-surface-100 relative group text-left",
                                                                                activeConversationId === proj.conversation?._id ? "bg-surface-50" : "hover:bg-surface-50/50"
                                                                            )}
                                                                        >
                                                                            <div className={cn(
                                                                                "w-11 h-11 rounded-full border flex items-center justify-center text-sm shrink-0 overflow-hidden transition-colors bg-surface-100",
                                                                                activeConversationId === proj.conversation?._id ? "border-brand-500 bg-brand-50 shadow-sm" : "border-surface-200"
                                                                            )}>
                                                                                <Users size={20} className="text-brand-600" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center justify-between mb-0.5">
                                                                                    <span className={cn(
                                                                                        "text-[14px] font-semibold transition-colors truncate pr-2",
                                                                                        activeConversationId === proj.conversation?._id ? "text-brand-600" : "text-surface-900 group-hover:text-brand-600"
                                                                                    )}>
                                                                                        {proj.name}
                                                                                    </span>
                                                                                    <span className="text-[11px] text-surface-400 tabular-nums">
                                                                                        {proj.conversation?.lastMessage?.createdAt ? format(new Date(proj.conversation.lastMessage.createdAt), 'HH:mm') : ''}
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-[12px] text-surface-500 truncate font-normal">
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
                                                directConversations.length > 0 ? directConversations.map(convo => (
                                                    <ConversationItem 
                                                        key={convo._id} 
                                                        convo={convo} 
                                                        isActive={activeConversationId === convo._id}
                                                        onClick={() => setActiveConversation(convo._id)}
                                                        currentUserId={user?.id || ''}
                                                    />
                                                )) : (
                                                    <div className="flex flex-col items-center justify-center p-12 text-center text-surface-400">
                                                        <MessageCircle size={32} className="mb-2 opacity-20" />
                                                        <p className="text-sm">No direct messages</p>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                                {activeTab === 'projects' && ['admin', 'manager', 'team-leader'].includes(user?.role || '') && (
                                    <div className="p-4 border-t border-surface-100 bg-surface-50/50">
                                        <button 
                                            onClick={() => setIsCreatingGroup(true)}
                                            className="w-full py-2.5 bg-white hover:bg-surface-50 text-brand-600 rounded-xl text-xs font-bold border border-brand-200 shadow-sm transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus size={14} /> Create New Group
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between bg-white shrink-0 shadow-sm">
                                     <div className="flex items-center gap-3 min-w-0">
                                         <button
                                            className="sm:hidden p-2 -ml-2 text-surface-400 hover:text-surface-900 rounded-lg"
                                            onClick={() => setActiveConversation(null)}
                                         >
                                            <ChevronLeft size={18} />
                                         </button>
                                         <div className="w-14 h-14 rounded-full bg-gradient-to-br from-surface-50 to-surface-100 border border-surface-200 flex items-center justify-center text-brand-600 relative shrink-0 shadow-inner">
                                             {activeConvo?.isGroup ? <Users size={24} /> : <span className="text-lg font-semibold">{currentRecipient ? currentRecipient[0] : 'U'}</span>}
                                             <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                                         </div>
                                         <div className="flex-1 min-w-0">
                                              <div className="text-[15px] font-semibold text-surface-900 leading-tight truncate">
                                                  {currentRecipient}
                                              </div>
                                              <span className="text-[12px] text-emerald-500 font-semibold block mt-0.5 truncate">
                                                  {activeConvo?.isGroup ? `@${activeConvo.participants.length} members` : 'Online'}
                                              </span>
                                         </div>
                                     </div>
                                     <button className="hidden sm:flex p-2 text-surface-400 hover:text-surface-900 rounded-lg" onClick={() => setActiveConversation(null)}>
                                         <X size={18} />
                                     </button>
                                </div>

                                <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-surface-50/80 to-white px-4 py-5 sm:px-5">
                                    {messages.length > 0 ? (
                                        <div className="space-y-1">
                                            {messages.map(msg => (
                                                <MessageBubble key={msg._id} message={msg} isMe={isMeCheck(msg.senderId)} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center text-surface-400 px-6">
                                            <div className="w-14 h-14 rounded-2xl bg-white border border-surface-200 flex items-center justify-center shadow-sm mb-4">
                                                <MessageCircle size={24} className="opacity-60" />
                                            </div>
                                            <p className="text-sm font-medium text-surface-600">No messages yet</p>
                                            <p className="text-xs mt-1 max-w-[220px]">Start the conversation with a quick update or question.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 border-t border-surface-200 bg-white shrink-0">
                                    <form onSubmit={handleSend} className="relative flex items-center gap-2 rounded-3xl border border-brand-200 bg-white px-2 py-1.5 shadow-[0_8px_24px_rgba(51,102,255,0.08)] focus-within:border-brand-400 transition-all">
                                        <button type="button" className="p-2.5 text-surface-400 hover:text-brand-500 transition-colors rounded-xl">
                                            <Paperclip size={18} />
                                        </button>
                                        <input
                                            type="text"
                                            placeholder="Type a message..."
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            className="flex-1 bg-transparent text-[14px] text-surface-900 placeholder:text-surface-400 py-3 outline-none px-1 min-w-0"
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
                            </>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
