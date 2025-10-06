const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit'
});

export const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }
  const date = value instanceof Date ? value : new Date(value);
  return dateTimeFormatter.format(date);
};

export const formatDate = (value) => {
  if (!value) {
    return '-';
  }
  const date = value instanceof Date ? value : new Date(value);
  return dateFormatter.format(date);
};
