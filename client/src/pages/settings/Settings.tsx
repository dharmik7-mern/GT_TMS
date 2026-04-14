import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';
import {
  User,
  Lock,
  Bell,
  Palette,
  Building2,
  Shield,
  Camera,
  Save,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Check,
  Loader2,
  Star,
  TrendingUp,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import { cn } from '../../utils/helpers';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { ColorPicker } from '../../components/ColorPicker';
import { UserAvatar } from '../../components/UserAvatar';
import { ProfilePhotoUpload } from '../../components/ProfilePhotoUpload';
import { Tabs, TabsContent } from '../../components/ui';
import { PROJECT_COLORS } from '../../app/constants';
import { usersService, workspacesService } from '../../services/api';
import type { UserPerformance } from '../../app/types';

const TAB_ITEMS = [
  { value: 'profile', label: 'Profile', icon: <User size={14} /> },
  { value: 'workspace', label: 'Workspace', icon: <Building2 size={14} /> },
  { value: 'security', label: 'Security', icon: <Lock size={14} /> },
  { value: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
  { value: 'appearance', label: 'Appearance', icon: <Palette size={14} /> },
];

interface ProfileForm {
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  bio: string;
}

interface SecurityForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

type NotificationSettings = {
  taskAssigned: boolean;
  taskCompleted: boolean;
  comments: boolean;
  deadlines: boolean;
  projectUpdates: boolean;
  weeklyDigest: boolean;
  emailNotifs: boolean;
  pushNotifs: boolean;
};

type AppearanceSettings = {
  theme: 'light' | 'dark' | 'system';
  density: 'compact' | 'default' | 'comfortable';
  language: string;
  timezone: string;
  dateFormat: string;
  weekStartsOn: string;
};

type EmployeeIdSettings = {
  prefix: string;
  separator: string;
  digits: number;
  nextSequence: number;
};

type WorkspaceSecuritySettings = {
  strongPasswords: boolean;
};

const DEFAULT_EMPLOYEE_ID_SETTINGS: EmployeeIdSettings = {
  prefix: 'EMP',
  separator: '-',
  digits: 4,
  nextSequence: 1,
};

const SettingRow: React.FC<{
  label: string;
  description?: string;
  children: React.ReactNode;
}> = ({ label, description, children }) => (
  <div className="flex items-start justify-between gap-6 border-b border-surface-100 py-4 last:border-0 dark:border-surface-800">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{label}</p>
      {description && <p className="mt-0.5 text-xs leading-relaxed text-surface-400">{description}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

export const SettingsPage: React.FC = () => {
  const { user, updateUser, logout } = useAuthStore();
  const { darkMode, toggleDarkMode, workspaces, bootstrap } = useAppStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [exportingWorkspace, setExportingWorkspace] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [selectedColor, setSelectedColor] = useState(user?.color || PROJECT_COLORS[0]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [employeeIdSettings, setEmployeeIdSettings] = useState<EmployeeIdSettings>(DEFAULT_EMPLOYEE_ID_SETTINGS);
  const [workspaceSecurity, setWorkspaceSecurity] = useState<WorkspaceSecuritySettings>({ strongPasswords: false });
  const [message, setMessage] = useState('');
  const [performance, setPerformance] = useState<UserPerformance | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const workspace = workspaces[0];
  const canManageWorkspaceSettings = ['super_admin', 'admin'].includes(user?.role || '');
  const canManagePasswordPolicy = ['super_admin', 'admin'].includes(user?.role || '');
  const visibleTabs = useMemo(
    () => TAB_ITEMS.filter((tab) => tab.value !== 'workspace' || canManageWorkspaceSettings),
    [canManageWorkspaceSettings]
  );

  const defaultNotifications = useMemo<NotificationSettings>(() => ({
    taskAssigned: user?.preferences?.notifications?.taskAssigned ?? true,
    taskCompleted: user?.preferences?.notifications?.taskCompleted ?? true,
    comments: user?.preferences?.notifications?.comments ?? true,
    deadlines: user?.preferences?.notifications?.deadlines ?? true,
    projectUpdates: user?.preferences?.notifications?.projectUpdates ?? false,
    weeklyDigest: user?.preferences?.notifications?.weeklyDigest ?? true,
    emailNotifs: user?.preferences?.notifications?.emailNotifs ?? true,
    pushNotifs: user?.preferences?.notifications?.pushNotifs ?? false,
  }), [user?.preferences?.notifications]);

  const defaultAppearance = useMemo<AppearanceSettings>(() => ({
    theme: user?.preferences?.appearance?.theme ?? (darkMode ? 'dark' : 'light'),
    density: user?.preferences?.appearance?.density ?? 'default',
    language: user?.preferences?.locale?.language ?? workspace?.settings?.defaultLanguage ?? 'English (US)',
    timezone: user?.preferences?.locale?.timezone ?? workspace?.settings?.timezone ?? 'UTC+0 (GMT)',
    dateFormat: user?.preferences?.locale?.dateFormat ?? workspace?.settings?.dateFormat ?? 'MM/DD/YYYY',
    weekStartsOn: user?.preferences?.locale?.weekStartsOn ?? workspace?.settings?.weekStartsOn ?? 'Monday',
  }), [darkMode, user?.preferences, workspace?.settings]);

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(defaultNotifications);
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>(defaultAppearance);

  useEffect(() => {
    setNotifSettings(defaultNotifications);
  }, [defaultNotifications]);

  useEffect(() => {
    setAppearanceSettings(defaultAppearance);
  }, [defaultAppearance]);

  useEffect(() => {
    setWorkspaceName(workspace?.name || '');
    setWorkspaceSlug(workspace?.slug || '');
    setEmployeeIdSettings({
      prefix: workspace?.settings?.employeeIdConfig?.prefix || DEFAULT_EMPLOYEE_ID_SETTINGS.prefix,
      separator: workspace?.settings?.employeeIdConfig?.separator || DEFAULT_EMPLOYEE_ID_SETTINGS.separator,
      digits: workspace?.settings?.employeeIdConfig?.digits || DEFAULT_EMPLOYEE_ID_SETTINGS.digits,
      nextSequence: workspace?.settings?.employeeIdConfig?.nextSequence || DEFAULT_EMPLOYEE_ID_SETTINGS.nextSequence,
    });
    setWorkspaceSecurity({
      strongPasswords: workspace?.settings?.security?.strongPasswords ?? false,
    });
  }, [workspace]);

  useEffect(() => {
    let active = true;
    setLoadingPerformance(true);
    usersService.myPerformance()
      .then((res) => {
        if (!active) return;
        setPerformance(res.data?.data ?? null);
      })
      .catch(() => {
        if (active) setPerformance(null);
      })
      .finally(() => {
        if (active) setLoadingPerformance(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'workspace' && !canManageWorkspaceSettings) {
      setActiveTab('profile');
    }
  }, [activeTab, canManageWorkspaceSettings]);

  const { register: registerProfile, handleSubmit: handleProfile, reset: resetProfile } = useForm<ProfileForm>({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      jobTitle: user?.jobTitle || '',
      department: user?.department || '',
      bio: user?.bio || '',
    },
  });

  useEffect(() => {
    resetProfile({
      name: user?.name || '',
      email: user?.email || '',
      jobTitle: user?.jobTitle || '',
      department: user?.department || '',
      bio: user?.bio || '',
    });
    setSelectedColor(user?.color || PROJECT_COLORS[0]);
  }, [resetProfile, user]);

  const { register: registerSecurity, handleSubmit: handleSecurity, reset: resetSecurity, formState: { errors: secErrors }, watch } = useForm<SecurityForm>();
  const newPass = watch('newPassword', '');

  if (!user || !workspace) return null;

  const onSaveProfile = async (data: ProfileForm) => {
    setSavingProfile(true);
    setMessage('');
    try {
      const res = await usersService.updateMe({
        name: data.name,
        jobTitle: data.jobTitle,
        department: data.department,
        bio: data.bio,
        color: selectedColor,
      });
      const updatedUser = res.data?.data;
      updateUser({
        name: updatedUser?.name ?? data.name,
        jobTitle: updatedUser?.jobTitle ?? data.jobTitle,
        department: updatedUser?.department ?? data.department,
        bio: updatedUser?.bio ?? data.bio,
        color: updatedUser?.color ?? selectedColor,
      });
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
      setMessage('Profile updated successfully.');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const onSaveSecurity = async (data: SecurityForm) => {
    setMessage('');
    try {
      await usersService.updatePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      resetSecurity();
      setMessage('Password updated successfully.');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message || 'Failed to update password.');
    }
  };

  const savePreferences = async (nextAppearance?: Partial<AppearanceSettings>, nextNotifications?: Partial<NotificationSettings>) => {
    const mergedAppearance = { ...appearanceSettings, ...(nextAppearance || {}) };
    const mergedNotifications = { ...notifSettings, ...(nextNotifications || {}) };

    setSavingPreferences(true);
    setMessage('');
    try {
      await usersService.updatePreferences({
        notifications: mergedNotifications,
        appearance: {
          theme: mergedAppearance.theme,
          density: mergedAppearance.density,
        },
        locale: {
          language: mergedAppearance.language,
          timezone: mergedAppearance.timezone,
          dateFormat: mergedAppearance.dateFormat,
          weekStartsOn: mergedAppearance.weekStartsOn,
        },
      });

      updateUser({
        preferences: {
          ...user.preferences,
          notifications: mergedNotifications,
          appearance: {
            theme: mergedAppearance.theme,
            density: mergedAppearance.density,
          },
          locale: {
            language: mergedAppearance.language,
            timezone: mergedAppearance.timezone,
            dateFormat: mergedAppearance.dateFormat,
            weekStartsOn: mergedAppearance.weekStartsOn,
          },
        },
      });
      setMessage('Preferences saved successfully.');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message || 'Failed to save preferences.');
    } finally {
      setSavingPreferences(false);
    }
  };

  const saveWorkspace = async () => {
    setSavingWorkspace(true);
    setMessage('');
    try {
      const settingsPayload: Record<string, unknown> = {
        defaultLanguage: appearanceSettings.language,
        timezone: appearanceSettings.timezone,
        dateFormat: appearanceSettings.dateFormat,
        weekStartsOn: appearanceSettings.weekStartsOn,
        employeeIdConfig: employeeIdSettings,
      };

      if (canManagePasswordPolicy) {
        settingsPayload.security = workspaceSecurity;
      }

      await workspacesService.update(workspace.id, {
        name: workspaceName,
        slug: workspaceSlug,
        settings: settingsPayload,
      });
      await bootstrap();
      updateUser({
        preferences: {
          ...user.preferences,
          locale: {
            language: appearanceSettings.language,
            timezone: appearanceSettings.timezone,
            dateFormat: appearanceSettings.dateFormat,
            weekStartsOn: appearanceSettings.weekStartsOn,
          },
        },
      });
      setMessage('Workspace settings saved successfully.');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message || 'Failed to save workspace settings.');
    } finally {
      setSavingWorkspace(false);
    }
  };

  const persistWorkspaceStrongPasswordPolicy = async (nextValue: boolean) => {
    setWorkspaceSecurity({ strongPasswords: nextValue });
    setSavingWorkspace(true);
    setMessage('');
    try {
      await workspacesService.update(workspace.id, {
        settings: {
          security: {
            strongPasswords: nextValue,
          },
        },
      });
      await bootstrap();
      setMessage('Organization password policy updated successfully.');
    } catch (error: any) {
      setWorkspaceSecurity({ strongPasswords: !nextValue });
      setMessage(error?.response?.data?.error?.message || 'Failed to update organization password policy.');
    } finally {
      setSavingWorkspace(false);
    }
  };

  const exportWorkspace = async () => {
    setExportingWorkspace(true);
    setMessage('');
    try {
      const res = await workspacesService.exportData(workspace.id);
      const blob = new Blob([JSON.stringify(res.data?.data ?? {}, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${workspace.slug || 'workspace'}-export.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage('Workspace export generated.');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message || 'Failed to export workspace data.');
    } finally {
      setExportingWorkspace(false);
    }
  };

  const applyTheme = async (theme: AppearanceSettings['theme']) => {
    setAppearanceSettings((prev) => ({ ...prev, theme }));
    if (theme === 'dark' && !darkMode) toggleDarkMode();
    if (theme === 'light' && darkMode) toggleDarkMode();
    await savePreferences({ theme });
  };

  return (
    <div className="w-full">
      {message && <div className="mb-4 rounded-xl bg-surface-50 px-4 py-3 text-sm text-surface-600 dark:bg-surface-800/60">{message}</div>}

      <Tabs value={activeTab} onValueChange={setActiveTab} items={visibleTabs} variant="underline">
        <TabsContent value="profile" className="pt-6">
          <form onSubmit={handleProfile(onSaveProfile)}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="card flex flex-col items-center gap-4 p-5">
                <div className="relative group">
                  <ProfilePhotoUpload size="xl" />
                </div>
                <div className="text-center">
                  <p className="font-display font-semibold text-surface-900 dark:text-white">{user.name}</p>
                  <p className="text-xs capitalize text-surface-400">{user.role.replace('_', ' ')}</p>
                </div>
                <div className="w-full rounded-2xl border border-surface-100 bg-surface-50 p-3 text-center dark:border-surface-800 dark:bg-surface-900/60">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-surface-400">Overall Performance</p>
                  <p className="mt-1 text-3xl font-semibold text-surface-900 dark:text-white">
                    {loadingPerformance ? '--' : `${performance?.summary.performanceScore ?? 0}%`}
                  </p>
                  <p className="mt-1 text-xs text-surface-500">
                    {loadingPerformance ? 'Loading analytics...' : `${performance?.summary.averageRating ?? 0}/5 average rating`}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-center text-xs text-surface-500">Profile color</p>
                  <ColorPicker
                    value={selectedColor}
                    onChange={setSelectedColor}
                    palette={PROJECT_COLORS}
                    helperText="Used for your avatar and profile accents."
                  />
                </div>
              </div>

              <div className="card p-5 lg:col-span-2">
                <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Personal Information</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Full name</label>
                      <input {...registerProfile('name', { required: true })} className="input" />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input {...registerProfile('email')} type="email" className="input bg-surface-50 dark:bg-surface-800" readOnly />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Job title</label>
                      <input {...registerProfile('jobTitle')} placeholder="e.g. Frontend Developer" className="input" />
                    </div>
                    <div>
                      <label className="label">Department</label>
                      <input {...registerProfile('department')} placeholder="e.g. Engineering" className="input" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Bio</label>
                    <textarea {...registerProfile('bio')} placeholder="Tell your teammates a bit about yourself..." className="input h-auto resize-none py-2" rows={3} />
                  </div>
                  <div className="flex justify-end pt-2">
                    <button type="submit" disabled={savingProfile} className="btn-primary btn-md">
                      {savingProfile ? <Loader2 size={16} className="animate-spin" /> : savedProfile ? <><Check size={16} /> Saved!</> : <><Save size={15} /> Save changes</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {[
                {
                  label: 'Assigned Tasks',
                  value: performance?.summary.assignedTasks ?? 0,
                  sub: `${performance?.summary.completedTasks ?? 0} completed`,
                  icon: <ClipboardList size={16} />,
                },
                {
                  label: 'Approval Rate',
                  value: `${performance?.summary.approvalRate ?? 0}%`,
                  sub: `${performance?.summary.approvedTasks ?? 0} approved completions`,
                  icon: <CheckCircle2 size={16} />,
                },
                {
                  label: 'Average Rating',
                  value: `${performance?.summary.averageRating ?? 0}/5`,
                  sub: `${performance?.summary.pendingReviewTasks ?? 0} pending reviews`,
                  icon: <Star size={16} />,
                },
              ].map((item) => (
                <div key={item.label} className="card p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-300">
                    {item.icon}
                  </div>
                  <p className="text-2xl font-semibold text-surface-900 dark:text-white">{item.value}</p>
                  <p className="mt-1 text-sm font-medium text-surface-700 dark:text-surface-300">{item.label}</p>
                  <p className="mt-1 text-xs text-surface-400">{item.sub}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-brand-600 dark:text-brand-300" />
                  <h3 className="font-display font-semibold text-surface-900 dark:text-white">Performance Evolution</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performance?.monthlyTrend ?? []}>
                      <defs>
                        <linearGradient id="profilePerformanceFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3366ff" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3366ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="completed" stroke="#3366ff" fill="url(#profilePerformanceFill)" strokeWidth={2} />
                      <Area type="monotone" dataKey="approved" stroke="#10b981" fill="transparent" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Star size={16} className="text-amber-500" />
                  <h3 className="font-display font-semibold text-surface-900 dark:text-white">Rating Distribution</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performance?.ratingDistribution ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="rating" tickFormatter={(value) => `${value}★`} tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => [`${value}`, 'Tasks']} />
                      <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card p-5">
                <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Recent Task Evaluations</h3>
                <div className="space-y-3">
                  {(performance?.recentEvaluations ?? []).length ? performance?.recentEvaluations.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-surface-100 p-3 dark:border-surface-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-surface-900 dark:text-white">{item.title}</p>
                          <p className="text-xs uppercase tracking-[0.14em] text-surface-400">
                            {item.type === 'project_task' ? 'Project Task' : 'Quick Task'}
                          </p>
                        </div>
                        <span className="badge bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
                          {item.rating ? `${item.rating}/5` : 'No rating'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-surface-500">{item.reviewRemark || 'No review remark added.'}</p>
                    </div>
                  )) : <p className="text-sm text-surface-400">No reviewed completions yet.</p>}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Project Footprint</h3>
                <div className="space-y-3">
                  {(performance?.activeProjects ?? []).length ? performance?.activeProjects.map((project) => (
                    <div key={project.id} className="flex items-center justify-between gap-3 rounded-2xl border border-surface-100 px-4 py-3 dark:border-surface-800">
                      <div>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">{project.name}</p>
                        <p className="text-xs capitalize text-surface-400">{project.status.replace('_', ' ')}</p>
                      </div>
                      <span className="text-xs text-surface-500">Active member</span>
                    </div>
                  )) : <p className="text-sm text-surface-400">No active project memberships yet.</p>}
                </div>
              </div>
            </div>
          </form>
        </TabsContent>

        {canManageWorkspaceSettings && (
          <TabsContent value="workspace" className="pt-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card p-5">
                <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Workspace Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Workspace name</label>
                    <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">Workspace URL</label>
                    <div className="flex items-center">
                      <span className="flex h-10 items-center rounded-l-xl border border-r-0 border-surface-200 bg-surface-50 px-3 text-sm text-surface-400 dark:border-surface-700 dark:bg-surface-800">app.flowboard.io/</span>
                      <input value={workspaceSlug} onChange={(e) => setWorkspaceSlug(e.target.value.toLowerCase())} className="input flex-1 rounded-l-none border-l-0" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Plan</label>
                    <div className="flex items-center justify-between rounded-xl border border-surface-100 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800">
                      <div>
                        <p className="text-sm font-medium capitalize text-surface-800 dark:text-surface-200">{workspace.plan} Plan</p>
                        <p className="text-xs text-surface-400">{workspace.membersCount} members</p>
                      </div>
                      <button className="btn-primary btn-sm" type="button">Upgrade</button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-surface-100 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-800">
                    <h4 className="mb-3 text-sm font-semibold text-surface-800 dark:text-surface-200">Employee ID Format</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Prefix</label>
                        <input value={employeeIdSettings.prefix} onChange={(e) => setEmployeeIdSettings((prev) => ({ ...prev, prefix: e.target.value }))} className="input" />
                      </div>
                      <div>
                        <label className="label">Separator</label>
                        <input value={employeeIdSettings.separator} onChange={(e) => setEmployeeIdSettings((prev) => ({ ...prev, separator: e.target.value }))} className="input" />
                      </div>
                      <div>
                        <label className="label">Digits</label>
                        <input type="number" min={1} max={8} value={employeeIdSettings.digits} onChange={(e) => setEmployeeIdSettings((prev) => ({ ...prev, digits: Number(e.target.value) || 4 }))} className="input" />
                      </div>
                      <div>
                        <label className="label">Next Sequence</label>
                        <input type="number" min={1} value={employeeIdSettings.nextSequence} onChange={(e) => setEmployeeIdSettings((prev) => ({ ...prev, nextSequence: Number(e.target.value) || 1 }))} className="input" />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-surface-400">
                      Preview: {employeeIdSettings.prefix}{employeeIdSettings.separator}{String(employeeIdSettings.nextSequence).padStart(employeeIdSettings.digits, '0')}
                    </p>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button className="btn-primary btn-md" onClick={saveWorkspace} disabled={savingWorkspace}>
                      {savingWorkspace ? 'Saving...' : <><Save size={15} /> Save</>}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Danger Zone</h3>
                <div className="space-y-3">
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Export Data</p>
                    <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">Download all workspace data as a JSON export.</p>
                    <button className="btn-secondary btn-sm mt-3" onClick={exportWorkspace} disabled={exportingWorkspace}>
                      {exportingWorkspace ? 'Exporting...' : 'Export all data'}
                    </button>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
                    <p className="text-sm font-medium text-rose-800 dark:text-rose-300">Logout Current Session</p>
                    <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-400/80">Use this if you changed sensitive settings and want to sign in again.</p>
                    <button className="btn-danger btn-sm mt-3" onClick={logout}>Logout</button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="security" className="pt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Change Password</h3>
              <form onSubmit={handleSecurity(onSaveSecurity)} className="space-y-4">
                <div>
                  <label className="label">Current password</label>
                  <div className="relative">
                    <input {...registerSecurity('currentPassword', { required: true })} type={showCurrent ? 'text' : 'password'} className="input pr-10" />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                      {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">New password</label>
                  <div className="relative">
                    <input {...registerSecurity('newPassword', { required: true, minLength: 4 })} type={showNew ? 'text' : 'password'} className="input pr-10" />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                      {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Confirm new password</label>
                  <input {...registerSecurity('confirmPassword', { required: true, validate: (value) => value === newPass || 'Passwords do not match' })} type="password" className={cn('input', secErrors.confirmPassword && 'border-rose-400')} />
                  {secErrors.confirmPassword && <p className="mt-1 text-xs text-rose-500">{secErrors.confirmPassword.message}</p>}
                </div>
                <button type="submit" className="btn-primary btn-md w-full">
                  <Lock size={15} /> Update password
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {canManagePasswordPolicy && (
                <div className="card p-5">
                  <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Organization Password Policy</h3>
                  <SettingRow
                    label="Strong Passwords"
                    description="Apply strong password rules only for users in this organization."
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!canManagePasswordPolicy || savingWorkspace) return;
                        void persistWorkspaceStrongPasswordPolicy(!workspaceSecurity.strongPasswords);
                      }}
                      disabled={!canManagePasswordPolicy || savingWorkspace}
                      aria-label="Toggle strong password policy"
                      className={cn(
                        'relative h-6 w-10 rounded-full transition-colors',
                        workspaceSecurity.strongPasswords ? 'bg-brand-600' : 'bg-surface-200 dark:bg-surface-700',
                        (!canManagePasswordPolicy || savingWorkspace) && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                          workspaceSecurity.strongPasswords ? 'left-5' : 'left-1'
                        )}
                      />
                    </button>
                  </SettingRow>
                  <p className="mt-3 text-xs text-surface-400">
                    When off, users in this organization still need at least 4 characters, but uppercase, number, and special-character requirements are removed.
                  </p>
                </div>
              )}

              <div className="card p-5">
                <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Two-Factor Authentication</h3>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Authenticator App</p>
                    <p className="text-xs text-surface-400">Extra login security is managed by platform settings.</p>
                  </div>
                  <span className="badge-gray text-xs">Not set up</span>
                </div>
                <button className="btn-secondary btn-sm w-full"><Shield size={13} /> Enable 2FA</button>
              </div>

              <div className="card p-5">
                <h3 className="mb-3 font-display font-semibold text-surface-900 dark:text-white">Active Session</h3>
                <div className="rounded-xl bg-surface-50 p-3 dark:bg-surface-800">
                  <p className="text-xs font-medium text-surface-700 dark:text-surface-300">Current browser session</p>
                  <p className="text-[11px] text-surface-400">Signed in as {user.email}</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="pt-6">
          <div className="card p-5">
            <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Notification Preferences</h3>
            <div>
              <p className="section-title mb-3">In-App Notifications</p>
              {[
                { key: 'taskAssigned', label: 'Task assigned to me', description: 'When someone assigns a task to you' },
                { key: 'taskCompleted', label: 'Task completed', description: 'When a task you created is marked done' },
                { key: 'comments', label: 'Comments on my tasks', description: 'When someone comments on your task' },
                { key: 'deadlines', label: 'Upcoming deadlines', description: '24 hours before a task is due' },
                { key: 'projectUpdates', label: 'Project updates', description: 'Status changes on your projects' },
              ].map((item) => (
                <SettingRow key={item.key} label={item.label} description={item.description}>
                  <button type="button" onClick={() => setNotifSettings((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof NotificationSettings] }))} className={cn('relative h-6 w-10 rounded-full transition-colors', notifSettings[item.key as keyof NotificationSettings] ? 'bg-brand-600' : 'bg-surface-200 dark:bg-surface-700')}>
                    <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform', notifSettings[item.key as keyof NotificationSettings] ? 'left-5' : 'left-1')} />
                  </button>
                </SettingRow>
              ))}

              <p className="section-title mb-3 mt-6">Email & Push</p>
              {[
                { key: 'weeklyDigest', label: 'Weekly digest', description: 'Summary of your team activity every Monday' },
                { key: 'emailNotifs', label: 'Email notifications', description: 'Receive important notifications via email' },
                { key: 'pushNotifs', label: 'Push notifications', description: 'Browser push notifications' },
              ].map((item) => (
                <SettingRow key={item.key} label={item.label} description={item.description}>
                  <button type="button" onClick={() => setNotifSettings((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof NotificationSettings] }))} className={cn('relative h-6 w-10 rounded-full transition-colors', notifSettings[item.key as keyof NotificationSettings] ? 'bg-brand-600' : 'bg-surface-200 dark:bg-surface-700')}>
                    <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform', notifSettings[item.key as keyof NotificationSettings] ? 'left-5' : 'left-1')} />
                  </button>
                </SettingRow>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button className="btn-primary btn-sm" onClick={() => savePreferences(undefined, notifSettings)} disabled={savingPreferences}>
                {savingPreferences ? 'Saving...' : 'Save Notification Settings'}
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="pt-6">
          <div className="space-y-6">
            <div className="card p-5">
              <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Theme</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', label: 'Light', icon: <Sun size={20} /> },
                  { value: 'dark', label: 'Dark', icon: <Moon size={20} /> },
                  { value: 'system', label: 'System', icon: <div className="h-5 w-5 rounded-full border border-gray-200 bg-gradient-to-r from-white to-gray-900" /> },
                ].map((theme) => {
                  const isActive = appearanceSettings.theme === theme.value;
                  return (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => applyTheme(theme.value as AppearanceSettings['theme'])}
                      className={cn('flex flex-col items-center gap-2.5 rounded-2xl border-2 p-4 transition-all', isActive ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-surface-200 hover:border-surface-300 dark:border-surface-700 dark:hover:border-surface-600')}
                    >
                      <div className={cn('text-surface-500', isActive && 'text-brand-600')}>{theme.icon}</div>
                      <span className={cn('text-sm font-medium', isActive ? 'text-brand-700 dark:text-brand-300' : 'text-surface-600 dark:text-surface-400')}>{theme.label}</span>
                      {isActive && <Check size={14} className="text-brand-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Display Density</h3>
              <div className="grid grid-cols-3 gap-3">
                {(['compact', 'default', 'comfortable'] as const).map((density, index) => {
                  const isActive = appearanceSettings.density === density;
                  return (
                    <button key={density} type="button" onClick={() => setAppearanceSettings((prev) => ({ ...prev, density }))} className={cn('flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all', isActive ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20' : 'border-surface-200 hover:border-surface-300 dark:border-surface-700')}>
                      <div className="w-8 space-y-1">
                        {Array.from({ length: index === 0 ? 4 : index === 1 ? 3 : 2 }).map((_, itemIndex) => (
                          <div key={itemIndex} className="h-1 rounded-full bg-current opacity-30" />
                        ))}
                      </div>
                      <span className="text-xs font-medium capitalize text-surface-600 dark:text-surface-400">{density}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="mb-4 font-display font-semibold text-surface-900 dark:text-white">Language & Region</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Language</label>
                  <select value={appearanceSettings.language} onChange={(e) => setAppearanceSettings((prev) => ({ ...prev, language: e.target.value }))} className="input">
                    <option>English (US)</option>
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Gujarati</option>
                  </select>
                </div>
                <div>
                  <label className="label">Timezone</label>
                  <select value={appearanceSettings.timezone} onChange={(e) => setAppearanceSettings((prev) => ({ ...prev, timezone: e.target.value }))} className="input">
                    <option>UTC+0 (GMT)</option>
                    <option>UTC-8 (Pacific)</option>
                    <option>UTC-5 (Eastern)</option>
                    <option>UTC+1 (CET)</option>
                    <option>IST (GMT+5:30)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Date format</label>
                  <select value={appearanceSettings.dateFormat} onChange={(e) => setAppearanceSettings((prev) => ({ ...prev, dateFormat: e.target.value }))} className="input">
                    <option>MM/DD/YYYY</option>
                    <option>DD/MM/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="label">Start of week</label>
                  <select value={appearanceSettings.weekStartsOn} onChange={(e) => setAppearanceSettings((prev) => ({ ...prev, weekStartsOn: e.target.value }))} className="input">
                    <option>Monday</option>
                    <option>Sunday</option>
                    <option>Saturday</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button className="btn-primary btn-sm" onClick={() => savePreferences(appearanceSettings)} disabled={savingPreferences}>
                  {savingPreferences ? 'Saving...' : 'Save Appearance Settings'}
                </button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
