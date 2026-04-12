import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { 
  ArrowLeft, 
  Plus,
  Type,
  AlignLeft,
  Layers,
  Calendar,
  Palette,
  ChevronDown,
  DollarSign,
  Workflow,
  Clock,
  Zap,
  Users,
  UserCheck,
  X,
  Check,
  Search
} from 'lucide-react';
import { cn } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { PROJECT_COLORS } from '../../app/constants';
import { projectsService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';
import { UserAvatar } from '../../components/UserAvatar';

interface SdlcStage {
  name: string;
  duration: string;
  enabled: boolean;
}

interface ProjectFormData {
  name: string;
  description: string;
  department: string;
  startDate: string;
  endDate: string;
  budgetAmount: string;
  budgetCurrency: string;
}

const DEPARTMENTS = ['General', 'Development', 'Design', 'Marketing', 'Product'];
const INITIAL_SDLC: SdlcStage[] = [
  { name: 'Requirement', duration: '5', enabled: true },
  { name: 'Analysis', duration: '5', enabled: true },
  { name: 'Design', duration: '7', enabled: true },
  { name: 'Development', duration: '20', enabled: true },
  { name: 'Testing', duration: '10', enabled: true },
  { name: 'Deployment', duration: '3', enabled: true },
  { name: 'Maintenance', duration: '0', enabled: false }
];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

const CreateProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { bootstrap, users } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
  const [sdlcStages, setSdlcStages] = useState<SdlcStage[]>(INITIAL_SDLC);
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  
  // Team & Reporting State
  const [selectedMembers, setSelectedMembers] = useState<string[]>(currentUser?.id ? [currentUser.id] : []);
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);
  const [showMemberDrop, setShowMemberDrop] = useState(false);
  const [showReporterDrop, setShowReporterDrop] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [reporterQuery, setReporterQuery] = useState('');

  const departmentRef = useRef<HTMLDivElement>(null);
  const memberRef = useRef<HTMLDivElement>(null);
  const reporterRef = useRef<HTMLDivElement>(null);
  const customColorRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isValid } } = useForm<ProjectFormData>({
    mode: 'onChange',
    defaultValues: {
      startDate: new Date().toISOString().split('T')[0],
      department: 'General',
      budgetCurrency: 'INR'
    }
  });

  const selectedDepartment = watch('department');

  const totalDays = useMemo(() => {
    return sdlcStages.reduce((acc, s) => s.enabled ? acc + (parseInt(s.duration) || 0) : acc, 0);
  }, [sdlcStages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (departmentRef.current && !departmentRef.current.contains(e.target as Node)) setIsDeptOpen(false);
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) setShowMemberDrop(false);
      if (reporterRef.current && !reporterRef.current.contains(e.target as Node)) setShowReporterDrop(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredUsers = (q: string) => users.filter(u => 
    u.name.toLowerCase().includes(q.toLowerCase()) || 
    u.email.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 8);

  const updateStage = (index: number, updates: Partial<SdlcStage>) => {
    const newStages = [...sdlcStages];
    newStages[index] = { ...newStages[index], ...updates };
    setSdlcStages(newStages);
  };

  const toggleUser = (id: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const onSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name,
        description: data.description || '',
        color: selectedColor,
        status: 'active',
        department: data.department,
        members: selectedMembers,
        reportingPersonIds: selectedReporters,
        startDate: data.startDate,
        endDate: data.endDate,
        budget: data.budgetAmount ? parseFloat(data.budgetAmount) : 0,
        budgetCurrency: data.budgetCurrency,
        sdlcPlan: sdlcStages.filter(s => s.enabled).map(s => ({
          name: s.name,
          durationDays: parseInt(s.duration) || 0
        })),
        subcategories: []
      };

      const res = await projectsService.create(payload);
      if (res.data?.success || res.data?.data) {
        emitSuccessToast('Project created successfully');
        await bootstrap();
        navigate(`/projects/${res.data?.data?.id || res.data?.id}`);
      }
    } catch (err: any) {
      emitErrorToast(err.response?.data?.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-surface-950 flex flex-col font-sans -mt-6">
      <div className="flex items-center justify-between pb-3 border-b border-surface-50 dark:border-surface-800/50 mb-4">
        <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-surface-300 hover:text-surface-900 transition-all"><ArrowLeft size={14} /> Back</button>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-brand-50/50 dark:bg-brand-950/10 rounded-lg border border-brand-100/50">
            <Zap size={10} className="text-brand-500" />
            <span className="text-[10px] font-black text-brand-700 dark:text-brand-400 uppercase tracking-widest leading-none">Total: {totalDays} Days</span>
          </div>
          <button onClick={() => navigate('/projects')} className="text-[10px] font-black text-surface-400 hover:text-surface-600 uppercase tracking-widest px-3">Cancel</button>
          <button onClick={handleSubmit(onSubmit)} disabled={!isValid || isSubmitting} className={cn("px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", isValid ? "bg-brand-600 text-white shadow-lg shadow-brand-500/10" : "bg-surface-100 text-surface-400 cursor-not-allowed")}>{isSubmitting ? 'Creating...' : 'Create Project'}</button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7 space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-surface-300 flex items-center gap-2 italic"><Type size={10} className="text-brand-500" /> Project Name *</label>
            <input {...register('name', { required: true, minLength: 3 })} autoFocus className="w-full bg-surface-50/50 dark:bg-surface-900/30 border border-surface-100 dark:border-surface-800 rounded-xl px-4 h-9 text-sm font-bold text-surface-900 dark:text-surface-50 focus:outline-none focus:border-brand-500 transition-all" placeholder="Project name..." />
          </div>
          <div className="col-span-12 lg:col-span-5 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-surface-300 flex items-center gap-2"><Calendar size={10} className="text-brand-500" /> Start</label>
              <input type="date" {...register('startDate', { required: true })} className="w-full h-9 bg-surface-50/50 dark:bg-surface-900/30 border border-surface-100 dark:border-surface-800 rounded-xl px-3 text-[11px] font-bold text-surface-700 dark:text-surface-200" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-surface-300 flex items-center gap-2"><Calendar size={10} className="text-brand-500" /> Due</label>
              <input type="date" {...register('endDate')} className="w-full h-9 bg-surface-50/50 dark:bg-surface-900/30 border border-surface-100 dark:border-surface-800 rounded-xl px-3 text-[11px] font-bold text-surface-700 dark:text-surface-200" />
            </div>
          </div>
        </div>

        {/* Team & Reporters - ADDED HERE */}
        <div className="grid grid-cols-12 gap-6 pt-1">
          <div className="col-span-12 lg:col-span-6 space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-surface-300 flex items-center gap-2"><Users size={10} className="text-brand-500" /> Assign Employees</label>
            <div ref={memberRef} className="relative">
              <div onClick={() => setShowMemberDrop(true)} className="min-h-[38px] bg-surface-50/50 dark:bg-surface-900/30 border border-surface-100 dark:border-surface-800 rounded-xl p-1 flex flex-wrap gap-1 cursor-pointer">
                {selectedMembers.map(id => {
                  const u = users.find(x => x.id === id);
                  return (
                    <div key={id} className="flex items-center gap-1.5 bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 rounded-lg pl-1 pr-1.5 py-0.5 shadow-sm">
                      <UserAvatar name={u?.name || ''} avatar={u?.avatar} size="xs" />
                      <span className="text-[10px] font-bold text-surface-700 dark:text-surface-200">{u?.name.split(' ')[0]}</span>
                      <X size={10} className="text-surface-400 hover:text-rose-500 transition-colors" onClick={(e) => { e.stopPropagation(); toggleUser(id, selectedMembers, setSelectedMembers); }} />
                    </div>
                  );
                })}
                {selectedMembers.length === 0 && <span className="text-surface-400 text-[10px] px-2 py-2">Select members...</span>}
              </div>
              <AnimatePresence>
                {showMemberDrop && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-surface-50 dark:border-surface-800"><input autoFocus value={memberQuery} onChange={e => setMemberQuery(e.target.value)} placeholder="Search..." className="w-full bg-surface-50 dark:bg-surface-800 rounded-lg px-3 py-1.5 text-[11px] outline-none" /></div>
                    <div className="max-h-40 overflow-y-auto py-1">
                      {filteredUsers(memberQuery).map(u => (
                        <div key={u.id} onClick={() => toggleUser(u.id, selectedMembers, setSelectedMembers)} className={cn("px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800", selectedMembers.includes(u.id) && "bg-brand-50 dark:bg-brand-950/20")}>
                          <UserAvatar name={u.name} avatar={u.avatar} size="xs" />
                          <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-surface-900 dark:text-surface-100 truncate">{u.name}</p></div>
                          {selectedMembers.includes(u.id) && <Check size={12} className="text-brand-500 ml-auto" />}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-6 space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-surface-300 flex items-center gap-2"><UserCheck size={10} className="text-brand-500" /> Reporting Persons</label>
            <div ref={reporterRef} className="relative">
              <div onClick={() => setShowReporterDrop(true)} className="min-h-[38px] bg-surface-50/50 dark:bg-surface-900/30 border border-surface-100 dark:border-surface-800 rounded-xl p-1 flex flex-wrap gap-1 cursor-pointer">
                {selectedReporters.map(id => {
                  const u = users.find(x => x.id === id);
                  return (
                    <div key={id} className="flex items-center gap-1.5 bg-brand-50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/30 rounded-lg pl-1 pr-1.5 py-0.5 shadow-sm">
                      <UserAvatar name={u?.name || ''} avatar={u?.avatar} size="xs" />
                      <span className="text-[10px] font-bold text-brand-700 dark:text-brand-300">{u?.name.split(' ')[0]}</span>
                      <X size={10} className="text-brand-400 hover:text-rose-500 transition-colors" onClick={(e) => { e.stopPropagation(); toggleUser(id, selectedReporters, setSelectedReporters); }} />
                    </div>
                  );
                })}
                {selectedReporters.length === 0 && <span className="text-surface-400 text-[10px] px-2 py-2">Select reporters...</span>}
              </div>
              <AnimatePresence>
                {showReporterDrop && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-surface-50 dark:border-surface-800"><input autoFocus value={reporterQuery} onChange={e => setReporterQuery(e.target.value)} placeholder="Search..." className="w-full bg-surface-50 dark:bg-surface-800 rounded-lg px-3 py-1.5 text-[11px] outline-none" /></div>
                    <div className="max-h-40 overflow-y-auto py-1">
                      {filteredUsers(reporterQuery).map(u => (
                        <div key={u.id} onClick={() => toggleUser(u.id, selectedReporters, setSelectedReporters)} className={cn("px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800", selectedReporters.includes(u.id) && "bg-brand-50 dark:bg-brand-950/20")}>
                          <UserAvatar name={u.name} avatar={u.avatar} size="xs" />
                          <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-surface-900 dark:text-surface-100 truncate">{u.name}</p></div>
                          {selectedReporters.includes(u.id) && <Check size={12} className="text-brand-500 ml-auto" />}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-4 space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-surface-300 flex items-center gap-2"><Layers size={10} className="text-brand-500" /> Department</label>
            <div ref={departmentRef} className="relative">
              <button type="button" onClick={() => setIsDeptOpen(!isDeptOpen)} className="w-full h-9 bg-surface-50/50 dark:bg-surface-900/30 border border-surface-100 dark:border-surface-800 rounded-xl px-4 flex items-center justify-between transition-all outline-none leading-none"><span className="text-[11px] font-bold text-surface-700 dark:text-surface-200">{selectedDepartment}</span><ChevronDown size={14} className={cn("text-surface-300 transition-transform", isDeptOpen && "rotate-180")} /></button>
              <AnimatePresence>{isDeptOpen && (<motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute z-50 left-0 right-0 mt-1.5 py-1 bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-xl shadow-xl">{DEPARTMENTS.map(dept => (<button key={dept} type="button" onClick={() => { setValue('department', dept); setIsDeptOpen(false); }} className={cn("w-full px-4 py-2 text-[11px] font-bold text-left hover:bg-surface-50 dark:hover:bg-surface-800 leading-none", selectedDepartment === dept ? "text-brand-600" : "text-surface-600 dark:text-surface-200")}>{dept}</button>))}</motion.div>)}</AnimatePresence>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 space-y-1.5 text-nowrap">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-surface-300 flex items-center gap-2"><DollarSign size={10} className="text-brand-500" /> Budget</label>
            <div className="flex bg-surface-50/50 dark:bg-surface-900/30 border border-surface-100 dark:border-surface-800 rounded-xl px-3 h-9 items-center gap-2">
              <input {...register('budgetAmount')} type="number" placeholder="Amt" className="flex-1 bg-transparent text-[11px] font-bold outline-none text-surface-700 dark:text-surface-200" />
              <select {...register('budgetCurrency')} className="bg-transparent text-[10px] font-black outline-none text-brand-600 cursor-pointer">{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-3 space-y-1.5 text-nowrap">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-surface-300 flex items-center gap-2"><Palette size={10} className="text-brand-500" /> Accent</label>
            <div className="flex items-center gap-2 bg-surface-50/50 dark:bg-surface-900/30 border border-surface-100 dark:border-surface-800 rounded-xl p-2 h-9">
              {PROJECT_COLORS.slice(0, 5).map(color => (<button key={color} type="button" onClick={() => setSelectedColor(color)} className={cn("w-3.5 h-3.5 rounded-full transition-all border border-white dark:border-surface-900", selectedColor === color ? "ring-2 ring-brand-500" : "opacity-60")} style={{ backgroundColor: color }} />))}
              <Plus size={10} className="text-surface-300 cursor-pointer shrink-0" onClick={() => customColorRef.current?.click()} />
              <input ref={customColorRef} type="color" onChange={(e) => setSelectedColor(e.target.value)} className="sr-only" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-surface-300 flex items-center gap-2 italic"><Workflow size={10} className="text-brand-500" /> SDLC Workflow Configuration (7 Stages)</label>
            <div className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{totalDays} Total Days</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {sdlcStages.map((stage, i) => (
              <div key={stage.name} className={cn("p-2 rounded-xl transition-all border flex flex-col gap-2", stage.enabled ? "bg-brand-50/20 dark:bg-brand-950/20 border-brand-500/30" : "bg-surface-50/30 dark:bg-surface-900/20 border-surface-100 dark:border-surface-800 opacity-60")}>
                <label className="flex items-center gap-2 cursor-pointer group leading-none">
                  <input type="checkbox" checked={stage.enabled} onChange={e => updateStage(i, { enabled: e.target.checked })} className="w-3 h-3 rounded border-surface-200 text-brand-600 focus:ring-brand-500" />
                  <span className="text-[10px] font-black text-surface-700 dark:text-surface-200 uppercase truncate leading-none">{stage.name}</span>
                </label>
                {stage.enabled && (
                  <div className="relative">
                    <Clock size={8} className="absolute left-2 top-1/2 -translate-y-1/2 text-brand-400" />
                    <input type="number" value={stage.duration} onChange={e => updateStage(i, { duration: e.target.value })} className="w-full bg-white dark:bg-surface-900 border border-brand-500/20 rounded-lg pl-5 pr-1.5 h-7 text-[10px] font-bold text-brand-600 focus:outline-none" placeholder="0" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectPage;
