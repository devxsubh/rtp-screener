import { randomUUID } from "crypto";
import { connectDb } from "../infra/db";
import { WorkflowModel } from "../../models";
import { WorkflowShareModel } from "../../models";
import { HiddenWorkflowModel } from "../../models";
import { BUILTIN_WORKFLOWS } from "./builtinWorkflows";

export type WorkflowType = "assistant" | "tabular";

export type ColumnConfig = {
  index: number;
  name: string;
  prompt: string;
  format?: string;
};

export type WorkflowRecord = {
  id: string;
  user_id: string | null;
  is_system: boolean;
  created_at: string;
  title: string;
  type: WorkflowType;
  practice: string | null;
  prompt_md: string | null;
  columns_config: ColumnConfig[] | null;
};

export type WorkflowShare = {
  id: string;
  workflow_id: string;
  shared_by_user_id: string;
  shared_with_email: string;
  allow_edit: boolean;
  created_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function docToRecord(doc: Record<string, unknown>): WorkflowRecord {
  return {
    id: doc._id as string,
    user_id: (doc.user_id as string | null) ?? null,
    is_system: (doc.is_system as boolean) ?? false,
    created_at: doc.created_at as string,
    title: doc.title as string,
    type: doc.type as WorkflowType,
    practice: (doc.practice as string | null) ?? null,
    prompt_md: (doc.prompt_md as string | null) ?? null,
    columns_config: (doc.columns_config as ColumnConfig[] | null) ?? null,
  };
}

function docToShare(doc: Record<string, unknown>): WorkflowShare {
  return {
    id: doc._id as string,
    workflow_id: doc.workflow_id as string,
    shared_by_user_id: doc.shared_by_user_id as string,
    shared_with_email: doc.shared_with_email as string,
    allow_edit: (doc.allow_edit as boolean) ?? false,
    created_at: doc.created_at as string,
  };
}

export async function listCustomWorkflows(
  userId: string,
  userEmail: string,
  type?: WorkflowType,
): Promise<
  Array<
    WorkflowRecord & {
      allow_edit: boolean;
      is_owner: boolean;
      shared_by_name: string | null;
    }
  >
> {
  await connectDb();
  const normalizedEmail = userEmail.trim().toLowerCase();

  const query: Record<string, unknown> = { is_system: false, user_id: userId };
  if (type) query.type = type;
  const ownDocs = await WorkflowModel.find(query).lean();

  const out: Array<
    WorkflowRecord & {
      allow_edit: boolean;
      is_owner: boolean;
      shared_by_name: string | null;
    }
  > = ownDocs.map((doc) => ({
    ...docToRecord(doc as Record<string, unknown>),
    allow_edit: true,
    is_owner: true,
    shared_by_name: null,
  }));

  const sharedRecords = await WorkflowShareModel.find({
    shared_with_email: normalizedEmail,
  }).lean();

  for (const share of sharedRecords) {
    const s = share as Record<string, unknown>;
    const wfDoc = await WorkflowModel.findById(s.workflow_id as string).lean();
    if (!wfDoc) continue;
    const wf = wfDoc as Record<string, unknown>;
    if (wf.is_system) continue;
    if (type && wf.type !== type) continue;
    if (out.some((row) => row.id === (wf._id as string))) continue;
    out.push({
      ...docToRecord(wf),
      allow_edit: (s.allow_edit as boolean) ?? false,
      is_owner: false,
      shared_by_name: null,
    });
  }

  return out.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function getWorkflowById(
  workflowId: string,
  userId: string,
  userEmail: string,
): Promise<(WorkflowRecord & { allow_edit: boolean; is_owner: boolean }) | null> {
  await connectDb();
  const wfDoc = await WorkflowModel.findById(workflowId).lean();
  if (!wfDoc) return null;
  const wf = wfDoc as Record<string, unknown>;

  if (wf.user_id === userId) {
    return { ...docToRecord(wf), allow_edit: true, is_owner: true };
  }

  const normalizedEmail = userEmail.trim().toLowerCase();
  const share = await WorkflowShareModel.findOne({
    workflow_id: workflowId,
    shared_with_email: normalizedEmail,
  }).lean();
  if (!share) return null;
  const s = share as Record<string, unknown>;
  return {
    ...docToRecord(wf),
    allow_edit: (s.allow_edit as boolean) ?? false,
    is_owner: false,
  };
}

export async function createWorkflow(
  userId: string,
  payload: {
    title: string;
    type: WorkflowType;
    prompt_md?: string;
    columns_config?: ColumnConfig[];
    practice?: string | null;
  },
): Promise<WorkflowRecord> {
  await connectDb();
  const id = randomUUID();
  const doc = await WorkflowModel.create({
    _id: id,
    user_id: userId,
    is_system: false,
    created_at: nowIso(),
    title: payload.title.trim(),
    type: payload.type,
    practice: payload.practice ?? null,
    prompt_md: payload.prompt_md ?? null,
    columns_config: payload.columns_config ?? null,
  });
  return docToRecord(doc.toObject() as Record<string, unknown>);
}

export async function updateWorkflow(
  workflowId: string,
  userId: string,
  userEmail: string,
  updates: {
    title?: string;
    prompt_md?: string;
    columns_config?: ColumnConfig[];
    practice?: string | null;
  },
): Promise<WorkflowRecord | null> {
  await connectDb();
  const access = await getWorkflowById(workflowId, userId, userEmail);
  if (!access || access.is_system || !access.allow_edit) return null;

  const patch: Record<string, unknown> = {};
  if (updates.title != null) patch.title = updates.title;
  if (updates.prompt_md != null) patch.prompt_md = updates.prompt_md;
  if (updates.columns_config != null) patch.columns_config = updates.columns_config;
  if ("practice" in updates) patch.practice = updates.practice ?? null;

  const updated = await WorkflowModel.findByIdAndUpdate(
    workflowId,
    { $set: patch },
    { new: true },
  ).lean();
  if (!updated) return null;
  return docToRecord(updated as Record<string, unknown>);
}

export async function deleteWorkflow(
  workflowId: string,
  userId: string,
): Promise<boolean> {
  await connectDb();
  const wfDoc = await WorkflowModel.findById(workflowId).lean();
  if (!wfDoc) return false;
  const wf = wfDoc as Record<string, unknown>;
  if (wf.user_id !== userId || wf.is_system) return false;
  await WorkflowModel.findByIdAndDelete(workflowId);
  await WorkflowShareModel.deleteMany({ workflow_id: workflowId });
  return true;
}

export async function listHiddenWorkflowIds(userId: string): Promise<string[]> {
  await connectDb();
  const docs = await HiddenWorkflowModel.find({ user_id: userId }).lean();
  return (docs as Array<Record<string, unknown>>).map(
    (d) => d.workflow_id as string,
  );
}

export async function hideWorkflow(
  userId: string,
  workflowId: string,
): Promise<void> {
  await connectDb();
  await HiddenWorkflowModel.updateOne(
    { user_id: userId, workflow_id: workflowId },
    { $setOnInsert: { user_id: userId, workflow_id: workflowId } },
    { upsert: true },
  );
}

export async function unhideWorkflow(
  userId: string,
  workflowId: string,
): Promise<void> {
  await connectDb();
  await HiddenWorkflowModel.deleteOne({ user_id: userId, workflow_id: workflowId });
}

export async function listWorkflowShares(
  workflowId: string,
  userId: string,
): Promise<WorkflowShare[] | null> {
  await connectDb();
  const wfDoc = await WorkflowModel.findById(workflowId).lean();
  if (!wfDoc) return null;
  const wf = wfDoc as Record<string, unknown>;
  if (wf.user_id !== userId) return null;

  const docs = await WorkflowShareModel.find({ workflow_id: workflowId })
    .sort({ created_at: 1 })
    .lean();
  return (docs as Array<Record<string, unknown>>).map(docToShare);
}

export async function shareWorkflow(
  workflowId: string,
  userId: string,
  userEmail: string,
  emails: string[],
  allowEdit: boolean,
): Promise<string | null> {
  await connectDb();
  const wfDoc = await WorkflowModel.findById(workflowId).lean();
  if (!wfDoc) return "Workflow not found";
  const wf = wfDoc as Record<string, unknown>;
  if (wf.user_id !== userId || wf.is_system) return "Workflow not found";

  const normalizedUserEmail = userEmail.trim().toLowerCase();
  const normalizedEmails = [
    ...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  ];
  if (normalizedEmails.length === 0) return "emails is required";
  if (normalizedEmails.includes(normalizedUserEmail)) {
    return "You cannot share a workflow with yourself.";
  }

  for (const email of normalizedEmails) {
    const existing = await WorkflowShareModel.findOne({
      workflow_id: workflowId,
      shared_with_email: email,
    });
    if (existing) {
      existing.set("allow_edit", allowEdit);
      await existing.save();
    } else {
      await WorkflowShareModel.create({
        _id: randomUUID(),
        workflow_id: workflowId,
        shared_by_user_id: userId,
        shared_with_email: email,
        allow_edit: allowEdit,
        created_at: nowIso(),
      });
    }
  }
  return null;
}

export async function deleteWorkflowShare(
  workflowId: string,
  userId: string,
  shareId: string,
): Promise<boolean> {
  await connectDb();
  const wfDoc = await WorkflowModel.findById(workflowId).lean();
  if (!wfDoc) return false;
  const wf = wfDoc as Record<string, unknown>;
  if (wf.user_id !== userId) return false;

  const result = await WorkflowShareModel.findOneAndDelete({
    _id: shareId,
    workflow_id: workflowId,
  });
  return result !== null;
}

export type WorkflowPrompt = { id: string; title: string; prompt_md: string };

export async function buildWorkflowStore(
  userId: string,
  userEmail: string,
): Promise<Map<string, WorkflowPrompt>> {
  await connectDb();
  const store = new Map<string, WorkflowPrompt>();

  for (const wf of BUILTIN_WORKFLOWS) {
    if (wf.type === "assistant" && wf.prompt_md) {
      store.set(wf.id, { id: wf.id, title: wf.title, prompt_md: wf.prompt_md });
    }
  }

  const normalizedEmail = userEmail.trim().toLowerCase();

  const ownDocs = await WorkflowModel.find({
    user_id: userId,
    is_system: false,
    type: "assistant",
    prompt_md: { $ne: null },
  }).lean();

  for (const doc of ownDocs as Array<Record<string, unknown>>) {
    const wf = docToRecord(doc);
    if (wf.prompt_md) {
      store.set(wf.id, { id: wf.id, title: wf.title, prompt_md: wf.prompt_md });
    }
  }

  const sharedDocs = await WorkflowShareModel.find({
    shared_with_email: normalizedEmail,
  }).lean();

  for (const share of sharedDocs as Array<Record<string, unknown>>) {
    const wfDoc = await WorkflowModel.findOne({
      _id: share.workflow_id as string,
      is_system: false,
      type: "assistant",
      prompt_md: { $ne: null },
    }).lean();
    if (!wfDoc) continue;
    const wf = docToRecord(wfDoc as Record<string, unknown>);
    if (wf.prompt_md && !store.has(wf.id)) {
      store.set(wf.id, { id: wf.id, title: wf.title, prompt_md: wf.prompt_md });
    }
  }

  return store;
}
