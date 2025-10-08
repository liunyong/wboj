import mongoose from 'mongoose';

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, required: true },
    output: { type: String, required: true },
    points: { type: Number, min: 1, max: 1000, default: 1 }
  },
  { _id: false }
);

const sampleSchema = new mongoose.Schema(
  {
    input: { type: String, required: true },
    output: { type: String, required: true },
    explanation: { type: String, trim: true }
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    problemId: { type: Number, required: true, unique: true, min: 100000, immutable: true },
    problemNumber: { type: Number, required: true, unique: true, min: 1, immutable: true },
    statement: { type: String, required: true },
    inputFormat: { type: String },
    outputFormat: { type: String },
    constraints: { type: String },
    difficulty: {
      type: String,
      enum: ['BASIC', 'EASY', 'MEDIUM', 'HARD'],
      default: 'BASIC'
    },
    tags: {
      type: [String],
      default: [],
      set: (values = []) => values.map((tag) => tag.trim()).filter(Boolean)
    },
    algorithms: {
      type: [String],
      default: [],
      set: (values = []) =>
        Array.from(new Set(values.map((algorithm) => algorithm.trim()).filter(Boolean)))
    },
    samples: { type: [sampleSchema], default: [] },
    judge0LanguageIds: { type: [Number], default: [71] },
    testCases: {
      type: [testCaseSchema],
      default: [],
      validate: [
        {
          validator(value) {
            return Array.isArray(value) && value.length > 0 && value.length <= 500;
          },
          message: 'Problem must define between 1 and 500 test cases'
        }
      ]
    },
    cpuTimeLimit: { type: Number, min: 0.1, max: 30, default: 2 },
    memoryLimit: { type: Number, min: 16, max: 1024, default: 128 },
    submissionCount: { type: Number, default: 0, min: 0 },
    acceptedSubmissionCount: { type: Number, default: 0, min: 0 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isPublic: { type: Boolean, default: true }
  },
  { timestamps: true }
);

problemSchema.virtual('acceptanceRate').get(function acceptanceRateGetter() {
  const total = this.submissionCount || 0;
  if (!total) {
    return 0;
  }
  return (this.acceptedSubmissionCount || 0) / total;
});

problemSchema.set('toJSON', { virtuals: true });
problemSchema.set('toObject', { virtuals: true });

const Problem = mongoose.model('Problem', problemSchema);

export default Problem;
