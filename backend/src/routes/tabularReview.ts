import express from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/requireAuth";
import { connectDb } from "../lib/infra/db";
import { TabularReview } from "../models";
import { TabularCell } from "../models";
import { applyTabularStatusCell } from "../lib/tabular/reviewStatusSync";
import type { TabularRowDoc } from "../types/tabular";
import { sendEmailSafe, sendReviewInviteEmail } from "../lib/auth/email";
import { resolveInviterLabel } from "../lib/auth/inviterLabel";

export const tabularReviewRouter = express.Router();

tabularReviewRouter.use(requireAuth);
tabularReviewRouter.use(async (_req, _res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
});

function toReviewApi(raw: Record<string, unknown>, userId: string) {
  return {
    id: String(raw._id),
    project_id: raw.projectId ? String(raw.projectId) : null,
    user_id: raw.userId as string,
    title: raw.title ?? null,
    columns_config: raw.columnsConfig ?? [],
    document_ids: raw.rowIds ?? [],
    workflow_id: raw.workflowId ?? null,
    shared_with: raw.sharedWith ?? [],
    is_owner: raw.userId === userId,
    created_at: new Date(raw.createdAt as string).toISOString(),
    updated_at: new Date(raw.updatedAt as string).toISOString(),
    document_count: Array.isArray(raw.rowIds) ? raw.rowIds.length : 0,
    review_kind: raw.reviewKind ?? "standard",
  };
}

function toCellApi(raw: Record<string, unknown>) {
  return {
    id: String(raw._id),
    review_id: String(raw.reviewId),
    document_id: raw.documentId,
    column_index: raw.columnIndex,
    content: raw.content ?? null,
    status: raw.status ?? "done",
    created_at: new Date(raw.createdAt as string).toISOString(),
  };
}

async function findOwnedReview(id: string, userId: string) {
  return TabularReview.findOne({ _id: id, userId }).lean();
}

function rowsToDocuments(
  rows: Array<{ id: string; name: string }>,
  userId: string,
  projectId: string | null,
): TabularRowDoc[] {
  const now = new Date().toISOString();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    user_id: userId,
    project_id: projectId,
    folder_id: null,
    filename: r.name,
    mime_type: "text/plain",
    size_bytes: 0,
    created_at: now,
    updated_at: now,
  }));
}

tabularReviewRouter.get("/", async (req, res) => {
  const userId = res.locals.userId as string;
  const { project_id } = req.query as { project_id?: string };

  const query: Record<string, unknown> = { userId };
  if (project_id) {
    query.projectId = new mongoose.Types.ObjectId(project_id);
  }

  const list = await TabularReview.find(query).sort({ updatedAt: -1 }).lean();
  res.json(list.map((r) => toReviewApi(r as Record<string, unknown>, userId)));
});

tabularReviewRouter.post("/", async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const {
    title,
    document_ids,
    columns_config,
    workflow_id,
    project_id,
  } = req.body as {
    title?: string;
    document_ids?: string[];
    columns_config?: unknown[];
    workflow_id?: string;
    project_id?: string;
  };

  const rowIds = document_ids ?? [];
  const review = await TabularReview.create({
    userId,
    userEmail,
    title: title?.trim() ?? "Untitled review",
    projectId: project_id ? new mongoose.Types.ObjectId(project_id) : null,
    workflowId: workflow_id ?? null,
    reviewKind: "standard",
    columnsConfig: columns_config ?? [],
    rowIds,
    rows: rowIds.map((id) => ({ id, name: id, meta: {} })),
  });

  res.status(201).json(toReviewApi(review.toObject(), userId));
});

tabularReviewRouter.post("/prompt", async (req, res) => {
  const { title } = req.body as { title?: string };
  res.json({
    prompt: `Extract "${title ?? "this field"}" from the document.`,
    source: "fallback",
  });
});

tabularReviewRouter.get("/:id", async (req, res) => {
  const userId = res.locals.userId as string;
  const review = (await findOwnedReview(req.params.id, userId)) as
    | Record<string, unknown>
    | null;

  if (!review) {
    res.status(404).json({ detail: "Review not found" });
    return;
  }

  const cells = await TabularCell.find({ reviewId: req.params.id }).lean();
  const rows = (review.rows as Array<{ id: string; name: string }>) ?? [];
  const projectId = review.projectId ? String(review.projectId) : null;

  res.json({
    review: toReviewApi(review, userId),
    cells: cells.map((c) => toCellApi(c as Record<string, unknown>)),
    documents: rowsToDocuments(rows, userId, projectId),
  });
});

tabularReviewRouter.patch("/:id", async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const {
    title,
    columns_config,
    document_ids,
    project_id,
    shared_with,
  } = req.body as {
    title?: string;
    columns_config?: unknown[];
    document_ids?: string[];
    project_id?: string | null;
    shared_with?: string[];
  };

  const existing = (await findOwnedReview(req.params.id, userId)) as
    | Record<string, unknown>
    | null;
  if (!existing) {
    res.status(404).json({ detail: "Review not found" });
    return;
  }

  const previousShared = Array.isArray(existing.sharedWith)
    ? (existing.sharedWith as string[]).map((e) => e.toLowerCase())
    : [];

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) update.title = title;
  if (columns_config !== undefined) update.columnsConfig = columns_config;
  if (shared_with !== undefined) update.sharedWith = shared_with;
  if (project_id !== undefined) {
    update.projectId = project_id
      ? new mongoose.Types.ObjectId(project_id)
      : null;
  }
  if (document_ids !== undefined) {
    update.rowIds = document_ids;
  }

  const review = await TabularReview.findOneAndUpdate(
    { _id: req.params.id, userId },
    { $set: update },
    { new: true },
  ).lean();

  if (!review) {
    res.status(404).json({ detail: "Review not found" });
    return;
  }

  if (shared_with !== undefined) {
    const nextShared = shared_with.map((e) => e.trim().toLowerCase()).filter(Boolean);
    const added = nextShared.filter((email) => !previousShared.includes(email));
    if (added.length > 0) {
      const inviterLabel = await resolveInviterLabel(userId, userEmail);
      const reviewDoc = review as Record<string, unknown>;
      const reviewTitle =
        typeof reviewDoc.title === "string" && reviewDoc.title.trim()
          ? reviewDoc.title
          : "Tabular review";
      const projectId = reviewDoc.projectId
        ? String(reviewDoc.projectId)
        : null;
      for (const to of added) {
        sendEmailSafe(() =>
          sendReviewInviteEmail({
            to,
            inviterLabel,
            reviewTitle,
            reviewId: req.params.id,
            projectId,
          }),
        );
      }
    }
  }

  res.json(toReviewApi(review as Record<string, unknown>, userId));
});

tabularReviewRouter.delete("/:id", async (req, res) => {
  const userId = res.locals.userId as string;
  const review = await TabularReview.findOneAndDelete({
    _id: req.params.id,
    userId,
  });
  if (!review) {
    res.status(404).json({ detail: "Review not found" });
    return;
  }
  await TabularCell.deleteMany({ reviewId: req.params.id });
  res.status(204).send();
});

tabularReviewRouter.get("/:id/people", async (_req, res) => {
  res.json({ owner: { email: "admin@rtpglobal.com", name: "RTP Admin" }, shared: [] });
});

/** Screening-backed reviews skip LLM generation — cells are pre-filled. */
tabularReviewRouter.post("/:id/generate", async (req, res) => {
  res.json({ ok: true, message: "Screening-backed cells are pre-populated" });
});

tabularReviewRouter.post("/:id/regenerate-cell", async (req, res) => {
  const { document_id, column_index, content } = req.body as {
    document_id?: string;
    column_index?: number;
    content?: { summary?: string };
  };

  if (!document_id || column_index === undefined) {
    res.status(400).json({ detail: "document_id and column_index required" });
    return;
  }

  const summary = content?.summary ?? "";
  const userId = res.locals.userId as string;
  const owned = await findOwnedReview(req.params.id, userId);
  if (!owned) {
    res.status(404).json({ detail: "Review not found" });
    return;
  }
  const userEmail = res.locals.userEmail as string;

  const cell = await TabularCell.findOneAndUpdate(
    {
      reviewId: req.params.id,
      documentId: document_id,
      columnIndex: column_index,
    },
    {
      $set: {
        content: { summary, flag: "grey", reasoning: "" },
        status: "done",
      },
    },
    { upsert: true, new: true },
  ).lean();

  await applyTabularStatusCell({
    reviewId: req.params.id,
    documentId: document_id,
    columnIndex: column_index,
    summary,
    performedBy: userId,
    performedByEmail: userEmail,
  });

  const c = cell as Record<string, unknown>;
  res.json({
    summary: (c.content as { summary: string })?.summary ?? summary,
    flag: (c.content as { flag: string })?.flag ?? "grey",
    reasoning: "",
  });
});

tabularReviewRouter.post("/:id/clear-cells", async (req, res) => {
  const userId = res.locals.userId as string;
  const { document_ids } = req.body as { document_ids?: string[] };
  if (!document_ids?.length) {
    res.status(400).json({ detail: "document_ids required" });
    return;
  }
  if (document_ids.length > 100) {
    res.status(400).json({ detail: "document_ids limited to 100 entries" });
    return;
  }
  const owned = await findOwnedReview(req.params.id, userId);
  if (!owned) {
    res.status(404).json({ detail: "Review not found" });
    return;
  }
  await TabularCell.deleteMany({
    reviewId: req.params.id,
    documentId: { $in: document_ids },
  });
  res.json({ ok: true });
});

tabularReviewRouter.get("/:id/chats", async (_req, res) => {
  res.json([]);
});

tabularReviewRouter.get("/:id/chats/:chatId/messages", async (_req, res) => {
  res.json([]);
});

tabularReviewRouter.delete("/:id/chats/:chatId", async (_req, res) => {
  res.status(204).send();
});

tabularReviewRouter.post("/:id/chat", async (_req, res) => {
  res.status(501).json({
    detail: "Tabular chat is not enabled for screening-backed reviews",
  });
});
