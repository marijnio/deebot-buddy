import React from 'react';
import { ArrowUpDown, Search } from 'lucide-react';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'attention', label: 'Due Soon / Overdue' },
  { id: 'robot', label: 'Robot' },
  { id: 'station', label: 'OMNI Station' },
  { id: 'consumables', label: 'Consumables' },
];

export default function FilterBar({
  activeFilter,
  onFilterChange,
  filterCounts,
  searchQuery,
  onSearchChange,
  sortMode,
  onSortChange,
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Quick-filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          const count = filterCounts[filter.id] ?? 0;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onFilterChange(filter.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? 'bg-stone-900 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950'
                  : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span>{filter.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none ${
                  isActive
                    ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950'
                    : 'bg-stone-100 text-stone-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter components..."
            className="w-full rounded-xl border border-stone-200 bg-white py-1.5 pl-8 pr-3 text-xs text-stone-800 placeholder:text-stone-400 focus:border-teal-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <button
          type="button"
          onClick={() =>
            onSortChange(sortMode === 'urgency' ? 'default' : 'urgency')
          }
          title="Toggle sort order"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowUpDown className="h-3.5 w-3.5 text-stone-400" />
          {sortMode === 'urgency' ? 'Urgency' : 'Default'}
        </button>
      </div>
    </div>
  );
}
