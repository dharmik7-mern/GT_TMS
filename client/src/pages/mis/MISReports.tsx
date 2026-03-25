import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function MISReports() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'employee' | 'project'>('weekly');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetchReport();
  }, [activeTab]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/reports/${activeTab}`);
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const renderTabs = () => (
     <div className="flex space-x-1 bg-gray-100/80 dark:bg-surface-800/50 p-1 rounded-lg w-fit mb-4">
      {['weekly', 'employee', 'project'].map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab as any)}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold capitalize transition-colors ${
            activeTab === tab 
              ? 'bg-white dark:bg-surface-800 text-blue-600 dark:text-brand-400 shadow-sm' 
              : 'text-gray-600 dark:text-surface-400 hover:text-gray-800 dark:hover:text-surface-200'
          }`}
        >
          {tab} Report
        </button>
      ))}
    </div>
  );

  const renderTable = () => {
    if (loading) {
       return <div className="text-gray-500 text-center py-6 text-sm">Loading report data...</div>;
    }

    if (activeTab === 'weekly') {
      return (
         <table className="min-w-full divide-y divide-gray-200 dark:divide-surface-800 text-xs text-left">
          <thead className="bg-[#fcfdff] dark:bg-surface-950/50 text-gray-500 dark:text-surface-400 font-semibold tracking-widest uppercase text-[10px] border-b border-gray-200 dark:border-surface-800">
            <tr>
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2">Week</th>
              <th className="px-4 py-2 text-center">Total Goals</th>
              <th className="px-4 py-2 text-center">Completed</th>
              <th className="px-4 py-2 text-center">Pending</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-surface-800 bg-white dark:bg-surface-900">
             {data.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-surface-800/50 transition-colors group">
                <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-surface-100">
                   <div className="flex items-center space-x-2">
                     {row.avatar ? (
                       <img src={row.avatar} alt="avatar" className="w-5 h-5 rounded-full object-cover" />
                     ) : (
                       <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-brand-950/40 flex items-center justify-center text-blue-800 dark:text-brand-400 font-bold text-[10px]">
                         {row.employeeName?.charAt(0) || 'U'}
                       </div>
                     )}
                     <span>{row.employeeName}</span>
                   </div>
                </td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-surface-300 font-medium">{row.week}</td>
                <td className="px-4 py-2.5 text-center text-gray-800 dark:text-surface-100 font-bold">{row.totalGoals}</td>
                <td className="px-4 py-2.5 text-center text-green-600 font-bold">{row.completedGoals}</td>
                <td className="px-4 py-2.5 text-center text-red-500 font-bold">{row.pendingGoals}</td>
                <td className="px-4 py-2.5">
                   <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border
                     ${row.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                     ${row.status === 'submitted' ? 'bg-blue-100 text-blue-700 border-blue-200' : ''}
                     ${row.status === 'draft' ? 'bg-gray-100 text-gray-700 border-gray-200' : ''}
                     ${row.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : ''}
                   `}>
                     {row.status}
                   </span>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">No records found.</td></tr>}
          </tbody>
        </table>
      );
    }

    if (activeTab === 'employee') {
      return (
         <table className="min-w-full divide-y divide-gray-200 dark:divide-surface-800 text-xs text-left">
          <thead className="bg-[#fcfdff] dark:bg-surface-950/50 text-gray-500 dark:text-surface-400 font-semibold tracking-widest uppercase text-[10px] border-b border-gray-200 dark:border-surface-800">
            <tr>
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2 text-center">Total Tasks</th>
              <th className="px-4 py-2 text-center">Completed</th>
              <th className="px-4 py-2 text-center">Pending</th>
              <th className="px-4 py-2 text-center">Efficiency %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-surface-800 bg-white dark:bg-surface-900">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors group">
                <td className="px-4 py-2.5 font-medium text-gray-800">
                   <div className="flex items-center space-x-2">
                     {row.avatar ? (
                       <img src={row.avatar} alt="avatar" className="w-5 h-5 rounded-full object-cover" />
                     ) : (
                       <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold text-[10px]">
                         {row.employeeName?.charAt(0) || 'U'}
                       </div>
                     )}
                     <span>{row.employeeName}</span>
                   </div>
                </td>
                <td className="px-4 py-2.5 text-center text-gray-800 font-bold">{row.totalTasks}</td>
                <td className="px-4 py-2.5 text-center text-green-600 font-bold">{row.completedTasks}</td>
                <td className="px-4 py-2.5 text-center text-red-500 font-bold">{row.pendingTasks}</td>
                <td className="px-4 py-2.5 text-center">
                   <div className="flex items-center justify-center space-x-2">
                     <span className="font-bold text-blue-700 text-xs">{row.efficiency}%</span>
                     <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500" style={{ width: `${row.efficiency}%` }} />
                     </div>
                   </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">No records found.</td></tr>}
          </tbody>
        </table>
      );
    }

    if (activeTab === 'project') {
      return (
         <table className="min-w-full divide-y divide-gray-200 dark:divide-surface-800 text-xs text-left">
          <thead className="bg-[#fcfdff] dark:bg-surface-950/50 text-gray-500 dark:text-surface-400 font-semibold tracking-widest uppercase text-[10px] border-b border-gray-200 dark:border-surface-800">
            <tr>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Employee Name</th>
              <th className="px-4 py-2 text-center">Completed Tasks</th>
              <th className="px-4 py-2 text-center">Pending Tasks</th>
              <th className="px-4 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-surface-800 bg-white dark:bg-surface-900">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors group">
                <td className="px-4 py-2.5 font-medium text-brand-700">{row.projectName}</td>
                <td className="px-4 py-2.5 text-gray-700">
                   <div className="flex items-center space-x-2">
                     {row.avatar ? (
                       <img src={row.avatar} alt="avatar" className="w-5 h-5 rounded-full object-cover" />
                     ) : (
                       <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-[10px]">
                         {row.employeeName?.charAt(0) || 'U'}
                       </div>
                     )}
                     <span>{row.employeeName}</span>
                   </div>
                </td>
                <td className="px-4 py-2.5 text-center text-green-600 font-bold">{row.completedTasks}</td>
                <td className="px-4 py-2.5 text-center text-red-500 font-bold">{row.pendingTasks}</td>
                <td className="px-4 py-2.5 text-center">
                   <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-gray-100 text-gray-700 border-gray-200">
                     {row.status}
                   </span>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">No records found.</td></tr>}
          </tbody>
        </table>
      );
    }

    return null;
  };

   return (
     <div className="w-full font-sans pb-8">
       {renderTabs()}
  
       <div className="bg-white dark:bg-surface-900 border text-gray-800 dark:text-surface-100 border-gray-200 dark:border-surface-800 rounded-lg overflow-hidden animate-in fade-in">
         <div className="overflow-x-auto">
           {renderTable()}
         </div>
       </div>
     </div>
   );
}
