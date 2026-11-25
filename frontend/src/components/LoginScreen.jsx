import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Moon, ShieldCheck, Sun } from 'lucide-react';
import { api } from '../api';
import RobotMascot from './RobotMascot';

export default function LoginScreen({
  robotName = 'Deebot T90 PRO OMNI',
  darkMode,
  onToggleDarkMode,
  onUnlocked,
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError('');
    try {
      await api.login({ password, remember_me: rememberMe });
      setPassword('');
      onUnlocked();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 py-10 text-stone-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <button
        type="button"
        onClick={onToggleDarkMode}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute right-5 top-5 rounded-xl border border-stone-200 bg-white p-2.5 text-stone-600 shadow-xs transition hover:bg-stone-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {darkMode ? (
          <Sun className="h-4 w-4 text-amber-400" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>

      <div className="w-full max-w-md rounded-3xl border border-stone-200/90 bg-white p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col items-center text-center">
          <RobotMascot mood="happy" className="h-36 w-40 drop-shadow-sm" />
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 dark:border-teal-800/70 dark:bg-teal-950/60 dark:text-teal-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Protected by Password
          </span>
          <h1 className="mt-3 text-xl font-extrabold tracking-tight text-stone-900 dark:text-white">
            {robotName}
          </h1>
          <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
            Enter your Deebot Buddy password to access maintenance schedules.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-10 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-stone-400 hover:text-stone-600 dark:hover:text-slate-200"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
            />
            Keep me signed in for 30 days
          </label>

          <button
            type="submit"
            disabled={submitting || !password}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
          >
            <Lock className="h-4 w-4" />
            {submitting ? 'Unlocking...' : 'Unlock Deebot Buddy'}
          </button>
        </form>
      </div>
    </div>
  );
}
