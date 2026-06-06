import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user_id: { type: String, required: true },
  workflow_id: { type: String, required: true },
});

schema.index({ user_id: 1, workflow_id: 1 }, { unique: true });

export const HiddenWorkflowModel =
  mongoose.models["HiddenWorkflow"] ??
  mongoose.model("HiddenWorkflow", schema);
