import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDatabase from '../src/config/database.js';
import Problem from '../src/models/Problem.js';
import Submission from '../src/models/Submission.js';
import Counter from '../src/models/Counter.js';
import User from '../src/models/User.js';
import { getNextSequence } from '../src/services/idService.js';
import { buildProblemSlug } from '../src/utils/problemSlug.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TEST_PASSWORD = 'test1234';

const upsertUser = async ({ username, email, role = 'user' }) => {
  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
    user = await User.create({
      username,
      email,
      passwordHash,
      role,
      isActive: true,
      emailVerified: true,
      profile: { displayName: username }
    });
    console.log(`Created ${role} ${username} / ${email} (pw: ${TEST_PASSWORD})`);
  } else {
    console.log(`User ${email} already exists`);
  }
  return user;
};

const createProblem = async ({ title, difficulty, author, testCases }) => {
  const problemId = await getNextSequence('problemId');
  const problemNumber = await getNextSequence('problemNumber');
  const slug = buildProblemSlug(title, problemId);
  const problem = await Problem.create({
    title,
    slug,
    problemId,
    problemNumber,
    statement: `${title} statement`,
    statementMd: `${title} statement`,
    difficulty,
    judge0LanguageIds: [71],
    author: author?._id ?? null,
    isPublic: true,
    testCases
  });
  const total = testCases.reduce((s, tc) => s + tc.points, 0);
  console.log(`Seeded problem #${problemNumber} "${title}" (${difficulty}) total=${total} across ${testCases.length} cases`);
  return problem;
};

const createSubmission = async ({ user, problem, score }) => {
  const verdict = score >= 100 ? 'AC' : score > 0 ? 'PARTIAL' : 'WA';
  const status = verdict === 'AC' ? 'accepted' : verdict === 'WA' ? 'wrong_answer' : 'failed';
  await Submission.create({
    user: user._id,
    userName: user.username,
    problem: problem._id,
    problemId: problem.problemId,
    problemTitle: problem.title,
    languageId: 71,
    language: 'Python',
    sourceCode: 'print(sum(map(int, input().split())))',
    verdict,
    status,
    score
  });
};

const seed = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/judge0';
  await connectDatabase(mongoUri);

  await Promise.all([
    Problem.deleteMany({}),
    Submission.deleteMany({}),
    Counter.deleteMany({ _id: { $in: ['problemId', 'problemNumber'] } })
  ]);

  const admin = await upsertUser({
    username: process.env.ADMIN_USERNAME || 'admin',
    email: (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase(),
    role: 'admin'
  });
  const alice = await upsertUser({ username: 'alice', email: 'alice@example.com' });
  const bob = await upsertUser({ username: 'bob', email: 'bob@example.com' });
  const carol = await upsertUser({ username: 'carol', email: 'carol@example.com' });

  // EASY 총 10점을 4개 케이스에 균등 배분 → 2.5점씩 (소수점 배점 확인)
  const easy = await createProblem({
    title: 'Sum of Two Numbers',
    difficulty: 'EASY',
    author: admin,
    testCases: [
      { input: '1 2', output: '3', points: 2.5 },
      { input: '10 20', output: '30', points: 2.5 },
      { input: '100 -5', output: '95', points: 2.5 },
      { input: '0 0', output: '0', points: 2.5 }
    ]
  });

  // HARD 총 30점을 3개 케이스에 균등 배분 → 10점씩
  const hard = await createProblem({
    title: 'Tricky Graph',
    difficulty: 'HARD',
    author: admin,
    testCases: [
      { input: '1', output: '1', points: 10 },
      { input: '2', output: '4', points: 10 },
      { input: '3', output: '9', points: 10 }
    ]
  });

  // 제출: (유저, 문제)별 최고 score. 랭킹 = Σ (best/100 × 문제총점)
  await createSubmission({ user: alice, problem: easy, score: 75 }); // 예전 제출
  await createSubmission({ user: alice, problem: easy, score: 100 }); // 최고 점수
  await createSubmission({ user: alice, problem: hard, score: 100 });

  await createSubmission({ user: bob, problem: easy, score: 100 });
  await createSubmission({ user: bob, problem: hard, score: 50 });

  await createSubmission({ user: carol, problem: easy, score: 50 });
  await createSubmission({ user: carol, problem: hard, score: 0 });

  console.log('\nExpected ranking: alice=40, bob=25, carol=5');
  console.log('Test logins → alice/bob/carol @example.com, password:', TEST_PASSWORD);
  process.exit(0);
};

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
