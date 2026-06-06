import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { connectDb } from "../../lib/infra/db";
import { Startup } from "../../models";
import { StoredDocument } from "../../models/documents/storedDocument";
import { toRtpDocument } from "../documents/serializers";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);
projectsRouter.use(async (_req, _res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
});

function toProject(startup: Record<string, unknown>, documents: unknown[]) {
  return {
    id: String(startup._id),
    user_id: startup.ownerId,
    is_owner: true,
    name: startup.name,
    cm_number: null,
    shared_with: [],
    created_at: new Date(startup.createdAt as Date).toISOString(),
    updated_at: new Date(
      (startup.updatedAt as Date | undefined) ??
        (startup.createdAt as Date),
    ).toISOString(),
    documents,
    folders: [],
    document_count: documents.length,
    chat_count: 0,
    review_count: 0,
  };
}

projectsRouter.post("/", async (req, res) => {
  const userId = res.locals.userId as string;
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ detail: "name is required" });
    return;
  }
  const startup = await Startup.create({
    name: name.trim(),
    ownerId: userId,
  });
  res.status(201).json(toProject(startup.toObject() as Record<string, unknown>, []));
});

projectsRouter.get("/", async (req, res) => {
  const userId = res.locals.userId as string;
  const startups = await Startup.find({ ownerId: userId })
    .sort({ createdAt: -1 })
    .lean();
  res.json(
    startups.map((s) =>
      toProject(s as Record<string, unknown>, []),
    ),
  );
});

projectsRouter.get("/:projectId", async (req, res) => {
  const userId = res.locals.userId as string;
  const startup = (await Startup.findOne({
    _id: req.params.projectId,
    ownerId: userId,
  }).lean()) as Record<string, unknown> | null;
  if (!startup) {
    res.status(404).json({ detail: "Project not found" });
    return;
  }
  const docs = await StoredDocument.find({
    ownerId: userId,
    projectId: req.params.projectId,
  })
    .sort({ createdAt: -1 })
    .lean();
  res.json(
    toProject(
      startup,
      docs.map((d) => toRtpDocument(d as Record<string, unknown>)),
    ),
  );
});

projectsRouter.patch("/:projectId", async (req, res) => {
  const userId = res.locals.userId as string;
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ detail: "name is required" });
    return;
  }
  const startup = (await Startup.findOneAndUpdate(
    { _id: req.params.projectId, ownerId: userId },
    { name: name.trim() },
    { new: true },
  ).lean()) as Record<string, unknown> | null;
  if (!startup) {
    res.status(404).json({ detail: "Project not found" });
    return;
  }
  const docs = await StoredDocument.find({
    ownerId: userId,
    projectId: req.params.projectId,
  }).lean();
  res.json(
    toProject(
      startup,
      docs.map((d) => toRtpDocument(d as Record<string, unknown>)),
    ),
  );
});

projectsRouter.delete("/:projectId", async (req, res) => {
  const userId = res.locals.userId as string;
  const deleted = await Startup.findOneAndUpdate(
    { _id: req.params.projectId, ownerId: userId },
    { $set: { deletedAt: new Date() } },
    { new: true },
  ).lean();
  if (!deleted) {
    res.status(404).json({ detail: "Project not found" });
    return;
  }
  res.status(204).send();
});
