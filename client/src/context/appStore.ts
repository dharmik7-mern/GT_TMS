import { create } from 'zustand';
import type { Project, Task, Team, Notification, TaskStatus, QuickTask, QuickTaskStatus, User, Workspace } from '../app/types';
import { projectsService, tasksService, teamsService, quickTasksService, notificationsService, usersService, workspacesService } from '../services/api';

interface AppStore {
  users: User[];
  workspaces: Workspace[];
  projects: Project[];
  tasks: Task[];
  quickTasks: QuickTask[];
  teams: Team[];
  notifications: Notification[];
  activeProjectId: string | null;
  sidebarCollapsed: boolean;
  darkMode: boolean;

  bootstrap: () => Promise<void>;

  setActiveProject: (id: string | null) => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;

  addUser: (user: User) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  reorderTasks: (projectId: string, status: TaskStatus, tasks: Task[]) => void;

  addQuickTask: (task: QuickTask) => void;
  updateQuickTask: (id: string, updates: Partial<QuickTask>) => void;
  deleteQuickTask: (id: string) => void;
  setQuickTaskStatus: (id: string, status: QuickTaskStatus) => void;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  unreadNotificationsCount: () => number;
}

export const useAppStore = create<AppStore>((set, get) => ({
  users: [],
  workspaces: [],
  projects: [],
  tasks: [],
  quickTasks: [],
  teams: [],
  notifications: [],
  activeProjectId: null,
  sidebarCollapsed: false,
  darkMode: false,

  bootstrap: async () => {
    const [usersRes, workspacesRes, projectsRes, tasksRes, teamsRes, quickRes, notifRes] = await Promise.all([
      usersService.getAll(),
      workspacesService.getAll(),
      projectsService.getAll(),
      tasksService.getAll(),
      teamsService.getAll(),
      quickTasksService.getAll(),
      notificationsService.getAll(),
    ]);
    set({
      users: usersRes.data.data ?? usersRes.data,
      workspaces: workspacesRes.data.data ?? workspacesRes.data,
      projects: projectsRes.data.data ?? projectsRes.data,
      tasks: tasksRes.data.data ?? tasksRes.data,
      teams: teamsRes.data.data ?? teamsRes.data,
      quickTasks: quickRes.data.data ?? quickRes.data,
      notifications: notifRes.data.data ?? notifRes.data,
    });
  },

  setActiveProject: (id) => set({ activeProjectId: id }),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  addUser: (user) => set(s => ({ users: [user, ...s.users] })),
  toggleDarkMode: () => {
    const newMode = !get().darkMode;
    set({ darkMode: newMode });
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  addProject: (project) => set(s => ({ projects: [...s.projects, project] })),
  updateProject: (id, updates) => set(s => ({
    projects: s.projects.map(p => p.id === id ? { ...p, ...updates } : p),
  })),
  deleteProject: (id) => set(s => ({
    projects: s.projects.filter(p => p.id !== id),
    tasks: s.tasks.filter(t => t.projectId !== id),
  })),

  addTask: (task) => set(s => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, updates) => set(s => ({
    tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
  })),
  deleteTask: (id) => set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),
  moveTask: (taskId, newStatus) => set(s => ({
    tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t),
  })),
  reorderTasks: (projectId, status, tasks) => set(s => {
    const otherTasks = s.tasks.filter(t => !(t.projectId === projectId && t.status === status));
    return { tasks: [...otherTasks, ...tasks] };
  }),

  addQuickTask: (task) => set(s => ({ quickTasks: [...s.quickTasks, task] })),
  updateQuickTask: (id, updates) => set(s => ({
    quickTasks: s.quickTasks.map(t => t.id === id ? { ...t, ...updates } : t),
  })),
  deleteQuickTask: (id) => set(s => ({ quickTasks: s.quickTasks.filter(t => t.id !== id) })),
  setQuickTaskStatus: (id, status) => set(s => ({
    quickTasks: s.quickTasks.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t),
  })),

  markNotificationRead: (id) => set(s => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
  })),
  markAllNotificationsRead: () => set(s => ({
    notifications: s.notifications.map(n => ({ ...n, isRead: true })),
  })),

  unreadNotificationsCount: () => get().notifications.filter(n => !n.isRead).length,
}));
