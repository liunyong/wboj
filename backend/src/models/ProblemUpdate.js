import mongoose from 'mongoose';

const problemUpdateSchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    problemId: { type: Number, required: true },
    titleSnapshot: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true }
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false
    }
  }
);

problemUpdateSchema.index({ createdAt: -1 });
problemUpdateSchema.index({ problemId: 1, createdAt: -1 });

const ProblemUpdate = mongoose.model('ProblemUpdate', problemUpdateSchema);

export default ProblemUpdate;
