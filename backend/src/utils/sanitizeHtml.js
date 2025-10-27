import sanitizeHtml from 'sanitize-html';

const ENTITY_DECODE_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#96;': '`'
};

const ENTITY_DECODE_REGEX = /&(amp|lt|gt|quot|#39|#96);/g;

const ALLOWED_TAGS = [
  'p',
  'strong',
  'em',
  'code',
  'pre',
  'img',
  'a',
  'span',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'br'
];

const ALLOWED_ATTRIBUTES = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  code: ['class'],
  span: ['class'],
  th: ['colspan', 'rowspan'],
  td: ['colspan', 'rowspan']
};

const NUMERIC_DIMENSION_REGEX = /^[0-9]{1,4}$/;
const MAX_IMAGE_DIMENSION = 4096;
const ALLOWED_URI_REGEX = /^(https?:|\/uploads\/|\/api\/uploads\/)/i;
const MARKDOWN_LINK_REGEX = /(!?\[[^\]]*])( ?)\(([^)]+)\)/g;

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

const sanitizeDimension = (value) => {
  const normalized = String(value ?? '').trim();
  if (!NUMERIC_DIMENSION_REGEX.test(normalized)) {
    return undefined;
  }
  const numeric = Number.parseInt(normalized, 10);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > MAX_IMAGE_DIMENSION) {
    return undefined;
  }
  return String(numeric);
};

const decodeHtmlEntitiesInternal = (value) =>
  value.replace(ENTITY_DECODE_REGEX, (match) => ENTITY_DECODE_MAP[match] ?? match);

const sanitizeOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  selfClosing: [],
  transformTags: {
    img: (tagName, attribs) => {
      const next = { ...attribs };
      const src = typeof next.src === 'string' ? next.src.trim() : '';
      if (!ALLOWED_URI_REGEX.test(src)) {
        delete next.src;
      }
      if (typeof next.alt === 'string') {
        next.alt = next.alt.slice(0, 512);
      }
      const sanitizedWidth = sanitizeDimension(next.width);
      if (sanitizedWidth) {
        next.width = sanitizedWidth;
      } else {
        delete next.width;
      }
      const sanitizedHeight = sanitizeDimension(next.height);
      if (sanitizedHeight) {
        next.height = sanitizedHeight;
      } else {
        delete next.height;
      }
      delete next.onload;
      delete next.onerror;
      delete next.style;
      return { tagName, attribs: next };
    },
    a: (tagName, attribs) => {
      const next = { ...attribs };
      const href = typeof next.href === 'string' ? next.href.trim() : '';
      if (!ALLOWED_URI_REGEX.test(href)) {
        delete next.href;
      }
      delete next.onclick;
      delete next.style;
      return { tagName, attribs: next };
    }
  },
  exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src
};

export const decodeHtmlEntities = (value) => decodeHtmlEntitiesInternal(String(value ?? ''));

export const sanitizeMarkdown = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  const decoded = decodeHtmlEntitiesInternal(value);
  const withSafeLinks = sanitizeMarkdownLinks(decoded);
  const sanitized = sanitizeHtml(withSafeLinks, sanitizeOptions);
  const sanitizedLinks = sanitizeMarkdownLinks(sanitized);
  return sanitizeHtml(sanitizedLinks, sanitizeOptions);
};

export const sanitizeRichText = sanitizeMarkdown;

export const sanitizeOptionalRichText = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return sanitizeMarkdown(trimmed);
};

export default sanitizeMarkdown;
