import 'dotenv/config';
import mongoose from 'mongoose';
import connectDatabase from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { backfillRatings } from '../src/services/ratingService.js';

try {
  await connectDatabase(env.mongoUri);
  await backfillRatings();
  console.log('First accepts, portfolio ratings and season results are up to date.');
} catch (error) {
  console.error('Rating backfill failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
