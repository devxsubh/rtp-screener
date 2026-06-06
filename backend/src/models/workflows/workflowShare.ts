import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  workflow_id: { type: String, required: true, index: true },
  shared_by_user_id: { type: String, required: true },
  shared_with_email: { type: String, required: true, index: true },
  allow_edit: { type: Boolean, default: false },
  created_at: { type: String, required: true },
});

export const WorkflowShareModel =
  mongoose.models["WorkflowShare"] ??
  mongoose.model("WorkflowShare", schema);
