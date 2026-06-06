import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  user_id: { type: String, index: true, default: null },
  is_system: { type: Boolean, default: false },
  created_at: { type: String, required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ["assistant", "tabular"], required: true },
  practice: { type: String, default: null },
  prompt_md: { type: String, default: null },
  columns_config: { type: mongoose.Schema.Types.Mixed, default: null },
});

export const WorkflowModel =
  mongoose.models["Workflow"] ?? mongoose.model("Workflow", schema);
