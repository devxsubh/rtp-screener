import mongoose from "mongoose";
import { screeningResultSchema } from "../models/screening/schemas/screening";

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ownerId: { type: String, index: true, default: null },
  createdAt: { type: Date, default: Date.now },
  latestCsvId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CapTableCsv",
    default: null,
  },
  lastScreeningResult: { type: screeningResultSchema, default: null },
  lastScreenedAt: { type: Date, default: null },
  lastScreenedCsvId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CapTableCsv",
    default: null,
  },
  lastCoInvestorScreeningResult: {
    type: screeningResultSchema,
    default: null,
  },
  lastCoInvestorScreenedAt: { type: Date, default: null },
  lastVendorScreeningResult: {
    type: screeningResultSchema,
    default: null,
  },
  lastVendorScreenedAt: { type: Date, default: null },
  latestCsvByPurpose: { type: mongoose.Schema.Types.Mixed, default: {} },
  portfolioReviewStatus: {
    type: String,
    enum: ["pending", "cleared", "escalated", "blocked"],
    default: "pending",
  },
  portfolioReviewNotes: { type: String, default: null },
});

export const Startup =
  mongoose.models["Startup"] ?? mongoose.model("Startup", schema);
