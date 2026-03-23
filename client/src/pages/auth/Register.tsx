import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, User, Mail, Lock, Building, Loader2, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../context/authStore';
import { cn } from '../../utils/helpers';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  workspace: string;
  agreeTerms: boolean;
}

const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v: string) => /[0-9]/.test(v) },
];

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>();
  const password = watch('password', '');

  const onSubmit = async (data: RegisterForm) => {
    await login(data.email, data.password);
    navigate('/dashboard');
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2].map(s => (
          <React.Fragment key={s}>
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              step >= s ? 'bg-brand-600 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-400'
            )}>
              {step > s ? <CheckCircle size={14} /> : s}
            </div>
            {s < 2 && <div className={cn('flex-1 h-0.5 rounded', step > s ? 'bg-brand-600' : 'bg-surface-200 dark:bg-surface-700')} />}
          </React.Fragment>
        ))}
      </div>

      <h1 className="font-display font-bold text-3xl text-surface-900 dark:text-white mb-2">
        {step === 1 ? 'Create your account' : 'Set up your workspace'}
      </h1>
      <p className="text-surface-500 dark:text-surface-400 mb-8">
        {step === 1 ? 'Start your free trial today' : 'Almost done — just a few more details'}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {step === 1 ? (
          <>
            <div>
              <label className="label">Full name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  {...register('name', { required: 'Name is required' })}
                  placeholder="Enter Your Full Name"
                  className={cn('input pl-9', errors.name && 'border-rose-400')}
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
            </div>

            <div>
              <label className="label">Work email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } })}
                  type="email"
                  placeholder="you@company.com"
                  className={cn('input pl-9', errors.email && 'border-rose-400')}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  className={cn('input pl-9 pr-10', errors.password && 'border-rose-400')}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Password strength */}
              {password && (
                <div className="mt-2 space-y-1">
                  {PASSWORD_REQUIREMENTS.map(req => (
                    <div key={req.label} className={cn('flex items-center gap-2 text-xs', req.test(password) ? 'text-emerald-600' : 'text-surface-400')}>
                      <div className={cn('w-1.5 h-1.5 rounded-full', req.test(password) ? 'bg-emerald-500' : 'bg-surface-300')} />
                      {req.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="button" onClick={() => setStep(2)} className="btn-primary btn-xl w-full mt-2">
              Continue
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="label">Workspace name</label>
              <div className="relative">
                <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  {...register('workspace', { required: 'Workspace name is required' })}
                  placeholder="Gitakshmi"
                  className={cn('input pl-9', errors.workspace && 'border-rose-400')}
                />
              </div>
              {errors.workspace && <p className="mt-1 text-xs text-rose-500">{errors.workspace.message}</p>}
              <p className="mt-1 text-xs text-surface-400">This will be your team's shared workspace</p>
            </div>

            <div className="flex items-start gap-2">
              <input
                {...register('agreeTerms', { required: 'You must agree to terms' })}
                type="checkbox"
                id="agree"
                className="w-4 h-4 mt-0.5 rounded border-surface-300 text-brand-600"
              />
              <label htmlFor="agree" className="text-sm text-surface-600 dark:text-surface-400">
                I agree to the{' '}
                <a href="#" className="text-brand-600 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-brand-600 hover:underline">Privacy Policy</a>
              </label>
            </div>
            {errors.agreeTerms && <p className="text-xs text-rose-500">{errors.agreeTerms.message}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary btn-xl flex-1">
                Back
              </button>
              <button type="submit" disabled={isLoading} className="btn-primary btn-xl flex-1">
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Create workspace'}
              </button>
            </div>
          </>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-surface-500">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 dark:text-brand-400 font-medium hover:text-brand-700">Sign in</Link>
      </p>
    </div>
  );
};

export default RegisterPage;
