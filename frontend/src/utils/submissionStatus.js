export const STATUS_LABELS = {
  queued: 'Queued',
  running: 'Grading…',
  accepted: 'Accepted',
  wrong_answer: 'Wrong Answer',
  tle: 'Time Limit',
  rte: 'Runtime Error',
  ce: 'Compile Error',
  failed: 'Failed'
};

export const STATUS_CLASS = {
  queued: 'status-queued',
  running: 'status-running',
  accepted: 'status-accepted',
  wrong_answer: 'status-wrong-answer',
  tle: 'status-tle',
  rte: 'status-rte',
  ce: 'status-ce',
  failed: 'status-failed'
};

export const STATUS_OPTIONS = [
  { value: 'queued', label: STATUS_LABELS.queued },
  { value: 'running', label: STATUS_LABELS.running },
  { value: 'accepted', label: STATUS_LABELS.accepted },
  { value: 'wrong_answer', label: STATUS_LABELS.wrong_answer },
  { value: 'tle', label: STATUS_LABELS.tle },
  { value: 'rte', label: STATUS_LABELS.rte },
  { value: 'ce', label: STATUS_LABELS.ce },
  { value: 'failed', label: STATUS_LABELS.failed }
];

export const PENDING_STATUSES = new Set(['queued', 'running']);

export const isPendingStatus = (status) => PENDING_STATUSES.has(status);
