#!/usr/bin/env node
import mongoose from 'mongoose';
import 'dotenv/config';

import User from '../../src/models/User.js';

const log = (message, ...args) => {
  // eslint-disable-next-line no-console
  console.log(`[roles-backfill] ${message}`, ...args);
};

const run = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online-judge';
  log(`Connecting to ${mongoUri}`);
  await mongoose.connect(mongoUri);

  try {
    const filter = { role: 'admin' };
    const update = { $set: { role: 'super_admin' } };
    const result = await User.updateMany(filter, update);
    const totalSuperAdmins = await User.countDocuments({ role: 'super_admin' });

    log(`Promoted ${result.modifiedCount} admin users to super_admin.`);
    log(`Total super_admin accounts: ${totalSuperAdmins}`);
  } finally {
    await mongoose.disconnect();
  }
};

run()
  .then(() => {
    log('Migration completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[roles-backfill] Migration failed', error);
    process.exit(1);
  });
