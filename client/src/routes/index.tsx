import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import AuthLayout from '../layouts/AuthLayout';
import { useAuthStore } from '../context/authStore';
import type { Role } from '../app/types';

// Auth pages
import LoginPage from '../pages/auth/Login';
import RegisterPage from '../pages/auth/Register';
import { ForgotPasswordPage, ResetPasswordPage } from '../pages/auth/ForgotPassword';

// App pages
import DashboardPage from '../pages/dashboard/Dashboard';
import ProjectsPage from '../pages/projects/Projects';
import ProjectDetailPage from '../pages/projects/ProjectDetail';
import ProjectTodoPage from '../pages/projects/ProjectTodoPage';
import CalendarPage from '../pages/calendar/Calendar';
import TeamsPage from '../pages/teams/Teams';
import ReportsPage from '../pages/reports/Reports';
import QuickTasksPage from '../pages/quicktasks/QuickTasks';
import QuickTaskDetailPage from '../pages/quicktasks/QuickTaskDetail';
import MyTasksPage from '../pages/tasks/MyTasks';
import TasksManagement from '../pages/tasks/TasksManagement';
import MISEntry from '../pages/mis/MISEntry';
import MISManager from '../pages/mis/MISManager';
import MISReports from '../pages/mis/MISReports';
import NotificationsPage from '../pages/notifications/Notifications';
import UserSettingsPage from '../pages/settings/Settings';
import PlannerPage from '../pages/planner/Planner';

// Admin pages
import {
  AdminWorkspacesPage,
  AdminUsersPage,
  AdminPermissionsPage,
  AdminBillingPage,
} from '../pages/admin/Admin';

// Super Admin pages
import {
  Companies as SACompanies,
  Users as SAUsers,
  RolesPermissions as SARoles,
  Notifications as SABroadcast,
  Settings as SASettings,
  Logs as SALogs,
  Support as SASupport,
} from '../pages/super-admin';

// Guard component
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const RequireGuest: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const RequireRole: React.FC<{ roles: Role[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const SettingsRoute: React.FC = () => {
  const { user } = useAuthStore();
  if (user?.role === 'super_admin' || user?.role === 'admin') {
    return <SASettings />;
  }
  return <UserSettingsPage />;
};

export const router = createBrowserRouter([
  // Auth routes
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      {
        path: 'login',
        element: <RequireGuest><LoginPage /></RequireGuest>,
      },
      {
        path: 'register',
        element: <RequireGuest><RegisterPage /></RequireGuest>,
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        path: 'reset-password',
        element: <ResetPasswordPage />,
      },
    ],
  },
  // App routes
  {
    path: '/',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { path: 'dashboard', element: <DashboardPage /> },

      // Standard App (Maintained as requested)
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'projects/:projectId/todo', element: <ProjectTodoPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'mis-entry', element: <MISEntry /> },
      { path: 'mis-manager', element: <RequireRole roles={['super_admin', 'admin', 'manager', 'team_leader']}><MISManager /></RequireRole> },
      { path: 'mis-reports', element: <MISReports /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'quick-tasks', element: <QuickTasksPage /> },
      { path: 'quick-tasks/:id', element: <QuickTaskDetailPage /> },
      { path: 'my-tasks', element: <MyTasksPage /> },
      { path: 'tasks', element: <TasksManagement /> },

      // Super Admin Modules (Separate routes)
      { path: 'companies', element: <SACompanies /> },
      { path: 'companies/:id', element: <SACompanies /> },
      { path: 'users', element: <SAUsers /> },
      { path: 'roles-permissions', element: <SARoles /> },
      { path: 'settings', element: <SettingsRoute /> },
      {
        path: 'logs',
        element: (
          <RequireRole roles={['super_admin', 'admin', 'manager', 'team_leader']}>
            <SALogs />
          </RequireRole>
        ),
      },
      { path: 'support', element: <SASupport /> },
      { path: 'broadcast-notifications', element: <SABroadcast /> },
      { path: 'profile', element: <UserSettingsPage /> },

      // Admin
      { path: 'admin/workspaces', element: <AdminWorkspacesPage /> },
      { path: 'admin/users', element: <AdminUsersPage /> },
      { path: 'admin/permissions', element: <AdminPermissionsPage /> },
      { path: 'admin/billing', element: <AdminBillingPage /> },
      { path: 'planner', element: <PlannerPage /> },

    ],
  },
  {
    path: '/500',
    element: <Error500Page />,
  },
  {
    path: '*',
    element: <NotFound404 />,
  },
], {
  future: {
    v7_relativeSplatPath: true,
  },
});

export default router;
