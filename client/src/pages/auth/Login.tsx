import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../context/authStore';
import { cn } from '../../utils/helpers';
import type { Role } from '../../app/types';

interface LoginForm {
  email: string;
  password: string;
  remember: boolean;
}

const DEMO_ROLES: { role: Role; label: string; color: string }[] = [
  { role: 'super_admin', label: 'Seeded Super Admin', color: '#f43f5e' },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<LoginForm>({
    defaultValues: { email: 'gitakshmi@gmail.com', password: 'Gitakshmi@123', remember: false }
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    const result = await login(data.email, data.password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Invalid credentials');
    }
  };

  const loginAsRole = async (role: Role) => {
    const roleEmails: Record<Role, string> = {
      super_admin: 'gitakshmi@gmail.com',
      admin: 'gitakshmi@gmail.com',
      manager: 'gitakshmi@gmail.com',
      team_leader: 'gitakshmi@gmail.com',
      team_member: 'gitakshmi@gmail.com',
    };
    setError('');
    setValue('email', roleEmails[role]);
    setValue('password', 'Gitakshmi@123');
    const result = await login(roleEmails[role], 'Gitakshmi@123', role);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Invalid credentials');
    }
  };

  return (
    <div>
      <h1 className="font-display font-bold text-3xl text-surface-900 dark:text-white mb-2">Welcome back</h1>
      <p className="text-surface-500 dark:text-surface-400 mb-8">Sign in to your workspace</p>

      {/* Demo role selector */}
      <div className="mb-6">
        {/* <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Demo: Sign in as</p> */}
        <div className="flex flex-wrap gap-2">
          {/* {DEMO_ROLES.map(({ role, label, color }) => (
            <button
              key={role}
              onClick={() => loginAsRole(role)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all hover:scale-105 disabled:opacity-50"
              style={{ borderColor: color, color, backgroundColor: `${color}15` }}
            >
              {label}
            </button>
          ))} */}
        </div>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-surface-200 dark:border-surface-700" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-white dark:bg-surface-950 text-surface-400">or sign in with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <div>
          <label className="label">Email address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' }
              })}
              type="email"
              placeholder="you@company.com"
              className={cn('input pl-9', errors.email && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20')}
            />
          </div>
          {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label mb-0">Password</label>
            <Link to="/forgot-password" className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              {...register('password', { required: 'Password is required' })}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className={cn('input pl-9 pr-10', errors.password && 'border-rose-400')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>}
        </div>

        <div className="flex items-center gap-2">
          <input
            {...register('remember')}
            type="checkbox"
            id="remember"
            className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="remember" className="text-sm text-surface-600 dark:text-surface-400">
            Remember me for 30 days
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary btn-xl w-full mt-2"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-surface-500">
        Don't have an account?{' '}
        <Link to="/register" className="text-brand-600 dark:text-brand-400 font-medium hover:text-brand-700 transition-colors">
          Start for free
        </Link>
      </p>
    </div>
  );
};

export default LoginPage;
