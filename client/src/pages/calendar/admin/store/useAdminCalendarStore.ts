import { create } from 'zustand';
import API from '../../../../api/axios.ts';

export type CalendarView = 'month' | 'week' | 'day';

export interface AdminTask {
    _id: string;
    title: string;
    description: string;
    assignedUser: string;
    startDateTime: string | null;
    endDateTime: string | null;
    duration: number | null; // in minutes
    color: string;
    priority: 'low' | 'medium' | 'high' | 'urgent' | 'none';
    status: 'Pending' | 'In Progress' | 'Done';
    isRecurring: boolean;
    recurrenceRule?: {
        frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
        interval: number;
        days?: number[];
        endAt?: string;
    };
    tags: string[];
    comments: { _id: string; text: string; userName: string; createdAt: string }[];
    attachments: { _id: string; fileName: string; fileUrl: string; fileType: string }[];
}

interface AdminCalendarState {
    view: CalendarView;
    currentDate: Date;
    tasks: AdminTask[];
    waitingList: AdminTask[];
    loading: boolean;
    selectedTask: AdminTask | 'new' | null;
    groupBy: 'time' | 'user';
    priorityFilter: AdminTask['priority'] | 'all';
    statusFilter: AdminTask['status'] | 'all';
    isMultiUserView: boolean;
    activeUserIds: string[];

    setView: (view: CalendarView) => void;
    setSelectedTask: (task: AdminTask | 'new' | null) => void;
    setGroupBy: (mode: 'time' | 'user') => void;
    setMultiUserView: (active: boolean) => void;
    toggleUser: (userId: string) => void;
    setCurrentDate: (date: Date | ((prev: Date) => Date)) => void;
    fetchTasks: (start: Date, end: Date) => Promise<void>;
    fetchWaitingList: () => Promise<void>;
    createTask: (data: Partial<AdminTask>) => Promise<AdminTask | null>;
    updateTask: (id: string, data: Partial<AdminTask>) => Promise<AdminTask | null>;
    deleteTask: (id: string) => Promise<void>;
    setPriorityFilter: (priority: AdminTask['priority'] | 'all') => void;
    setStatusFilter: (status: AdminTask['status'] | 'all') => void;
    addComment: (taskId: string, comment: any) => Promise<void>;
    uploadAttachment: (taskId: string, file: File) => Promise<void>;
}

export const useAdminCalendarStore = create<AdminCalendarState>((set) => ({
    view: 'week',
    currentDate: new Date(),
    tasks: [],
    waitingList: [],
    loading: false,
    selectedTask: null,
    groupBy: 'time',
    priorityFilter: 'all',
    statusFilter: 'all',
    isMultiUserView: false,
    activeUserIds: [],

    setView: (view) => set({ view }),
    setSelectedTask: (task) => set({ selectedTask: task }),
    setGroupBy: (groupBy) => set({ groupBy }),
    setMultiUserView: (isMultiUserView) => set({ isMultiUserView }),
    toggleUser: (userId) => set((state) => ({
        activeUserIds: state.activeUserIds.includes(userId)
            ? state.activeUserIds.filter(id => id !== userId)
            : [...state.activeUserIds, userId]
    })),

    setPriorityFilter: (priority) => set({ priorityFilter: priority }),
    setStatusFilter: (status) => set({ statusFilter: status }),

    setCurrentDate: (dateInput) => set((state) => ({
        currentDate: typeof dateInput === 'function' ? (dateInput as any)(state.currentDate) : dateInput
    })),

    fetchTasks: async (start, end) => {
        set({ loading: true });
        try {
            const res = await API.get('/admin/calendar/tasks', {
                params: {
                    start: start.toISOString(),
                    end: end.toISOString()
                }
            });
            set({ tasks: res.data, loading: false });
        } catch (err) {
            console.error(err);
            set({ tasks: [], loading: false });
        }
    },

    fetchWaitingList: async () => {
        set({ loading: true });
        try {
            const res = await API.get('/admin/calendar/waiting-list');
            set({ waitingList: res.data, loading: false });
        } catch (err) {
            console.error(err);
            set({ waitingList: [], loading: false });
        }
    },

    createTask: async (data) => {
        try {
            const res = await API.post('/admin/calendar/tasks', data);
            const created = res.data as AdminTask;
            set((state) => {
                const isWaiting = !created.startDateTime || !created.endDateTime;
                if (isWaiting) {
                    return { waitingList: [...state.waitingList, created] };
                }
                return { tasks: [...state.tasks, created] };
            });
            return created;
        } catch (err) {
            console.error(err);
            return null;
        }
    },

    updateTask: async (id, data) => {
        try {
            const res = await API.put(`/admin/calendar/tasks/${id}`, data);
            const updated = res.data as AdminTask;
            set((state) => {
                const isWaiting = !updated.startDateTime || !updated.endDateTime;
                if (isWaiting) {
                    return {
                        tasks: state.tasks.filter((t) => t._id !== id),
                        waitingList: state.waitingList.some((t) => t._id === id)
                            ? state.waitingList.map((t) => (t._id === id ? updated : t))
                            : [...state.waitingList, updated],
                        selectedTask:
                            state.selectedTask && state.selectedTask !== 'new' && state.selectedTask._id === id
                                ? updated
                                : state.selectedTask,
                    };
                }

                return {
                    waitingList: state.waitingList.filter((t) => t._id !== id),
                    tasks: state.tasks.some((t) => t._id === id)
                        ? state.tasks.map((t) => (t._id === id ? updated : t))
                        : [...state.tasks, updated],
                    selectedTask:
                        state.selectedTask && state.selectedTask !== 'new' && state.selectedTask._id === id
                            ? updated
                            : state.selectedTask,
                };
            });
            return updated;
        } catch (err) {
            console.error(err);
            return null;
        }
    },

    deleteTask: async (id) => {
        try {
            await API.delete(`/admin/calendar/tasks/${id}`);
            set((state) => ({
                tasks: state.tasks.filter((t) => t._id !== id),
                waitingList: state.waitingList.filter((t) => t._id !== id),
                selectedTask:
                    state.selectedTask && state.selectedTask !== 'new' && state.selectedTask._id === id
                        ? null
                        : state.selectedTask,
            }));
        } catch (err) {
            console.error(err);
        }
    },

    addComment: async (taskId, comment) => {
        try {
            const res = await API.post(`/admin/calendar/tasks/${taskId}/comments`, comment);
            set((state) => ({
                tasks: state.tasks.map((t) => (t._id === taskId ? res.data : t)),
                waitingList: state.waitingList.map((t) => (t._id === taskId ? res.data : t)),
                selectedTask:
                    state.selectedTask && state.selectedTask !== 'new' && state.selectedTask._id === taskId
                        ? res.data
                        : state.selectedTask,
            }));
        } catch (err) {
            console.error(err);
        }
    },

    uploadAttachment: async (taskId, file) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await API.post(`/admin/calendar/tasks/${taskId}/attachments`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            set((state) => ({
                tasks: state.tasks.map((t) => (t._id === taskId ? res.data : t)),
                waitingList: state.waitingList.map((t) => (t._id === taskId ? res.data : t)),
                selectedTask:
                    state.selectedTask && state.selectedTask !== 'new' && state.selectedTask._id === taskId
                        ? res.data
                        : state.selectedTask,
            }));
        } catch (err) {
            console.error(err);
        }
    }
}));
