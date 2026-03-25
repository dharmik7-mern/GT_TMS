import { create } from 'zustand';
import API from '../../../../api/axios.ts';

export interface Participant {
    _id: string;
    id?: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
}

export interface Conversation {
    _id: string;
    participants: Participant[];
    lastMessage?: {
        text: string;
        senderId: string;
        createdAt: string;
    };
    isGroup: boolean;
    groupName?: string;
    groupAvatar?: string;
    projectId?: string;
     groupType?: 'project' | 'team' | 'manual';
     department?: string;
     unreadCount?: number;
 }

export interface Message {
    _id: string;
    conversationId: string;
    senderId: string | { _id?: string; id?: string; name?: string; avatar?: string };
    senderName: string;
    text: string;
    createdAt: string;
}

interface AdminChatState {
    isOpen: boolean;
    setOpen: (open: boolean) => void;
    toggleSidebar: () => void;
    activeConversationId: string | null;
    conversations: Conversation[];
    messages: Message[];
    loading: boolean;
    fetchConversations: () => Promise<void>;
    fetchMessages: (conversationId: string) => Promise<void>;
    sendMessage: (text: string, conversationId?: string) => Promise<void>;
     startConversation: (participantId: string) => Promise<Conversation | undefined>;
     createGroup: (name: string, members: string[], metadata?: { projectId?: string, groupType?: string, department?: string }) => Promise<any>;
     setActiveConversation: (id: string | null) => void;
     markAsRead: (conversationId: string) => Promise<void>;
 }

export const useAdminChatStore = create<AdminChatState>((set, get) => ({
    isOpen: false,
    setOpen: (open) => set({ isOpen: open }),
    toggleSidebar: () => set(state => ({ isOpen: !state.isOpen })),
    activeConversationId: null,
    conversations: [],
    messages: [],
    loading: false,

     setActiveConversation: (id) => {
         set({ activeConversationId: id });
         if (id) {
             get().fetchMessages(id);
             get().markAsRead(id);
         }
     },
 
     markAsRead: async (conversationId) => {
         try {
             await API.post(`/admin/chat/conversations/${conversationId}/read`);
             set(state => ({
                 conversations: state.conversations.map(c => 
                     c._id === conversationId ? { ...c, unreadCount: 0 } : c
                 )
             }));
         } catch (error) {
             console.error('Failed to mark as read', error);
         }
     },

    fetchConversations: async () => {
        set({ loading: true });
        try {
            const res = await API.get('/admin/chat/conversations');
            set({ conversations: res.data, loading: false });
        } catch (error) {
            console.error('Failed to fetch conversations', error);
            set({ loading: false });
        }
    },

    fetchMessages: async (conversationId: string) => {
        try {
            const res = await API.get(`/admin/chat/conversations/${conversationId}/messages`);
            set({ messages: res.data });
        } catch (error) {
            console.error('Failed to fetch messages', error);
        }
    },

    startConversation: async (participantId: string) => {
        set({ loading: true });
        try {
            const res = await API.post('/admin/chat/conversations/start', { participantId });
            const conversation = res.data as Conversation;
            set((state) => {
                const existing = state.conversations.find((item) => item._id === conversation._id);
                return {
                    conversations: existing
                        ? state.conversations.map((item) => item._id === conversation._id ? conversation : item)
                        : [conversation, ...state.conversations],
                    loading: false,
                };
            });
            return conversation;
        } catch (error) {
            console.error('Failed to start conversation', error);
            set({ loading: false });
        }
    },

    createGroup: async (groupName: string, participantIds: string[], metadata?: { projectId?: string, groupType?: string, department?: string }) => {
        set({ loading: true });
        try {
            const res = await API.post('/admin/chat/conversations/group', { groupName, participantIds, ...metadata });
            const newConvo = res.data;
            set((state) => ({
                conversations: [newConvo, ...state.conversations],
                loading: false
            }));
            return res.data;
        } catch (error) {
            console.error('Failed to create group', error);
            set({ loading: false });
        }
    },

    sendMessage: async (text, convoId) => {
        const conversationId = convoId || get().activeConversationId;
        if (!conversationId) return;

        try {
            const res = await API.post('/admin/chat/messages', {
                conversationId,
                text
            });
            
            // The API returns the new message
            set((state) => ({
                messages: [...state.messages, res.data]
            }));

            // Update the last message in conversations list
            set((state) => ({
                conversations: state.conversations.map(c => 
                    c._id === conversationId 
                        ? { ...c, lastMessage: { text: res.data.text, senderId: res.data.senderId, createdAt: res.data.createdAt } }
                        : c
                )
            }));
        } catch (error) {
            console.error('Failed to send message', error);
        }
    }
}));
