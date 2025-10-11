const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const KEYWORDS = [
  'alignas',
  'alignof',
  'and',
  'and_eq',
  'as',
  'async',
  'await',
  'bool',
  'break',
  'case',
  'catch',
  'char',
  'class',
  'const',
  'constexpr',
  'continue',
  'def',
  'default',
  'del',
  'do',
  'double',
  'elif',
  'else',
  'enum',
  'except',
  'export',
  'extends',
  'false',
  'finally',
  'float',
  'for',
  'from',
  'function',
  'global',
  'if',
  'implements',
  'import',
  'in',
  'inline',
  'int',
  'interface',
  'lambda',
  'let',
  'long',
  'namespace',
  'new',
  'not',
  'null',
  'or',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'short',
  'static',
  'struct',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typedef',
  'typeof',
  'union',
  'unsigned',
  'using',
  'var',
  'virtual',
  'void',
  'volatile',
  'while',
  'with',
  'yield'
];

const TOKEN_REGEX_ESCAPE = /[-/\\^$*+?.()|[\]{}]/g;

const createPlaceholder = (value, className, placeholders) => {
  const token = `__TOKEN_${placeholders.length}__`;
  placeholders.push({
    token,
    html: `<span class="token ${className}">${escapeHtml(value)}</span>`
  });
  return token;
};

export const highlightSource = (source) => {
  if (!source) {
    return '';
  }

  const placeholders = [];
  let working = source;

  // Block comments, line comments, python comments
  working = working.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*$/gm,
    (match) => createPlaceholder(match, 'comment', placeholders)
  );

  // Strings (double, single, backtick)
  working = working.replace(
    /"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'/g,
    (match) => createPlaceholder(match, 'string', placeholders)
  );

  let html = escapeHtml(working);

  html = html.replace(/\b\d+(?:\.\d+)?\b/g, (match) => `<span class="token number">${match}</span>`);

  KEYWORDS.forEach((keyword) => {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'g');
    html = html.replace(pattern, `<span class="token keyword">${keyword}</span>`);
  });

  placeholders.forEach(({ token, html: tokenHtml }) => {
    const escapedToken = token.replace(TOKEN_REGEX_ESCAPE, '\\$&');
    html = html.replace(new RegExp(escapedToken, 'g'), tokenHtml);
  });

  return html;
};
