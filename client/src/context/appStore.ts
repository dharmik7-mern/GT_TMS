import { create } from 'zustand';
import type { Project, Task, Team, Notification, TaskStatus, QuickTask, QuickTaskStatus, User, Workspace, PersonalTask, Label } from '../app/types';
import { projectsService, tasksService, teamsService, quickTasksService, notificationsService, usersService, workspacesService, personalTasksService, labelsService } from '../services/api';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function safeList<T>(
  label: string,
  request: Promise<{ data: unknown }>
): Promise<T[]> {
  try {
    const res = await request;
    return asArray<T>((res.data as { data?: unknown })?.data ?? res.data);
  } catch (error) {
    console.warn(`[appStore.bootstrap] ${label} fetch failed`, error);
    return [];
  }
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
  allLabels: Label[];
  activeProjectId: string | null;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  darkMode: boolean;

  bootstrap: () => Promise<void>;

  setActiveProject: (id: string | null) => void;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
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
  mergeTasks: (tasks: Task[]) => void;
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
  allLabels: [],
  activeProjectId: null,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  darkMode: localStorage.getItem('darkMode') === 'true',

  bootstrap: async () => {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isPublicPath = ['/login', '/forgot-password', '/reset-password', '/unauthorized', '/access-denied'].some((path) =>
      currentPath.startsWith(path)
    );
    if (isPublicPath) {
      return;
    }

    // Apply dark mode on initial load
    if (localStorage.getItem('darkMode') === 'true') {
      document.documentElement.classList.add('dark');
    }

    const [
      users,
      workspaces,
      projects,
      tasks,
      teams,
      quickTasks,
      notifications,
      personalTasks,
      labels,
    ] = await Promise.all([
      safeList<User>('users', usersService.getAll()),
      safeList<Workspace>('workspaces', workspacesService.getAll()),
      safeList<Project>('projects', projectsService.getAll()),
      safeList<Task>('tasks', tasksService.getAll()),
      safeList<Team>('teams', teamsService.getAll()),
      safeList<QuickTask>('quick-tasks', quickTasksService.getAll()),
      safeList<Notification>('notifications', notificationsService.getAll()),
      safeList<PersonalTask>('personal-tasks', personalTasksService.getAll()),
      safeList<Label>('labels', labelsService.getAll()),
    ]);
    set({
      users,
      workspaces,
      projects,
      tasks,
      teams,
      quickTasks,
      notifications,
      personalTasks,
      allLabels: labels,
    });
  },

  setActiveProject: (id) => set({ activeProjectId: id }),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleMobileSidebar: () => set(s => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
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

  addProject: (project) => set(s => ({ projects: [...s.projects, { ...project, id: project.id || (project as any)._id }] })),
  updateProject: (id, updates) => set(s => ({
    projects: s.projects.map(p => p.id === id ? { ...p, ...updates } : p),
  })),
  deleteProject: (id) => set(s => ({
    projects: s.projects.filter(p => p.id !== id),
    tasks: s.tasks.filter(t => t.projectId !== id),
  })),

  addTask: (task) => set(s => ({
    tasks: [...s.tasks.filter(t => (t.id || (t as any)._id) !== (task.id || (task as any)._id)), {
      ...task,
      id: task.id || (task as any)._id,
      projectId: typeof task.projectId === 'string' ? task.projectId : (task.projectId as any)?._id || (task.projectId as any)?.id
    }]
  })),
  updateTask: (id, updates) => set(s => ({
    tasks: s.tasks.map(t => t.id === id ? {
      ...t,
      ...updates,
      projectId: updates.projectId
        ? (typeof updates.projectId === 'string' ? updates.projectId : (updates.projectId as any)?._id || (updates.projectId as any)?.id)
        : t.projectId
    } : t),
  })),
  deleteTask: (id) => set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),
  moveTask: (taskId, newStatus) => set(s => ({
    tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t),
  })),
  reorderTasks: (projectId, status, tasks) => set(s => {
    const normalizedTasks = tasks.map(t => ({
      ...t,
      id: t.id || (t as any)._id,
      projectId: typeof t.projectId === 'string' ? t.projectId : (t.projectId as any)?._id || (t.projectId as any)?.id
    }));
    const otherTasks = s.tasks.filter(t => !(t.projectId === projectId && t.status === status));
    return { tasks: [...otherTasks, ...normalizedTasks] };
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
  mergeTasks: (newTasks) => set(s => {
    const taskMap = new Map(s.tasks.map(t => [t.id, t]));
    newTasks.forEach(t => {
      const normalized = {
        ...t,
        id: t.id || (t as any)._id,
        projectId: typeof t.projectId === 'string' ? t.projectId : (t.projectId as any)?._id || (t.projectId as any)?.id
      };
      // Always overwrite — incoming data from server is more up-to-date
      taskMap.set(normalized.id, normalized);
    });
    return { tasks: Array.from(taskMap.values()) };
  }),
}));
