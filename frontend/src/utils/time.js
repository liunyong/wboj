export const getUserTZ = (fallback = 'UTC') => {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return resolved || fallback;
  } catch (error) {
    return fallback;
  }
};

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

const buildDateParts = (iso, timeZone) => {
  const formatter = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone
  });
  return formatter.formatToParts(new Date(iso));
};

export const formatRelativeOrDate = (iso, nowMs = Date.now(), tz) => {
  if (!iso) {
    return '—';
  }
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) {
    return '—';
  }

  let diffSec = Math.max(0, Math.floor((nowMs - timestamp) / 1000));
  if (diffSec < 60) {
    return relativeFormatter.format(-diffSec, 'second');
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return relativeFormatter.format(-diffMin, 'minute');
  }

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return relativeFormatter.format(-diffHr, 'hour');
  }

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay <= 10) {
    return relativeFormatter.format(-diffDay, 'day');
  }

  const timeZone = tz || getUserTZ();
  const parts = buildDateParts(iso, timeZone);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
};

export const formatTooltip = (iso, tz) => {
  if (!iso) {
    return '—';
  }
  const timeZone = tz || getUserTZ();
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone
  }).format(new Date(iso));
};

export const formatAbsoluteDateTime = (iso, tz) => {
  if (!iso) {
    return '—';
  }
  const timeZone = tz || getUserTZ();
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone
  }).format(new Date(iso));
};
