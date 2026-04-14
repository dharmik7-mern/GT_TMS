import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, ExternalLink, Calendar } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tasksService } from '../../services/api';
import { useAuthStore } from '../../context/authStore';

interface OverdueTask {
  id: string;
  title: string;
  dueDate: string;
  assignedToName: string;
}

export const OverdueTasksPopup: React.FC = () => {
  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [show, setShow] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const isPublicPath = ['/login', '/forgot-password', '/reset-password', '/unauthorized', '/access-denied'].some((path) =>
      location.pathname.startsWith(path)
    );
    if (!user || !isAuthenticated || isPublicPath) return;

    // Only show once per session for this user
    const sessionKey = `overdue_popup_shown_${user.id}`;
    const isShown = sessionStorage.getItem(sessionKey);
    if (isShown) return;

    const fetchOverdue = async () => {
      try {
<<<<<<< HEAD
        const res = await tasksService.getOverdue({ suppressErrorToast: true });
=======
        const res = await tasksService.getOverdue();
        console.log('[OverduePopup] Fetched tasks:', res.data?.count);
>>>>>>> main
        if (res.data?.success && res.data.count > 0) {
          setTasks(res.data.tasks || []);
          setShow(true);
          sessionStorage.setItem(sessionKey, 'true');
        }
      } catch {
        setTasks([]);
      }
    };

    fetchOverdue();
  }, [user, isAuthenticated, location.pathname]);

  if (!show || tasks.length === 0) return null;

  const isManagerOrAdmin = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed bottom-6 right-6 z-[9999] w-full max-w-sm"
      >
        <div className="bg-white dark:bg-surface-900 border border-rose-100 dark:border-rose-900/30 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5">
          {/* Header */}
          <div className="bg-rose-50 dark:bg-rose-950/20 px-5 py-4 flex items-center justify-between border-b border-rose-100 dark:border-rose-900/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <AlertCircle size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-400">
                  {tasks.length} Overdue {tasks.length === 1 ? 'Task' : 'Tasks'}
                </h3>
                <p className="text-[10px] text-rose-600/80 dark:text-rose-500/80 font-medium">Needs immediate attention</p>
              </div>
            </div>
            <button
              onClick={() => setShow(false)}
              className="text-rose-400 hover:text-rose-600 p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Task List */}
          <div className="max-h-[320px] overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="group p-3 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-all cursor-pointer"
                onClick={() => {
                  navigate(`/tasks?filter=overdue`);
                  setShow(false);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[13px] font-semibold text-surface-900 dark:text-white line-clamp-2 group-hover:text-rose-600 transition-colors">
                    {task.title}
                  </span>
                  <ExternalLink size={12} className="text-surface-300 group-hover:text-rose-400 mt-1 flex-shrink-0" />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                    <Calendar size={12} />
                    {task.dueDate}
                  </div>
                  {isManagerOrAdmin && (
                    <div className="text-[10px] text-surface-400 dark:text-surface-500 truncate">
                      • {task.assignedToName}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 bg-surface-50/50 dark:bg-surface-800/20 border-t border-surface-100 dark:border-surface-800">
            <button
              onClick={() => {
                navigate('/tasks?filter=overdue');
                setShow(false);
              }}
              className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-lg shadow-rose-500/20 active:scale-[0.98]"
            >
              View All Overdue Tasks
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
