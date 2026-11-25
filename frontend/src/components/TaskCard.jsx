import React from 'react';
import {
  AlertCircle,
  BatteryCharging,
  Bot,
  Box,
  Check,
  ChevronRight,
  CircleDot,
  Disc,
  Droplets,
  Eye,
  Fan,
  Filter,
  FlaskConical,
  Home,
  Package,
  RefreshCw,
  Sparkles,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';
import { formatShortDue } from '../utils/date';

const ICON_MAP = {
  droplets: Droplets,
  waves: Waves,
  tray: Box,
  sparkles: Sparkles,
  brush: Wrench,
  filter: Filter,
  fan: Fan,
  disc: Disc,
  'circle-dot': CircleDot,
  eye: Eye,
  zap: Zap,
  flask: FlaskConical,
  package: Package,
  battery: BatteryCharging,
  wrench: Wrench,
};

function getBarColor(status) {
  if (status === 'overdue') return 'bg-rose-500 dark:bg-rose-500';
  if (status === 'due_soon') return 'bg-amber-400 dark:bg-amber-400';
  return 'bg-emerald-500 dark:bg-emerald-500';
}

function getStatusPill(status) {
  if (status === 'overdue') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300';
  }
  if (status === 'due_soon') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300';
  }
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300';
}

function CycleBar({ label, cycle }) {
  if (!cycle) return null;
  const barColor = getBarColor(cycle.status);
  const dueText = formatShortDue(cycle.days_remaining);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-stone-600 dark:text-slate-300">
          {label}{' '}
          <span className="text-stone-400 dark:text-slate-500">
            ({cycle.interval_days}d)
          </span>
        </span>
        <span
          className={`font-semibold ${
            cycle.status === 'overdue'
              ? 'text-rose-600 dark:text-rose-400'
              : cycle.status === 'due_soon'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {dueText}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(4, cycle.progress_clamped)}%` }}
        />
      </div>
    </div>
  );
}

export default function TaskCard({
  task,
  onOpenDetail,
  onQuickComplete,
  isBusy,
}) {
  const Icon = ICON_MAP[task.icon] || Wrench;
  const borderClass =
    task.overall_status === 'overdue'
      ? 'border-rose-200/90 hover:border-rose-300 dark:border-rose-900/60 dark:hover:border-rose-800'
      : task.overall_status === 'due_soon'
        ? 'border-amber-200/90 hover:border-amber-300 dark:border-amber-900/60 dark:hover:border-amber-800'
        : 'border-stone-200/90 hover:border-stone-300 dark:border-slate-800 dark:hover:border-slate-700';

  const LocationIcon = task.location === 'Robot' ? Bot : Home;

  return (
    <article
      onClick={() => onOpenDetail(task.id)}
      className={`group flex cursor-pointer flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${borderClass}`}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                task.overall_status === 'overdue'
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                  : task.overall_status === 'due_soon'
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                    : 'bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400'
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-snug text-stone-900 group-hover:text-teal-700 dark:text-white dark:group-hover:text-teal-400">
                {task.name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600 dark:bg-slate-800 dark:text-slate-300">
                  <LocationIcon className="h-3 w-3" />
                  {task.location}
                </span>
                {task.inventory && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                      task.inventory.is_low_stock
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                        : 'bg-stone-100 text-stone-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {task.inventory.is_low_stock && (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {task.inventory.in_stock} {task.inventory.unit_label}
                  </span>
                )}
              </div>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${getStatusPill(
              task.overall_status
            )}`}
          >
            {task.overall_status === 'due_soon'
              ? 'Due soon'
              : task.overall_status}
          </span>
        </div>

        {/* Dual-track progress bars */}
        <div className="mt-4 space-y-2.5">
          <CycleBar label="Clean / Check" cycle={task.clean_cycle} />
          <CycleBar label="Replace Part" cycle={task.replace_cycle} />
        </div>
      </div>

      {/* Quick Action Footer */}
      <div
        className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 pt-3 dark:border-slate-800/80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2">
          {task.clean_cycle && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onQuickComplete(task.id, 'CLEAN')}
              className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-900/70"
            >
              <Check className="h-3.5 w-3.5" />
              Cleaned
            </button>
          )}
          {task.replace_cycle && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onQuickComplete(task.id, 'REPLACE')}
              className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/70"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Replaced
              {task.inventory && (
                <span className="opacity-70">(-1)</span>
              )}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpenDetail(task.id)}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-stone-400 transition group-hover:text-stone-700 dark:text-slate-500 dark:group-hover:text-slate-300"
        >
          Details
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}
