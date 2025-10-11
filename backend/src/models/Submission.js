import mongoose from 'mongoose';

const testCaseResultSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    input: String,
    output: String,
    stdout: String,
    stderr: String,
    compileOutput: String,
    message: String,
    points: { type: Number, default: 1 },
    passed: { type: Boolean, default: false },
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

const resultCaseSummarySchema = new mongoose.Schema(
  {
    i: Number,
    s: Number,
    t: String,
    m: Number,
    p: Number,
    pass: Boolean
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, trim: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    problemId: { type: Number },
    problemTitle: { type: String },
    languageId: { type: Number, required: true },
    language: { type: String },
    sourceCode: { type: String, required: true, alias: 'source' },
    sourceLen: { type: Number, default: 0 },
    verdict: {
      type: String,
      enum: ['PENDING', 'AC', 'WA', 'TLE', 'RTE', 'CE', 'MLE', 'PE', 'IE', 'PARTIAL'],
      default: 'PENDING'
    },
    status: {
      type: String,
      enum: [
        'queued',
        'running',
        'accepted',
        'wrong_answer',
        'tle',
        'rte',
        'ce',
        'failed'
      ],
      default: 'queued'
    },
    score: { type: Number, min: 0, max: 100, default: 0 },
    execTimeMs: { type: Number, default: null },
    memoryKb: { type: Number, default: null },
    runtimeMs: { type: Number, default: null },
    memoryKB: { type: Number, default: null },
    testCaseResults: { type: [testCaseResultSchema], default: [] },
    resultSummary: {
      type: {
        score: { type: Number, default: 0 },
        cases: {
          type: [resultCaseSummarySchema],
          default: []
        }
      },
      default: () => ({ score: 0, cases: [] })
    },
    judge0: { type: judge0Schema, default: () => ({}) },
    submittedAt: { type: Date, default: Date.now },
    queuedAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    finishedAt: { type: Date }
  },
  { timestamps: true }
);

submissionSchema.index({ user: 1, submittedAt: -1 });
submissionSchema.index({ problem: 1, submittedAt: -1 });
submissionSchema.index({ createdAt: -1 });
submissionSchema.index({ user: 1, createdAt: -1 });
submissionSchema.index({ problemId: 1, createdAt: -1 });
submissionSchema.index({ status: 1, createdAt: -1 });

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;
