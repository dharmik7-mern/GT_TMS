import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Search, Filter, Mail, Phone, ExternalLink, CheckCircle2, AlertCircle, Clock, MoreHorizontal } from 'lucide-react';
import { cn, formatDate } from '../../utils/helpers';
import { Table } from '../../components/ui';

const TICKETS = [
  { id: 'tk1', company: 'Gitakshmi', subject: 'Cannot login to mobile app', status: 'open', priority: 'high', category: 'Technical', createdAt: '2024-03-15T09:30:00' },
  { id: 'tk2', company: 'Global Tech', subject: 'Billing inquiry Q1', status: 'pending', priority: 'medium', category: 'Billing', createdAt: '2024-03-15T08:15:00' },
  { id: 'tk3', company: 'Stellar Systems', subject: 'How to export reports?', status: 'resolved', priority: 'low', category: 'Usage', createdAt: '2024-03-14T15:00:00' },
  { id: 'tk4', company: 'Flowboard', subject: 'Feature request: Gantt views', status: 'open', priority: 'medium', category: 'Feature', createdAt: '2024-03-14T11:45:00' },
];

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30' },
  pending: { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  resolved: { label: 'Resolved', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
};

const PRIORITY_COLORS = {
  high: 'text-rose-500',
  medium: 'text-amber-500',
  low: 'text-emerald-500',
};

export const SupportPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Support Desk</h1>
          <p className="page-subtitle">Manage customer tickets and platform support inquiries</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Tickets', val: '1,284', icon: MessageSquare, color: 'text-brand-600' },
          { label: 'Active Issues', val: '42', icon: AlertCircle, color: 'text-rose-600' },
          { label: 'Resolved today', val: '18', icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Avg Feedback', val: '4.8/5', icon: Clock, color: 'text-amber-600' },
        ].map((stat, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-surface-400 uppercase tracking-widest">{stat.label}</p>
              <stat.icon size={16} className={stat.color} />
            </div>
            <p className="text-2xl font-display font-bold text-surface-900 dark:text-white">{stat.val}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between bg-surface-50 dark:bg-surface-800/20">
          <h3 className="font-display font-bold text-surface-900 dark:text-white">Active Tickets</h3>
          <div className="flex items-center gap-2">
            <div className="relative max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input className="input pl-9 h-9 text-xs" placeholder="Search tickets..." />
            </div>
            <button className="btn-secondary h-9 px-3 text-xs flex items-center gap-2">
              <Filter size={14} /> Filter
            </button>
          </div>
        </div>
        <Table
          columns={[
            {
              key: 'id', header: 'Ticket ID',
              render: (t: any) => <span className="text-xs font-mono text-surface-400">#{t.id}</span>
            },
            {
              key: 'company', header: 'Company',
              render: (t: any) => <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{t.company}</span>
            },
            {
              key: 'subject', header: 'Subject',
              render: (t: any) => (
                <div className="max-w-md">
                  <p className="text-sm text-surface-900 dark:text-white truncate">{t.subject}</p>
                  <p className="text-[10px] text-surface-400 uppercase mt-0.5">{t.category}</p>
                </div>
              )
            },
            {
              key: 'priority', header: 'Priority',
              render: (t: any) => (
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_COLORS[t.priority as keyof typeof PRIORITY_COLORS])} />
                  <span className="text-xs capitalize">{t.priority}</span>
                </div>
              )
            },
            {
              key: 'status', header: 'Status',
              render: (t: any) => {
                const cfg = STATUS_CONFIG[t.status as keyof typeof STATUS_CONFIG];
                return <span className={cn('badge text-[10px]', cfg.bg, cfg.color)}>{cfg.label}</span>;
              }
            },
            {
              key: 'createdAt', header: 'Created',
              render: (t: any) => <span className="text-xs text-surface-400">{formatDate(t.createdAt)}</span>
            },
            {
              key: 'actions', header: '', align: 'right',
              render: () => (
                <button className="btn-ghost btn-sm w-8 h-8 rounded-lg">
                  <ExternalLink size={14} />
                </button>
              )
            }
          ]}
          data={TICKETS}
          keyExtractor={t => t.id}
        />
      </div>
    </div>
  );
};

export default SupportPage;
