import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  Palette,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import RobotMascot from './RobotMascot';
import { formatCountdown } from '../utils/date';

const MOOD_STYLES = {
  happy: {
    badge:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    gradient:
      'from-emerald-50/90 via-white to-teal-50/70 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900',
    ring: '#10b981',
    ringTrack: 'text-emerald-100 dark:text-emerald-950/60',
  },
  normal: {
    badge:
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    gradient:
      'from-amber-50/90 via-white to-orange-50/60 dark:from-amber-950/25 dark:via-slate-900 dark:to-slate-900',
    ring: '#f59e0b',
    ringTrack: 'text-amber-100 dark:text-amber-950/60',
  },
  dusty: {
    badge:
      'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/60',
    gradient:
      'from-orange-50/90 via-white to-amber-50/70 dark:from-orange-950/30 dark:via-slate-900 dark:to-slate-900',
    ring: '#f97316',
    ringTrack: 'text-orange-100 dark:text-orange-950/60',
  },
  faint: {
    badge:
      'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
    gradient:
      'from-rose-50/90 via-white to-orange-50/60 dark:from-rose-950/30 dark:via-slate-900 dark:to-slate-900',
    ring: '#f43f5e',
    ringTrack: 'text-rose-100 dark:text-rose-950/60',
  },
};

export default function HeroSection({
  dashboard,
  onQuickComplete,
  onOpenTask,
  busyTaskId,
}) {
  const {
    robot_name: robotName,
    health_score: healthScore,
    mood,
    mood_label: moodLabel,
    mood_subtitle: moodSubtitle,
    counts,
    next_upcoming: nextUpcoming,
    dirty_water_overdue: dirtyWaterOverdue,
  } = dashboard;

  const [previewMood, setPreviewMood] = useState(null);
  const [showDesignerBar, setShowDesignerBar] = useState(false);
  const [svgCacheBust, setSvgCacheBust] = useState(0);

  const displayedMood = previewMood || mood;
  const style = MOOD_STYLES[displayedMood] || MOOD_STYLES.happy;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (healthScore / 100) * circumference;

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-stone-200/90 bg-gradient-to-br ${style.gradient} p-5 shadow-sm transition-colors sm:p-7 dark:border-slate-800`}
    >
      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
        {/* Left: Cute Dynamic Robot Mascot + Designer Preview Toggle */}
        <div className="flex flex-col items-center justify-center lg:col-span-3">
          <RobotMascot
            mood={displayedMood}
            cacheBust={svgCacheBust}
            className="h-44 w-48 drop-shadow-sm sm:h-48 sm:w-52"
          />

          {!showDesignerBar ? (
            <button
              type="button"
              onClick={() => setShowDesignerBar(true)}
              className="mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-stone-400 transition hover:bg-stone-900/5 hover:text-stone-600 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300"
            >
              <Palette className="h-3 w-3" />
              Preview moods
            </button>
          ) : (
            <div className="mt-2 flex flex-col items-center gap-1.5 rounded-2xl border border-stone-200/80 bg-white/80 p-2 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex flex-wrap items-center justify-center gap-1">
                {[
                  { id: null, label: 'Live' },
                  { id: 'happy', label: 'Happy' },
                  { id: 'normal', label: 'Normal' },
                  { id: 'dusty', label: 'Dusty' },
                  { id: 'faint', label: 'Faint' },
                ].map((opt) => {
                  const active = previewMood === opt.id;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setPreviewMood(opt.id)}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                        active
                          ? 'bg-stone-900 text-white dark:bg-teal-500 dark:text-slate-950'
                          : 'text-stone-600 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-stone-500 dark:text-slate-400">
                <code className="rounded bg-stone-100 px-1.5 py-0.5 dark:bg-slate-800">
                  mascots/{displayedMood}.svg
                </code>
                <button
                  type="button"
                  onClick={() => setSvgCacheBust((c) => c + 1)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/60"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  Reload SVG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewMood(null);
                    setShowDesignerBar(false);
                  }}
                  className="text-stone-400 hover:text-stone-600 dark:hover:text-slate-200"
                >
                  Hide
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Middle: Mood Status & Summary Pills */}
        <div className="space-y-4 text-center lg:col-span-5 lg:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${style.badge}`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {moodLabel}
            </span>
            {dirtyWaterOverdue && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:border-rose-700/60 dark:text-rose-300">
                <Droplets className="h-3.5 w-3.5" />
                Dirty Water Alert
              </span>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-white">
              {robotName}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600 sm:text-base dark:text-slate-300">
              {moodSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1 lg:justify-start">
            <StatChip
              icon={AlertTriangle}
              label="Overdue"
              value={counts.overdue}
              tone={counts.overdue > 0 ? 'rose' : 'neutral'}
            />
            <StatChip
              icon={Clock}
              label="Due Soon"
              value={counts.due_soon}
              tone={counts.due_soon > 0 ? 'amber' : 'neutral'}
            />
            <StatChip
              icon={CheckCircle2}
              label="Healthy"
              value={counts.ok}
              tone="emerald"
            />
          </div>
        </div>

        {/* Right: Health Score Ring & Next Upcoming Task */}
        <div className="flex flex-col gap-3.5 sm:flex-row lg:col-span-4 lg:flex-col">
          {/* Health Score Ring Card */}
          <div className="flex flex-1 items-center gap-4 rounded-2xl border border-stone-200/80 bg-white/85 p-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="relative flex h-22 w-22 shrink-0 items-center justify-center">
              <svg className="h-22 w-22 -rotate-90" viewBox="0 0 96 96">
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className={style.ringTrack}
                />
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  fill="none"
                  stroke={style.ring}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-stone-900 dark:text-white">
                  {healthScore}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                Robot Health Score
              </p>
              <p className="mt-0.5 text-sm font-medium text-stone-700 dark:text-slate-200">
                {healthScore >= 85
                  ? 'Peak cleaning condition'
                  : healthScore >= 60
                    ? 'Good, minor upkeep ahead'
                    : 'Needs maintenance love'}
              </p>
            </div>
          </div>

          {/* Next Upcoming Task Card */}
          {nextUpcoming && (
            <div className="flex flex-1 flex-col justify-between rounded-2xl border border-stone-200/80 bg-white/85 p-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                    Next Up ({nextUpcoming.action_type === 'REPLACE' ? 'Replace' : 'Clean'})
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenTask(nextUpcoming.task_id)}
                    className="mt-0.5 truncate text-left text-sm font-bold text-stone-900 hover:text-teal-600 dark:text-white dark:hover:text-teal-400"
                  >
                    {nextUpcoming.task_name}
                  </button>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    nextUpcoming.status === 'overdue'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                      : nextUpcoming.status === 'due_soon'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                  }`}
                >
                  {formatCountdown(
                    nextUpcoming.days_remaining,
                    nextUpcoming.hours_remaining
                  )}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-stone-500 dark:text-slate-400">
                  {nextUpcoming.location}
                </span>
                <button
                  type="button"
                  disabled={busyTaskId === nextUpcoming.task_id}
                  onClick={() =>
                    onQuickComplete(nextUpcoming.task_id, nextUpcoming.action_type)
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-500 dark:hover:bg-teal-600"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  {nextUpcoming.action_type === 'REPLACE' ? 'Mark Replaced' : 'Mark Cleaned'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatChip({ icon: Icon, label, value, tone }) {
  const tones = {
    rose: 'bg-rose-100/80 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/50',
    amber:
      'bg-amber-100/80 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50',
    emerald:
      'bg-emerald-100/80 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50',
    neutral:
      'bg-stone-100 text-stone-600 border-stone-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  };
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${tones[tone]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{value}</span>
      <span className="font-normal opacity-80">{label}</span>
    </div>
  );
}
