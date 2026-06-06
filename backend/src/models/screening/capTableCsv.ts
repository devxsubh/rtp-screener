import mongoose from "mongoose";
import { parseErrorSchema } from "./schemas/screening";

const schema = new mongoose.Schema(
  {
  startupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Startup",
    required: true,
    index: true,
  },
  filename: { type: String, required: true },
  content: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  parseStatus: {
    type: String,
    enum: ["pending", "valid", "invalid", "needs_review"],
    default: "pending",
  },
  parseErrors: { type: [parseErrorSchema], default: [] },
  recordCount: { type: Number, default: 0 },
  csvKind: {
    type: String,
    enum: [
      "ownership_cap_table",
      "entity_roster",
      "reference_metadata",
      "unknown",
    ],
    default: null,
  },
  parseSource: {
    type: String,
    enum: ["strict", "heuristic", "ai"],
    default: null,
  },
  confidence: { type: Number, default: null },
  columnMapping: { type: mongoose.Schema.Types.Mixed, default: null },
  normalizedContent: { type: String, default: null },
  ingestWarnings: { type: [String], default: [] },
  rosterPurpose: {
    type: String,
    enum: ["cap_table", "co_investor", "vendor", "entity_roster"],
    default: "cap_table",
  },
  deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ startupId: 1, uploadedAt: -1 });
schema.index({ deletedAt: 1 }, { sparse: true });

function excludeDeleted(this: mongoose.Query<unknown, unknown>): void {
  if (!("deletedAt" in (this.getFilter() as Record<string, unknown>))) {
    this.where({ deletedAt: null });
  }
}
schema.pre("find", excludeDeleted);
schema.pre("findOne", excludeDeleted);
schema.pre("findOneAndUpdate", excludeDeleted);
schema.pre("countDocuments", excludeDeleted);

export const CapTableCsv =
  mongoose.models["CapTableCsv"] ?? mongoose.model("CapTableCsv", schema);
