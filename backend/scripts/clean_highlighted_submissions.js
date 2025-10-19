/* eslint-disable no-console */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Submission from '../src/models/Submission.js';
import { sanitizeSourceCode, detectHighlightArtifacts } from '../src/utils/sourceSanitizer.js';

dotenv.config({ path: process.env.BACKEND_DOTENV || '.env' });

const parseArgs = () => {
  const args = process.argv.slice(2);
  let dryRun = true;
  let limit = null;

  for (const arg of args) {
    if (arg === '--execute' || arg === '--apply') {
      dryRun = false;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const [, value] = arg.split('=');
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed;
      }
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/clean_highlighted_submissions.js [--dry-run] [--execute] [--limit=N]'
      );
      process.exit(0);
    }
  }

  return { dryRun, limit };
};

const highlightQuery = {
  $or: [
    { sourceCode: { $regex: '<span[^>]+class="[^"]*token', $options: 'i' } },
    { sourceCode: { $regex: "<span[^>]+class='[^']*token", $options: 'i' } },
    { sourceCode: { $regex: '<code[^>]+class="[^"]*language-', $options: 'i' } },
    { sourceCode: { $regex: "<code[^>]+class='[^']*language-", $options: 'i' } },
    { sourceCode: { $regex: '<pre[^>]+class="[^"]*language-', $options: 'i' } },
    { sourceCode: { $regex: "<pre[^>]+class='[^']*language-", $options: 'i' } }
  ]
};

const preview = (value, length = 160) => {
  if (!value) {
    return '';
  }
  const normalized = value.replace(/\s+/g, (match) => (match.includes('\n') ? '\n' : ' '));
  if (normalized.length <= length) {
    return normalized;
  }
  return `${normalized.slice(0, length)}…`;
};

const cleanSubmission = (submission) => {
  const original = submission.sourceCode ?? '';
  const sanitized = sanitizeSourceCode(original);
  const normalizedSource = sanitized.sanitized;
  const normalizedLen = normalizedSource.length;
  const needsUpdate = sanitized.changed || submission.sourceLen !== normalizedLen;

  if (!needsUpdate) {
    return null;
  }

  if (!normalizedSource.trim().length) {
    return {
      id: submission._id.toString(),
      action: 'skip-empty',
      highlightDetected: sanitized.highlightDetected,
      before: original,
      after: normalizedSource
    };
  }

  return {
    id: submission._id.toString(),
    highlightDetected: sanitized.highlightDetected || detectHighlightArtifacts(original),
    before: original,
    after: normalizedSource,
    update: {
      sourceCode: normalizedSource,
      sourceLen: normalizedLen
    }
  };
};

const runDry = async (cursor, limit) => {
  const previews = [];
  let inspected = 0;

  for await (const submission of cursor) {
    const outcome = cleanSubmission(submission);
    inspected += 1;
    if (!outcome || outcome.action === 'skip-empty') {
      continue;
    }

    previews.push({
      id: outcome.id,
      detected: outcome.highlightDetected,
      before: preview(outcome.before),
      after: preview(outcome.after)
    });

    if (limit && previews.length >= limit) {
      break;
    }
  }

  return { inspected, previews };
};

const runExecute = async (cursor, limit) => {
  let inspected = 0;
  let updated = 0;
  const skipped = [];

  for await (const submission of cursor) {
    const outcome = cleanSubmission(submission);
    inspected += 1;

    if (!outcome) {
      continue;
    }

    if (outcome.action === 'skip-empty') {
      skipped.push(outcome.id);
      continue;
    }

    await Submission.updateOne({ _id: submission._id }, { $set: outcome.update });
    updated += 1;

    if (limit && updated >= limit) {
      break;
    }
  }

  return { inspected, updated, skipped };
};

const main = async () => {
  const { dryRun, limit } = parseArgs();
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wboj';

  await mongoose.connect(mongoUri);

  const cursor = Submission.find(highlightQuery)
    .select('_id sourceCode sourceLen language languageId createdAt')
    .sort({ createdAt: -1 })
    .cursor();

  if (dryRun) {
    const { inspected, previews } = await runDry(cursor, limit);
    console.log(`Inspected ${inspected} submission(s). Potential updates: ${previews.length}.`);
    if (previews.length) {
      console.log('--- Dry-run preview ---');
      for (const entry of previews) {
        console.log(`Submission ${entry.id}`);
        console.log(`  detected: ${entry.detected ? 'yes' : 'no'}`);
        console.log(`  before: ${entry.before}`);
        console.log(`  after:  ${entry.after}`);
      }
    } else {
      console.log('No submissions requiring cleanup were detected by the query.');
    }
  } else {
    const { inspected, updated, skipped } = await runExecute(cursor, limit);
    console.log(
      `Inspected ${inspected} submission(s). Updated ${updated}. Skipped ${skipped.length} empty sources.`
    );
    if (skipped.length) {
      console.log('Skipped submission ids (empty after sanitization):', skipped.join(', '));
    }
  }

  await mongoose.disconnect();
};

main().catch((error) => {
  console.error('Cleanup failed', error);
  process.exit(1);
});
