const LANGUAGE_KEYWORDS = {
  python: new Set([
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif',
    'else', 'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
    'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while',
    'with', 'yield'
  ]),
  cpp: new Set([
    'alignas', 'alignof', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const',
    'constexpr', 'continue', 'default', 'delete', 'do', 'double', 'else', 'enum', 'explicit',
    'export', 'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long',
    'mutable', 'namespace', 'new', 'noexcept', 'nullptr', 'operator', 'private', 'protected',
    'public', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch',
    'template', 'this', 'throw', 'true', 'try', 'typedef', 'typename', 'union', 'unsigned',
    'using', 'virtual', 'void', 'volatile', 'while'
  ]),
  c: new Set([
    'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else',
    'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'register', 'return',
    'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned',
    'void', 'volatile', 'while'
  ]),
  java: new Set([
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const',
    'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float',
    'for', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
    'null', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
    'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'true', 'try',
    'void', 'volatile', 'while'
  ]),
  javascript: new Set([
    'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
    'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if',
    'import', 'in', 'instanceof', 'let', 'new', 'null', 'return', 'super', 'switch', 'this',
    'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'
  ]),
  typescript: new Set([
    'abstract', 'any', 'as', 'asserts', 'async', 'await', 'boolean', 'break', 'case', 'catch',
    'class', 'const', 'continue', 'declare', 'default', 'do', 'else', 'enum', 'export', 'extends',
    'false', 'finally', 'for', 'from', 'function', 'if', 'implements', 'import', 'in', 'infer',
    'interface', 'is', 'keyof', 'let', 'module', 'namespace', 'never', 'new', 'null', 'number',
    'object', 'package', 'private', 'protected', 'public', 'readonly', 'return', 'static', 'string',
    'super', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'unknown',
    'var', 'void', 'while'
  ]),
  go: new Set([
    'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough', 'for',
    'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range', 'return', 'select',
    'struct', 'switch', 'type', 'var'
  ]),
  rust: new Set([
    'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern', 'false',
    'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref',
    'return', 'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use',
    'where', 'while'
  ]),
  kotlin: new Set([
    'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun', 'if', 'in', 'interface',
    'is', 'null', 'object', 'package', 'return', 'super', 'this', 'throw', 'true', 'try', 'typealias',
    'val', 'var', 'when', 'while'
  ]),
  csharp: new Set([
    'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked', 'class',
    'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else', 'enum', 'event',
    'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if',
    'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace', 'new',
    'null', 'object', 'operator', 'out', 'override', 'private', 'protected', 'public', 'readonly',
    'ref', 'return', 'sbyte', 'sealed', 'short', 'static', 'string', 'struct', 'switch', 'this',
    'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using',
    'virtual', 'void', 'volatile', 'while'
  ])
};

const LANGUAGE_ALIASES = [
  ['python', ['python', 'pypy']],
  ['cpp', ['c++', 'cpp', 'g++', 'clang++']],
  ['c', ['c', 'gcc', 'clang c', 'gnu c', 'c11']],
  ['java', ['java']],
  ['javascript', ['javascript', 'node']],
  ['typescript', ['typescript', 'ts-node']],
  ['go', ['go']],
  ['rust', ['rust']],
  ['kotlin', ['kotlin']],
  ['csharp', ['c#', 'csharp', '.net']]
];

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const normalizeLanguage = (languageName) =>
  ` ${String(languageName ?? '').toLowerCase().replace(/\s+/g, ' ').trim()} `;

const resolveLanguageKey = (languageName) => {
  const normalized = normalizeLanguage(languageName);
  for (const [key, patterns] of LANGUAGE_ALIASES) {
    if (patterns.some((token) => normalized.includes(` ${token} `))) {
      return key;
    }
  }
  return 'javascript';
};

const buildTokenizer = (languageKey) => {
  const hashComment = languageKey === 'python' || languageKey === 'rust' || languageKey === 'go';
  const parts = [
    '(?<blockComment>/\\*[\\s\\S]*?\\*/)',
    '(?<lineComment>//[^\\n]*)'
  ];
  if (hashComment) {
    parts.push('(?<hashComment>#[^\\n]*)');
  }
  parts.push(
    '(?<string>"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)',
    '(?<number>\\b\\d+(?:\\.\\d+)?\\b)',
    '(?<identifier>\\b[A-Za-z_][A-Za-z0-9_]*\\b)'
  );
  return new RegExp(parts.join('|'), 'g');
};

const wrap = (tokenClass, token) => `<span class="token-${tokenClass}">${escapeHtml(token)}</span>`;

export const highlightCode = (sourceCode, languageName) => {
  const text = typeof sourceCode === 'string' ? sourceCode : '';
  if (!text) {
    return '';
  }

  const languageKey = resolveLanguageKey(languageName);
  const keywords = LANGUAGE_KEYWORDS[languageKey] ?? new Set();
  const regex = buildTokenizer(languageKey);

  let result = '';
  let lastIndex = 0;
  let match = regex.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      result += escapeHtml(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const groups = match.groups ?? {};

    if (groups.blockComment || groups.lineComment || groups.hashComment) {
      result += wrap('comment', token);
    } else if (groups.string) {
      result += wrap('string', token);
    } else if (groups.number) {
      result += wrap('number', token);
    } else if (groups.identifier) {
      if (keywords.has(token)) {
        result += wrap('keyword', token);
      } else {
        result += wrap('identifier', token);
      }
    } else {
      result += escapeHtml(token);
    }

    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    result += escapeHtml(text.slice(lastIndex));
  }

  return result;
};

export default highlightCode;
