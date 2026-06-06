import mongoose from "mongoose";

/** Prior screening summary for per-startup delta (what changed). */
const schema = new mongoose.Schema({
  startupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Startup",
    required: true,
    index: true,
  },
  purpose: {
    type: String,
    enum: ["cap_table", "co_investor", "vendor"],
    default: "cap_table",
  },
  screenedAt: { type: Date, default: Date.now },
  flaggedCount: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  entityRisks: {
    type: Map,
    of: String,
    default: {},
  },
});

schema.index({ startupId: 1, purpose: 1, screenedAt: -1 });

export const ScreeningSnapshot =
  mongoose.models["ScreeningSnapshot"] ??
  mongoose.model("ScreeningSnapshot", schema);
