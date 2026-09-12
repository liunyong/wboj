import axios from 'axios';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import Problem from '../src/models/Problem.js';
import Submission from '../src/models/Submission.js';
import FirstSolve from '../src/models/FirstSolve.js';
import RatingProfile from '../src/models/RatingProfile.js';
import Season from '../src/models/Season.js';
import SeasonWriteLock from '../src/models/SeasonWriteLock.js';
import { backfillRatings, finalizeEndedSeasons, getRatingProfile, recordFirstAccept, reconcileRatingSubmissions } from '../src/services/ratingService.js';
import { authHeader, authenticateAsAdmin, authenticateAsUser } from './utils.js';

let mongo;
let admin;
let user;
let nextProblemId;
const now = Date.now();
const ago = (days) => new Date(now - days * 86400000);

const makeProblem = async (difficultyRating = 1000) => {
  const problemId = nextProblemId++;
  return Problem.create({ problemId, problemNumber: problemId, title: `Problem ${problemId}`,
    statement: 'Add A and B', inputFormat: 'Two integers', outputFormat: 'Their sum', constraints: 'A, B <= 100',
    samples: [{ input: '1 2', output: '3' }], testCases: [{ input: 'secret input', output: 'secret output' }], difficultyRating });
};
const accept = async (problem, date = ago(2), owner = user.user.id) => {
  const submission = await Submission.create({ user: owner, problem: problem._id, problemId: problem.problemId,
    problemTitle: problem.title, languageId: 71, sourceCode: 'private solution', status: 'accepted', verdict: 'AC',
    submittedAt: date, finishedAt: date, firstAcceptedAt: date, ratingPending: true });
  await reconcileRatingSubmissions();
  return submission;
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([FirstSolve.init(), RatingProfile.init(), Season.init(), SeasonWriteLock.init()]);
  admin = await authenticateAsAdmin();
  user = await authenticateAsUser();
}, 30000);
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  nextProblemId = 100000;
  await Promise.all([Problem.deleteMany({}), Submission.deleteMany({}), FirstSolve.deleteMany({}), RatingProfile.deleteMany({}), Season.deleteMany({}), SeasonWriteLock.deleteMany({})]);
});
afterAll(async () => { vi.unstubAllEnvs(); await mongoose.disconnect(); await mongo.stop(); });

describe('Ratings and first accepts', () => {
  it('deduplicates concurrent accepts and excludes unrated solves, retries and WA from history', async () => {
    const problem = await makeProblem(4000);
    const first = await accept(problem);
    await Promise.all([recordFirstAccept(first), recordFirstAccept(first), recordFirstAccept(first)]);
    await accept(problem, ago(1));
    await accept(await makeProblem(null));
    await Submission.updateOne({ _id: first._id }, { $set: { verdict: 'WA', deletedAt: new Date() } });
    const profile = await getRatingProfile(user.user.id);
    expect(profile.overall).toMatchObject({ rating: 112, solvedCount: 2, ratedSolvedCount: 1 });
    expect(profile.overall.history).toHaveLength(1);
    expect(await FirstSolve.countDocuments({ problem: problem._id })).toBe(1);
  });

  it('counts lifetime first AC using half-open UTC season boundaries', async () => {
    const season = await Season.create({ name: 'Current', startDate: ago(10), endDate: ago(-10) });
    const past = await makeProblem();
    await accept(past, ago(11));
    await accept(past, ago(1));
    await accept(await makeProblem(), season.startDate);
    const profile = await getRatingProfile(user.user.id);
    expect(profile.overall.solvedCount).toBe(2);
    expect(profile.currentSeason).toMatchObject({ rating: 112, solvedCount: 1, rank: 1 });
    const boundary = await Season.create({ name: 'Past', startDate: ago(20), endDate: ago(10) });
    await finalizeEndedSeasons();
    const archived = await Season.findById(boundary._id).lean();
    expect(archived.results[0].solvedCount).toBe(1);
  });

  it('keeps all distinct simultaneous first accepts in the same portfolio', async () => {
    const problems = await Promise.all(Array.from({ length: 4 }, () => makeProblem()));
    await Promise.all(problems.map((problem) => recordFirstAccept({
      user: user.user.id, problem: problem._id, problemId: problem.problemId, firstAcceptedAt: new Date()
    })));
    expect((await getRatingProfile(user.user.id)).overall).toMatchObject({ rating: 448, solvedCount: 4 });
  });

  it('recovers a saved first accept after a profile write fails without duplicating history', async () => {
    const problem = await makeProblem();
    await getRatingProfile(user.user.id);
    const submission = await Submission.create({ user: user.user.id, problem: problem._id, problemId: problem.problemId,
      languageId: 71, sourceCode: 'code', verdict: 'AC', firstAcceptedAt: ago(2), ratingPending: true });
    const update = vi.spyOn(RatingProfile, 'findOneAndUpdate').mockReturnValueOnce({ lean: () => Promise.reject(new Error('Temporary database failure')) });
    await expect(reconcileRatingSubmissions()).rejects.toThrow('Temporary database failure');
    expect((await Submission.findById(submission._id)).ratingPending).toBe(true);
    expect(await FirstSolve.countDocuments()).toBe(1);
    update.mockRestore();
    await reconcileRatingSubmissions();
    expect((await getRatingProfile(user.user.id)).overall.history).toHaveLength(1);
    expect((await Submission.findById(submission._id)).ratingPending).toBe(false);
  });

  it('backfills the earliest retained AC even after a later WA and is safe to rerun', async () => {
    const problem = await makeProblem();
    await Submission.create({ user: user.user.id, problem: problem._id, problemId: problem.problemId,
      languageId: 71, sourceCode: 'code', verdict: 'WA', submittedAt: ago(20), finishedAt: ago(1),
      runs: [{ at: ago(10), status: { verdict: 'AC' } }, { at: ago(1), status: { verdict: 'WA' } }] });
    await backfillRatings();
    await backfillRatings();
    expect(await FirstSolve.countDocuments()).toBe(1);
    expect(+(await FirstSolve.findOne()).acceptedAt).toBe(+ago(10));
    expect((await getRatingProfile(user.user.id)).overall.history).toHaveLength(1);
  });

  it('retains earned rating history when a problem is removed', async () => {
    const problem = await makeProblem();
    await accept(problem);
    const before = await getRatingProfile(user.user.id);
    await problem.deleteOne();
    expect(await Submission.countDocuments()).toBe(0);
    const after = await getRatingProfile(user.user.id);
    expect(after.overall.rating).toBe(before.overall.rating);
    expect(after.overall.history).toEqual(before.overall.history);
  });

  it('archives season ratings and ranks before later difficulty changes', async () => {
    const season = await Season.create({ name: 'Archived', startDate: ago(20), endDate: ago(1) });
    const problems = [];
    for (let i = 0; i < 5; i += 1) { const problem = await makeProblem(2000); problems.push(problem); await accept(problem, ago(3)); }
    await finalizeEndedSeasons();
    const before = await Season.findById(season._id).lean();
    expect(before.results[0]).toMatchObject({ rating: 1160, rank: 1, solvedCount: 5 });
    for (const problem of problems) {
      await request(app).put(`/api/problems/${problem.problemId}/difficulty-rating`).set(authHeader(admin.tokens.accessToken))
        .send({ difficultyRating: 800, expectedVersion: 0, expectedUpdatedAt: problem.updatedAt.toISOString() }).expect(200);
    }
    const profile = await getRatingProfile(user.user.id);
    expect(profile.overall.rating).toBe(560);
    expect(profile.previousSeasons[0]).toMatchObject({ rating: 1160, rank: 1 });
    const ranking = await request(app).get(`/api/ratings/leaderboard?scope=season&seasonId=${season.id}`).expect(200);
    expect(ranking.body.items[0].rating).toBe(1160);
  });

  it('exposes stable paginated rankings with rating, rated solved count, username tie breaks', async () => {
    const problem = await makeProblem();
    await accept(problem, ago(1), user.user.id);
    await accept(problem, ago(1), admin.user.id);
    const first = await request(app).get('/api/ratings/leaderboard?limit=1').expect(200);
    const second = await request(app).get('/api/ratings/leaderboard?limit=1&page=2').expect(200);
    const names = [admin.user.username, user.user.username].sort();
    expect(first.body.items[0]).toMatchObject({ username: names[0], rating: 112, rank: 1, solvedCount: 1 });
    expect(second.body.items[0]).toMatchObject({ username: names[1], rank: 2 });
    expect(first.body.items[0]).not.toHaveProperty('email');
    await request(app).get('/api/ratings/me').expect(401);
    await request(app).get('/api/ratings/leaderboard?page=-1').expect(400);
    await request(app).get(`/api/users/${user.user.username}/dashboard`).expect(403);
  });
});

describe('Admin difficulty review', () => {
  it('requires admin and keeps AI proposals unsaved until explicit confirmation, allowing overrides', async () => {
    const problem = await makeProblem(null);
    vi.stubEnv('DIFFICULTY_AI_API_KEY', 'test-key');
    vi.stubEnv('DIFFICULTY_AI_MODEL', 'test-model');
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ difficultyRating: 1200, reasoning: 'Simple arithmetic in constant time.' }) } }] } });
    const url = `/api/problems/${problem.problemId}/evaluate-difficulty`;
    await request(app).post(url).expect(401);
    await request(app).post(url).set(authHeader(user.tokens.accessToken)).expect(403);
    const response = await request(app).post(url).set(authHeader(admin.tokens.accessToken)).expect(200);
    expect(response.body.difficultyRating).toBe(1200);
    expect((await Problem.findById(problem._id)).difficultyRating).toBeNull();
    const input = JSON.stringify(post.mock.calls[0][1].messages);
    expect(input).toContain('Two integers');
    expect(input).not.toContain('secret input');
    expect(input).not.toContain('private solution');
    const body = { difficultyRating: 1000, expectedVersion: response.body.expectedVersion, expectedUpdatedAt: response.body.expectedUpdatedAt };
    const saveUrl = `/api/problems/${problem.problemId}/difficulty-rating`;
    await request(app).put(saveUrl).set(authHeader(user.tokens.accessToken)).send(body).expect(403);
    await request(app).put(saveUrl).set(authHeader(admin.tokens.accessToken)).send({ ...body, difficultyRating: 900.5 }).expect(400);
    await request(app).put(saveUrl).set(authHeader(admin.tokens.accessToken)).send(body).expect(200);
    expect((await Problem.findById(problem._id)).difficultyRating).toBe(1000);
    await request(app).put(saveUrl).set(authHeader(admin.tokens.accessToken)).send(body).expect(409);
    await request(app).post(url).set(authHeader(admin.tokens.accessToken)).expect(200);
  });

  it('returns actionable errors for missing configuration, malformed output and timeout without saving', async () => {
    const problem = await makeProblem(null);
    const url = `/api/problems/${problem.problemId}/evaluate-difficulty`;
    vi.stubEnv('DIFFICULTY_AI_API_KEY', '');
    await request(app).post(url).set(authHeader(admin.tokens.accessToken)).expect(503);
    vi.stubEnv('DIFFICULTY_AI_API_KEY', 'test-key');
    vi.stubEnv('DIFFICULTY_AI_MODEL', 'test-model');
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { choices: [{ finish_reason: 'stop', message: { content: '{"difficultyRating":999999}' } }] } });
    await request(app).post(url).set(authHeader(admin.tokens.accessToken)).expect(502);
    post.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    await request(app).post(url).set(authHeader(admin.tokens.accessToken)).expect(504);
    expect((await Problem.findById(problem._id)).difficultyRating).toBeNull();
  });
});

describe('Seasons administration', () => {
  it('initializes ratings for an existing solve and waits for pending accepts before archiving', async () => {
    const problem = await makeProblem();
    const submission = await accept(problem, ago(3));
    const current = await Season.create({ name: 'Current', startDate: ago(5), endDate: ago(-5) });
    const ranking = await request(app).get('/api/ratings/leaderboard?scope=season').expect(200);
    expect(ranking.body.items[0]).toMatchObject({ rating: 112, solvedCount: 1 });
    expect((await Season.findById(current._id)).ratingsInitializedAt).toBeInstanceOf(Date);
    await Season.updateOne({ _id: current._id }, { $set: { endDate: ago(1) } });
    await Submission.updateOne({ _id: submission._id }, { $set: { ratingPending: true } });
    await finalizeEndedSeasons();
    expect((await Season.findById(current._id)).finalizedAt).toBeNull();
    await reconcileRatingSubmissions();
    await finalizeEndedSeasons();
    expect((await Season.findById(current._id)).results[0].rating).toBe(112);
  });

  it('validates dates and permissions, rejects overlapping seasons and detects current season', async () => {
    const body = { name: 'Current season', startDate: ago(5).toISOString(), endDate: ago(-5).toISOString(), active: true };
    await request(app).post('/api/ratings/seasons').set(authHeader(user.tokens.accessToken)).send(body).expect(403);
    await request(app).post('/api/ratings/seasons').set(authHeader(admin.tokens.accessToken)).send({ ...body, endDate: ago(6).toISOString() }).expect(400);
    const created = await request(app).post('/api/ratings/seasons').set(authHeader(admin.tokens.accessToken)).send(body).expect(201);
    expect(created.body.current).toBe(true);
    await request(app).post('/api/ratings/seasons').set(authHeader(admin.tokens.accessToken)).send(body).expect(409);
    const list = await request(app).get('/api/ratings/seasons').expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).not.toHaveProperty('results');
  });
});
