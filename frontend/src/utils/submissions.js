import { isPendingStatus } from './submissionStatus.js';

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
    lastRunAt:
      event.lastRunAt ?? event.finishedAt ?? event.startedAt ?? event.createdAt ?? createdAt,
    userId: event.userId ?? null,
    userName: event.userName ?? null
  };
};

const getSubmissionProblemId = (submission) =>
  submission?.problemId ??
  submission?.problem?.problemId ??
  submission?.problem?.id ??
  submission?.problem?._id ??
  null;

const getSubmissionUserId = (submission) =>
  submission?.userId ??
  submission?.user?.id ??
  submission?.user?._id ??
  null;

export const isSubmissionPending = (submission) =>
  Boolean(submission && isPendingStatus(submission.status));

export const getPendingProblemIdSet = (submissions, userId) => {
  const pendingIds = new Set();
  if (!Array.isArray(submissions)) {
    return pendingIds;
  }
  submissions.forEach((submission) => {
    if (!isSubmissionPending(submission)) {
      return;
    }
    const ownerId = getSubmissionUserId(submission);
    if (userId && ownerId && String(ownerId) !== String(userId)) {
      return;
    }
    const problemId = getSubmissionProblemId(submission);
    if (problemId != null) {
      pendingIds.add(String(problemId));
    }
  });
  return pendingIds;
};

export const hasPendingSubmissionForProblem = ({ submissions, problemId, userId }) => {
  if (!problemId) {
    return false;
  }
  const pendingIds = getPendingProblemIdSet(submissions, userId);
  return pendingIds.has(String(problemId));
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
      lastRunAt:
        event.lastRunAt ?? existing.lastRunAt ?? event.finishedAt ?? existing.finishedAt ?? null,
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
    lastRunAt: null,
    testCaseResults: [],
    resultSummary: { score: 0, cases: [] },
    judge0: null,
    sourceLen
  };
};

export const detailToEvent = (detail) => {
  if (!detail) {
    return null;
  }

  return {
    _id: detail._id,
    id: detail._id,
    userId: detail.userId ?? null,
    userName: detail.userName ?? null,
    problemId: detail.problemId ?? null,
    problemTitle: detail.problemTitle ?? null,
    languageId: detail.languageId ?? null,
    language: detail.language ?? null,
    status: detail.status ?? null,
    verdict: detail.verdict ?? null,
    score: detail.score ?? null,
    runtimeMs: detail.runtimeMs ?? detail.execTimeMs ?? null,
    memoryKB: detail.memoryKB ?? detail.memoryKb ?? null,
    createdAt: detail.createdAt ?? detail.queuedAt ?? null,
    queuedAt: detail.queuedAt ?? null,
    startedAt: detail.startedAt ?? null,
    finishedAt: detail.finishedAt ?? null,
    lastRunAt: detail.lastRunAt ?? detail.finishedAt ?? null
  };
};
