export const transformEventToRow = (event, { problem = null } = {}) => {
  if (!event) {
    return null;
  }

  const createdAt = event.createdAt ?? event.queuedAt ?? new Date().toISOString();
  const runtimeMs = event.runtimeMs ?? null;
  const memoryKB = event.memoryKB ?? null;
  const problemData =
    problem ||
    (event.problemId
      ? {
          id: null,
          title: event.problemTitle ?? null,
          problemId: event.problemId,
          difficulty: null
        }
      : undefined);

  return {
    id: event._id,
    _id: event._id,
    problem: problemData,
    problemId: event.problemId ?? problem?.problemId ?? null,
    problemTitle: event.problemTitle ?? problem?.title ?? null,
    languageId: event.languageId ?? null,
    language: event.language ?? null,
    verdict: event.verdict ?? null,
    status: event.status ?? 'queued',
    score: typeof event.score === 'number' ? event.score : 0,
    runtimeMs,
    execTimeMs: runtimeMs,
    memoryKB,
    memoryKb: memoryKB,
    submittedAt: createdAt,
    createdAt,
    queuedAt: event.queuedAt ?? createdAt,
    startedAt: event.startedAt ?? null,
    finishedAt: event.finishedAt ?? null,
    userId: event.userId ?? null,
    userName: event.userName ?? null
  };
};

export const applyEventToSubmissionList = (
  list,
  event,
  { maxItems = null, allowInsert = true, problem = null } = {}
) => {
  if (!Array.isArray(list)) {
    return list;
  }
  if (!event) {
    return list;
  }

  const identifier = event._id;
  let updated = list.slice();
  const index = updated.findIndex((item) => (item.id ?? item._id) === identifier);

  if (index >= 0) {
    const existing = updated[index];
    updated[index] = {
      ...existing,
      verdict: event.verdict ?? existing.verdict,
      status: event.status ?? existing.status,
      score: typeof event.score === 'number' ? event.score : existing.score,
      runtimeMs: event.runtimeMs ?? existing.runtimeMs ?? existing.execTimeMs ?? null,
      execTimeMs: event.runtimeMs ?? existing.execTimeMs ?? null,
      memoryKB: event.memoryKB ?? existing.memoryKB ?? existing.memoryKb ?? null,
      memoryKb: event.memoryKB ?? existing.memoryKb ?? null,
      finishedAt: event.finishedAt ?? existing.finishedAt ?? null,
      startedAt: event.startedAt ?? existing.startedAt ?? null,
      queuedAt: event.queuedAt ?? existing.queuedAt ?? existing.createdAt,
      createdAt: event.createdAt ?? existing.createdAt,
      submittedAt: event.createdAt ?? existing.submittedAt ?? existing.createdAt,
      problemTitle: event.problemTitle ?? existing.problemTitle,
      language: event.language ?? existing.language,
      languageId: event.languageId ?? existing.languageId
    };
    return updated;
  }

  if (!allowInsert) {
    return list;
  }

  const row = transformEventToRow(event, { problem });
  if (!row) {
    return list;
  }

  updated = [row, ...updated];
  if (typeof maxItems === 'number' && maxItems > 0 && updated.length > maxItems) {
    updated = updated.slice(0, maxItems);
  }
  return updated;
};

export const buildOptimisticSubmission = ({
  submissionId,
  base,
  problem,
  languageId,
  language,
  sourceLen = 0
}) => {
  const nowIso = new Date().toISOString();

  return {
    ...(base || {}),
    id: submissionId,
    _id: submissionId,
    problem: problem
      ? {
          id: problem._id ?? problem.id ?? null,
          title: problem.title ?? problem.problemTitle ?? null,
          problemId: problem.problemId ?? null,
          difficulty: problem.difficulty ?? null
        }
      : base?.problem,
    problemId: problem?.problemId ?? base?.problemId ?? null,
    problemTitle: problem?.title ?? base?.problemTitle ?? null,
    languageId: languageId ?? base?.languageId ?? null,
    language:
      language ??
      base?.language ??
      (languageId != null ? `language-${languageId}` : null),
    verdict: 'PENDING',
    status: 'queued',
    score: 0,
    runtimeMs: null,
    execTimeMs: null,
    memoryKB: null,
    memoryKb: null,
    submittedAt: nowIso,
    createdAt: nowIso,
    queuedAt: nowIso,
    startedAt: null,
    finishedAt: null,
    testCaseResults: [],
    resultSummary: { score: 0, cases: [] },
    judge0: null,
    sourceLen
  };
};
