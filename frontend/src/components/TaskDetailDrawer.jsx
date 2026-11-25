import React, { useEffect, useState } from 'react';
import {
  CalendarClock,
  Check,
  History,
  Info,
  Package,
  RefreshCw,
  RotateCcw,
  Sliders,
  X,
} from 'lucide-react';
import { api } from '../api';
import {
  formatCountdown,
  formatDateTime,
  formatRelativePast,
  toLocalDatetimeInputValue,
} from '../utils/date';

function renderFormattedInstructions(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-stone-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export default function TaskDetailDrawer({
  taskId,
  onClose,
  onCompleted,
  onUpdated,
  onUndoLog,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Backdate / log form state
  const [performedAt, setPerformedAt] = useState(toLocalDatetimeInputValue());
  const [notes, setNotes] = useState('');
  const [deductCleanStock, setDeductCleanStock] = useState(false);

  // Schedule editor state
  const [showSchedule, setShowSchedule] = useState(false);
  const [cleanInterval, setCleanInterval] = useState('');
  const [replaceInterval, setReplaceInterval] = useState('');
  const [cleanDueOverride, setCleanDueOverride] = useState('');
  const [replaceDueOverride, setReplaceDueOverride] = useState('');

  const loadDetail = async () => {
    if (!taskId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getTaskDetail(taskId);
      setDetail(data);
      const t = data.task;
      setCleanInterval(
        t.clean_cycle ? String(t.clean_cycle.interval_days) : ''
      );
      setReplaceInterval(
        t.replace_cycle ? String(t.replace_cycle.interval_days) : ''
      );
      setCleanDueOverride(
        t.clean_cycle
          ? toLocalDatetimeInputValue(new Date(t.clean_cycle.due_at))
          : ''
      );
      setReplaceDueOverride(
        t.replace_cycle
          ? toLocalDatetimeInputValue(new Date(t.replace_cycle.due_at))
          : ''
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      setPerformedAt(toLocalDatetimeInputValue());
      setNotes('');
      setDeductCleanStock(false);
      setShowSchedule(false);
      loadDetail();
    }
  }, [taskId]);

  if (!taskId) return null;

  const task = detail?.task;
  const logs = detail?.logs || [];

  const applyBackdatePreset = (daysAgo) => {
    const dt = new Date(Date.now() - daysAgo * 86400000);
    setPerformedAt(toLocalDatetimeInputValue(dt));
  };

  const handleLogAction = async (actionType) => {
    if (!task) return;
    setSubmitting(true);
    setError('');
    try {
      const iso = performedAt ? new Date(performedAt).toISOString() : undefined;
      const res = await api.completeTask(task.id, {
        action_type: actionType,
        performed_at: iso,
        notes,
        decrement_stock:
          actionType === 'CLEAN' ? deductCleanStock : undefined,
      });
      setNotes('');
      setPerformedAt(toLocalDatetimeInputValue());
      await onCompleted(res, task.name, actionType);
      await loadDetail();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSnooze = async (cycleType, days) => {
    if (!task) return;
    setSubmitting(true);
    setError('');
    try {
      const payload =
        cycleType === 'CLEAN'
          ? { snooze_clean_days: days }
          : { snooze_replace_days: days };
      const dash = await api.updateTask(task.id, payload);
      onUpdated(dash, `Snoozed ${task.name} by +${days}d`);
      await loadDetail();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!task) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {};
      if (task.clean_cycle && cleanInterval) {
        payload.clean_interval_days = Number(cleanInterval);
      }
      if (task.replace_cycle && replaceInterval) {
        payload.replace_interval_days = Number(replaceInterval);
      }
      if (task.clean_cycle && cleanDueOverride) {
        payload.clean_due_override = new Date(cleanDueOverride).toISOString();
      }
      if (task.replace_cycle && replaceDueOverride) {
        payload.replace_due_override = new Date(
          replaceDueOverride
        ).toISOString();
      }
      const dash = await api.updateTask(task.id, payload);
      setShowSchedule(false);
      onUpdated(dash, `Updated schedule for ${task.name}`);
      await loadDetail();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndo = async (logId) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await api.undoLog(logId);
      onUndoLog(res);
      await loadDetail();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-stone-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              {task ? task.location : 'Component Details'}
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-stone-900 dark:text-white">
              {task ? task.name : 'Loading...'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
              {error}
            </div>
          )}

          {loading && !task ? (
            <div className="py-12 text-center text-sm text-stone-500">
              Loading component history...
            </div>
          ) : (
            task && (
              <>
                {/* Care Instructions */}
                <div className="rounded-2xl border border-teal-200/80 bg-teal-50/70 p-4 dark:border-teal-900/50 dark:bg-teal-950/30">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                    <Info className="h-4 w-4" />
                    T90 PRO OMNI Care Instructions
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700 dark:text-slate-200">
                    {renderFormattedInstructions(task.instructions)}
                  </p>
                </div>

                {/* Current Cycles & Quick Snooze */}
                <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-slate-300">
                      <CalendarClock className="h-4 w-4" />
                      Schedule Status
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSchedule((s) => !s)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      {showSchedule ? 'Hide Editor' : 'Customize / Due Date'}
                    </button>
                  </div>

                  {task.clean_cycle && (
                    <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-800 dark:text-slate-100">
                          Clean / Check (every {task.clean_cycle.interval_days}d)
                        </span>
                        <span className="font-semibold text-teal-700 dark:text-teal-400">
                          {formatCountdown(
                            task.clean_cycle.days_remaining,
                            task.clean_cycle.hours_remaining
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
                        Last cleaned: {formatDateTime(task.clean_cycle.last_at)}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[11px] text-stone-400">Snooze:</span>
                        {[1, 3, 7].map((d) => (
                          <button
                            key={d}
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSnooze('CLEAN', d)}
                            className="rounded-lg border border-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-600 hover:bg-stone-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            +{d}d
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {task.replace_cycle && (
                    <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-800 dark:text-slate-100">
                          Replace Part (every {task.replace_cycle.interval_days}d)
                        </span>
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                          {formatCountdown(
                            task.replace_cycle.days_remaining,
                            task.replace_cycle.hours_remaining
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
                        Last replaced: {formatDateTime(task.replace_cycle.last_at)}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[11px] text-stone-400">Snooze:</span>
                        {[3, 7, 14].map((d) => (
                          <button
                            key={d}
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSnooze('REPLACE', d)}
                            className="rounded-lg border border-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-600 hover:bg-stone-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            +{d}d
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showSchedule && (
                    <form
                      onSubmit={handleSaveSchedule}
                      className="space-y-3 rounded-xl border border-stone-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
                    >
                      {task.clean_cycle && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <label className="block text-xs">
                            <span className="font-medium text-stone-600 dark:text-slate-300">
                              Clean interval (days)
                            </span>
                            <input
                              type="number"
                              min="1"
                              max="3650"
                              value={cleanInterval}
                              onChange={(e) => setCleanInterval(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="font-medium text-stone-600 dark:text-slate-300">
                              Next clean due
                            </span>
                            <input
                              type="datetime-local"
                              value={cleanDueOverride}
                              onChange={(e) =>
                                setCleanDueOverride(e.target.value)
                              }
                              className="mt-1 w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                            />
                          </label>
                        </div>
                      )}

                      {task.replace_cycle && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <label className="block text-xs">
                            <span className="font-medium text-stone-600 dark:text-slate-300">
                              Replace interval (days)
                            </span>
                            <input
                              type="number"
                              min="1"
                              max="3650"
                              value={replaceInterval}
                              onChange={(e) =>
                                setReplaceInterval(e.target.value)
                              }
                              className="mt-1 w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="font-medium text-stone-600 dark:text-slate-300">
                              Next replace due
                            </span>
                            <input
                              type="datetime-local"
                              value={replaceDueOverride}
                              onChange={(e) =>
                                setReplaceDueOverride(e.target.value)
                              }
                              className="mt-1 w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                            />
                          </label>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSchedule(false)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 dark:bg-teal-500 dark:text-slate-950"
                        >
                          Save Schedule
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Log Maintenance (supports backdating & notes) */}
                <div className="space-y-3 rounded-2xl border border-stone-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-slate-300">
                      Log Maintenance Action
                    </span>
                    {task.inventory && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 dark:text-slate-400">
                        <Package className="h-3.5 w-3.5" />
                        {task.inventory.in_stock} {task.inventory.unit_label} in stock
                      </span>
                    )}
                  </div>

                  {/* Quick Backdate Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-stone-500 dark:text-slate-400">
                      When:
                    </span>
                    {[
                      { label: 'Now', days: 0 },
                      { label: 'Yesterday', days: 1 },
                      { label: '2 days ago', days: 2 },
                      { label: '5 days ago', days: 5 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyBackdatePreset(preset.days)}
                        className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="datetime-local"
                    value={performedAt}
                    onChange={(e) => setPerformedAt(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />

                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional note (e.g., cleared hair tangle, rotated spare filter)..."
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 placeholder:text-stone-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />

                  {task.inventory && !task.replace_cycle && (
                    <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={deductCleanStock}
                        onChange={(e) => setDeductCleanStock(e.target.checked)}
                        className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                      />
                      Also deduct 1 {task.inventory.unit_label.replace(/s$/, '')} from stock
                    </label>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {task.clean_cycle && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleLogAction('CLEAN')}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        Log Cleaned
                      </button>
                    )}
                    {task.replace_cycle && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleLogAction('REPLACE')}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Log Replaced
                        {task.inventory ? ' (-1 stock)' : ''}
                      </button>
                    )}
                  </div>
                </div>

                {/* History Log */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-slate-300">
                    <History className="h-4 w-4" />
                    Maintenance History ({logs.length})
                  </div>

                  {logs.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-stone-200 py-6 text-center text-xs text-stone-500 dark:border-slate-800 dark:text-slate-400">
                      No maintenance events logged yet for this component.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {logs.map((log) => (
                        <li
                          key={log.id}
                          className="flex items-start justify-between gap-3 rounded-xl border border-stone-200/80 bg-stone-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                  log.action_type === 'REPLACE'
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                                    : 'bg-teal-100 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300'
                                }`}
                              >
                                {log.action_type}
                              </span>
                              <span className="text-xs font-medium text-stone-700 dark:text-slate-200">
                                {formatRelativePast(log.performed_at)}
                              </span>
                              <span className="text-[11px] text-stone-400">
                                ({formatDateTime(log.performed_at)})
                              </span>
                            </div>
                            {log.notes && (
                              <p className="mt-1 text-xs text-stone-600 dark:text-slate-300">
                                {log.notes}
                              </p>
                            )}
                            {log.stock_decremented === 1 && (
                              <p className="mt-1 text-[11px] text-stone-400">
                                Deducted 1 spare from stock
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleUndo(log.id)}
                            title="Undo this log entry"
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-900 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Undo
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )
          )}
        </div>
      </aside>
    </div>
  );
}
