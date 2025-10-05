import mongoose from 'mongoose';

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isPublic: { type: Boolean, default: false },
    inputFileName: { type: String, trim: true },
    outputFileName: { type: String, trim: true }
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    problemNumber: { type: Number, required: true, unique: true, min: 1, immutable: true },
    judge0LanguageIds: { type: [Number], default: [71] },
    testCases: { type: [testCaseSchema], default: [] },
    submissionCount: { type: Number, default: 0, min: 0 },
    acceptedSubmissionCount: { type: Number, default: 0, min: 0 }
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
