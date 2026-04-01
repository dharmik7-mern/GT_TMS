import React from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-brand-50/30 dark:from-surface-950 dark:via-surface-900 dark:to-brand-950/20 flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 to-brand-900 relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Background mesh */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-brand-400/20 rounded-full blur-2xl" />
        </div>

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 text-white text-center max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-3 mb-8"
          >
<div className="w-20 h-20 bg-white backdrop-blur rounded-2xl flex items-center justify-center border border-white/30">
  <img 
    src="/1.png" 
    className="w-full h-full object-contain"
  />
</div>
          </motion.div>
            <span className="font-display font-bold text-5xl tracking-tight">Gitakshmi's</span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="font-display font-bold text-4xl leading-tight mb-5"
          >
            Project Management System
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-brand-200 text-lg leading-relaxed"
          >
            Streamline your team's workflow with visual boards, smart tracking, and real-time collaboration.
          </motion.p>

          {/* Stats */}
          {/* <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex gap-8 mt-12 justify-center"
          >
            {[
              { value: '10k+', label: 'Teams' },
              { value: '500k+', label: 'Tasks done' },
              { value: '99.9%', label: 'Uptime' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="font-display font-bold text-2xl">{stat.value}</p>
                <p className="text-brand-300 text-sm">{stat.label}</p>
              </div>
            ))}
          </motion.div> */}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
              {/* <Zap size={16} className="text-white" /> */}
            </div>
            <span className="font-display font-bold text-xl text-surface-900 dark:text-white">Gitakshmi</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
