import React from 'react';
import { AlertTriangle, Minus, Package, Plus } from 'lucide-react';
import { formatUnitLabel } from '../utils/stock';

export default function InventorySection({
  inventory,
  onAdjustStock,
  busyInventoryId,
}) {
  const lowCount = inventory.filter((i) => i.is_low_stock).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">
              Spare Parts Inventory
            </h2>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              Track spare parts on hand and adjust quantities manually
            </p>
          </div>
        </div>

        {lowCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/90 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/70 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            {lowCount} item{lowCount > 1 ? 's' : ''} low on stock
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {inventory.map((item) => {
          const isLow = item.is_low_stock;
          const isBusy = busyInventoryId === item.id;
          return (
            <div
              key={item.id}
              className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                isLow
                  ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800/70 dark:bg-amber-950/20'
                  : 'border-stone-200/90 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                    {item.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
                    {item.notes}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div>
                  {isLow ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/90 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-900/70 dark:text-amber-200">
                      <AlertTriangle className="h-3 w-3" />
                      Low Stock — Reorder Buddy Kit
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Stocked & ready
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy || item.in_stock <= 0}
                    onClick={() => onAdjustStock(item.id, -1)}
                    aria-label={`Decrease ${item.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-14 text-center">
                    <span className="text-base font-extrabold text-stone-900 dark:text-white">
                      {item.in_stock}
                    </span>
                    <span className="ml-1 text-xs text-stone-500 dark:text-slate-400">
                      {formatUnitLabel(item.in_stock, item.unit_label)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onAdjustStock(item.id, 1)}
                    aria-label={`Increase ${item.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
