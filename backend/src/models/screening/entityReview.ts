import mongoose from "mongoose";

/** Human sign-off on a screened entity (tabular Status column). */
const schema = new mongoose.Schema({
  startupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Startup",
    required: true,
    index: true,
  },
  entityName: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["pending", "cleared", "escalated", "blocked"],
    default: "pending",
  },
  notes: { type: String, default: null },
  reviewedBy: { type: String, required: true },
  reviewedByEmail: { type: String, required: true },
  reviewedAt: { type: Date, default: Date.now },
});

schema.index({ startupId: 1, entityName: 1 }, { unique: true });

export const EntityReview =
  mongoose.models["EntityReview"] ?? mongoose.model("EntityReview", schema);
