import mongoose from "mongoose";

const changeSchema = new mongoose.Schema(
  {
    startupId: { type: String, required: true },
    startupName: { type: String, required: true },
    entityName: { type: String, required: true },
    previousRisk: { type: String, default: null },
    newRisk: { type: String, required: true },
    matchScore: { type: Number, default: null },
  },
  { _id: false },
);

/** Weekly / scheduled re-screen delta for alert digests (F12). */
const schema = new mongoose.Schema({
  generatedAt: { type: Date, default: Date.now, index: true },
  rescreenedCount: { type: Number, default: 0 },
  newFlagCount: { type: Number, default: 0 },
  newReviewCount: { type: Number, default: 0 },
  changes: { type: [changeSchema], default: [] },
  summaryText: { type: String, default: "" },
});

export const ScreeningDigest =
  mongoose.models["ScreeningDigest"] ??
  mongoose.model("ScreeningDigest", schema);
