import api from './api';

export type DashboardStatResponse = {
  stats: {
    projects: number;
    completedTasks: number;
    openTasks: number;
    overdueTasks: number;
    quickTasks: number;
  };
  activity: Array<{ day: string; completed: number; added: number }>;
  projects: Array<{
    id: string;
    name: string;
    progress?: number;
    tasksCount?: number;
    completedTasksCount?: number;
    color?: string;
    members?: { id: string; avatar?: string; name: string }[];
  }>;
  teamTasks: Array<{
    id: string;
    assignee: string;
    title: string;
    projectName?: string;
    type?: string;
    status: string;
    dueDate?: string;
  }>;
  insights: {
    todayTasks: number;
    completedToday: number;
    pendingToday: number;
  };
};

export const dashboardApi = {
  getFullStats: () => api.get<DashboardStatResponse>('/dashboard/full-stats'),
};

export default dashboardApi;
