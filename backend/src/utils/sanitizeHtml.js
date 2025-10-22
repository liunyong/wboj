const ENTITY_DECODE_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#96;': '`'
};

const ENTITY_DECODE_REGEX = /&(amp|lt|gt|quot|#39|#96);/g;

export const decodeHtmlEntities = (value) =>
  value.replace(ENTITY_DECODE_REGEX, (match) => ENTITY_DECODE_MAP[match] ?? match);

export const sanitizeRichText = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return decodeHtmlEntities(value);
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
