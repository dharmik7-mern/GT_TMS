import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../context/authStore';
import api from '../../services/api';
import { cn } from '../../utils/helpers';


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
  id?: string;
  _id?: string;
  week: string;
  projectId?: string;
  goals: Goal[];
  learnings: Learning[];
  keyTasks: KeyTask[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  managerComment?: string;
  createdAt?: string;
}

export default function MISEntry() {
  const { user } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [history, setHistory] = useState<MISData[]>([]);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  
  // Form State
  const [currentMISId, setCurrentMISId] = useState<string | null>(null);
  const [week, setWeek] = useState(generateCurrentWeekLabel());
  const [status, setStatus] = useState<'draft' | 'submitted' | 'approved' | 'rejected'>('draft');
  const [managerComment, setManagerComment] = useState('');
  
  const [goals, setGoals] = useState<Goal[]>([
    { target: '', actual: '', status: 'Pending', comment: '' }
  ]);
  const [learnings, setLearnings] = useState<Learning[]>([
    { challenge: '', lesson: '' }
  ]);
  const [keyTasks, setKeyTasks] = useState<KeyTask[]>([
    { task: '', status: 'Pending', comment: '' }
  ]);
  const [projectId, setProjectId] = useState<string>('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      if (res.data?.success) {
        setProjects(res.data.data.map((p: any) => ({ id: p.id || p._id, name: p.name })));
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  function generateCurrentWeekLabel() {
    const d = new Date();
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const date = d.getDate();
    const weekNum = Math.ceil(date / 7);
    return `${month}-WEEK-${weekNum > 4 ? 4 : weekNum}`;
  }

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/mis/employee/me');
      if (res.data?.success) {
        setHistory(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMISIntoForm = (mis: MISData) => {
    setCurrentMISId(mis.id || mis._id || null);
    setWeek(mis.week);
    setGoals(mis.goals.length ? mis.goals : [{ target: '', actual: '', status: 'Pending', comment: '' }]);
    setLearnings(mis.learnings.length ? mis.learnings : [{ challenge: '', lesson: '' }]);
    setKeyTasks(mis.keyTasks.length ? mis.keyTasks : [{ task: '', status: 'Pending', comment: '' }]);
    setProjectId(typeof mis.projectId === 'object' ? (mis.projectId as any).id || (mis.projectId as any)._id : mis.projectId || '');
    setStatus(mis.status);
    setManagerComment(mis.managerComment || '');
    setActiveTab('form');
  };

  const handleDuplicateLast = () => {
    if (history.length > 0) {
      const last = history[0];
      setGoals(last.goals);
      setLearnings(last.learnings);
      setKeyTasks(last.keyTasks);
      setCurrentMISId(null);
      setProjectId(typeof last.projectId === 'object' ? (last.projectId as any).id || (last.projectId as any)._id : last.projectId || '');
      setWeek(generateCurrentWeekLabel());
      setStatus('draft');
      setManagerComment('');
    }
  };

  const handleSave = async (submit: boolean = false) => {
    if (submit) {
      if (!window.confirm('Once submitted, you cannot edit this MIS. Are you sure?')) {
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        id: currentMISId,
        week,
        projectId: projectId || undefined,
        goals,
        learnings,
        keyTasks,
        status: submit ? 'submitted' : 'draft'
      };

      if (currentMISId) {
        if (submit) {
          await api.put('/mis/update', payload);
          await api.put('/mis/submit', { id: currentMISId });
        } else {
          await api.put('/mis/update', payload);
        }
      } else {
        const res = await api.post('/mis/create', { ...payload, status: submit ? 'submitted' : 'draft' });
        setCurrentMISId(res.data.data._id);
      }
      
      setStatus(submit ? 'submitted' : 'draft');
      alert(submit ? 'MIS Submitted successfully!' : 'Draft saved!');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      alert('Failed to save MIS: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const isEditable = status === 'draft' || status === 'rejected';

  return (
    <div className="w-full font-sans pb-8">
      
      {/* Header Info */}
      <div className="flex justify-start mb-4">
        <div className="flex space-x-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-lg">
           <button 
             onClick={() => setActiveTab('form')} 
             className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${activeTab === 'form' ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200'}`}
           >
             Entry Form
           </button>
           <button 
             onClick={() => setActiveTab('history')} 
             className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${activeTab === 'history' ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200'}`}
           >
             My History
           </button>
        </div>
      </div>

       {activeTab === 'history' && (
        <div className="bg-white dark:bg-surface-900 rounded-lg border border-gray-200 dark:border-surface-800 overflow-hidden shadow-sm animate-in fade-in">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-surface-800 text-sm text-left">
            <thead className="bg-[#fcfdff] dark:bg-surface-950/50 text-gray-500 dark:text-surface-400 font-semibold text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2">Week</th>
                <th className="px-4 py-2">Submitted On</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-surface-800">
               {history.map(item => (
                <tr key={item.id || item._id} className="hover:bg-gray-50/50 dark:hover:bg-surface-800/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-surface-100">{item.week}</td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-surface-400">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                   <td className="px-4 py-2.5">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
                      item.status === 'draft' && 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border-surface-200 dark:border-surface-700',
                      item.status === 'submitted' && 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-900/50',
                      item.status === 'approved' && 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
                      item.status === 'rejected' && 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                    )}>
                      {item.status}
                    </span>
                  </td>
                   <td className="px-4 py-2.5 text-right">
                    <button 
                      onClick={() => loadMISIntoForm(item)}
                      className="text-brand-600 dark:text-brand-400 hover:underline font-medium text-xs transition-colors"
                    >
                      View / Edit
                    </button>
                  </td>
                </tr>
              ))}
              {history.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500 text-sm">
                    No MIS history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'form' && (
        <div className="space-y-4 animate-in fade-in">
          
           {/* Header Controls */}
          <div className="bg-gray-50/50 dark:bg-surface-900/50 p-3 rounded-lg border border-gray-200 dark:border-surface-800 flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-widest mb-0.5">Employee</label>
              <div className="text-gray-800 dark:text-surface-100 font-semibold text-sm">{user?.name}</div>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-widest mb-0.5">Week</label>
              <input 
                value={week} 
                onChange={e => setWeek(e.target.value)} 
                disabled={!isEditable}
                className="bg-transparent border-b border-gray-200 dark:border-surface-700 focus:border-blue-400 dark:focus:border-brand-500 focus:outline-none py-0.5 w-full text-gray-800 dark:text-surface-100 font-semibold text-sm disabled:text-gray-500 disabled:border-transparent transition-colors"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-widest mb-0.5">Project</label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                disabled={!isEditable}
                className="bg-transparent border-b border-gray-200 dark:border-surface-700 focus:border-blue-400 dark:focus:border-brand-500 focus:outline-none py-0.5 w-full text-gray-800 dark:text-surface-100 font-semibold text-sm disabled:text-gray-500 disabled:border-transparent transition-colors cursor-pointer"
              >
                <option value="">No Project / General</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-surface-500 uppercase tracking-widest mb-0.5">Status</label>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border
                ${status === 'draft' ? 'bg-gray-100 dark:bg-surface-800 text-gray-700 dark:text-surface-300 border-gray-200 dark:border-surface-700' : ''}
                ${status === 'submitted' ? 'bg-blue-100 dark:bg-brand-950/40 text-blue-700 dark:text-brand-400 border-blue-200 dark:border-brand-900' : ''}
                ${status === 'approved' ? 'bg-green-100 dark:bg-emerald-950/40 text-green-700 dark:text-emerald-400 border-green-200 dark:border-emerald-900' : ''}
                ${status === 'rejected' ? 'bg-red-100 dark:bg-rose-950/40 text-red-700 dark:text-rose-400 border-red-200 dark:border-rose-900' : ''}
              `}>
                {status}
              </span>
            </div>
            
            {status === 'rejected' && managerComment && (
              <div className="w-full mt-2 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs text-rose-800 dark:text-rose-200 flex flex-col">
                <span className="font-bold uppercase tracking-wide text-[10px] mb-1">Rejection Reason</span>
                <span>{managerComment}</span>
              </div>
            )}
            {status === 'approved' && managerComment && (
              <div className="w-full mt-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-200 flex flex-col">
                <span className="font-bold uppercase tracking-wide text-[10px] mb-1">Manager Feedback</span>
                <span>{managerComment}</span>
              </div>
            )}
          </div>

           <div className="flex justify-between items-center px-1">
             <div className="flex space-x-3">
               <button 
                  onClick={() => {
                    setCurrentMISId(null);
                    setWeek(generateCurrentWeekLabel());
                    setStatus('draft');
                    setGoals([{ target: '', actual: '', status: 'Pending', comment: '' }]);
                    setLearnings([{ challenge: '', lesson: '' }]);
                    setKeyTasks([{ task: '', status: 'Pending', comment: '' }]);
                  }}
                  className="text-xs font-semibold text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors"
                >
                  Create Fresh Draft
                </button>
                <span className="text-surface-200 dark:text-surface-700 text-xs">|</span>
                <button 
                  onClick={handleDuplicateLast}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:opacity-80 transition-colors"
                  disabled={!isEditable}
                >
                  Duplicate Last Week
                </button>
             </div>
          </div>

           {/* Section 1: Business Goals Table */}
          <div className="bg-white dark:bg-surface-900 border text-gray-800 dark:text-surface-100 border-gray-200 dark:border-surface-800 rounded-lg overflow-hidden">
            <div className="bg-[#fcfdff] dark:bg-surface-950/50 px-3 py-2 border-b border-gray-200 dark:border-surface-800 flex justify-between items-center">
              <h2 className="text-xs font-bold text-gray-700 dark:text-surface-300 uppercase tracking-widest">Section 1: Business Goals</h2>
              {isEditable && (
                <button 
                  onClick={() => goals.length < 15 && setGoals([...goals, { target: '', actual: '', status: 'Pending', comment: '' }])}
                  className="text-[11px] font-bold text-blue-600 dark:text-brand-400 hover:text-blue-800 transition-colors flex items-center gap-1"
                >
                  <span className="text-lg leading-none">+</span> Add Row
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f9fafb] dark:bg-surface-900 border-b border-gray-100 dark:border-surface-800 text-gray-500 dark:text-surface-400 font-semibold tracking-wide uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-1.5 w-8 text-center">SN</th>
                    <th className="px-3 py-1.5 min-w-[150px]">Goal / Target</th>
                    <th className="px-3 py-1.5 min-w-[150px]">Actual Work</th>
                    <th className="px-3 py-1.5 w-32">Status</th>
                    <th className="px-3 py-1.5 min-w-[150px]">Comment</th>
                    {isEditable && <th className="px-2 py-1.5 w-8"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-surface-800">
                  {goals.map((goal, idx) => (
                    <tr key={idx} className="group hover:bg-gray-50/50">
                      <td className="px-3 py-1.5 text-center text-gray-400">{idx + 1}</td>
                      <td className="px-2 py-1">
                        <textarea disabled={!isEditable} value={goal.target} onChange={(e) => { const n = [...goals]; n[idx].target = e.target.value; setGoals(n); }} className="w-full resize-none bg-transparent focus:bg-white border border-transparent focus:border-blue-200 rounded p-1.5 outline-none transition-all disabled:text-gray-700" rows={1} placeholder="Define goal..." />
                      </td>
                      <td className="px-2 py-1">
                        <textarea disabled={!isEditable} value={goal.actual} onChange={(e) => { const n = [...goals]; n[idx].actual = e.target.value; setGoals(n); }} className="w-full resize-none bg-transparent focus:bg-white border border-transparent focus:border-blue-200 rounded p-1.5 outline-none transition-all disabled:text-gray-700" rows={1} placeholder="Achieved so far..." />
                      </td>
                       <td className="px-2 py-1">
                        <select 
                          disabled={!isEditable}
                          value={goal.status}
                          onChange={(e) => { const n = [...goals]; n[idx].status = e.target.value as any; setGoals(n); }}
                          className={cn(
                            'w-full py-1 text-xs px-1.5 rounded border font-semibold outline-none transition-colors cursor-pointer',
                            goal.status === 'Done' && 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
                            goal.status === 'In Progress' && 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
                            goal.status === 'Pending' && 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                          )}
                        >
                          <option value="Done" className="bg-white dark:bg-surface-900">Done</option>
                          <option value="In Progress" className="bg-white dark:bg-surface-900">In Progress</option>
                          <option value="Pending" className="bg-white dark:bg-surface-900">Pending</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <textarea disabled={!isEditable} value={goal.comment} onChange={(e) => { const n = [...goals]; n[idx].comment = e.target.value; setGoals(n); }} className="w-full resize-none bg-transparent focus:bg-white border border-transparent focus:border-blue-200 rounded p-1.5 outline-none transition-all disabled:text-gray-700" rows={1} placeholder="Notes..." />
                      </td>
                      {isEditable && (
                        <td className="px-2 py-1 text-center">
                          <button onClick={() => goals.length > 1 && setGoals(goals.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" disabled={goals.length <= 1}>
                             ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Learning From Last Week */}
          <div className="bg-white dark:bg-surface-900 border text-gray-800 dark:text-surface-100 border-gray-200 dark:border-surface-800 rounded-lg overflow-hidden">
            <div className="bg-[#fcfdff] dark:bg-surface-950/50 px-3 py-2 border-b border-gray-200 dark:border-surface-800 flex justify-between items-center">
              <h2 className="text-xs font-bold text-gray-700 dark:text-surface-300 uppercase tracking-widest">Section 2: Learning From Last Week</h2>
              {isEditable && (
                <button 
                  onClick={() => learnings.length < 5 && setLearnings([...learnings, { challenge: '', lesson: '' }])}
                  className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:opacity-80 transition-colors flex items-center gap-1"
                >
                  <span className="text-lg leading-none">+</span> Add Row
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-50 dark:bg-surface-900 border-b border-surface-100 dark:border-surface-800 text-surface-500 dark:text-surface-400 font-semibold tracking-wide uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-1.5 w-1/2">Challenge Faced</th>
                    <th className="px-3 py-1.5 w-1/2">Lesson Learned</th>
                    {isEditable && <th className="px-2 py-1.5 w-8"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  {learnings.map((l, idx) => (
                    <tr key={idx} className="group hover:bg-surface-50/50">
                      <td className="px-2 py-1">
                        <textarea disabled={!isEditable} value={l.challenge} onChange={(e) => { const n = [...learnings]; n[idx].challenge = e.target.value; setLearnings(n); }} className="w-full resize-none bg-transparent focus:bg-white dark:focus:bg-surface-800 border border-transparent focus:border-brand-200 rounded p-1.5 outline-none transition-all disabled:opacity-70 dark:text-surface-200" rows={1} placeholder="What blocked you..." />
                      </td>
                      <td className="px-2 py-1">
                        <textarea disabled={!isEditable} value={l.lesson} onChange={(e) => { const n = [...learnings]; n[idx].lesson = e.target.value; setLearnings(n); }} className="w-full resize-none bg-transparent focus:bg-white dark:focus:bg-surface-800 border border-transparent focus:border-brand-200 rounded p-1.5 outline-none transition-all disabled:opacity-70 dark:text-surface-200" rows={1} placeholder="How to fix it..." />
                      </td>
                      {isEditable && (
                        <td className="px-2 py-1 text-center">
                          <button onClick={() => learnings.length > 1 && setLearnings(learnings.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" disabled={learnings.length <= 1}>
                             ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Key Tasks (Priority Section) */}
          <div className="bg-white dark:bg-surface-900 border border-brand-200/60 dark:border-brand-900/40 rounded-lg overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500"></div>
            <div className="bg-brand-50/30 dark:bg-brand-950/20 px-4 py-2 border-b border-brand-100/50 dark:border-brand-900/50 flex justify-between items-center pl-4">
              <div className="flex items-center gap-3">
                 <h2 className="text-xs font-bold text-brand-800 dark:text-brand-300 uppercase tracking-widest leading-none">Key Priority Tasks</h2>
                 <span className="text-[10px] text-brand-500 bg-brand-100 dark:bg-brand-950/40 px-1.5 py-0.5 rounded font-semibold leading-none">Max 3</span>
              </div>
              {isEditable && keyTasks.length < 3 && (
                <button 
                  onClick={() => setKeyTasks([...keyTasks, { task: '', status: 'Pending', comment: '' }])}
                  className="text-[11px] font-bold text-brand-700 dark:text-brand-400 hover:opacity-80 transition-colors flex items-center gap-1"
                >
                  <span className="text-lg leading-none">+</span> Add Task
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-50 dark:bg-surface-900 border-b border-surface-100 dark:border-surface-800 text-surface-500 dark:text-surface-400 font-semibold tracking-wide uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-1.5 w-8 text-center">#</th>
                    <th className="px-3 py-1.5 min-w-[200px]">Task / Focus Area</th>
                    <th className="px-3 py-2.5 w-32">Status</th>
                    <th className="px-3 py-1.5 min-w-[150px] hidden sm:table-cell">Comment</th>
                    {isEditable && <th className="px-2 py-1.5 w-8"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  {keyTasks.map((t, idx) => (
                    <tr key={idx} className="group hover:bg-brand-50/10 transition-colors">
                      <td className="px-3 py-1.5 text-center text-brand-400 font-bold">{idx + 1}</td>
                      <td className="px-2 py-1">
                        <textarea disabled={!isEditable} value={t.task} onChange={(e) => { const n = [...keyTasks]; n[idx].task = e.target.value; setKeyTasks(n); }} className="w-full font-medium resize-none text-surface-800 dark:text-surface-200 bg-transparent focus:bg-white dark:focus:bg-surface-800 border border-transparent focus:border-brand-200 rounded p-1.5 outline-none transition-all disabled:opacity-70" rows={1} placeholder="Main focus task..." />
                      </td>
                      <td className="px-2 py-1">
                        <select 
                          disabled={!isEditable}
                          value={t.status}
                          onChange={(e) => { const n = [...keyTasks]; n[idx].status = e.target.value as any; setKeyTasks(n); }}
                          className={cn(
                            'w-full py-1 text-xs px-1.5 rounded border font-semibold outline-none transition-colors cursor-pointer',
                            t.status === 'Done' && 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
                            t.status === 'In Progress' && 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
                            t.status === 'Pending' && 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                          )}
                        >
                          <option value="Done" className="bg-white dark:bg-surface-900">Done</option>
                          <option value="In Progress" className="bg-white dark:bg-surface-900">In Progress</option>
                          <option value="Pending" className="bg-white dark:bg-surface-900">Pending</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 hidden sm:table-cell">
                        <textarea disabled={!isEditable} value={t.comment} onChange={(e) => { const n = [...keyTasks]; n[idx].comment = e.target.value; setKeyTasks(n); }} className="w-full resize-none bg-transparent focus:bg-white dark:focus:bg-surface-800 border border-transparent focus:border-brand-200 rounded p-1.5 outline-none transition-all disabled:opacity-70 dark:text-surface-200" rows={1} placeholder="Notes..." />
                      </td>
                      {isEditable && (
                        <td className="px-2 py-1 text-center">
                          <button onClick={() => keyTasks.length > 1 && setKeyTasks(keyTasks.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" disabled={keyTasks.length <= 1}>
                             ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          {isEditable && (
            <div className="flex justify-end gap-3 pt-4 border-t border-surface-100 dark:border-surface-800 mt-6">
              <button 
                onClick={() => handleSave(false)}
                disabled={loading}
                className="px-5 py-2 rounded border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Draft'}
              </button>
              <button 
                onClick={() => handleSave(true)}
                disabled={loading}
                className="px-8 py-2 rounded bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Submitting...' : (status === 'rejected' ? 'Resubmit MIS' : 'Submit MIS')}
              </button>
            </div>
          )}
          {!isEditable && (
            <div className="flex justify-end pt-4 border-t border-surface-100 dark:border-surface-800 mt-6 text-xs text-surface-500 font-semibold">
               MIS is currently in completely Read-Only mode.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
