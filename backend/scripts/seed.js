import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDatabase from '../src/config/database.js';
import Problem from '../src/models/Problem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const seed = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/judge0';

  await connectDatabase(mongoUri);

  await Problem.deleteMany({});

  const problem = await Problem.create({
    title: 'A+B Problem',
    slug: 'a-plus-b',
    description: 'Given two integers, output their sum.',
    judge0LanguageIds: [71, 63, 52],
    testCases: [
      { input: '1 2', expectedOutput: '3', isPublic: true },
      { input: '10 20', expectedOutput: '30', isPublic: true },
      { input: '100 -5', expectedOutput: '95', isPublic: false }
    ]
  });

  console.log('Seeded problem:', problem.title);

  process.exit(0);
};

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
