import mongoose from "mongoose";

const contentSchema = new mongoose.Schema(
  {
    summary: { type: String, default: "" },
    flag: {
      type: String,
      enum: ["green", "grey", "yellow", "red"],
      default: "grey",
    },
    reasoning: { type: String, default: "" },
  },
  { _id: false },
);

const schema = new mongoose.Schema({
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TabularReview",
    required: true,
    index: true,
  },
  documentId: { type: String, required: true },
  columnIndex: { type: Number, required: true },
  content: { type: contentSchema, default: null },
  status: {
    type: String,
    enum: ["pending", "generating", "done", "error"],
    default: "done",
  },
  createdAt: { type: Date, default: Date.now },
});

schema.index({ reviewId: 1, documentId: 1, columnIndex: 1 }, { unique: true });

export const TabularCell =
  mongoose.models["TabularCell"] ??
  mongoose.model("TabularCell", schema);
