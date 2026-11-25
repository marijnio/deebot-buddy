import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ClipboardCheck,
  Lock,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { api } from './api';
import HeroSection from './components/HeroSection';
import FilterBar from './components/FilterBar';
import TaskCard from './components/TaskCard';
import InventorySection from './components/InventorySection';
import TaskDetailDrawer from './components/TaskDetailDrawer';
import SettingsModal from './components/SettingsModal';
import FullCheckModal from './components/FullCheckModal';
import LoginScreen from './components/LoginScreen';
import Toast from './components/Toast';

export default function App() {
  const [authStatus, setAuthStatus] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('urgency');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullCheckOpen, setFullCheckOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
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
      } catch { }
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

    const checkAuthAndLoad = useCallback(async () => {
      try {
        const status = await api.getAuthStatus();
        setAuthStatus(status);
        if (status.password_enabled && !status.authenticated) {
          setDashboard(null);
          setLoading(false);
          return;
        }
        const data = await api.getDashboard();
        setDashboard(data);
        setError('');
      } catch (err) {
        if (err.status === 401) {
          setAuthStatus((prev) => ({
            ...(prev || {}),
            password_enabled: true,
            authenticated: false,
          }));
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }, []);

    const fetchDashboard = useCallback(async () => {
      try {
        const data = await api.getDashboard();
        setDashboard(data);
        setError('');
      } catch (err) {
        if (err.status === 401) {
          await checkAuthAndLoad();
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }, [checkAuthAndLoad]);

    useEffect(() => {
    checkAuthAndLoad();
  }, [checkAuthAndLoad]);

  useEffect(() => {
    const name = dashboard?.robot_name;
    document.title =
      name && name !== 'Deebot T90 PRO OMNI'
        ? `${name} — Deebot Buddy`
        : 'Deebot Buddy — T90 PRO OMNI Maintenance Tracker';
  }, [dashboard?.robot_name]);

  const handleLockApp = async () => {
    try {
      await api.logout();
    } catch { }
    setSettingsOpen(false);
    setFullCheckOpen(false);
    setSelectedTaskId(null);
    setDashboard(null);
    setAuthStatus((prev) => ({
      ...(prev || {}),
      password_enabled: true,
      authenticated: false,
    }));
  };

  const handleQuickComplete = async (taskId, actionType) => {
    setBusyTaskId(taskId);
    try {
      const task = dashboard?.tasks.find((t) => t.id === taskId);
      const res = await api.completeTask(taskId, { action_type: actionType });
      setDashboard(res.dashboard);
      const verb = actionType === 'REPLACE' ? 'Replaced' : 'Cleaned';
      showToast(`${verb} ${task?.name || 'component'}`, res.log_id);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleRenameRobot = async (newName) => {
    try {
      const saved = await api.saveSettings({ robot_name: newName });
      setAuthStatus((prev) =>
        prev ? { ...prev, robot_name: saved.robot_name } : prev
      );
      await fetchDashboard();
      showToast(`Renamed robot to "${saved.robot_name}"`);
    } catch (err) {
      showToast(`Rename failed: ${err.message}`);
      throw err;
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

  if (authStatus && authStatus.password_enabled && !authStatus.authenticated) {
    return (
      <LoginScreen
        robotName={authStatus.robot_name}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onUnlocked={() => {
          setLoading(true);
          checkAuthAndLoad();
        }}
      />
    );
  }

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
                {dashboard?.robot_name &&
                dashboard.robot_name !== 'Deebot T90 PRO OMNI'
                  ? `${dashboard.robot_name} · DEEBOT T90 PRO OMNI`
                  : 'ECOVACS DEEBOT T90 PRO OMNI'}
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
            {authStatus?.password_enabled && (
              <button
                type="button"
                onClick={handleLockApp}
                title="Lock Deebot Buddy"
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Lock className="h-4 w-4" />
                <span className="hidden sm:inline">Lock</span>
              </button>
            )}
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
                onRenameRobot={handleRenameRobot}
                busyTaskId={busyTaskId}
              />

              {/* First-run / unlogged full check-up prompt */}
              {dashboard.counts.total_logs === 0 &&
                dashboard.counts.overdue === 0 &&
                !bannerDismissed && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                        <ClipboardCheck className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-stone-900 sm:text-sm dark:text-white">
                          Long time since last maintenance?
                        </p>
                        <p className="text-xs text-stone-600 dark:text-slate-300">
                          No maintenance logs recorded yet. Flag components as due now to start a full check-up.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFullCheckOpen(true)}
                        className="rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-stone-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
                      >
                        Start Full Check-Up
                      </button>
                      <button
                        type="button"
                        onClick={() => setBannerDismissed(true)}
                        aria-label="Dismiss check-up prompt"
                        className="rounded-xl p-1.5 text-stone-400 hover:bg-amber-100 hover:text-stone-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

              {/* Maintenance Components */}
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                      Maintenance Schedule
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                      Click any component card for T90 PRO OMNI care instructions, backdating, and history
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFullCheckOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5 text-rose-500" />
                    Full Check-Up
                  </button>
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
        onOpenFullCheck={() => setFullCheckOpen(true)}
        authStatus={authStatus}
        onAuthChanged={checkAuthAndLoad}
      />

      <FullCheckModal
        isOpen={fullCheckOpen}
        onClose={() => setFullCheckOpen(false)}
        totalLogs={dashboard?.counts?.total_logs || 0}
        onSuccess={(newDash, flaggedCycles, urgency) => {
          setDashboard(newDash);
          if (urgency === 'overdue') {
            setActiveFilter('attention');
          }
          showToast(
            `Flagged ${flaggedCycles} maintenance cycle${flaggedCycles === 1 ? '' : 's'} as ${urgency === 'overdue' ? 'due now' : 'due soon'
            }`
          );
        }}
      />

      <Toast
        toast={toast}
        onUndo={handleUndoLog}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
