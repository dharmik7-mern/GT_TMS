import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, ExternalLink, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { extensionRequestsService } from '../../services/api';
import { useAuthStore } from '../../context/authStore';
import type { ExtensionRequest } from '../../app/types';

export const ExtensionRequestsPopup: React.FC = () => {
  const [requests, setRequests] = useState<ExtensionRequest[]>([]);
  const [show, setShow] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    
    // Only managers/admins should see this
    const isManagerOrAdmin = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user.role);
    if (!isManagerOrAdmin) return;

    // Only show once per session for this user
    const sessionKey = `extension_popup_shown_${user.id}`;
    const isShown = sessionStorage.getItem(sessionKey);
    if (isShown) return;

    const fetchRequests = async () => {
      try {
        const res = await extensionRequestsService.getAll();
        const pending = (res.data.data ?? res.data).filter((r: ExtensionRequest) => r.status === 'pending');
        
        if (pending.length > 0) {
          setRequests(pending);
          setShow(true);
          sessionStorage.setItem(sessionKey, 'true');
        }
      } catch (err) {
        console.error('Failed to fetch extension requests:', err);
      }
    };

    fetchRequests();
  }, [user]);

  if (!show || requests.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed bottom-6 right-6 z-[9999] w-full max-w-sm"
      >
        <div className="bg-white dark:bg-surface-900 border border-brand-100 dark:border-brand-900/30 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5">
          {/* Header */}
          <div className="bg-brand-50 dark:bg-brand-950/20 px-5 py-4 flex items-center justify-between border-b border-brand-100 dark:border-brand-900/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Clock size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-brand-900 dark:text-brand-400">
                  {requests.length} Extension {requests.length === 1 ? 'Request' : 'Requests'}
                </h3>
                <p className="text-[10px] text-brand-600/80 dark:text-brand-500/80 font-medium">Approval pending</p>
              </div>
            </div>
            <button
              onClick={() => setShow(false)}
              className="text-brand-400 hover:text-brand-600 p-1 hover:bg-brand-100 dark:hover:bg-brand-900/50 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Request List */}
          <div className="max-h-[320px] overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {requests.map((req) => (
              <div
                key={req._id || req.id}
                className="group p-3 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-transparent hover:border-brand-200 dark:hover:border-brand-800 transition-all cursor-pointer"
                onClick={() => {
                  navigate(`/task-requests`);
                  setShow(false);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[13px] font-semibold text-surface-900 dark:text-white line-clamp-2 group-hover:text-brand-600 transition-colors">
                    {req.tasks && req.tasks[0] ? req.tasks[0].title : 'Unnamed Task'}
                    {req.taskIds.length > 1 && ` (+${req.taskIds.length - 1} more)`}
                  </span>
                  <ExternalLink size={12} className="text-surface-300 group-hover:text-brand-400 mt-1 flex-shrink-0" />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-surface-500 dark:text-surface-400">
                    <User size={12} />
                    {req.user?.name || 'User'}
                  </div>
                  <div className="text-[10px] font-bold text-brand-600 dark:text-brand-400">
                    → {new Date(req.requestedDueDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 bg-surface-50/50 dark:bg-surface-800/20 border-t border-surface-100 dark:border-surface-800">
            <button
              onClick={() => {
                navigate('/task-requests');
                setShow(false);
              }}
              className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-lg shadow-brand-500/20 active:scale-[0.98]"
            >
              Go to Task Requests
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
