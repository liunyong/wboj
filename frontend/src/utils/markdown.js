import DOMPurify from 'dompurify';

let purifierInstance = null;
const ALLOWED_URI_REGEX = /^(https?:|\/uploads\/|\/api\/uploads\/)/i;
const MARKDOWN_LINK_REGEX = /(!?\[[^\]]*])( ?)\(([^)]+)\)/g;

const getPurifier = () => {
  if (purifierInstance) {
    return purifierInstance;
  }
  if (DOMPurify?.sanitize) {
    purifierInstance = DOMPurify;
    return purifierInstance;
  }
  if (typeof window !== 'undefined') {
    purifierInstance = DOMPurify(window);
    return purifierInstance;
  }
  return null;
};

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
};

const decodeEntity = (entity) => {
  const named = NAMED_ENTITIES[entity.toLowerCase()];
  if (named) {
    return named;
  }
  if (entity.startsWith('#x') || entity.startsWith('#X')) {
    const hex = entity.slice(2);
    const codePoint = Number.parseInt(hex, 16);
    if (Number.isFinite(codePoint)) {
      return String.fromCodePoint(codePoint);
    }
  }
  if (entity.startsWith('#')) {
    const dec = entity.slice(1);
    const codePoint = Number.parseInt(dec, 10);
    if (Number.isFinite(codePoint)) {
      return String.fromCodePoint(codePoint);
    }
  }
  return `&${entity};`;
};

const decodeHtmlEntities = (value) =>
  value.replace(/&([a-zA-Z]+|#x?[0-9a-fA-F]+);/g, (_match, entity) => decodeEntity(entity));

const sanitizeMarkdownLinks = (value) =>
  value.replace(MARKDOWN_LINK_REGEX, (match, label, separator, target) => {
    const trimmedTarget = target.trim();
    const targetMatch = trimmedTarget.match(/^<?([^>\s]+)>?/);
    const url = targetMatch ? targetMatch[1] : '';

    if (ALLOWED_URI_REGEX.test(url)) {
      return `${label}${separator}(${trimmedTarget})`;
    }

    if (label.startsWith('![')) {
      const alt = label.slice(2, -1);
      return alt || '';
    }

    return label.slice(1, -1);
  });

const sanitizeHtml = (html) => {
  const purifier = getPurifier();
  if (!purifier) {
    return html;
  }
  return purifier.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: ALLOWED_URI_REGEX,
    FORBID_ATTR: ['style', 'onerror', 'onload']
  });
};

export const sanitizeMarkdownSource = (content) => {
  if (typeof content !== 'string') {
    return '';
  }
  const withSafeLinks = sanitizeMarkdownLinks(content);
  const sanitized = sanitizeHtml(withSafeLinks);
  const decoded = decodeHtmlEntities(sanitized);
  return sanitizeMarkdownLinks(decoded);
};

export default sanitizeMarkdownSource;
