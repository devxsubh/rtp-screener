import { Router } from "express";
import {
  createIcMemoDocument,
  getLatestIcMemo,
  getStartupDocument,
  listIcMemos,
} from "../../lib/documents/icMemoDocument";
import { Startup } from "../../models";
import type { ScreeningResult } from "../../types/screening";

export const startupIcMemoRouter = Router();

startupIcMemoRouter.post("/:id/ic-memo", async (req, res) => {
  const startup = (await Startup.findById(req.params.id).lean()) as
    | Record<string, unknown>
    | null;
  if (!startup) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }
  const result = startup.lastScreeningResult as ScreeningResult | null;
  if (!result) {
    res.status(400).json({ detail: "No screening result — run a screen first" });
    return;
  }

  try {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string;
    const doc = await createIcMemoDocument({
      startupId: req.params.id,
      screeningResult: result,
      performedBy: userId,
      performedByEmail: userEmail,
    });
    res.status(201).json(doc);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Failed to generate IC memo";
    res.status(500).json({ detail });
  }
});

startupIcMemoRouter.get("/:id/ic-memo", async (req, res) => {
  const docs = await listIcMemos(req.params.id);
  res.json(docs);
});

startupIcMemoRouter.get("/:id/ic-memo/latest", async (req, res) => {
  const doc = await getLatestIcMemo(req.params.id);
  if (!doc) {
    res.status(404).json({ detail: "No IC memo found" });
    return;
  }
  res.json(doc);
});

startupIcMemoRouter.get("/:id/ic-memo/:docId", async (req, res) => {
  const doc = await getStartupDocument(req.params.id, req.params.docId);
  if (!doc) {
    res.status(404).json({ detail: "Document not found" });
    return;
  }
  res.json(doc);
});

startupIcMemoRouter.get("/:id/documents/:docId/download", async (req, res) => {
  res.redirect(307, `/api/documents/${req.params.docId}/download`);
});
