import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDatabase from '../src/config/database.js';
import Problem from '../src/models/Problem.js';
import Counter from '../src/models/Counter.js';
import { getNextSequence } from '../src/services/idService.js';
import User from '../src/models/User.js';
import { buildProblemSlug } from '../src/utils/problemSlug.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const seed = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/judge0';

  await connectDatabase(mongoUri);

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123';

  let adminUser = await User.findOne({ email: adminEmail });

  if (!adminUser) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    adminUser = await User.create({
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      role: 'admin',
      isActive: true,
      profile: {
        displayName: 'Administrator'
      }
    });

    console.log(`Created admin user ${adminUsername} (${adminEmail})`);
  } else {
    console.log(`Admin user ${adminEmail} already exists`);
  }

  await Promise.all([
    Problem.deleteMany({}),
    Counter.deleteMany({ _id: { $in: ['problemId', 'problemNumber'] } })
  ]);

  const problemId = await getNextSequence('problemId');
  const problemNumber = await getNextSequence('problemNumber');

  const title = 'A+B Problem';
  const slug = buildProblemSlug(title, problemId);

  const problem = await Problem.create({
    title,
    slug,
    problemNumber,
    statement: 'Given two integers, output their sum.',
    statementMd: 'Given two integers, output their sum.',
    inputFormat: 'Two integers a and b (|a|, |b| \le 10^9).',
    outputFormat: 'Print a single integer, the sum of a and b.',
    constraints: '0 < |a|, |b| \le 10^9',
    difficulty: 'BASIC',
    tags: ['math', 'introduction'],
    algorithms: ['Arithmetic', 'Ad-hoc'],
    samples: [
      { input: '1 2', output: '3', explanation: '1 + 2 = 3' },
      { input: '4 5', output: '9', explanation: '4 + 5 = 9' }
    ],
    problemId,
    judge0LanguageIds: [71, 63, 52],
    author: adminUser?._id ?? null,
    isPublic: true,
    cpuTimeLimit: 2,
    memoryLimit: 128,
    testCases: [
      { input: '1 2', output: '3', points: 1 },
      { input: '10 20', output: '30', points: 1 },
      { input: '100 -5', output: '95', points: 2 }
    ]
  });

  console.log('Seeded problem:', problem.title);

  process.exit(0);
};

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
