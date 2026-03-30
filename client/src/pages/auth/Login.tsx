import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Building2, User, Mail, Lock, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../context/authStore';
import { cn } from '../../utils/helpers';

type LoginMode = 'email' | 'employee';

interface LoginForm {
  email: string;
  companyCode: string;
  employeeCode: string;
  password: string;
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<LoginMode>('email');

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    defaultValues: {
      email: '',
      companyCode: '',
      employeeCode: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');

    const result = await login(
      mode === 'email'
        ? {
            email: data.email.trim(),
            password: data.password,
          }
        : {
            companyCode: data.companyCode.trim(),
            employeeCode: data.employeeCode.trim(),
            password: data.password,
          }
    );

    if (result.success) {
      navigate('/dashboard');
      return;
    }

    setError(result.error || 'Invalid credentials');
  };

  return (
    <div>
      <h1 className="font-display font-bold text-3xl text-surface-900 dark:text-white mb-2">Welcome Back!!</h1>
      <p className="text-surface-500 dark:text-surface-400 mb-6">
        {mode === 'email'
          ? 'Sign in with your email and password'
          : 'Sign in with your company code, employee code, and password'}
      </p>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-100 p-1 dark:bg-surface-900/70 mb-6">
        <button
          type="button"
          onClick={() => setMode('email')}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
            mode === 'email'
              ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-800 dark:text-white'
              : 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200'
          )}
        >
          Email Login
        </button>
        <button
          type="button"
          onClick={() => setMode('employee')}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
            mode === 'employee'
              ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-800 dark:text-white'
              : 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200'
          )}
        >
          Employee Code Login
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {mode === 'email' ? (
          <div>
            <label className="label">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                {...register('email', {
                  validate: (value) => {
                    if (mode !== 'email') return true;
                    if (!value.trim()) return 'Email is required';
                    return /^\S+@\S+\.\S+$/i.test(value) || 'Invalid email';
                  },
                })}
                type="email"
                placeholder="you@company.com"
                className={cn('input pl-9', errors.email && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20')}
              />
            </div>
            {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>}
          </div>
        ) : (
          <>
            <div>
              <label className="label">Company Code</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  {...register('companyCode', {
                    validate: (value) => (mode !== 'employee' || value.trim() ? true : 'Company code is required'),
                  })}
                  placeholder="Enter your company code"
                  className={cn('input pl-9', errors.companyCode && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20')}
                />
              </div>
              {errors.companyCode && <p className="mt-1 text-xs text-rose-500">{errors.companyCode.message}</p>}
            </div>

            <div>
              <label className="label">Employee Code</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  {...register('employeeCode', {
                    validate: (value) => (mode !== 'employee' || value.trim() ? true : 'Employee code is required'),
                  })}
                  placeholder="Enter your employee code"
                  className={cn('input pl-9', errors.employeeCode && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20')}
                />
              </div>
              {errors.employeeCode && <p className="mt-1 text-xs text-rose-500">{errors.employeeCode.message}</p>}
            </div>
          </>
        )}

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
              placeholder="Enter your password"
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

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary btn-xl w-full mt-2 md-10"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Sign in'}
        </button>
      </form>

      {/* <p className="mt-6 text-center text-sm text-surface-500">
        {mode === 'email' ? (
          <>
            Prefer employee credentials?{' '}
            <button
              type="button"
              onClick={() => setMode('employee')}
              className="text-brand-600 dark:text-brand-400 font-medium hover:text-brand-700 transition-colors"
            >
              Use employee code login
            </button>
          </>
        ) : (
          <>
            Prefer email instead?{' '}
            <button
              type="button"
              onClick={() => setMode('email')}
              className="text-brand-600 dark:text-brand-400 font-medium hover:text-brand-700 transition-colors"
            >
              Use email login
            </button>
          </>
        )}
      </p> */}
    </div>
  );
};

export default LoginPage;
