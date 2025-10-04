import mongoose from 'mongoose';

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isPublic: { type: Boolean, default: false }
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    judge0LanguageIds: { type: [Number], default: [71] },
    testCases: { type: [testCaseSchema], default: [] }
  },
  { timestamps: true }
);

const Problem = mongoose.model('Problem', problemSchema);

export default Problem;
