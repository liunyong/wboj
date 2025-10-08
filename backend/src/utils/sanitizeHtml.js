const ENTITY_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;'
};

export const sanitizeRichText = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[&<>"'`]/g, (char) => ENTITY_MAP[char] || char);
};

export const sanitizeOptionalRichText = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return sanitizeRichText(trimmed);
};

export default sanitizeRichText;
