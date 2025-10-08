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

export const runJudge0Submission = async ({
  languageId,
  sourceCode,
  stdin,
  expectedOutput,
  cpuTimeLimit,
  memoryLimit,
  enableNetwork = false
}) => {
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
