import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '../../utils/helpers';

export const ForgotPasswordPage: React.FC = () => {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<{ email: string }>();

  const onSubmit = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    setSent(true);
  };

  const email = watch('email');

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} className="text-emerald-600" />
        </div>
        <h1 className="font-display font-bold text-2xl text-surface-900 dark:text-white mb-2">Check your email</h1>
        <p className="text-surface-500 dark:text-surface-400 mb-6">
          We sent a password reset link to <span className="font-medium text-surface-700 dark:text-surface-300">{email}</span>
        </p>
        <Link to="/login" className="btn-primary btn-lg w-full">Back to sign in</Link>
        <p className="mt-4 text-sm text-surface-400">
          Didn't receive it?{' '}
          <button onClick={() => setSent(false)} className="text-brand-600 hover:underline">Try again</button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/login" className="flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 mb-8 transition-colors">
        <ArrowLeft size={16} />
        Back to sign in
      </Link>

      <h1 className="font-display font-bold text-3xl text-surface-900 dark:text-white mb-2">Forgot password?</h1>
      <p className="text-surface-500 dark:text-surface-400 mb-8">
        Enter your email and we'll send you a reset link
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              className={cn('input pl-9', errors.email && 'border-rose-400')}
            />
          </div>
          {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>}
        </div>

        <button type="submit" disabled={loading} className="btn-primary btn-xl w-full">
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Send reset link'}
        </button>
      </form>
    </div>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<{ password: string; confirm: string }>();

  const onSubmit = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-brand-50 dark:bg-brand-950/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} className="text-brand-600" />
        </div>
        <h1 className="font-display font-bold text-2xl text-surface-900 dark:text-white mb-2">Password updated!</h1>
        <p className="text-surface-500 mb-6">Your password has been reset successfully.</p>
        <Link to="/login" className="btn-primary btn-lg w-full">Sign in now</Link>
      </div>
    );
  }

  const password = watch('password', '');

  return (
    <div>
      <h1 className="font-display font-bold text-3xl text-surface-900 dark:text-white mb-2">Set new password</h1>
      <p className="text-surface-500 mb-8">Your new password must be at least 8 characters</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">New password</label>
          <input
            {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 chars' } })}
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter new password"
            className="input"
          />
        </div>
        <div>
          <label className="label">Confirm password</label>
          <input
            {...register('confirm', {
              required: 'Required',
              validate: v => v === password || 'Passwords do not match'
            })}
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm new password"
            className={cn('input', errors.confirm && 'border-rose-400')}
          />
          {errors.confirm && <p className="mt-1 text-xs text-rose-500">{errors.confirm.message}</p>}
        </div>
        <button type="submit" disabled={loading} className="btn-primary btn-xl w-full">
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Reset password'}
        </button>
      </form>
    </div>
  );
};
