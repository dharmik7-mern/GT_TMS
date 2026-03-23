import React, { useEffect, useMemo, useState } from 'react';
import { Globe, Mail, Server, Shield } from 'lucide-react';
import { Tabs, TabsContent } from '../../components/ui';
import { systemSettingsService } from '../../services/api';

const TAB_ITEMS = [
  { value: 'general', label: 'General', icon: <Globe size={14} /> },
  { value: 'email', label: 'Email Setup', icon: <Mail size={14} /> },
  { value: 'security', label: 'Security', icon: <Shield size={14} /> },
  { value: 'infrastructure', label: 'System Health', icon: <Server size={14} /> },
];

type SystemSettingsState = {
  general: {
    siteName: string;
    supportEmail: string;
    adminEmail: string;
    siteLanguage: string;
    timeZone: string;
  };
  security: {
    openRegistration: boolean;
    confirmEmail: boolean;
    extraLoginSecurity: boolean;
    strongPasswords: boolean;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    securityType: string;
    username: string;
    password: string;
    templates: {
      welcomeMessage: boolean;
      forgotPassword: boolean;
      loginAlert: boolean;
      paymentReceipt: boolean;
    };
  };
  infrastructure: {
    maintenanceMode: boolean;
    lastBackupAt: string | null;
    storageLimitMb?: number;
  };
  idGeneration: {
    company: {
      prefix: string;
      separator: string;
      digits: number;
      nextSequence: number;
    };
  };
  stats?: {
    lastBackupText?: string;
    storageUsedText?: string;
    onlineUsers?: number;
    companiesCount?: number;
    usersCount?: number;
    dbStatus?: string;
    maintenanceMode?: boolean;
  };
};

const DEFAULT_SETTINGS: SystemSettingsState = {
  general: {
    siteName: 'Gitakshmi PMS',
    supportEmail: 'gitakshmi@support.com',
    adminEmail: 'admin@gmail.com',
    siteLanguage: 'English',
    timeZone: 'UTC+0 (GMT)',
  },
  security: {
    openRegistration: true,
    confirmEmail: true,
    extraLoginSecurity: false,
    strongPasswords: true,
  },
  email: {
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: 587,
    securityType: 'TLS',
    username: 'apikey',
    password: '',
    templates: {
      welcomeMessage: true,
      forgotPassword: true,
      loginAlert: true,
      paymentReceipt: true,
    },
  },
  infrastructure: {
    maintenanceMode: false,
    lastBackupAt: null,
    storageLimitMb: 512000,
  },
  idGeneration: {
    company: {
      prefix: 'ORG',
      separator: '-',
      digits: 4,
      nextSequence: 1,
    },
  },
  stats: {
    lastBackupText: 'Never',
    storageUsedText: '0MB / 500GB',
    onlineUsers: 0,
    companiesCount: 0,
    usersCount: 0,
    dbStatus: 'unknown',
    maintenanceMode: false,
  },
};

const ToggleRow: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between rounded-xl border border-surface-100 p-3 dark:border-surface-800">
    <div>
      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{label}</p>
      <p className="text-[10px] text-surface-400">{description}</p>
    </div>
    <button
      type="button"
      onClick={onChange}
      className={`relative h-5 w-10 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-surface-200 dark:bg-surface-700'}`}
    >
      <span className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${checked ? 'right-1' : 'left-1'}`} />
    </button>
  </div>
);

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<SystemSettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [testingEmail, setTestingEmail] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await systemSettingsService.get();
      const data = res.data?.data ?? DEFAULT_SETTINGS;
      setSettings({
        ...DEFAULT_SETTINGS,
        ...data,
        general: { ...DEFAULT_SETTINGS.general, ...(data.general || {}) },
        security: { ...DEFAULT_SETTINGS.security, ...(data.security || {}) },
        email: {
          ...DEFAULT_SETTINGS.email,
          ...(data.email || {}),
          templates: { ...DEFAULT_SETTINGS.email.templates, ...(data.email?.templates || {}) },
        },
        infrastructure: { ...DEFAULT_SETTINGS.infrastructure, ...(data.infrastructure || {}) },
        idGeneration: {
          company: {
            ...DEFAULT_SETTINGS.idGeneration.company,
            ...(data.idGeneration?.company || {}),
          },
        },
        stats: { ...DEFAULT_SETTINGS.stats, ...(data.stats || {}) },
      });
    } catch {
      setMessage('Failed to load platform settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await systemSettingsService.update({
        general: settings.general,
        security: settings.security,
        email: settings.email,
        infrastructure: settings.infrastructure,
        idGeneration: settings.idGeneration,
      });
      setSettings((prev) => ({
        ...prev,
        ...(res.data?.data || {}),
        stats: res.data?.data?.stats || prev.stats,
      }));
      setMessage('Settings saved successfully.');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const persistStrongPasswordPolicy = async (nextValue: boolean) => {
    setSettings((prev) => ({
      ...prev,
      security: {
        ...prev.security,
        strongPasswords: nextValue,
      },
    }));
    setSaving(true);
    setMessage('');
    try {
      const res = await systemSettingsService.update({
        security: {
          strongPasswords: nextValue,
        },
      });
      const data = res.data?.data;
      if (data) {
        setSettings((prev) => ({
          ...prev,
          ...data,
          security: { ...prev.security, ...(data.security || {}) },
          stats: data.stats || prev.stats,
        }));
      }
      setMessage('Strong password policy updated successfully.');
    } catch (error: any) {
      setSettings((prev) => ({
        ...prev,
        security: {
          ...prev.security,
          strongPasswords: !nextValue,
        },
      }));
      setMessage(error?.response?.data?.error?.message || 'Failed to update strong password policy.');
    } finally {
      setSaving(false);
    }
  };

  const clearCache = async () => {
    setMessage('');
    try {
      await systemSettingsService.clearCache();
      setMessage('Cache cleared successfully.');
    } catch {
      setMessage('Failed to clear cache.');
    }
  };

  const refreshSystemData = async () => {
    setMessage('');
    try {
      const res = await systemSettingsService.refresh();
      const data = res.data?.data;
      if (data) {
        setSettings((prev) => ({
          ...prev,
          ...data,
          stats: data.stats || prev.stats,
        }));
      }
      setMessage('System data refreshed.');
    } catch {
      setMessage('Failed to refresh system data.');
    }
  };

  const testEmail = async () => {
    setTestingEmail(true);
    setMessage('');
    try {
      const res = await systemSettingsService.testEmail(settings.email);
      setMessage(res.data?.data?.message || 'SMTP test completed.');
    } catch (error: any) {
      setMessage(error?.response?.data?.data?.message || 'SMTP test failed.');
    } finally {
      setTestingEmail(false);
    }
  };

  const statRows = useMemo(() => [
    { label: 'Last Backup', value: settings.stats?.lastBackupText || 'Never' },
    { label: 'Storage Used', value: settings.stats?.storageUsedText || '0MB / 500GB' },
    { label: 'Online Users', value: String(settings.stats?.onlineUsers || 0) },
    { label: 'Companies', value: String(settings.stats?.companiesCount || 0) },
    { label: 'Users', value: String(settings.stats?.usersCount || 0) },
    { label: 'Database', value: settings.stats?.dbStatus || 'unknown' },
  ], [settings.stats]);

  if (loading) {
    return <div className="mx-auto max-w-7xl text-sm text-surface-400">Loading settings...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Site Settings</h1>
          <p className="page-subtitle">Manage your platform info, security, and emails</p>
        </div>
        <div className="flex gap-2">
          {/* <button className="btn-secondary btn-sm" onClick={clearCache}>Clear Cache</button> */}
          <button className="btn-primary btn-sm px-6" onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {message && <div className="mb-4 rounded-xl bg-surface-50 px-4 py-3 text-sm text-surface-600 dark:bg-surface-800/60">{message}</div>}

      <Tabs value={activeTab} onValueChange={setActiveTab} items={TAB_ITEMS} variant="underline">
        <TabsContent value="general" className="pt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="card p-6">
                <h3 className="mb-4 font-display font-bold text-surface-900 dark:text-white">Site Information</h3>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="label">Site Name</label>
                    <input value={settings.general.siteName} onChange={(e) => setSettings((prev) => ({ ...prev, general: { ...prev.general, siteName: e.target.value } }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Support Email address</label>
                    <input value={settings.general.supportEmail} onChange={(e) => setSettings((prev) => ({ ...prev, general: { ...prev.general, supportEmail: e.target.value } }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Admin Email address</label>
                    <input value={settings.general.adminEmail} onChange={(e) => setSettings((prev) => ({ ...prev, general: { ...prev.general, adminEmail: e.target.value } }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Site Language</label>
                    <select value={settings.general.siteLanguage} onChange={(e) => setSettings((prev) => ({ ...prev, general: { ...prev.general, siteLanguage: e.target.value } }))} className="input">
                      <option>English</option>
                      <option>Hindi</option>
                      <option>Gujarati</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Time Zone</label>
                    <select value={settings.general.timeZone} onChange={(e) => setSettings((prev) => ({ ...prev, general: { ...prev.general, timeZone: e.target.value } }))} className="input">
                      <option>UTC+0 (GMT)</option>
                      <option>IST (GMT+5:30)</option>
                      <option>PST (Pacific)</option>
                      <option>EST (Eastern)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="mb-4 font-display font-bold text-surface-900 dark:text-white">New User & Login</h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ToggleRow label="Open Registration" description="Allow anyone to join without invite" checked={settings.security.openRegistration} onChange={() => setSettings((prev) => ({ ...prev, security: { ...prev.security, openRegistration: !prev.security.openRegistration } }))} />
                  <ToggleRow label="Confirm Email" description="Require email check for new users" checked={settings.security.confirmEmail} onChange={() => setSettings((prev) => ({ ...prev, security: { ...prev.security, confirmEmail: !prev.security.confirmEmail } }))} />
                  <ToggleRow label="Extra Login Security" description="Add extra login verification for admins" checked={settings.security.extraLoginSecurity} onChange={() => setSettings((prev) => ({ ...prev, security: { ...prev.security, extraLoginSecurity: !prev.security.extraLoginSecurity } }))} />
                  <ToggleRow
                    label="Strong Passwords"
                    description="Require difficult passwords for safety"
                    checked={settings.security.strongPasswords}
                    onChange={() => {
                      void persistStrongPasswordPolicy(!settings.security.strongPasswords);
                    }}
                  />
                </div>
              </div>

              <div className="card p-6">
                <h3 className="mb-4 font-display font-bold text-surface-900 dark:text-white">Organization ID Format</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Prefix</label>
                    <input value={settings.idGeneration.company.prefix} onChange={(e) => setSettings((prev) => ({ ...prev, idGeneration: { company: { ...prev.idGeneration.company, prefix: e.target.value } } }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Separator</label>
                    <input value={settings.idGeneration.company.separator} onChange={(e) => setSettings((prev) => ({ ...prev, idGeneration: { company: { ...prev.idGeneration.company, separator: e.target.value } } }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Digits</label>
                    <input type="number" min={1} max={8} value={settings.idGeneration.company.digits} onChange={(e) => setSettings((prev) => ({ ...prev, idGeneration: { company: { ...prev.idGeneration.company, digits: Number(e.target.value) || 4 } } }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Next Sequence</label>
                    <input type="number" min={1} value={settings.idGeneration.company.nextSequence} onChange={(e) => setSettings((prev) => ({ ...prev, idGeneration: { company: { ...prev.idGeneration.company, nextSequence: Number(e.target.value) || 1 } } }))} className="input" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-surface-400">
                  Preview: {settings.idGeneration.company.prefix}{settings.idGeneration.company.separator}{String(settings.idGeneration.company.nextSequence).padStart(settings.idGeneration.company.digits, '0')}
                </p>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-1">
              <div className="card border-brand-100 bg-brand-50/50 p-5 dark:border-brand-900/30 dark:bg-brand-950/10">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-600">Quick Actions</h4>
                <div className="space-y-2">
                  <button className="btn-primary w-full py-2" onClick={saveSettings}>Save All Changes</button>
                  <button className="btn-secondary w-full py-2" onClick={refreshSystemData}>Refresh System Data</button>
                  <button className="btn-ghost w-full py-2 text-rose-500 hover:bg-rose-50" onClick={() => setSettings((prev) => ({ ...prev, infrastructure: { ...prev.infrastructure, maintenanceMode: !prev.infrastructure.maintenanceMode } }))}>
                    {settings.infrastructure.maintenanceMode ? 'Disable Maintenance Mode' : 'Maintenance Mode'}
                  </button>
                </div>
              </div>

              <div className="card p-5">
                <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-surface-400">System Stats</h4>
                <div className="space-y-4">
                  {statRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-xs">
                      <span className="text-surface-500">{row.label}</span>
                      <span className="font-medium text-surface-900 dark:text-white">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="email" className="pt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="mb-4 font-display font-bold text-surface-900 dark:text-white">Email Sending (SMTP)</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="label">Mail Server Host</label>
                    <input value={settings.email.smtpHost} onChange={(e) => setSettings((prev) => ({ ...prev, email: { ...prev.email, smtpHost: e.target.value } }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Server Port</label>
                    <input value={settings.email.smtpPort} onChange={(e) => setSettings((prev) => ({ ...prev, email: { ...prev.email, smtpPort: Number(e.target.value) || 0 } }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Security Type</label>
                    <select value={settings.email.securityType} onChange={(e) => setSettings((prev) => ({ ...prev, email: { ...prev.email, securityType: e.target.value } }))} className="input">
                      <option>TLS</option>
                      <option>SSL</option>
                      <option>None</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Admin Username</label>
                    <input value={settings.email.username} onChange={(e) => setSettings((prev) => ({ ...prev, email: { ...prev.email, username: e.target.value } }))} className="input" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Admin Password</label>
                    <input type="password" value={settings.email.password} onChange={(e) => setSettings((prev) => ({ ...prev, email: { ...prev.email, password: e.target.value } }))} className="input" />
                  </div>
                </div>
                <div className="flex gap-2 border-t border-surface-100 pt-4 dark:border-surface-800">
                  <button className="btn-secondary btn-sm flex-1" onClick={testEmail} disabled={testingEmail}>{testingEmail ? 'Testing...' : 'Test Connection'}</button>
                  <button className="btn-primary btn-sm flex-1" onClick={saveSettings}>Apply Changes</button>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="mb-4 font-display font-bold text-surface-900 dark:text-white">Automatic Emails</h3>
              <div className="space-y-3">
                {[
                  ['welcomeMessage', 'Welcome Message'],
                  ['forgotPassword', 'Forgot Password'],
                  ['loginAlert', 'Login Alert'],
                  // ['paymentReceipt', 'Payment Receipt'],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-surface-50 p-3 dark:border-surface-800">
                    <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{label}</span>
                    <button
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, email: { ...prev.email, templates: { ...prev.email.templates, [key]: !prev.email.templates[key as keyof typeof prev.email.templates] } } }))}
                      className={`relative h-5 w-10 rounded-full transition-colors ${settings.email.templates[key as keyof typeof settings.email.templates] ? 'bg-brand-600' : 'bg-surface-200 dark:bg-surface-700'}`}
                    >
                      <span className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${settings.email.templates[key as keyof typeof settings.email.templates] ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="pt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="mb-4 font-display font-bold text-surface-900 dark:text-white">Security Controls</h3>
              <div className="space-y-3">
                <ToggleRow label="Open Registration" description="Allow self-registration across the platform" checked={settings.security.openRegistration} onChange={() => setSettings((prev) => ({ ...prev, security: { ...prev.security, openRegistration: !prev.security.openRegistration } }))} />
                <ToggleRow label="Email Confirmation" description="Require verification after signup" checked={settings.security.confirmEmail} onChange={() => setSettings((prev) => ({ ...prev, security: { ...prev.security, confirmEmail: !prev.security.confirmEmail } }))} />
                <ToggleRow label="Admin Extra Security" description="Enable stricter login flow for admins" checked={settings.security.extraLoginSecurity} onChange={() => setSettings((prev) => ({ ...prev, security: { ...prev.security, extraLoginSecurity: !prev.security.extraLoginSecurity } }))} />
                <ToggleRow label="Strong Password Policy" description="Require stronger passwords across the system" checked={settings.security.strongPasswords} onChange={() => setSettings((prev) => ({ ...prev, security: { ...prev.security, strongPasswords: !prev.security.strongPasswords } }))} />
              </div>
            </div>

            <div className="card p-6">
              <h3 className="mb-4 font-display font-bold text-surface-900 dark:text-white">Infrastructure Controls</h3>
              <ToggleRow label="Maintenance Mode" description="Flag the platform as under maintenance" checked={settings.infrastructure.maintenanceMode} onChange={() => setSettings((prev) => ({ ...prev, infrastructure: { ...prev.infrastructure, maintenanceMode: !prev.infrastructure.maintenanceMode } }))} />
              <div className="mt-4">
                <button className="btn-primary btn-sm w-full" onClick={saveSettings}>Save Security Settings</button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="infrastructure" className="pt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="mb-4 font-display font-bold text-surface-900 dark:text-white">Platform Health</h3>
              <div className="space-y-4">
                {statRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-xl bg-surface-50 px-4 py-3 dark:bg-surface-800/50">
                    <span className="text-sm text-surface-500">{row.label}</span>
                    <span className="text-sm font-medium text-surface-900 dark:text-white">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="mb-4 font-display font-bold text-surface-900 dark:text-white">Actions</h3>
              <div className="space-y-3">
                <button className="btn-primary w-full" onClick={refreshSystemData}>Refresh System Data</button>
                <button className="btn-secondary w-full" onClick={clearCache}>Clear Cache</button>
                <button className="btn-secondary w-full" onClick={saveSettings}>Save Platform Settings</button>
                <div className="rounded-xl bg-surface-50 p-4 text-sm text-surface-500 dark:bg-surface-800/50">
                  Current maintenance flag:
                  <span className="ml-2 font-medium text-surface-900 dark:text-white">
                    {settings.infrastructure.maintenanceMode ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
