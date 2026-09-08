import axios from 'axios';

let cachedClient = null;
let languageCache = null;
let languageCacheTimestamp = 0;
const submissionQueue = [];
let activeSubmissions = 0;

const LANGUAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const SUBMISSION_MAX_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.JUDGE0_MAX_CONCURRENCY ?? '2', 10)
);
const SUBMISSION_MAX_RETRIES = Math.max(0, Number.parseInt(process.env.JUDGE0_MAX_RETRIES ?? '2', 10));
const RETRY_BASE_DELAY_MS = 250;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error) => {
  const status = error?.response?.status;
  if (status && (status >= 500 || status === 429)) {
    return true;
  }

  const retryableCodes = new Set([
    'ECONNABORTED',
    'ETIMEDOUT',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EPIPE'
  ]);

  return retryableCodes.has(error?.code);
};

const withRetry = async (fn, { retries }) => {
  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === retries) {
        break;
      }

      const backoff = RETRY_BASE_DELAY_MS * 2 ** attempt;
      await delay(backoff);
      attempt += 1;
    }
  }

  throw lastError;
};

const enqueue = (operation) =>
  new Promise((resolve, reject) => {
    const execute = async () => {
      activeSubmissions += 1;

      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        activeSubmissions -= 1;
        const next = submissionQueue.shift();
        if (next) {
          next();
        }
      }
    };

    if (activeSubmissions < SUBMISSION_MAX_CONCURRENCY) {
      execute();
    } else {
      submissionQueue.push(execute);
    }
  });

const getJudge0Client = () => {
  const baseURL = process.env.JUDGE0_URL || 'http://localhost:2358';

  if (!cachedClient || cachedClient.defaults.baseURL !== baseURL) {
    cachedClient = axios.create({
      baseURL,
      timeout: Number.parseInt(process.env.JUDGE0_TIMEOUT_MS ?? '20000', 10)
    });
  }

  return cachedClient;
};

const encode = (value) => Buffer.from(value ?? '', 'utf8').toString('base64');

const isMockEnabled = () => process.env.JUDGE0_MOCK === 'true';

// Static snapshot of `GET /languages` from judge0/judge0:1.13.1, used only when JUDGE0_MOCK=true
// (local dev on hosts where the real sandbox can't run, e.g. Apple Silicon).
const MOCK_LANGUAGES = [
  { id: 45, name: 'Assembly (NASM 2.14.02)' }, { id: 46, name: 'Bash (5.0.0)' },
  { id: 47, name: 'Basic (FBC 1.07.1)' }, { id: 75, name: 'C (Clang 7.0.1)' },
  { id: 76, name: 'C++ (Clang 7.0.1)' }, { id: 48, name: 'C (GCC 7.4.0)' },
  { id: 52, name: 'C++ (GCC 7.4.0)' }, { id: 49, name: 'C (GCC 8.3.0)' },
  { id: 53, name: 'C++ (GCC 8.3.0)' }, { id: 50, name: 'C (GCC 9.2.0)' },
  { id: 54, name: 'C++ (GCC 9.2.0)' }, { id: 86, name: 'Clojure (1.10.1)' },
  { id: 51, name: 'C# (Mono 6.6.0.161)' }, { id: 77, name: 'COBOL (GnuCOBOL 2.2)' },
  { id: 55, name: 'Common Lisp (SBCL 2.0.0)' }, { id: 56, name: 'D (DMD 2.089.1)' },
  { id: 57, name: 'Elixir (1.9.4)' }, { id: 58, name: 'Erlang (OTP 22.2)' },
  { id: 44, name: 'Executable' }, { id: 87, name: 'F# (.NET Core SDK 3.1.202)' },
  { id: 59, name: 'Fortran (GFortran 9.2.0)' }, { id: 60, name: 'Go (1.13.5)' },
  { id: 88, name: 'Groovy (3.0.3)' }, { id: 61, name: 'Haskell (GHC 8.8.1)' },
  { id: 62, name: 'Java (OpenJDK 13.0.1)' }, { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
  { id: 78, name: 'Kotlin (1.3.70)' }, { id: 64, name: 'Lua (5.3.5)' },
  { id: 89, name: 'Multi-file program' }, { id: 79, name: 'Objective-C (Clang 7.0.1)' },
  { id: 65, name: 'OCaml (4.09.0)' }, { id: 66, name: 'Octave (5.1.0)' },
  { id: 67, name: 'Pascal (FPC 3.0.4)' }, { id: 85, name: 'Perl (5.28.1)' },
  { id: 68, name: 'PHP (7.4.1)' }, { id: 43, name: 'Plain Text' },
  { id: 69, name: 'Prolog (GNU Prolog 1.4.5)' }, { id: 70, name: 'Python (2.7.17)' },
  { id: 71, name: 'Python (3.8.1)' }, { id: 80, name: 'R (4.0.0)' },
  { id: 72, name: 'Ruby (2.7.0)' }, { id: 73, name: 'Rust (1.40.0)' },
  { id: 81, name: 'Scala (2.13.2)' }, { id: 82, name: 'SQL (SQLite 3.27.2)' },
  { id: 83, name: 'Swift (5.2.3)' }, { id: 74, name: 'TypeScript (3.7.4)' },
  { id: 84, name: 'Visual Basic.Net (vbnc 0.0.0.5943)' }
];

// Dev-only stand-in for a real Judge0 run: always reports Accepted and echoes back the
// expected output, so testCaseRunnerService's own stdout comparison also passes.
const buildMockSubmissionResult = ({ expectedOutput }) => ({
  stdout: encode(expectedOutput ?? ''),
  stderr: null,
  compile_output: null,
  message: encode('JUDGE0_MOCK=true: no real execution occurred'),
  time: '0.01',
  memory: 1024,
  status: { id: 3, description: 'Accepted' }
});

export const runJudge0Submission = async ({
  languageId,
  sourceCode,
  stdin,
  expectedOutput,
  cpuTimeLimit,
  memoryLimit,
  enableNetwork = false
}) => {
  if (isMockEnabled()) {
    return buildMockSubmissionResult({ expectedOutput });
  }

  const client = getJudge0Client();

  return enqueue(() =>
    withRetry(
      async () => {
        const response = await client.post(
          '/submissions?base64_encoded=true&wait=true&fields=stdout,stderr,status_id,status,compile_output,time,memory,message',
          (() => {
            const payload = {
              language_id: languageId,
              source_code: encode(sourceCode),
              stdin: encode(stdin),
              enable_network: Boolean(enableNetwork)
            };

            if (expectedOutput !== undefined) {
              payload.expected_output = encode(expectedOutput);
            }

            if (cpuTimeLimit !== undefined) {
              payload.cpu_time_limit = cpuTimeLimit;
            }

            if (memoryLimit !== undefined) {
              payload.memory_limit = memoryLimit;
            }

            return payload;
          })()
        );

        return response.data;
      },
      { retries: SUBMISSION_MAX_RETRIES }
    )
  );
};

export const fetchJudge0Languages = async () => {
  if (isMockEnabled()) {
    return MOCK_LANGUAGES;
  }

  const now = Date.now();

  if (languageCache && now - languageCacheTimestamp < LANGUAGE_CACHE_TTL_MS) {
    return languageCache;
  }

  const client = getJudge0Client();

  const response = await withRetry(() => client.get('/languages'), {
    retries: SUBMISSION_MAX_RETRIES
  });

  languageCache = response.data;
  languageCacheTimestamp = now;

  return languageCache;
};

export const clearLanguageCache = () => {
  languageCache = null;
  languageCacheTimestamp = 0;
};
