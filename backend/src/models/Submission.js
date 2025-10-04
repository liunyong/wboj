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

const submissionSchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    languageId: { type: Number, required: true },
    sourceCode: { type: String, required: true },
    verdict: { type: String, default: 'Pending' },
    testCaseResults: { type: [testCaseResultSchema], default: [] }
  },
  { timestamps: true }
);

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;
