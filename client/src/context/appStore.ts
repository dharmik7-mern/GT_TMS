import { create } from 'zustand';
import type { Project, Task, Team, Notification, TaskStatus, QuickTask, QuickTaskStatus, User, Workspace, PersonalTask } from '../app/types';
import { projectsService, tasksService, teamsService, quickTasksService, notificationsService, usersService, workspacesService, personalTasksService } from '../services/api';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

interface AppStore {
  users: User[];
  workspaces: Workspace[];
  projects: Project[];
  tasks: Task[];
  quickTasks: QuickTask[];
  teams: Team[];
  notifications: Notification[];
  personalTasks: PersonalTask[];
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

  addTeam: (team: Team) => void;
  updateTeam: (id: string, updates: Partial<Team>) => void;
  deleteTeam: (id: string) => void;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  unreadNotificationsCount: () => number;

  addPersonalTask: (task: PersonalTask) => void;
  updatePersonalTask: (id: string, updates: Partial<PersonalTask>) => void;
  deletePersonalTask: (id: string) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  users: [],
  workspaces: [],
  projects: [],
  tasks: [],
  quickTasks: [],
  teams: [],
  notifications: [],
  personalTasks: [],
  activeProjectId: null,
  sidebarCollapsed: false,
  darkMode: localStorage.getItem('darkMode') === 'true',

  bootstrap: async () => {
    // Apply dark mode on initial load
    if (localStorage.getItem('darkMode') === 'true') {
      document.documentElement.classList.add('dark');
    }

    const [usersRes, workspacesRes, projectsRes, tasksRes, teamsRes, quickRes, notifRes, personalRes] = await Promise.all([
      usersService.getAll(),
      workspacesService.getAll(),
      projectsService.getAll(),
      tasksService.getAll(),
      teamsService.getAll(),
      quickTasksService.getAll(),
      notificationsService.getAll(),
      personalTasksService.getAll(),
    ]);
    set({
      users: asArray<User>(usersRes.data.data ?? usersRes.data),
      workspaces: asArray<Workspace>(workspacesRes.data.data ?? workspacesRes.data),
      projects: asArray<Project>(projectsRes.data.data ?? projectsRes.data),
      tasks: asArray<Task>(tasksRes.data.data ?? tasksRes.data),
      teams: asArray<Team>(teamsRes.data.data ?? teamsRes.data),
      quickTasks: asArray<QuickTask>(quickRes.data.data ?? quickRes.data),
      notifications: asArray<Notification>(notifRes.data.data ?? notifRes.data),
      personalTasks: asArray<PersonalTask>(personalRes.data.data ?? personalRes.data),
    });
  },

  setActiveProject: (id) => set({ activeProjectId: id }),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  addUser: (user) => set(s => ({ users: [user, ...s.users] })),
  toggleDarkMode: () => {
    const newMode = !get().darkMode;
    set({ darkMode: newMode });
    localStorage.setItem('darkMode', String(newMode));
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

  addTeam: (team) => set(s => ({ teams: [team, ...s.teams] })),
  updateTeam: (id, updates) => set(s => ({
    teams: s.teams.map(t => t.id === id ? { ...t, ...updates } : t),
  })),
  deleteTeam: (id) => set(s => ({ teams: s.teams.filter(t => t.id !== id) })),

  markNotificationRead: (id) => set(s => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
  })),
  markAllNotificationsRead: () => set(s => ({
    notifications: s.notifications.map(n => ({ ...n, isRead: true })),
  })),

  unreadNotificationsCount: () => get().notifications.filter(n => !n.isRead).length,

  addPersonalTask: (task) => set(s => ({ personalTasks: [task, ...s.personalTasks] })),
  updatePersonalTask: (id, updates) => set(s => ({
    personalTasks: s.personalTasks.map(t => t.id === id ? { ...t, ...updates } : t),
  })),
  deletePersonalTask: (id) => set(s => ({
    personalTasks: s.personalTasks.filter(t => t.id !== id),
  })),
}));
