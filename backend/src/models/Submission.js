import mongoose from 'mongoose';

const testCaseResultSchema = new mongoose.Schema(
  {
    input: String,
    expectedOutput: String,
    stdout: String,
    stderr: String,
    compileOutput: String,
    message: String,
    status: {
      id: Number,
      description: String
    },
    time: String,
    memory: Number
  },
  { _id: false }
);

const judge0Schema = new mongoose.Schema(
  {
    jobId: { type: String },
    rawPayload: { type: mongoose.Schema.Types.Mixed }
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    languageId: { type: Number, required: true },
    sourceCode: { type: String, required: true },
    sourceLen: { type: Number, default: 0 },
    verdict: {
      type: String,
      enum: ['PENDING', 'AC', 'WA', 'TLE', 'RTE', 'CE', 'MLE', 'PE', 'IE'],
      default: 'PENDING'
    },
    execTimeMs: { type: Number, default: null },
    memoryKb: { type: Number, default: null },
    testCaseResults: { type: [testCaseResultSchema], default: [] },
    judge0: { type: judge0Schema, default: () => ({}) },
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

submissionSchema.index({ user: 1, submittedAt: -1 });
submissionSchema.index({ problem: 1, submittedAt: -1 });

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;
