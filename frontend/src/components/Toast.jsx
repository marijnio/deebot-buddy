import React from 'react';
import { CheckCircle2, RotateCcw, X } from 'lucide-react';

export default function Toast({ toast, onUndo, onDismiss }) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-900 px-4 py-3 text-sm text-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
      <span className="font-medium">{toast.message}</span>
      {toast.undoLogId && (
        <button
          type="button"
          onClick={() => onUndo(toast.undoLogId)}
          className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-white/25"
        >
          <RotateCcw className="h-3 w-3" />
          Undo
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-lg p-0.5 text-stone-400 hover:text-white"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
