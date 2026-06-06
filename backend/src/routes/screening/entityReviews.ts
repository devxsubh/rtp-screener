import { Router } from "express";
import { syncEntityReviewStatus } from "../../lib/tabular/reviewStatusSync";
import { EntityReview } from "../../models";
import { toReview } from "../startups/serializers";
import { authIdentityOr500 } from "../../middleware/userIdentity";

export const startupEntityReviewsRouter = Router();

startupEntityReviewsRouter.get("/:id/entity-reviews", async (req, res) => {
  const reviews = await EntityReview.find({ startupId: req.params.id })
    .sort({ reviewedAt: -1 })
    .lean();
  res.json(reviews.map(toReview));
});

startupEntityReviewsRouter.post("/:id/entity-reviews", async (req, res) => {
  const { entityName, status, notes } = req.body as {
    entityName?: string;
    status?: string;
    notes?: string;
  };
  const validStatuses = ["pending", "cleared", "escalated", "blocked"];
  if (!entityName?.trim()) {
    res.status(400).json({ detail: "entityName is required" });
    return;
  }
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({
      detail: "status must be one of: " + validStatuses.join(", "),
    });
    return;
  }

  const identity = authIdentityOr500(res);
  if (!identity) return;
  const { userId: reviewedBy, userEmail: reviewedByEmail } = identity;

  await syncEntityReviewStatus({
    startupId: req.params.id,
    entityName: entityName.trim(),
    status: status as "pending" | "cleared" | "escalated" | "blocked",
    notes: notes?.trim() ?? null,
    performedBy: reviewedBy,
    performedByEmail: reviewedByEmail,
  });

  const review = await EntityReview.findOne({
    startupId: req.params.id,
    entityName: entityName.trim(),
  }).lean();

  res.status(201).json(toReview(review as Record<string, unknown>));
});
