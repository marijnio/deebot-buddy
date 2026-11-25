import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ClipboardCheck,
  Download,
  Save,
  Send,
  Settings,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../api';

export default function SettingsModal({
  isOpen,
  onClose,
  onSaved,
  onNotify,
  onOpenFullCheck,
}) {
  const [form, setForm] = useState({
    robot_name: 'Deebot T90 PRO OMNI',
    webhook_url: '',
    webhook_type: 'auto',
    pushover_token: '',
    pushover_user: '',
    notifications_enabled: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setLoading(true);
    api
      .getSettings()
      .then((data) => {
        setForm({
          robot_name: data.robot_name || 'Deebot T90 PRO OMNI',
          webhook_url: data.webhook_url || '',
          webhook_type: data.webhook_type || 'auto',
          pushover_token: data.pushover_token || '',
          pushover_user: data.pushover_user || '',
          notifications_enabled: Boolean(data.notifications_enabled),
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.saveSettings(form);
      onSaved();
      onNotify('Settings saved');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    setError('');
    try {
      const res = await api.testWebhook({
        webhook_url: form.webhook_url,
        webhook_type: form.webhook_type,
        pushover_token: form.pushover_token,
        pushover_user: form.pushover_user,
      });
      onNotify(`Test webhook sent via ${res.provider} (HTTP ${res.status_code})`);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deebot-buddy-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify('Exported JSON backup');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await api.importBackup(json);
      onSaved();
      onNotify('Backup restored successfully');
      onClose();
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const showPushoverFields =
    form.webhook_type === 'pushover' ||
    form.webhook_url.toLowerCase().includes('api.pushover.net');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <h2 className="text-base font-bold text-stone-900 dark:text-white">
              Buddy Settings & Backups
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

        <form onSubmit={handleSave} className="space-y-4 p-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
              {error}
            </div>
          )}

          {loading ? (
            <p className="py-8 text-center text-xs text-stone-500">
              Loading settings...
            </p>
          ) : (
            <>
              <label className="block text-xs">
                <span className="font-semibold text-stone-700 dark:text-slate-200">
                  Robot Nickname
                </span>
                <input
                  type="text"
                  value={form.robot_name}
                  onChange={(e) =>
                    setForm({ ...form, robot_name: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              {/* Webhook notifications */}
              <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-slate-200">
                    <Bell className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    Webhook Alerts
                  </span>
                  <label className="flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.notifications_enabled}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          notifications_enabled: e.target.checked,
                        })
                      }
                      className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                    />
                    Enabled
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <label className="block text-xs sm:col-span-2">
                    <span className="font-medium text-stone-600 dark:text-slate-300">
                      Webhook URL
                    </span>
                    <input
                      type="url"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={form.webhook_url}
                      onChange={(e) =>
                        setForm({ ...form, webhook_url: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>

                  <label className="block text-xs">
                    <span className="font-medium text-stone-600 dark:text-slate-300">
                      Format
                    </span>
                    <select
                      value={form.webhook_type}
                      onChange={(e) =>
                        setForm({ ...form, webhook_type: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="auto">Auto-detect</option>
                      <option value="discord">Discord</option>
                      <option value="pushover">Pushover</option>
                      <option value="gotify">Gotify</option>
                      <option value="home_assistant">Home Assistant</option>
                      <option value="generic">Generic JSON</option>
                    </select>
                  </label>
                </div>

                {showPushoverFields && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Pushover App Token"
                      value={form.pushover_token}
                      onChange={(e) =>
                        setForm({ ...form, pushover_token: e.target.value })
                      }
                      className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    />
                    <input
                      type="text"
                      placeholder="Pushover User Key"
                      value={form.pushover_user}
                      onChange={(e) =>
                        setForm({ ...form, pushover_user: e.target.value })
                      }
                      className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-stone-500 dark:text-slate-400">
                    Supports Discord, Pushover, Gotify & Home Assistant
                  </span>
                  <button
                    type="button"
                    disabled={testing || !form.webhook_url}
                    onClick={handleTestWebhook}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {testing ? 'Sending...' : 'Test Hook'}
                  </button>
                </div>
              </div>

              {/* Full Maintenance Check-Up */}
              {onOpenFullCheck && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
                  <div>
                    <p className="text-xs font-bold text-stone-800 dark:text-slate-100">
                      Full Maintenance Check-Up
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400">
                      Mark unlogged or overdue components as due now
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenFullCheck();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800/70 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/50"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Flag Tasks as Due...
                  </button>
                </div>
              )}

              {/* JSON Backup Export / Import */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 p-4 dark:border-slate-800">
                <div>
                  <p className="text-xs font-bold text-stone-800 dark:text-slate-100">
                    JSON Backup & Restore
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400">
                    Export or restore all tasks, logs, and spare stock
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExport}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Import
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </div>
              </div>

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
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
