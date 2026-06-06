import { Router } from "express";
import { StartupDocument } from "../../models";
import { findOwnedStartup } from "../startups/middleware";
import { requireAuth } from "../../middleware/requireAuth";
import { connectDbMiddleware } from "../startups/middleware";
import { markdownToWordDocumentHtml } from "../../lib/documents/markdownToWordHtml";

export const startupDocumentDownloadRouter = Router();

startupDocumentDownloadRouter.use(requireAuth, connectDbMiddleware);

async function loadOwnedDocument(
  docId: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const doc = (await StartupDocument.findById(docId).lean()) as
    | Record<string, unknown>
    | null;

  if (!doc || typeof doc.content !== "string") return null;

  const startupId = String(doc.startupId);
  const owned = await findOwnedStartup(startupId, userId);
  if (!owned) return null;

  return doc;
}

/** View a startup screening document (IC memo, analysis, etc.) as JSON. */
startupDocumentDownloadRouter.get("/:docId/view", async (req, res) => {
  const userId = res.locals.userId as string;
  const doc = await loadOwnedDocument(req.params.docId, userId);
  if (!doc) {
    res.status(404).json({ detail: "Document not found" });
    return;
  }

  res.json({
    id: String(doc._id),
    startupId: String(doc.startupId),
    kind: doc.kind ?? "custom",
    title: String(doc.title ?? "document"),
    content: doc.content,
    screeningScreenedAt: doc.screeningScreenedAt ?? null,
    createdAt: doc.createdAt ?? null,
  });
});

/** Download a startup screening document as a Word-compatible .doc file. */
startupDocumentDownloadRouter.get("/:docId/download", async (req, res) => {
  const userId = res.locals.userId as string;
  const doc = await loadOwnedDocument(req.params.docId, userId);
  if (!doc) {
    res.status(404).json({ detail: "Document not found" });
    return;
  }

  const title = String(doc.title ?? "document");
  const safeName = title.replace(/[^\w\s.-]/g, "").trim() || "document";
  const html = markdownToWordDocumentHtml(title, String(doc.content));
  res.setHeader("Content-Type", "application/msword");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName}.doc"`,
  );
  res.send(html);
});
