import mongoose from "mongoose";
import { AuditLog } from "../../models";
import { EntityReview } from "../../models";
import { Startup } from "../../models";
import { TabularCell } from "../../models";
import { TabularReview } from "../../models";
import { portfolioStartupRowId } from "./tabularScreening";

const VALID = ["pending", "cleared", "escalated", "blocked"] as const;
export type ReviewStatusValue = (typeof VALID)[number];

export function parseReviewStatus(text: string): ReviewStatusValue | null {
  const t = text.trim().toLowerCase();
  if (!t) return "pending";
  if (VALID.includes(t as ReviewStatusValue)) return t as ReviewStatusValue;
  if (t === "clear" || t === "cleared") return "cleared";
  if (t === "escalate" || t === "escalated") return "escalated";
  if (t === "block" || t === "blocked") return "blocked";
  return null;
}

function decodeEntityRowId(documentId: string): string | null {
  if (!documentId.startsWith("entity:")) return null;
  try {
    return decodeURIComponent(documentId.slice("entity:".length));
  } catch {
    return documentId.slice("entity:".length);
  }
}

function decodeStartupRowId(documentId: string): string | null {
  if (!documentId.startsWith("startup:")) return null;
  return documentId.slice("startup:".length);
}

export async function syncEntityReviewStatus(params: {
  startupId: string;
  entityName: string;
  status: ReviewStatusValue;
  notes?: string | null;
  performedBy: string;
  performedByEmail: string;
}): Promise<void> {
  await EntityReview.findOneAndUpdate(
    { startupId: params.startupId, entityName: params.entityName },
    {
      $set: {
        status: params.status,
        notes: params.notes ?? null,
        reviewedBy: params.performedBy,
        reviewedByEmail: params.performedByEmail,
        reviewedAt: new Date(),
      },
    },
    { upsert: true },
  );

  const reviews = await TabularReview.find({
    projectId: new mongoose.Types.ObjectId(params.startupId),
    reviewKind: "entity_screening",
  }).lean();

  for (const review of reviews) {
    const docId = `entity:${encodeURIComponent(params.entityName)}`;
    await TabularCell.findOneAndUpdate(
      {
        reviewId: review._id,
        documentId: docId,
        columnIndex: 9,
      },
      {
        $set: {
          content: {
            summary: params.status,
            flag: "grey",
            reasoning: params.notes ?? "",
          },
          status: "done",
        },
      },
      { upsert: true },
    );
  }

  await AuditLog.create({
    startupId: params.startupId,
    eventType: "entity_reviewed",
    performedBy: params.performedBy,
    performedByEmail: params.performedByEmail,
    details: {
      entityName: params.entityName,
      outcome: params.status,
      notes: params.notes ?? null,
    },
  });
}

export async function syncPortfolioStartupStatus(params: {
  startupId: string;
  status: ReviewStatusValue;
  notes?: string | null;
  performedBy: string;
  performedByEmail: string;
}): Promise<void> {
  await Startup.findByIdAndUpdate(params.startupId, {
    portfolioReviewStatus: params.status,
    portfolioReviewNotes: params.notes ?? null,
  });

  const portfolioReviews = await TabularReview.find({
    reviewKind: "portfolio_monitoring",
  }).lean();

  const docId = portfolioStartupRowId(params.startupId);
  for (const review of portfolioReviews) {
    await TabularCell.findOneAndUpdate(
      {
        reviewId: review._id,
        documentId: docId,
        columnIndex: 4,
      },
      {
        $set: {
          content: {
            summary: params.status,
            flag: "grey",
            reasoning: params.notes ?? "",
          },
          status: "done",
        },
      },
      { upsert: true },
    );
  }

  await AuditLog.create({
    startupId: params.startupId,
    eventType: "portfolio_reviewed",
    performedBy: params.performedBy,
    performedByEmail: params.performedByEmail,
    details: { outcome: params.status, notes: params.notes ?? null },
  });
}

export async function applyTabularStatusCell(params: {
  reviewId: string;
  documentId: string;
  columnIndex: number;
  summary: string;
  performedBy: string;
  performedByEmail: string;
}): Promise<void> {
  const review = (await TabularReview.findById(params.reviewId).lean()) as
    | Record<string, unknown>
    | null;
  if (!review) return;

  const kind = review.reviewKind as string;
  const status = parseReviewStatus(params.summary);
  if (!status) return;

  if (kind === "entity_screening" && params.columnIndex === 8) {
    const entityName = decodeEntityRowId(params.documentId);
    const startupId = review.projectId ? String(review.projectId) : null;
    if (entityName && startupId) {
      await syncEntityReviewStatus({
        startupId,
        entityName,
        status,
        performedBy: params.performedBy,
        performedByEmail: params.performedByEmail,
      });
    }
    return;
  }

  if (kind === "portfolio_monitoring" && params.columnIndex === 4) {
    const startupId = decodeStartupRowId(params.documentId);
    if (startupId) {
      await syncPortfolioStartupStatus({
        startupId,
        status,
        performedBy: params.performedBy,
        performedByEmail: params.performedByEmail,
      });
    }
  }
}
