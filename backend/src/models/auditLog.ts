import mongoose from "mongoose";

export type AuditEventType =
  | "screening_completed"
  | "csv_uploaded"
  | "csv_updated"
  | "entity_reviewed"
  | "portfolio_reviewed"
  | "ic_memo_generated";

const schema = new mongoose.Schema({
  startupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Startup",
    index: true,
    default: null,
  },
  eventType: {
    type: String,
    enum: [
      "screening_completed",
      "csv_uploaded",
      "csv_updated",
      "entity_reviewed",
      "portfolio_reviewed",
      "ic_memo_generated",
    ],
    required: true,
  },
  performedBy: { type: String, required: true },
  performedByEmail: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const AuditLog =
  mongoose.models["AuditLog"] ?? mongoose.model("AuditLog", schema);
