import { parse } from 'node-html-parser';

const HIGHLIGHT_CLASS_HINTS = ['token', 'language-', 'hljs', 'cm-'];
const HIGHLIGHT_TAGS = new Set(['span', 'code', 'pre', 'div']);
const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  ampersand: '&'
};

const highlightArtifactPattern =
  /<(?:span|code|pre|div)\b[^>]*(?:class|data-language)\s*=\s*["'][^"']*(?:token|language-|hljs|cm-)[^"']*["'][^>]*>/i;

const numberEntityPattern = /^#(x?[0-9a-f]+)$/i;

const normalizeLineEndings = (value) => value.replace(/\r\n?/g, '\n');

const decodeHtmlEntity = (entity) => {
  const named = NAMED_ENTITIES[entity.toLowerCase()];
  if (named) {
    return named;
  }
  const match = entity.match(numberEntityPattern);
  if (!match) {
    return `&${entity};`;
  }
  const [, code] = match;
  const base = code.startsWith('x') ? 16 : 10;
  const normalized = code.startsWith('x') ? code.slice(1) : code;
  const codePoint = Number.parseInt(normalized, base);
  if (!Number.isFinite(codePoint)) {
    return `&${entity};`;
  }
  try {
    return String.fromCodePoint(codePoint);
  } catch (_error) {
    return `&${entity};`;
  }
};

const decodeHtmlEntities = (value) =>
  value.replace(/&([a-zA-Z]+|#[0-9]+|#x[0-9a-fA-F]+);/g, (_match, entity) => decodeHtmlEntity(entity));

const hasHighlightArtifacts = (value) => highlightArtifactPattern.test(value);

const shouldStripNode = (node) => {
  if (!node || typeof node.tagName !== 'string') {
    return false;
  }
  const tag = node.tagName.toLowerCase();
  if (!HIGHLIGHT_TAGS.has(tag)) {
    return false;
  }

  const classAttr = node.getAttribute?.('class') ?? '';
  const dataLanguage = node.getAttribute?.('data-language') ?? '';

  const candidates = [classAttr, dataLanguage]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  return candidates.some((candidate) =>
    HIGHLIGHT_CLASS_HINTS.some((hint) => candidate.includes(hint.toLowerCase()))
  );
};

const stripHighlighterHtml = (value) => {
  if (typeof value !== 'string' || !hasHighlightArtifacts(value)) {
    return { result: value, changed: false, detected: false };
  }

  const root = parse(`<root>${value}</root>`, {
    lowerCaseTagName: false,
    script: false,
    style: false
  });

  let mutated = false;

  const walk = (node) => {
    if (!node || !node.childNodes) {
      return;
    }

    for (const child of [...node.childNodes]) {
      if (child.nodeType === 8) {
        child.remove();
        mutated = true;
        continue;
      }

      if (child.nodeType === 3) {
        continue;
      }

      if (shouldStripNode(child)) {
        const replacement = child.innerText ?? child.textContent ?? '';
        child.replaceWith(replacement);
        mutated = true;
        continue;
      }

      walk(child);
    }
  };

  walk(root);

  const textContent = root.innerText ?? root.textContent ?? '';
  const decoded = decodeHtmlEntities(textContent);

  return { result: decoded, changed: mutated || decoded !== value, detected: true };
};

export const sanitizeSourceCode = (value) => {
  const original = typeof value === 'string' ? value : '';
  let sanitized = original;
  let changed = false;
  let highlightDetected = false;

  if (hasHighlightArtifacts(sanitized)) {
    const { result, changed: stripChanged, detected } = stripHighlighterHtml(sanitized);
    sanitized = result;
    changed = changed || stripChanged;
    highlightDetected = highlightDetected || detected;
  }

  const normalizedWhitespace = sanitized.replace(/\u00a0/g, ' ');
  if (normalizedWhitespace !== sanitized) {
    sanitized = normalizedWhitespace;
    changed = true;
  }

  const normalizedNewlines = normalizeLineEndings(sanitized);
  if (normalizedNewlines !== sanitized) {
    sanitized = normalizedNewlines;
    changed = true;
  }

  return {
    sanitized,
    changed,
    highlightDetected,
    hadArtifacts: highlightDetected
  };
};

export const ensureSourceCodeSanitized = (value) => sanitizeSourceCode(value).sanitized;

export const detectHighlightArtifacts = hasHighlightArtifacts;
