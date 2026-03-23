import React, { useEffect, useMemo, useState } from 'react';
import { Send, History, Trash2, Globe, Building2, User } from 'lucide-react';
import { cn, formatDate } from '../../utils/helpers';
import { Table } from '../../components/ui';
import { companiesService, notificationsService } from '../../services/api';
import { emitSuccessToast } from '../../context/toastBus';

type TargetType = 'all' | 'company' | 'user';
type MessageType = 'info' | 'success' | 'warning' | 'urgent';

type BroadcastHistoryItem = {
  id: string;
  title: string;
  message: string;
  targetLabel: string;
  targetType: TargetType;
  messageType: MessageType;
  reachCount: number;
  sentAt: string;
};

const MESSAGE_TYPES: { value: MessageType; label: string }[] = [
  { value: 'info', label: 'Information (Blue)' },
  { value: 'success', label: 'Success (Green)' },
  { value: 'warning', label: 'Warning (Amber)' },
  { value: 'urgent', label: 'Urgent (Red)' },
];

export const NotificationsPage: React.FC = () => {
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    companyId: '',
    userEmail: '',
    messageType: 'info' as MessageType,
    title: '',
    message: '',
  });

  useEffect(() => {
    companiesService
      .getAll()
      .then((response) => {
        const items = response.data.data ?? response.data ?? [];
        setCompanies(items.map((company: any) => ({ id: company.id, name: company.name })));
      })
      .catch(() => setCompanies([]));
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await notificationsService.getBroadcastHistory();
      setHistory(response.data.data ?? response.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const selectedCompanyName = useMemo(
    () => companies.find((company) => company.id === form.companyId)?.name || '',
    [companies, form.companyId]
  );

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBroadcast = async () => {
    setSending(true);
    try {
      await notificationsService.broadcast({
        targetType,
        companyId: targetType === 'company' ? form.companyId : undefined,
        companyName: targetType === 'company' ? selectedCompanyName : undefined,
        userEmail: targetType === 'user' ? form.userEmail : undefined,
        messageType: form.messageType,
        title: form.title,
        message: form.message,
      });
      emitSuccessToast('Broadcast sent successfully.', 'Notification Sent');
      setForm({
        companyId: companies[0]?.id || '',
        userEmail: '',
        messageType: 'info',
        title: '',
        message: '',
      });
      setTargetType('all');
      await loadHistory();
    } catch {
      // shared interceptor shows the error
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Broadcast Notifications</h1>
          <p className="page-subtitle">Send platform-wide announcements and review real broadcast history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-24">
            <h2 className="font-display font-bold text-lg text-surface-900 dark:text-white mb-4 flex items-center gap-2">
              <Send size={18} className="text-brand-600" />
              Compose Message
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Target Audience</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'All', icon: Globe },
                    { id: 'company', label: 'Company', icon: Building2 },
                    { id: 'user', label: 'User', icon: User },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setTargetType(item.id as TargetType)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border p-2 text-[10px] font-bold transition-all',
                        targetType === item.id
                          ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-950/20 dark:border-brand-800'
                          : 'border-surface-100 dark:border-surface-800 text-surface-400 hover:border-surface-200'
                      )}
                    >
                      <item.icon size={16} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {targetType === 'company' && (
                <div>
                  <label className="label">Select Company</label>
                  <select value={form.companyId} onChange={(e) => handleChange('companyId', e.target.value)} className="input">
                    <option value="" disabled>{companies.length ? 'Select a company' : 'No companies available'}</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'user' && (
                <div>
                  <label className="label">User Email</label>
                  <input value={form.userEmail} onChange={(e) => handleChange('userEmail', e.target.value)} className="input" placeholder="e.g. user@example.com" />
                </div>
              )}

              <div>
                <label className="label">Message Type</label>
                <select value={form.messageType} onChange={(e) => handleChange('messageType', e.target.value)} className="input">
                  {MESSAGE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Title</label>
                <input value={form.title} onChange={(e) => handleChange('title', e.target.value)} className="input" placeholder="Enter headline..." />
              </div>

              <div>
                <label className="label">Message Content</label>
                <textarea value={form.message} onChange={(e) => handleChange('message', e.target.value)} className="input h-32 py-2 resize-none" placeholder="Write your announcement here..." />
              </div>

              <button onClick={() => { void handleBroadcast(); }} disabled={sending} className="btn-primary w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2">
                <Send size={16} /> {sending ? 'Sending...' : 'Broadcast Now'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card p-0 overflow-hidden">
            <div className="p-5 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-50 dark:bg-surface-800 flex items-center justify-center text-surface-400">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-surface-900 dark:text-white">Broadcast History</h3>
                  <p className="text-xs text-surface-400">Persisted announcements sent from this panel</p>
                </div>
              </div>
              <button onClick={() => { void loadHistory(); }} className="btn-ghost btn-sm text-surface-400"><Trash2 size={14} /></button>
            </div>

            <Table
              columns={[
                {
                  key: 'title', header: 'Announcement',
                  render: (item: BroadcastHistoryItem) => (
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                        item.messageType === 'urgent' ? 'bg-rose-500' :
                          item.messageType === 'warning' ? 'bg-amber-500' :
                            item.messageType === 'success' ? 'bg-emerald-500' : 'bg-brand-500'
                      )} />
                      <div className="min-w-0">
                        <p className="font-medium text-surface-900 dark:text-white text-sm truncate">{item.title}</p>
                        <p className="text-xs text-surface-400 truncate max-w-[260px]">{item.message}</p>
                      </div>
                    </div>
                  ),
                },
                { key: 'targetLabel', header: 'Target', render: (item: BroadcastHistoryItem) => <span className="text-xs font-semibold px-2 py-0.5 bg-surface-50 dark:bg-surface-800 rounded">{item.targetLabel}</span> },
                { key: 'reachCount', header: 'Reach', render: (item: BroadcastHistoryItem) => <span className="text-xs text-surface-500">{item.reachCount}</span> },
                { key: 'sentAt', header: 'Sent At', render: (item: BroadcastHistoryItem) => <span className="text-xs text-surface-400">{formatDate(item.sentAt)}</span> },
              ]}
              data={loading ? [] : history}
              keyExtractor={(item) => item.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
