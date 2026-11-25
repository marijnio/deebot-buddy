export function formatCountdown(daysRemaining, hoursRemaining) {
  if (daysRemaining === null || daysRemaining === undefined) return '—';
  const totalHours = Math.round(hoursRemaining ?? daysRemaining * 24);

  if (totalHours <= 0) {
    const overdueHours = Math.abs(totalHours);
    if (overdueHours < 1) return 'Due now';
    if (overdueHours < 24) return `Overdue by ${overdueHours}h`;
    const d = Math.floor(overdueHours / 24);
    const h = overdueHours % 24;
    return h > 0 ? `Overdue by ${d}d ${h}h` : `Overdue by ${d}d`;
  }

  if (totalHours < 24) {
    return `Due in ${totalHours}h`;
  }
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  return h > 0 && d < 7 ? `Due in ${d}d ${h}h` : `Due in ${d}d`;
}

export function formatShortDue(daysRemaining) {
  if (daysRemaining === null || daysRemaining === undefined) return '';
  if (daysRemaining <= 0) {
    const overdueDays = Math.abs(daysRemaining);
    if (overdueDays * 24 < 1) {
      return 'Due now';
    }
    if (overdueDays < 1) {
      const hrs = Math.max(1, Math.round(overdueDays * 24));
      return `${hrs}h overdue`;
    }
    return `${Math.round(overdueDays)}d overdue`;
  }
  if (daysRemaining < 1) {
    const hrs = Math.max(1, Math.round(daysRemaining * 24));
    return `${hrs}h left`;
  }
  return `${Math.round(daysRemaining)}d left`;
}

export function formatDateTime(isoString) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativePast(isoString) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return formatDateTime(isoString);
}

export function toLocalDatetimeInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function isSameLocalDay(isoString, referenceDate = new Date()) {
  if (!isoString) return false;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth() &&
    date.getDate() === referenceDate.getDate()
  );
}

export function getCycleRemainingPercent(cycle, referenceDate = new Date()) {
  if (!cycle) return 0;
  if (!cycle.is_override && isSameLocalDay(cycle.last_at, referenceDate)) {
    return 100;
  }
  const raw = Number(cycle.progress_clamped ?? 0);
  const elapsed = !Number.isFinite(raw) ? 0 : Math.min(100, Math.max(0, raw));
  return Math.round((100 - elapsed) * 10) / 10;
}
