import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockedLanguages = [
  { id: 71, name: 'Python (3.10)' },
  { id: 63, name: 'JavaScript (Node)' }
];

vi.mock('../src/services/judge0Service.js', async () => ({
  runJudge0Submission: vi.fn(async ({ stdin }) => {
    const [a = '0', b = '0'] = String(stdin).split(/\s+/);
    const sum = Number(a) + Number(b);
    return {
      stdout: Buffer.from(String(sum), 'utf8').toString('base64'),
      stderr: null,
      compile_output: null,
      message: null,
      status: { id: 3, description: 'Accepted' },
      time: '0.01',
      memory: 10_240
    };
  }),
  fetchJudge0Languages: vi.fn(async () => mockedLanguages),
  clearLanguageCache: vi.fn()
}));

const { runJudge0Submission } = await import('../src/services/judge0Service.js');

import app from '../src/app.js';
import Problem from '../src/models/Problem.js';
import Submission from '../src/models/Submission.js';
import UserStatsDaily from '../src/models/UserStatsDaily.js';
import { authenticateAsAdmin, authenticateAsUser, authHeader } from './utils.js';

let mongoServer;

let problemIdCounter = 100000;
let problemNumberCounter = 1;

const buildProblem = (overrides = {}) => {
  const problemId = overrides.problemId ?? problemIdCounter++;
  const problemNumber = overrides.problemNumber ?? problemNumberCounter++;
  const statement = overrides.statement ?? 'Sum two numbers.';
  const statementMd = overrides.statementMd ?? statement;

  return {
    title: 'Submission Problem',
    statement,
    statementMd,
    difficulty: 'BASIC',
    problemId,
    problemNumber,
    judge0LanguageIds: [71],
    author: new mongoose.Types.ObjectId(),
    isPublic: true,
    algorithms: ['Arithmetic'],
    testCases: [
      { input: '1 2', output: '3', points: 1 },
      { input: '5 7', output: '12', points: 1 }
    ],
    ...overrides
  };
};

const waitForSubmissionCompletion = async (submissionId, timeoutMs = 3000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const doc = await Submission.findById(submissionId);
    if (doc && !['queued', 'running'].includes(doc.status)) {
      return doc;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Submission ${submissionId} did not finish within ${timeoutMs}ms`);
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { ip: '127.0.0.1', bindIp: '127.0.0.1', port: 0 }
  });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Problem.deleteMany({});
  await Submission.deleteMany({});
  await UserStatsDaily.deleteMany({});
  vi.clearAllMocks();
  problemIdCounter = 100000;
  problemNumberCounter = 1;
});

describe('Submission routes with auth', () => {
  it('creates a submission for an authenticated user', async () => {
    const { user, tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem({ problemId: 100000 }));

    const response = await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({
        problemId: problem._id.toString(),
        languageId: 71,
        sourceCode: 'print(sum(map(int, input().split())))'
      });

    expect(response.status).toBe(202);
    expect(response.body.submissionId).toBeDefined();
    expect(response.body.initialStatus).toBe('queued');

    const submissionDoc = await waitForSubmissionCompletion(response.body.submissionId);

    expect(submissionDoc.verdict).toBe('AC');
    expect(submissionDoc.status).toBe('accepted');
    expect(submissionDoc.score).toBe(100);
    expect(submissionDoc.language).toBe('Python (3.10)');
    expect(runJudge0Submission).toHaveBeenCalledTimes(2);
    for (const [params] of runJudge0Submission.mock.calls) {
      expect(params.memoryLimit).toBe(128 * 1024);
    }

    const updatedProblem = await Problem.findById(problem._id);
    expect(updatedProblem.submissionCount).toBe(1);
    expect(updatedProblem.acceptedSubmissionCount).toBe(1);

    const dailyStats = await UserStatsDaily.findOne({ user: user.id });
    expect(dailyStats.submitCount).toBe(1);
    expect(dailyStats.acCount).toBe(1);
  });

  it('sanitizes highlighted HTML artifacts before persisting submissions', async () => {
    const { tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem({ problemId: 100001 }));

    const highlighted =
      'if (m &lt; <span class="token number">3</span>) {\n  <span class="token keyword">return</span> m;\n}';

    const response = await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({
        problemId: problem._id.toString(),
        languageId: 71,
        sourceCode: highlighted
      });

    expect(response.status).toBe(202);
    const submissionId = response.body.submissionId;
    expect(submissionId).toBeDefined();

    const storedDoc = await Submission.findById(submissionId).lean();
    expect(storedDoc.sourceCode).toBe('if (m < 3) {\n  return m;\n}');
    expect(storedDoc.sourceLen).toBe(storedDoc.sourceCode.length);
    expect(storedDoc.language).toBe('Python (3.10)');

    const detailResponse = await request(app)
      .get(`/api/submissions/${submissionId}`)
      .set(authHeader(tokens.accessToken));

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.submission.source).toBe('if (m < 3) {\n  return m;\n}');
    expect(detailResponse.body.submission.language).toBe('Python (3.10)');
  });

  it('rejects submissions with disallowed languages', async () => {
    const { tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem({ judge0LanguageIds: [63] }));

    const response = await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'print(0)' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_LANGUAGE');
  });

  it('rejects submissions that sanitize to empty source', async () => {
    const { tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem({ problemId: 100002 }));

    const response = await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({
        problemId: problem._id.toString(),
        languageId: 71,
        sourceCode: '<span class="token keyword"></span>'
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_SOURCE');
  });

  it('lists submissions for the authenticated user only', async () => {
    const { user, tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem());

    const createResponse = await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    expect(createResponse.status).toBe(202);
    await waitForSubmissionCompletion(createResponse.body.submissionId);

    const myResponse = await request(app)
      .get('/api/submissions/mine')
      .set(authHeader(tokens.accessToken));

    expect(myResponse.status).toBe(200);
    expect(myResponse.body.items).toHaveLength(1);
    expect(myResponse.body.items[0].problem.problemId).toBe(problem.problemId);
    expect(myResponse.body.items[0].problem.title).toBe(problem.title);
    expect(myResponse.body.items[0].status).toBe('accepted');
    expect(myResponse.body.items[0].language).toBe('Python (3.10)');
    expect(myResponse.body.items[0].user).toBeUndefined();

    const globalResponse = await request(app)
      .get('/api/submissions')
      .set(authHeader(tokens.accessToken));
    expect(globalResponse.status).toBe(200);
    expect(globalResponse.body.items).toBeInstanceOf(Array);
    expect(globalResponse.body.items.length).toBeGreaterThanOrEqual(1);
    expect(globalResponse.body.items[0]._id).toBeDefined();
    expect(globalResponse.body.items[0].id).toBeDefined();
    expect(globalResponse.body.items[0].userName).toBeDefined();
    expect(globalResponse.body.items[0].status).toBeDefined();
    expect(globalResponse.body.items[0].language).toBe('Python (3.10)');
    expect(globalResponse.body.items[0]).not.toHaveProperty('source');
    expect(globalResponse.body.page).toBe(1);
  });

  it('allows owners to fetch their submission detail', async () => {
    const { tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem());

    const createResponse = await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    expect(createResponse.status).toBe(202);
    const submissionId = createResponse.body.submissionId;

    await waitForSubmissionCompletion(submissionId);

    const detailResponse = await request(app)
      .get(`/api/submissions/${submissionId}`)
      .set(authHeader(tokens.accessToken));

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.submission._id).toBe(submissionId);
    expect(detailResponse.body.submission.source).toBe('code');
    expect(detailResponse.body.submission.language).toBe('Python (3.10)');
    expect(detailResponse.body.submission.canViewSource).toBe(true);
  });

  it("hides source when accessing another user's submission detail", async () => {
    const ownerSession = await authenticateAsUser();
    const otherSession = await authenticateAsUser();
    const problem = await Problem.create(buildProblem());

    const createResponse = await request(app)
      .post('/api/submissions')
      .set(authHeader(ownerSession.tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    expect(createResponse.status).toBe(202);
    const submissionId = createResponse.body.submissionId;

    await waitForSubmissionCompletion(submissionId);

    const forbiddenResponse = await request(app)
      .get(`/api/submissions/${submissionId}`)
      .set(authHeader(otherSession.tokens.accessToken));

    expect(forbiddenResponse.status).toBe(200);
    expect(forbiddenResponse.body.submission._id).toBe(submissionId);
    expect(forbiddenResponse.body.submission.source).toBeUndefined();
    expect(forbiddenResponse.body.submission.canViewSource).toBe(false);
  });

  it('lists problem submissions with scope filtering', async () => {
    const ownerSession = await authenticateAsUser();
    const otherSession = await authenticateAsUser();
    const problem = await Problem.create(buildProblem({ problemId: 200123 }));

    const ownerSubmission = await request(app)
      .post('/api/submissions')
      .set(authHeader(ownerSession.tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'owner' });
    expect(ownerSubmission.status).toBe(202);
    await waitForSubmissionCompletion(ownerSubmission.body.submissionId);

    const otherSubmission = await request(app)
      .post('/api/submissions')
      .set(authHeader(otherSession.tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'other' });
    expect(otherSubmission.status).toBe(202);
    await waitForSubmissionCompletion(otherSubmission.body.submissionId);

    const mineResponse = await request(app)
      .get(`/api/problems/${problem.problemId}/submissions`)
      .set(authHeader(ownerSession.tokens.accessToken));

    expect(mineResponse.status).toBe(200);
    expect(mineResponse.body.scope).toBe('mine');
    expect(mineResponse.body.items).toHaveLength(1);
    expect(mineResponse.body.items[0].userId).toBe(ownerSession.user.id);
    expect(mineResponse.body.items[0].language).toBe('Python (3.10)');
    expect(mineResponse.body.items[0]).not.toHaveProperty('source');

    const allResponse = await request(app)
      .get(`/api/problems/${problem.problemId}/submissions?scope=all`)
      .set(authHeader(ownerSession.tokens.accessToken));

    expect(allResponse.status).toBe(200);
    expect(allResponse.body.scope).toBe('all');
    expect(allResponse.body.items.length).toBeGreaterThanOrEqual(2);
    const userIds = allResponse.body.items.map((item) => item.userId).sort();
    expect(userIds).toContain(ownerSession.user.id);
    expect(userIds).toContain(otherSession.user.id);
    allResponse.body.items.forEach((item) => {
      expect(item).not.toHaveProperty('source');
      expect(item.problemId).toBe(problem.problemId);
      expect(item.language).toBe('Python (3.10)');
    });
  });

  it('prevents unauthorized access to private problem submissions', async () => {
    const authorSession = await authenticateAsUser();
    const otherSession = await authenticateAsUser();
    const privateProblem = await Problem.create(
      buildProblem({
        problemId: 200456,
        isPublic: false,
        author: new mongoose.Types.ObjectId(authorSession.user.id)
      })
    );

    const authorResponse = await request(app)
      .get(`/api/problems/${privateProblem.problemId}/submissions`)
      .set(authHeader(authorSession.tokens.accessToken));
    expect(authorResponse.status).toBe(200);

    const forbiddenResponse = await request(app)
      .get(`/api/problems/${privateProblem.problemId}/submissions`)
      .set(authHeader(otherSession.tokens.accessToken));
    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.code).toBe('FORBIDDEN');
  });

  it('allows owners to resubmit their submission', async () => {
    const userSession = await authenticateAsUser();
    const problem = await Problem.create(buildProblem());

    const createResponse = await request(app)
      .post('/api/submissions')
      .set(authHeader(userSession.tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    expect(createResponse.status).toBe(202);
    const submissionId = createResponse.body.submissionId;
    await waitForSubmissionCompletion(submissionId);

    vi.clearAllMocks();

    const resubmitResponse = await request(app)
      .patch(`/api/submissions/${submissionId}/resubmit`)
      .set(authHeader(userSession.tokens.accessToken));

    expect(resubmitResponse.status).toBe(200);
    expect(resubmitResponse.body.submission._id).toBe(submissionId);
    expect(resubmitResponse.body.submission.verdict).toBe('AC');
    expect(resubmitResponse.body.submission.runs.length).toBe(2);

    const resubmitted = await Submission.findById(submissionId);
    expect(resubmitted.user.toString()).toBe(userSession.user.id);
    expect(resubmitted.problemId).toBe(problem.problemId);
    expect(resubmitted.status).toBe('accepted');
    expect(resubmitted.runs).toHaveLength(2);

    expect(runJudge0Submission).toHaveBeenCalledTimes(2);

    const dailyStats = await UserStatsDaily.findOne({ user: userSession.user.id });
    expect(dailyStats.submitCount).toBe(1);
    expect(dailyStats.acCount).toBe(1);

    const totalSubmissions = await Submission.countDocuments();
    expect(totalSubmissions).toBe(1);
  });

  it('allows admins to resubmit on behalf of the original user', async () => {
    const ownerSession = await authenticateAsUser();
    const adminSession = await authenticateAsAdmin();
    const problem = await Problem.create(buildProblem());

    const createResponse = await request(app)
      .post('/api/submissions')
      .set(authHeader(ownerSession.tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    expect(createResponse.status).toBe(202);
    const submissionId = createResponse.body.submissionId;
    await waitForSubmissionCompletion(submissionId);

    vi.clearAllMocks();

    const resubmitResponse = await request(app)
      .patch(`/api/submissions/${submissionId}/resubmit`)
      .set(authHeader(adminSession.tokens.accessToken));

    expect(resubmitResponse.status).toBe(200);
    expect(resubmitResponse.body.submission._id).toBe(submissionId);
    expect(resubmitResponse.body.submission.verdict).toBe('AC');
    expect(resubmitResponse.body.submission.runs.length).toBe(2);

    const resubmitted = await Submission.findById(submissionId);
    expect(resubmitted.user.toString()).toBe(ownerSession.user.id);
    expect(resubmitted.problemId).toBe(problem.problemId);
    expect(resubmitted.status).toBe('accepted');
    expect(resubmitted.runs).toHaveLength(2);

    expect(runJudge0Submission).toHaveBeenCalledTimes(2);

    const dailyStats = await UserStatsDaily.findOne({ user: ownerSession.user.id });
    expect(dailyStats.submitCount).toBe(1);
    expect(dailyStats.acCount).toBe(1);

    const totalSubmissions = await Submission.countDocuments();
    expect(totalSubmissions).toBe(1);
  });

  it("prevents users from resubmitting someone else's submission", async () => {
    const ownerSession = await authenticateAsUser();
    const otherSession = await authenticateAsUser();
    const problem = await Problem.create(buildProblem());

    const createResponse = await request(app)
      .post('/api/submissions')
      .set(authHeader(ownerSession.tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    expect(createResponse.status).toBe(202);
    const submissionId = createResponse.body.submissionId;
    await waitForSubmissionCompletion(submissionId);

    const resubmitResponse = await request(app)
      .patch(`/api/submissions/${submissionId}/resubmit`)
      .set(authHeader(otherSession.tokens.accessToken));

    expect(resubmitResponse.status).toBe(403);
  });

  it('prevents unauthenticated submissions', async () => {
    const problem = await Problem.create(buildProblem());

    const response = await request(app).post('/api/submissions').send({
      problemId: problem._id.toString(),
      languageId: 71,
      sourceCode: 'print(0)'
    });

    expect(response.status).toBe(401);
  });
});

describe('Submission routes public access', () => {
  it('allows guests to list submissions', async () => {
    const { tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem());

    const createResponse = await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    expect(createResponse.status).toBe(202);
    await waitForSubmissionCompletion(createResponse.body.submissionId);

    const guestResponse = await request(app).get('/api/submissions');
    expect(guestResponse.status).toBe(200);
    expect(Array.isArray(guestResponse.body.items)).toBe(true);
    expect(guestResponse.body.items.length).toBeGreaterThanOrEqual(1);
    expect(guestResponse.body.items[0]).not.toHaveProperty('source');
    expect(guestResponse.body.page).toBe(1);
  });

  it('allows guests to view submission metadata without source code', async () => {
    const { tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem());

    const createResponse = await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    expect(createResponse.status).toBe(202);
    const submissionId = createResponse.body.submissionId;
    await waitForSubmissionCompletion(submissionId);

    const detailResponse = await request(app).get(`/api/submissions/${submissionId}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.submission).toBeDefined();
    expect(detailResponse.body.submission._id).toBe(submissionId);
    expect(detailResponse.body.submission.canViewSource).toBe(false);
    expect(detailResponse.body.submission.source).toBeUndefined();
  });
});
