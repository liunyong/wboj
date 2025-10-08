import AdmZip from 'adm-zip';

const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const normalizeContent = (buffer, { trimTrailingWhitespace }) => {
  const content = buffer.toString('utf8').replace(/\r\n/g, '\n');

  if (!trimTrailingWhitespace) {
    return content;
  }

  return content
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
};

const isSafePath = (entryName) => {
  const normalized = entryName.replace(/\\/g, '/');
  if (normalized.includes('..')) {
    return false;
  }
  const segments = normalized.split('/');
  return segments.length <= 2;
};

export const parseTestCasesFromZip = (buffer, { trimTrailingWhitespace = false } = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('ZIP buffer is empty');
  }

  if (buffer.length > MAX_ZIP_BYTES) {
    throw new Error('ZIP file exceeds maximum allowed size');
  }

  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const warnings = [];
  const pairs = new Map();

  entries.forEach((entry) => {
    if (entry.isDirectory) {
      return;
    }

    if (!isSafePath(entry.entryName)) {
      warnings.push(`Skipped ${entry.entryName}: nested directories are not supported`);
      return;
    }

    if (entry.header.size > MAX_FILE_BYTES) {
      warnings.push(`Skipped ${entry.entryName}: file exceeds size limit`);
      return;
    }

    const filename = entry.name;
    const match = /^(\d+)\.(in|out)$/i.exec(filename);

    if (!match) {
      warnings.push(`Skipped ${entry.entryName}: filename must follow N.in / N.out pattern`);
      return;
    }

    const [, rawIndex, kind] = match;
    const index = Number.parseInt(rawIndex, 10);
    if (!Number.isFinite(index) || index < 1 || index > 9999) {
      warnings.push(`Skipped ${entry.entryName}: index must be between 1 and 9999`);
      return;
    }

    const bucket = pairs.get(index) ?? {};

    const content = normalizeContent(entry.getData(), { trimTrailingWhitespace });
    if (kind.toLowerCase() === 'in') {
      bucket.input = content;
    } else {
      bucket.output = content;
    }

    pairs.set(index, bucket);
  });

  const testCases = [];

  Array.from(pairs.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([index, value]) => {
      if (!value.input || !value.output) {
        warnings.push(`Skipped ${index}: missing ${!value.input ? 'input' : 'output'} file`);
        return;
      }

      testCases.push({
        index,
        input: value.input,
        output: value.output,
        points: 1
      });
    });

  let limited = testCases;
  if (testCases.length > 500) {
    warnings.push('Only the first 500 test case pairs were imported (limit: 500).');
    limited = testCases.slice(0, 500);
  }

  return { testCases: limited, warnings };
};
