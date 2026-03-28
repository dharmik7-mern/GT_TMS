import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Building2, User, Lock, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../context/authStore';
import { cn } from '../../utils/helpers';

interface LoginForm {
  companyCode: string;
  employeeCode: string;
  password: string;
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    defaultValues: {
      companyCode: '',
      employeeCode: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    const result = await login({
      companyCode: data.companyCode.trim(),
      employeeCode: data.employeeCode.trim(),
      password: data.password,
    });

    if (result.success) {
      navigate('/dashboard');
      return;
    }

    setError(result.error || 'Invalid credentials');
  };

  return (
    <div>
      <h1 className="font-display font-bold text-3xl text-surface-900 dark:text-white mb-2">Welcome Back!!</h1>
      <p className="text-surface-500 dark:text-surface-400 mb-8">Sign in with your company code and employee code</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <div>
          <label className="label">Company Code</label>
          <div className="relative">
            <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              {...register('companyCode', { required: 'Company code is required' })}
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
              {...register('employeeCode', { required: 'Employee code is required' })}
              placeholder="Enter your employee code"
              className={cn('input pl-9', errors.employeeCode && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20')}
            />
          </div>
          {errors.employeeCode && <p className="mt-1 text-xs text-rose-500">{errors.employeeCode.message}</p>}
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
    </div>
  );
};

export default LoginPage;
