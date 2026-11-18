import { readFileSync } from 'node:fs';
import AdmZip from 'adm-zip';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/judge0Service.js', () => ({
  fetchJudge0Languages: vi.fn(async () => [{ id: 62, name: 'Java' }, { id: 89, name: 'Multi-file program' }]),
  runJudge0Submission: vi.fn(async ({ additionalFiles, expectedOutput, sourceCode }) => {
    const zip = additionalFiles ? new AdmZip(Buffer.from(additionalFiles, 'base64')) : null;
    const code = zip?.readAsText('Rectangle.java') || sourceCode || '';
    const main = zip?.readAsText('Main.java') || '';
    const ce = code.includes('setWidths') && main.includes('setWidth(');
    const wa = code.includes('static int width') && main.includes('Rectangle b=');
    return { status: { id: ce ? 6 : wa ? 4 : 3, description: ce ? 'Compilation Error' : wa ? 'Wrong Answer' : 'Accepted' },
      stdout: Buffer.from(wa ? '28\n42\n' : expectedOutput || '').toString('base64'),
      compile_output: ce ? Buffer.from('Main.java:1: error: cannot find symbol\nSECRET_TEACHER_CODE').toString('base64') : null,
      time: '0.01', memory: 10000 };
  })
}));
import app from '../src/app.js';
import Problem from '../src/models/Problem.js';
import Submission from '../src/models/Submission.js';
import { validateProblemMode, isJavaClassName } from '../src/services/javaClassService.js';
import { runJudge0Submission } from '../src/services/judge0Service.js';
import { authenticateAsAdmin, authenticateAsUser, authHeader } from './utils.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/rectangle.json', import.meta.url)));
let mongo;
let admin, student, problem;
const ids = [];
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
const complete = async (id) => {
  for (let i = 0; i < 300; i++) {
    const doc = await Submission.findById(id);
    if (doc && !['queued', 'running'].includes(doc.status)) return doc;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Grading did not finish');
};

describe('Java Class Writing', () => {
  it('validates identifiers, points, main and intentionally empty expected stdout', () => {
    for (const name of ['Main', 'class', '../Rectangle', 'Rectangle;echo', '9Foo']) expect(isJavaClassName(name)).toBe(false);
    const problem = { mode: 'java_class', className: 'Rectangle', testCases: [{ ...fixture.groups[0], points: 100, output: '' }] };
    expect(validateProblemMode(problem)).toBeNull();
    expect(validateProblemMode({ ...problem, testCases: fixture.groups.slice(0, 1) })).toMatch(/100/);
    expect(validateProblemMode({ ...problem, testCases: [{ input: 'class Main {}', points: 100 }] })).toMatch(/main/);
  });
  it('authors, queues, grades, protects private data, and rejudges the same submission without duplicate accounting', async () => {
    admin = await authenticateAsAdmin();
    student = await authenticateAsUser();
    const draft = { title: 'Rectangle', statementMd: 'Implement Rectangle(int width, int height), void setWidth(int), int getArea().', mode: 'java_class', className: 'Rectangle', starterCode: 'public class Rectangle {}', testCases: fixture.groups, judge0LanguageIds: [62] };
    const bad = await request(app).post('/api/problems').set(authHeader(student.tokens.accessToken)).send(draft);
    expect(bad.status).toBe(403);
    const created = await request(app).post('/api/problems').set(authHeader(admin.tokens.accessToken)).send(draft);
    expect(created.status).toBe(201);
    problem = created.body;
    const publicProblem = await request(app).get(`/api/problems/${problem.problemId}`);
    expect(publicProblem.body.testCases).toBeUndefined();
    expect(publicProblem.body.publicTestGroups).toHaveLength(1);
    expect(JSON.stringify(publicProblem.body)).not.toContain('Rectangle b=');
    const reject = await request(app).post('/api/submissions').set(authHeader(student.tokens.accessToken)).send({ problemId: problem._id, languageId: 71, sourceCode: 'print(1)' });
    expect(reject.status).toBe(400);
  });
  it.each([
    [fixture.correct, 100, 'AC'],
    [fixture.correct.replace('setWidth(int w)', 'setWidths(int w)'), 30, 'CE'],
    [fixture.correct.replace('private int width, height;', 'private static int width; private int height;'), 60, 'PARTIAL']
  ])('grades Rectangle as %s with %i points and %s', async (code, score, verdict) => {
      const response = await request(app).post('/api/submissions').set(authHeader(student.tokens.accessToken)).send({ problemId: problem._id, languageId: 62, sourceCode: code });
      expect(response.status).toBe(202);
      const id = response.body.submissionId || response.body.id || response.body.submission?._id;
      ids.push(id);
      const result = await complete(id);
      expect(result.score).toBe(score);
      expect(result.verdict).toBe(verdict);
      for (const token of [null, student.tokens.accessToken]) {
        let req = request(app).get(`/api/submissions/${id}`);
        if (token) req = req.set(authHeader(token));
        const detail = (await req).body.submission;
        const cases = JSON.stringify(detail.testCaseResults);
        for (const secret of ['SECRET_TEACHER_CODE', 'Rectangle b=', 'stdout', 'stderr', '"output"', '"input"']) expect(cases).not.toContain(secret);
        if (verdict === 'CE') expect(cases).toContain('constructor and public method signatures');
      }
  });
  it('rejudges twice without duplicate accounting', async () => {
    for (let i = 0; i < 2; i++) {
      const rerun = await request(app).patch(`/api/submissions/${ids[0]}/resubmit`).set(authHeader(student.tokens.accessToken));
      expect(rerun.body).toHaveProperty('submission');
      expect(rerun.status).toBe(200);
      expect(rerun.body.submission._id).toBe(ids[0]);
      expect((await complete(ids[0])).score).toBe(100);
    }
    expect(await Submission.countDocuments({ problem: problem._id })).toBe(3);
    const counters = await Problem.findById(problem._id);
    expect(counters.submissionCount).toBe(3);
    expect(counters.acceptedSubmissionCount).toBe(1);
    const payload = runJudge0Submission.mock.calls.find(([arg]) => arg.additionalFiles && new AdmZip(Buffer.from(arg.additionalFiles, 'base64')).getEntry('Rectangle.java'))[0];
    expect(payload.languageId).toBe(89);
    expect(payload.enableNetwork).toBe(false);
    const zip = new AdmZip(Buffer.from(payload.additionalFiles, 'base64'));
    expect(zip.getEntries().map((entry) => entry.entryName).sort()).toEqual(['Main.java', 'Rectangle.java', 'compile', 'run']);
  });
});

it('redacts private results from student list APIs', async () => {
  for (const path of ['/api/submissions/mine', '/api/submissions', `/api/problems/${problem.problemId}/submissions?scope=all`]) {
    const response = await request(app).get(path).set(authHeader(student.tokens.accessToken));
    expect(response.status).toBe(200);
    const json = JSON.stringify(response.body);
    for (const secret of ['SECRET_TEACHER_CODE', 'Rectangle b=', 'rawPayload', '"stdout"', '"stderr"']) expect(json).not.toContain(secret);
  }
});

it('distinguishes runtime errors, timeouts and Judge0 failures', async () => {
  const { evaluateSubmissionRun } = await import('../src/services/submissionService.js');
  const problem = { mode: 'java_class', className: 'Rectangle', testCases: fixture.groups, memoryLimit: 512 };
  const evaluate = () => evaluateSubmissionRun({ submission: { languageId: 62, sourceCode: fixture.correct }, problem });
  runJudge0Submission.mockResolvedValueOnce({ status: { id: 5 }, stdout: '' });
  expect((await evaluate()).verdict).toBe('TLE');
  runJudge0Submission.mockResolvedValueOnce({ status: { id: 11 }, stdout: '' });
  expect((await evaluate()).verdict).toBe('RTE');
  runJudge0Submission.mockResolvedValueOnce({ status: { id: 13 }, message: 'private server diagnostic' });
  await expect(evaluate()).rejects.toMatchObject({ code: 'JUDGE0_SERVICE_FAILURE' });
  runJudge0Submission.mockRejectedValueOnce(new Error('connection refused'));
  await expect(evaluate()).rejects.toThrow('connection refused');
});

it('accepts an intentionally empty expected output when Judge0 returns WA for null stdout', async () => {
  const { evaluateSubmissionRun } = await import('../src/services/submissionService.js');
  runJudge0Submission.mockResolvedValueOnce({ status: { id: 4 }, stdout: null });
  const result = await evaluateSubmissionRun({ submission: { languageId: 62, sourceCode: fixture.correct },
    problem: { mode: 'java_class', className: 'Rectangle', memoryLimit: 512,
      testCases: [{ input: 'public class Main { public static void main(String[] args) {} }', output: '', points: 100 }] } });
  expect(result.score).toBe(100);
  expect(result.verdict).toBe('AC');
});

it('returns a clear configuration error when multi-file support is absent', async () => {
  const { fetchJudge0Languages } = await import('../src/services/judge0Service.js');
  const { ensureJavaClassSupport } = await import('../src/services/javaClassService.js');
  const previous = process.env.JUDGE0_URL;
  process.env.JUDGE0_URL = 'http://unconfigured.example';
  fetchJudge0Languages.mockResolvedValueOnce([{ id: 62, name: 'Java' }]);
  try {
    await expect(ensureJavaClassSupport()).rejects.toMatchObject({ code: 'JAVA_CLASS_CONFIGURATION', status: 503 });
  } finally {
    if (previous === undefined) delete process.env.JUDGE0_URL;
    else process.env.JUDGE0_URL = previous;
  }
});
