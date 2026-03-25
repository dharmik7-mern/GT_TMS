import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../context/authStore';
import api from '../../services/api';

interface Goal {
  target: string;
  actual: string;
  status: 'Done' | 'In Progress' | 'Pending';
  comment: string;
}
interface Learning {
  challenge: string;
  lesson: string;
}
interface KeyTask {
  task: string;
  status: 'Done' | 'In Progress' | 'Pending';
  comment: string;
}

interface MISData {
  id: string;
  _id?: string;
  week: string;
  employeeId?: { _id: string; id?: string; name: string; avatar?: string };
  projectId?: { _id: string; id?: string; name: string };
  goals: Goal[];
  learnings: Learning[];
  keyTasks: KeyTask[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  managerComment?: string;
  updatedAt?: string;
}

export default function MISManager() {
  const { user } = useAuthStore();
  
  const [pendingList, setPendingList] = useState<MISData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMIS, setSelectedMIS] = useState<MISData | null>(null);
  
  // Manager Action State
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.get('/mis/pending');
      if (res.data?.success) {
        setPendingList(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedMIS) return;
    if (action === 'reject' && !comment.trim()) {
      alert('A comment is mandatory for rejection.');
      return;
    }

    try {
      setActionLoading(true);
      const targetId = selectedMIS.id || selectedMIS._id;
      await api.put(`/mis/${action}`, { id: targetId, managerComment: comment });
      alert(`MIS ${action}d successfully`);
      setSelectedMIS(null);
      setComment('');
      fetchPending();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      alert('Failed to update MIS status: ' + msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (selectedMIS) {
    // Detail View Mode
    return (
      <div className="w-full font-sans pb-8 animate-in fade-in">
        <button 
          onClick={() => setSelectedMIS(null)}
          className="mb-3 text-blue-600 hover:text-blue-800 text-xs font-bold inline-flex items-center gap-1 transition-colors"
        >
          <span className="text-lg leading-none">&larr;</span> Back to Pending List
        </button>

         {/* Info Box */}
        <div className="bg-gray-50/50 dark:bg-surface-900/50 p-3 rounded-lg border border-gray-200 dark:border-surface-800 flex flex-wrap gap-4 items-center mb-6">
           <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-widest mb-1">Employee</label>
            <div className="flex items-center space-x-2">
               {selectedMIS.employeeId?.avatar ? (
                 <img src={selectedMIS.employeeId.avatar} alt="avatar" className="w-5 h-5 rounded-full object-cover" />
               ) : (
                 <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-brand-950/40 flex items-center justify-center text-blue-800 dark:text-brand-400 font-bold text-[10px] uppercase">
                   {selectedMIS.employeeId?.name?.charAt(0) || 'U'}
                 </div>
               )}
               <span className="text-gray-900 dark:text-surface-100 font-semibold text-sm">{selectedMIS.employeeId?.name || 'Unknown'}</span>
            </div>
          </div>
           <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-widest mb-1">Week</label>
            <div className="text-gray-900 dark:text-surface-100 font-semibold text-sm">{selectedMIS.week}</div>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-widest mb-1">Project</label>
            <div className="text-gray-900 dark:text-surface-100 font-semibold text-sm">{selectedMIS.projectId?.name || 'None'}</div>
          </div>
        </div>

         {/* Section 1 */}
        <div className="bg-white dark:bg-surface-900 border text-gray-800 dark:text-surface-100 border-gray-200 dark:border-surface-800 rounded-lg overflow-hidden mb-5">
          <div className="bg-[#fcfdff] dark:bg-surface-950/50 px-3 py-2 border-b border-gray-200 dark:border-surface-800">
             <h2 className="text-xs font-bold text-gray-700 dark:text-surface-300 uppercase tracking-widest">Business Goals</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
               <thead className="bg-[#f9fafb] dark:bg-surface-900 border-b border-gray-100 dark:border-surface-800 text-gray-500 dark:text-surface-400 font-semibold tracking-wide uppercase text-[10px]">
                 <tr>
                   <th className="px-3 py-1.5 w-8 text-center">#</th>
                   <th className="px-3 py-1.5 min-w-[200px]">Goal / Target</th>
                   <th className="px-3 py-1.5 min-w-[200px]">Actual Work</th>
                   <th className="px-3 py-1.5 w-28">Status</th>
                   <th className="px-3 py-1.5 min-w-[150px]">Comment</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-surface-800">
                 {selectedMIS.goals.map((g, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-surface-800/50">
                       <td className="px-3 py-2 text-center text-gray-400 dark:text-surface-500">{idx + 1}</td>
                       <td className="px-3 py-2 text-gray-800 dark:text-surface-100">{g.target}</td>
                       <td className="px-3 py-2 text-gray-800 dark:text-surface-100">{g.actual || '-'}</td>
                       <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                             ${g.status === 'Done' ? 'bg-green-100 dark:bg-emerald-950/40 text-green-700 dark:text-emerald-400' : ''}
                             ${g.status === 'In Progress' ? 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400' : ''}
                             ${g.status === 'Pending' ? 'bg-red-100 dark:bg-rose-950/40 text-red-700 dark:text-rose-400' : ''}
                          `}>
                            {g.status}
                         </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{g.comment || '-'}</td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        </div>

         {/* Section 2 */}
        <div className="bg-white dark:bg-surface-900 border text-gray-800 dark:text-surface-100 border-gray-200 dark:border-surface-800 rounded-lg overflow-hidden mb-5">
          <div className="bg-[#fcfdff] dark:bg-surface-950/50 px-3 py-2 border-b border-gray-200 dark:border-surface-800">
             <h2 className="text-xs font-bold text-gray-700 dark:text-surface-300 uppercase tracking-widest">Learnings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
               <thead className="bg-[#f9fafb] dark:bg-surface-900 border-b border-gray-100 dark:border-surface-800 text-gray-500 dark:text-surface-400 font-semibold tracking-wide uppercase text-[10px]">
                 <tr>
                   <th className="px-3 py-1.5 min-w-[250px]">Challenge Faced</th>
                   <th className="px-3 py-1.5 min-w-[250px]">Lesson Learned</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-surface-800">
                 {selectedMIS.learnings.length > 0 ? selectedMIS.learnings.map((l, idx) => (
                   <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-gray-800">{l.challenge}</td>
                      <td className="px-3 py-2 text-gray-800">{l.lesson}</td>
                   </tr>
                 )) : (
                   <tr><td colSpan={2} className="px-3 py-4 text-gray-400 text-center font-medium">No learnings recorded.</td></tr>
                 )}
               </tbody>
            </table>
          </div>
        </div>

        {/* Section 3 */}
        <div className="bg-white border border-brand-200/60 rounded-lg overflow-hidden relative mb-6">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500"></div>
          <div className="bg-brand-50/30 px-3 py-2 border-b border-brand-100/50 pl-4">
             <h2 className="text-xs font-bold text-brand-800 uppercase tracking-widest leading-none">Key Tasks (Priority)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left bg-white">
               <thead className="bg-[#f9fafb] border-b border-gray-100 text-gray-500 font-semibold tracking-wide uppercase text-[10px]">
                 <tr>
                   <th className="px-3 py-1.5 w-8 text-center">#</th>
                   <th className="px-3 py-1.5 min-w-[300px]">Task / Focus Area</th>
                   <th className="px-3 py-1.5 w-28">Status</th>
                   <th className="px-3 py-1.5 min-w-[200px]">Comment</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {selectedMIS.keyTasks.map((t, idx) => (
                   <tr key={idx} className="hover:bg-brand-50/10 transition-colors">
                      <td className="px-3 py-2 text-center text-brand-400 font-bold">{idx + 1}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{t.task}</td>
                      <td className="px-3 py-2">
                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                            ${t.status === 'Done' ? 'bg-green-100 text-green-700' : ''}
                            ${t.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' : ''}
                            ${t.status === 'Pending' ? 'bg-red-100 text-red-700' : ''}
                         `}>
                            {t.status}
                         </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{t.comment || '-'}</td>
                   </tr>
                 ))}
                 {selectedMIS.keyTasks.length === 0 && (
                   <tr><td colSpan={4} className="px-3 py-4 text-gray-400 text-center font-medium">No key tasks specified.</td></tr>
                 )}
               </tbody>
            </table>
          </div>
        </div>

         {/* Action Panel */}
        <div className="bg-gray-50/50 dark:bg-surface-900/50 rounded-lg p-4 border border-gray-200 dark:border-surface-800">
           <label className="block text-[11px] font-bold text-gray-500 dark:text-surface-400 uppercase tracking-widest mb-1.5">Manager Feedback / Comments</label>
           <textarea 
             value={comment}
             onChange={(e) => setComment(e.target.value)}
             className="w-full px-3 py-2 border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none resize-none disabled:bg-gray-100 dark:disabled:bg-surface-900 text-gray-800 dark:text-surface-100 shadow-sm transition-all"
             rows={2}
             placeholder="Optional for Approval, Mandatory for Rejection..."
           />
           <div className="flex justify-end gap-3 mt-3">
              <button 
                onClick={() => handleAction('reject')}
                disabled={actionLoading}
                className="px-5 py-1.5 rounded border border-red-200 dark:border-rose-900 bg-red-50 dark:bg-rose-950/20 hover:bg-red-100 dark:hover:bg-rose-900/40 text-red-700 dark:text-rose-400 text-xs font-bold transition-colors disabled:opacity-50"
              >
                Reject MIS
              </button>
              <button 
                onClick={() => handleAction('approve')}
                disabled={actionLoading}
                className="px-6 py-1.5 rounded bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-shadow shadow-sm disabled:opacity-50"
              >
                Approve MIS
              </button>
           </div>
        </div>

      </div>
    );
  }

  // Pending List View
  return (
    <div className="w-full font-sans pb-8">
      <div className="flex justify-end items-center mb-4">
        <button onClick={fetchPending} className="text-blue-600 hover:text-blue-800 font-bold text-xs underline">
          Refresh List
        </button>
      </div>

       <div className="bg-white dark:bg-surface-900 border text-gray-800 dark:text-surface-100 border-gray-200 dark:border-surface-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#fcfdff] dark:bg-surface-950/50 text-gray-500 dark:text-surface-400 font-semibold text-[10px] tracking-widest uppercase border-b border-gray-200 dark:border-surface-800">
              <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Week</th>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Submitted At</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-surface-800">
               {pendingList.map(item => (
                <tr key={item.id || item._id} className="hover:bg-gray-50/50 dark:hover:bg-surface-800/50 transition-colors">
                   <td className="px-4 py-2.5">
                      <div className="flex items-center space-x-2">
                         {item.employeeId?.avatar ? (
                           <img src={item.employeeId.avatar} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
                         ) : (
                           <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-brand-950/40 flex items-center justify-center text-blue-800 dark:text-brand-400 font-bold text-[10px]">
                             {item.employeeId?.name?.charAt(0) || 'U'}
                           </div>
                         )}
                         <span className="font-semibold text-gray-800 dark:text-surface-100">{item.employeeId?.name || 'Unknown'}</span>
                      </div>
                   </td>
                   <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-surface-300">{item.week}</td>
                   <td className="px-4 py-2.5 text-gray-600 dark:text-surface-400">{item.projectId?.name || '-'}</td>
                   <td className="px-4 py-2.5 text-gray-500 dark:text-surface-400">
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A'}
                   </td>
                   <td className="px-4 py-2.5 text-center">
                     <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border
                       ${item.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                       ${item.status === 'submitted' || !item.status ? 'bg-blue-100 text-blue-700 border-blue-200' : ''}
                       ${item.status === 'draft' ? 'bg-gray-100 text-gray-700 border-gray-200' : ''}
                       ${item.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : ''}
                     `}>
                       {item.status || 'SUBMITTED'}
                     </span>
                   </td>
                   <td className="px-4 py-2.5 text-center">
                      <button 
                        onClick={() => setSelectedMIS(item)}
                        className="text-blue-600 hover:text-blue-800 font-bold underline"
                      >
                        Review
                      </button>
                   </td>
                </tr>
              ))}
              {pendingList.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500 border-b border-transparent">
                    <div className="text-sm font-semibold mb-1 text-gray-400">All caught up!</div>
                    No MIS submissions pending review.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400 font-medium">Loading...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
