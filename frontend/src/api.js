const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && (data.detail || data.message)) ||
      `Request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return data;
}

export const api = {
  getAuthStatus: () => request('/api/auth/status'),
  login: (payload) =>
    request('/api/auth/login', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
  logout: () =>
    request('/api/auth/logout', {
      method: 'POST',
    }),
  updatePassword: (payload) =>
    request('/api/auth/password', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
  getDashboard: () => request('/api/dashboard'),
  getTaskDetail: (taskId) => request(`/api/tasks/${taskId}`),
  completeTask: (taskId, payload) =>
    request(`/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
  updateTask: (taskId, payload) =>
    request(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
  bulkFlagTasks: (payload) =>
    request('/api/tasks/bulk-flag', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
  undoLog: (logId) =>
    request(`/api/logs/${logId}`, {
      method: 'DELETE',
    }),
  updateInventory: (inventoryId, payload) =>
    request(`/api/inventory/${inventoryId}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
  getSettings: () => request('/api/settings'),
  saveSettings: (payload) =>
    request('/api/settings', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
  testWebhook: (payload) =>
    request('/api/settings/test-webhook', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
  exportBackup: () => request('/api/export'),
  importBackup: (payload) =>
    request('/api/import', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
};
