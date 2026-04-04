import React, { useEffect, useState } from 'react';
import { formatDate } from '../../utils/helpers';
import { reportsService } from '../../services/api';
import type { DailyWorkReport } from '../../app/types';

export default function MISReports() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'employee' | 'project' | 'daily'>('weekly');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [dailyReport, setDailyReport] = useState<DailyWorkReport | null>(null);
  const [runningNow, setRunningNow] = useState(false);

  useEffect(() => {
    void fetchReport();
  }, [activeTab]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      if (activeTab === 'daily') {
        const res = await reportsService.getDailyLatest();
        if (res.data?.success) {
          setDailyReport(res.data.data);
        } else {
          setDailyReport(null);
        }
        return;
      }
      const serviceMap = {
        weekly: reportsService.getWeekly,
        employee: reportsService.getEmployee,
        project: reportsService.getProject,
      } as const;
      const res = await serviceMap[activeTab]();
      setData(res.data?.success ? (res.data.data || []) : []);
    } catch (err) {
      console.error(err);
      setData([]);
      setDailyReport(null);
    } finally {
      setLoading(false);
    }
  };

  const runDailyReportNow = async () => {
    try {
      setRunningNow(true);
      await reportsService.runDailyNow();
      await fetchReport();
    } catch (error) {
      console.error(error);
    } finally {
      setRunningNow(false);
    }
  };

  const renderTabs = () => (
     <div className="flex space-x-1 bg-gray-100/80 dark:bg-surface-800/50 p-1 rounded-lg w-fit mb-4">
      {['weekly', 'employee', 'project', 'daily'].map((tab) => (
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

    if (activeTab === 'daily') {
      if (!dailyReport) {
        return <div className="text-gray-500 text-center py-6 text-sm">No daily report available yet.</div>;
      }

      return (
        <div className="space-y-4 p-4">
          <div className="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-900/60 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">{formatDate(dailyReport.reportDate)}</p>
              <p className="text-xs text-surface-500 dark:text-surface-400">{dailyReport.analysis.headline}</p>
            </div>
            <button onClick={runDailyReportNow} disabled={runningNow} className="btn-primary btn-sm">
              {runningNow ? 'Generating...' : 'Run Report Now'}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Employees', value: dailyReport.summary.employeesCount },
              { label: 'Completed Today', value: dailyReport.summary.totalCompletedToday },
              { label: 'Due Today', value: dailyReport.summary.totalDueToday },
              { label: 'Overdue Open', value: dailyReport.summary.totalOverdueOpen },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-surface-100 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
                <p className="text-[11px] uppercase tracking-wide text-surface-400">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-surface-100">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border border-surface-100 bg-white dark:border-surface-800 dark:bg-surface-900">
              <div className="border-b border-surface-100 px-4 py-3 dark:border-surface-800">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">Employee Overview</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[100%] divide-y divide-surface-100 text-xs dark:divide-surface-800">
                  <thead className="bg-surface-50 dark:bg-surface-950/40">
                    <tr>
                      <th className="px-4 py-3 text-left">Employee</th>
                      <th className="px-4 py-3 text-center">Open</th>
                      <th className="px-4 py-3 text-center">Done Today</th>
                      <th className="px-4 py-3 text-center">Due Today</th>
                      <th className="px-4 py-3 text-center">Overdue</th>
                      <th className="px-4 py-3 text-center">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {dailyReport.employeeSummaries.map((row) => (
                      <tr key={row.userId}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-surface-900 dark:text-surface-100">{row.name}</p>
                          <p className="text-[11px] text-surface-400">{row.analysis}</p>
                        </td>
                        <td className="px-4 py-3 text-center">{row.assignedOpenTasks}</td>
                        <td className="px-4 py-3 text-center">{row.completedToday}</td>
                        <td className="px-4 py-3 text-center">{row.dueToday}</td>
                        <td className="px-4 py-3 text-center">{row.overdueOpen}</td>
                        <td className="px-4 py-3 text-center font-semibold text-brand-600">{row.performanceScore}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-surface-100 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">Overall Analysis</p>
                <div className="mt-3 space-y-3 text-sm text-surface-600 dark:text-surface-300">
                  {dailyReport.analysis.strengths.map((item) => <p key={item}>{item}</p>)}
                  {dailyReport.analysis.risks.map((item) => <p key={item}>{item}</p>)}
                  {dailyReport.analysis.recommendations.map((item) => <p key={item}>{item}</p>)}
                </div>
              </div>
              <div className="rounded-xl border border-surface-100 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">Top Performer</p>
                <p className="mt-2 text-lg font-semibold text-brand-600">{dailyReport.summary.topPerformerName || 'Not available'}</p>
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  Score: {dailyReport.summary.topPerformerScore}% • Avg workspace score: {dailyReport.summary.averagePerformanceScore}%
                </p>
              </div>
            </div>
          </div>
        </div>
      );
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
