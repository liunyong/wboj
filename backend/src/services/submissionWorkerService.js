import Submission from '../models/Submission.js';
import { env } from '../config/env.js';
import { processSubmission } from '../controllers/submissionController.js';
import { reconcilePendingSubmissionAccounting } from './submissionAccountingService.js';

let timer = null;
let polling = false;

const recoverStaleSubmissions = async () => {
  const staleBefore = new Date(Date.now() - env.staleSubmissionMs);
  await Submission.updateMany(
    {
      deletedAt: null,
      status: 'running',
      $or: [{ startedAt: { $lt: staleBefore } }, { startedAt: null }]
    },
    {
      $set: { status: 'queued', startedAt: null, lastRunAt: new Date() }
    }
  );
};

const poll = async () => {
  if (polling) return;
  polling = true;
  try {
    await recoverStaleSubmissions();
    await reconcilePendingSubmissionAccounting();
    const queued = await Submission.find({ status: 'queued', deletedAt: null })
      .sort({ queuedAt: 1 })
      .limit(10)
      .select('_id')
      .lean();
    await Promise.all(queued.map(({ _id }) => processSubmission(_id)));
  } catch (error) {
    console.error('Submission worker poll failed', error);
  } finally {
    polling = false;
  }
};

export const startSubmissionWorker = () => {
  if (timer) return;
  void poll();
  timer = setInterval(() => void poll(), env.workerPollMs);
  timer.unref?.();
};

export const stopSubmissionWorker = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

export { recoverStaleSubmissions };
