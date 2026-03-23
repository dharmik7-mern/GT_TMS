import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Search, Settings, Filter, ShieldCheck, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { Table } from '../../components/ui';

const MODULES = [
  { id: 'tasks', name: 'Task Management', description: 'Kanban, List and Table views for tasks' },
  { id: 'projects', name: 'Project Portfolio', description: 'Organize work into projects and portfolios' },
  { id: 'chat', name: 'Real-time Chat', description: 'Internal team communication and direct messages' },
  { id: 'files', name: 'File Storage', description: 'Document management and file sharing' },
  { id: 'calendar', name: 'Team Calendar', description: 'Shared calendar for events and deadlines' },
  { id: 'reports', name: 'Advanced Analytics', description: 'Business intelligence and productivity reports' },
];

const COMPANIES = [
  { id: 'c1', name: 'Gitakshmi', modules: ['tasks', 'projects', 'chat', 'files', 'calendar'] },
  { id: 'c2', name: 'Global Tech', modules: ['tasks', 'projects', 'files'] },
  { id: 'c3', name: 'Stellar Systems', modules: ['tasks', 'chat', 'calendar'] },
  { id: 'c4', name: 'Flowboard', modules: ['tasks', 'projects', 'chat', 'files', 'calendar', 'reports'] },
];

export const ModulesPage: React.FC = () => {
  const [search, setSearch] = useState('');

  const filtered = COMPANIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Feature Modules</h1>
          <p className="page-subtitle">Configure available features per company</p>
        </div>
      </div>

      {/* Grid of Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {MODULES.map((module, i) => (
          <motion.div
            key={module.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-5 group hover:border-brand-500/30 transition-all border border-transparent"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center text-brand-600 mb-4 group-hover:scale-110 transition-transform">
              <Zap size={20} />
            </div>
            <h3 className="font-display font-bold text-surface-900 dark:text-white mb-1">{module.name}</h3>
            <p className="text-xs text-surface-400 leading-relaxed">{module.description}</p>
          </motion.div>
        ))}
      </div>

      <div className="card p-5 mb-4 border-b-0 rounded-b-none">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-surface-900 dark:text-white">Company Configuration</h2>
          <div className="relative max-w-xs w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter companies..."
              className="input pl-9"
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider w-64">Company</th>
                {MODULES.map(m => (
                  <th key={m.id} className="px-4 py-3 text-center text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    {m.name.split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50 dark:divide-surface-800/50">
              {filtered.map((company, ci) => (
                <tr key={company.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{company.name}</p>
                    <p className="text-[10px] text-surface-400 mt-0.5">{company.modules.length} modules active</p>
                  </td>
                  {MODULES.map(m => {
                    const isActive = company.modules.includes(m.id);
                    return (
                      <td key={m.id} className="px-4 py-4 text-center">
                        <button className={cn(
                          "w-10 h-5 rounded-full relative transition-colors duration-200 ml-auto mr-auto",
                          isActive ? "bg-brand-600" : "bg-surface-200 dark:bg-surface-700"
                        )}>
                          <span className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200",
                            isActive ? "left-6" : "left-1"
                          )} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ModulesPage;
