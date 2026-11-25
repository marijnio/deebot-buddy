import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Moon, RefreshCw, Settings, Sun } from 'lucide-react';
import { api } from './api';
import HeroSection from './components/HeroSection';
import FilterBar from './components/FilterBar';
import TaskCard from './components/TaskCard';
import InventorySection from './components/InventorySection';
import TaskDetailDrawer from './components/TaskDetailDrawer';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('urgency');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState(null);
  const [busyInventoryId, setBusyInventoryId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const [darkMode, setDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem('deebot-theme', next ? 'dark' : 'light');
      } catch {}
      return next;
    });
  };

  const showToast = useCallback((message, undoLogId = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, undoLogId });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 6000);
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setDashboard(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleQuickComplete = async (taskId, actionType) => {
    setBusyTaskId(taskId);
    try {
      const task = dashboard?.tasks.find((t) => t.id === taskId);
      const res = await api.completeTask(taskId, { action_type: actionType });
      setDashboard(res.dashboard);
      const verb = actionType === 'REPLACE' ? 'Replaced' : 'Cleaned';
      const stockNote = res.stock_decremented ? ' (-1 stock)' : '';
      showToast(`${verb} ${task?.name || 'component'}${stockNote}`, res.log_id);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleDrawerCompleted = async (res, taskName, actionType) => {
    setDashboard(res.dashboard);
    const verb = actionType === 'REPLACE' ? 'Replaced' : 'Cleaned';
    showToast(`Logged ${verb.toLowerCase()} for ${taskName}`, res.log_id);
  };

  const handleUndoLog = async (logId) => {
    try {
      const res = await api.undoLog(logId);
      setDashboard(res.dashboard);
      showToast('Maintenance action undone');
    } catch (err) {
      showToast(`Undo failed: ${err.message}`);
    }
  };

  const handleAdjustStock = async (inventoryId, delta) => {
    setBusyInventoryId(inventoryId);
    try {
      const dash = await api.updateInventory(inventoryId, { delta });
      setDashboard(dash);
    } catch (err) {
      showToast(`Stock update failed: ${err.message}`);
    } finally {
      setBusyInventoryId(null);
    }
  };

  const filterCounts = useMemo(() => {
    const tasks = dashboard?.tasks || [];
    return {
      all: tasks.length,
      attention: tasks.filter(
        (t) => t.overall_status === 'overdue' || t.overall_status === 'due_soon'
      ).length,
      robot: tasks.filter(
        (t) => t.location === 'Robot' || t.location === 'Both'
      ).length,
      station: tasks.filter(
        (t) => t.location === 'OMNI Station' || t.location === 'Both'
      ).length,
      consumables: tasks.filter((t) => Boolean(t.inventory)).length,
    };
  }, [dashboard]);

  const visibleTasks = useMemo(() => {
    const tasks = dashboard?.tasks || [];
    const q = searchQuery.trim().toLowerCase();

    const filtered = tasks.filter((t) => {
      if (activeFilter === 'attention') {
        if (t.overall_status !== 'overdue' && t.overall_status !== 'due_soon') {
          return false;
        }
      } else if (activeFilter === 'robot') {
        if (t.location !== 'Robot' && t.location !== 'Both') return false;
      } else if (activeFilter === 'station') {
        if (t.location !== 'OMNI Station' && t.location !== 'Both') return false;
      } else if (activeFilter === 'consumables') {
        if (!t.inventory) return false;
      }

      if (q) {
        return (
          t.name.toLowerCase().includes(q) ||
          t.location.toLowerCase().includes(q) ||
          t.instructions.toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (sortMode === 'urgency') {
      return [...filtered].sort((a, b) => {
        if (b.max_percent_elapsed !== a.max_percent_elapsed) {
          return b.max_percent_elapsed - a.max_percent_elapsed;
        }
        return a.sort_order - b.sort_order;
      });
    }
    return filtered;
  }, [dashboard, activeFilter, searchQuery, sortMode]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-stone-50/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-stone-900 dark:text-white">
                Deebot Buddy
              </h1>
              <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400">
                ECOVACS DEEBOT T90 PRO OMNI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDashboard}
              title="Refresh dashboard"
              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 transition hover:bg-stone-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 transition hover:bg-stone-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {darkMode ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-stone-500">
            Waking up Deebot Buddy...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
            <p className="font-semibold">Could not connect to Deebot Buddy API</p>
            <p className="mt-1 text-xs opacity-80">{error}</p>
            <button
              type="button"
              onClick={fetchDashboard}
              className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : (
          dashboard && (
            <>
              <HeroSection
                dashboard={dashboard}
                onQuickComplete={handleQuickComplete}
                onOpenTask={setSelectedTaskId}
                busyTaskId={busyTaskId}
              />

              {/* Maintenance Components */}
              <section className="space-y-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                      Maintenance Schedule
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                      Click any component card for T90 PRO OMNI care instructions, backdating, and history
                    </p>
                  </div>
                </div>

                <FilterBar
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  filterCounts={filterCounts}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  sortMode={sortMode}
                  onSortChange={setSortMode}
                />

                {visibleTasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-500 dark:border-slate-800 dark:text-slate-400">
                    No maintenance components match this filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visibleTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isBusy={busyTaskId === task.id}
                        onOpenDetail={setSelectedTaskId}
                        onQuickComplete={handleQuickComplete}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Spare Parts Inventory */}
              <InventorySection
                inventory={dashboard.inventory}
                onAdjustStock={handleAdjustStock}
                busyInventoryId={busyInventoryId}
              />
            </>
          )
        )}
      </main>

      <TaskDetailDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onCompleted={handleDrawerCompleted}
        onUpdated={(dash, msg) => {
          setDashboard(dash);
          showToast(msg);
        }}
        onUndoLog={(res) => {
          setDashboard(res.dashboard);
          showToast('Maintenance log undone');
        }}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={fetchDashboard}
        onNotify={(msg) => showToast(msg)}
      />

      <Toast
        toast={toast}
        onUndo={handleUndoLog}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
