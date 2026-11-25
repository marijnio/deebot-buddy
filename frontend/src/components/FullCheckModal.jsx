import React, { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardCheck, Clock, X } from 'lucide-react';
import { api } from '../api';

const SCOPE_OPTIONS = [
  {
    id: 'clean_and_bag',
    title: 'All Cleaning & Inspection Checks (+ Dust Bag)',
    description:
      'Covers all 14 components without forcing long-life part replacements (270d brush, 540d battery).',
  },
  {
    id: 'all_cycles',
    title: 'Everything (All Clean & Replace cycles)',
    description:
      'Flags both cleaning and replacement timers across all 14 components.',
  },
  {
    id: 'clean_only',
    title: 'Cleaning cycles only',
    description:
      'Flags the 13 components with clean/check intervals and leaves replacement parts untouched.',
  },
];

export default function FullCheckModal({
  isOpen,
  onClose,
  onSuccess,
  totalLogs = 0,
}) {
  const [scope, setScope] = useState('clean_and_bag');
  const [urgency, setUrgency] = useState('overdue');
  const [onlyUnlogged, setOnlyUnlogged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setOnlyUnlogged(totalLogs > 0);
    }
  }, [isOpen, totalLogs]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await api.bulkFlagTasks({
        scope,
        urgency,
        only_unlogged: onlyUnlogged,
      });
      onSuccess(res.dashboard, res.flagged_cycles, urgency);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            <h2 className="text-base font-bold text-stone-900 dark:text-white">
              Start Full Maintenance Check-Up
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
              {error}
            </div>
          )}

          <p className="text-xs leading-relaxed text-stone-600 dark:text-slate-300">
            Mark components as overdue or due soon without adding fake history
            logs. As you complete each item, its normal schedule resumes
            automatically.
          </p>

          {/* Scope selection */}
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-slate-300">
              What to flag
            </span>
            {SCOPE_OPTIONS.map((opt) => {
              const selected = scope === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                    selected
                      ? 'border-teal-500 bg-teal-50/70 dark:border-teal-500/70 dark:bg-teal-950/30'
                      : 'border-stone-200 hover:bg-stone-50 dark:border-slate-800 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value={opt.id}
                    checked={selected}
                    onChange={() => setScope(opt.id)}
                    className="mt-0.5 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-stone-900 dark:text-white">
                      {opt.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
                      {opt.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Urgency selection */}
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-slate-300">
              Urgency level
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setUrgency('overdue')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                  urgency === 'overdue'
                    ? 'border-rose-500 bg-rose-50 text-rose-700 dark:border-rose-500/70 dark:bg-rose-950/50 dark:text-rose-300'
                    : 'border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                Due Now (Overdue)
              </button>
              <button
                type="button"
                onClick={() => setUrgency('due_soon')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                  urgency === 'due_soon'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-500/70 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Clock className="h-4 w-4" />
                Due Soon (Amber)
              </button>
            </div>
          </div>

          {/* Only unlogged toggle */}
          <label className="flex items-start gap-2.5 rounded-2xl border border-stone-200 bg-stone-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/50">
            <input
              type="checkbox"
              checked={onlyUnlogged}
              onChange={(e) => setOnlyUnlogged(e.target.checked)}
              className="mt-0.5 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
            />
            <div>
              <span className="font-semibold text-stone-800 dark:text-slate-100">
                Only flag components with no logged history yet
              </span>
              <p className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
                {totalLogs === 0
                  ? 'Currently 0 maintenance logs recorded.'
                  : `Preserves timers on components you already logged (${totalLogs} total logs).`}
              </p>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 ${
                urgency === 'overdue'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              {submitting
                ? 'Flagging...'
                : urgency === 'overdue'
                  ? 'Flag as Due Now'
                  : 'Flag as Due Soon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
