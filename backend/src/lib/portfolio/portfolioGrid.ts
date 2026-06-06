import mongoose from "mongoose";
import { TabularReview } from "../../models";
import { TabularCell } from "../../models";
import { Startup } from "../../models";
import { EntityReview } from "../../models";
import {
  ENTITY_SCREENING_COLUMNS,
  PORTFOLIO_COLUMNS,
  entityToCells,
  formatCoInvestorRisk,
  formatOpenFlags,
  portfolioStartupRowId,
  riskToFlag,
  screeningResultToRows,
} from "../tabular/tabularScreening";
import type { ScreeningResult } from "../../types/screening";

export async function seedEntityScreeningReview(params: {
  userId: string;
  userEmail: string;
  startupId: string;
  startupName: string;
  screeningResult: ScreeningResult;
  title?: string;
}): Promise<{ reviewId: string }> {
  const { rowIds, rows } = screeningResultToRows(params.screeningResult);

  const review = await TabularReview.create({
    userId: params.userId,
    userEmail: params.userEmail,
    title: params.title ?? `${params.startupName} — Sanctions Review`,
    projectId: new mongoose.Types.ObjectId(params.startupId),
    workflowId: "builtin-cap-table-review",
    reviewKind: "entity_screening",
    columnsConfig: ENTITY_SCREENING_COLUMNS,
    rowIds,
    rows,
  });

  const cellOps = [];
  for (const entity of params.screeningResult.entities) {
    const docId = `entity:${encodeURIComponent(entity.name)}`;
    const colMap = entityToCells(entity);
    for (const [colIdx, cell] of colMap) {
      cellOps.push({
        reviewId: review._id,
        documentId: docId,
        columnIndex: colIdx,
        content: { summary: cell.summary, flag: cell.flag, reasoning: "" },
        status: "done",
      });
    }
  }
  if (cellOps.length > 0) {
    await TabularCell.insertMany(cellOps);
  }

  return { reviewId: String(review._id) };
}

interface StartupScreenFields {
  _id: unknown;
  name: string;
  lastScreenedAt?: Date | null;
  lastScreeningResult?: ScreeningResult | null;
  lastCoInvestorScreeningResult?: ScreeningResult | null;
  portfolioReviewStatus?: string | null;
}

export async function syncPortfolioMonitoringReview(params: {
  userId: string;
  userEmail: string;
}): Promise<{ reviewId: string; rowCount: number }> {
  const startups = (await Startup.find().sort({ createdAt: -1 }).lean()) as unknown as
    StartupScreenFields[];

  const rowIds: string[] = [];
  const rows: { id: string; name: string; meta: Record<string, unknown> }[] =
    [];
  const cellOps: {
    reviewId: mongoose.Types.ObjectId;
    documentId: string;
    columnIndex: number;
    content: { summary: string; flag: string; reasoning: string };
    status: string;
  }[] = [];

  let review = await TabularReview.findOne({
    userId: params.userId,
    reviewKind: "portfolio_monitoring",
  });

  const reviewId =
    review?._id ?? new mongoose.Types.ObjectId();

  // Preserve human Status column (index 4) per startup row
  const existingStatus = new Map<string, string>();
  if (review) {
    const statusCells = await TabularCell.find({
      reviewId: review._id,
      columnIndex: 5,
    }).lean();
    for (const c of statusCells) {
      const summary = (c.content as { summary?: string } | null)?.summary;
      if (summary?.trim()) {
        existingStatus.set(c.documentId as string, summary);
      }
    }
  }

  for (const s of startups) {
    const startupId = String(s._id);
    const docId = portfolioStartupRowId(startupId);
    rowIds.push(docId);
    rows.push({ id: docId, name: s.name, meta: { startupId } });

    const result = s.lastScreeningResult ?? null;
    const coInv = s.lastCoInvestorScreeningResult ?? null;
    const lastScreened = s.lastScreenedAt
      ? new Date(s.lastScreenedAt).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "Never";

    let highestEntity = "—";
    let highestFlag: "green" | "grey" | "yellow" | "red" = "grey";
    if (result?.entities?.length) {
      const flagged = result.entities.find((e) => e.riskLevel === "flagged");
      const reviewEnt = result.entities.find((e) => e.riskLevel === "review");
      const top = flagged ?? reviewEnt;
      if (top) {
        highestEntity = top.name;
        highestFlag = riskToFlag(top.riskLevel);
      }
    }

    const openFlags = formatOpenFlags(
      result?.flaggedCount ?? 0,
      result?.reviewCount ?? 0,
    );
    const openFlagLevel: "green" | "yellow" | "red" | "grey" =
      (result?.flaggedCount ?? 0) > 0
        ? "red"
        : (result?.reviewCount ?? 0) > 0
          ? "yellow"
          : result
            ? "green"
            : "grey";

    const maxExposure =
      result?.maxSanctionedExposurePct != null
        ? `${result.maxSanctionedExposurePct.toFixed(1)}%`
        : "—";
    const exposureFlag: "green" | "yellow" | "red" | "grey" =
      (result?.maxSanctionedExposurePct ?? 0) >= 50
        ? "red"
        : (result?.maxSanctionedExposurePct ?? 0) >= 25
          ? "yellow"
          : result?.maxSanctionedExposurePct != null
            ? "green"
            : "grey";

    const coRisk = formatCoInvestorRisk(
      coInv
        ? {
            flaggedCount: coInv.flaggedCount,
            reviewCount: coInv.reviewCount,
          }
        : null,
    );
    const coFlag: "green" | "yellow" | "red" | "grey" =
      (coInv?.flaggedCount ?? 0) > 0
        ? "red"
        : (coInv?.reviewCount ?? 0) > 0
          ? "yellow"
          : coInv
            ? "green"
            : "grey";

    const statusSummary =
      existingStatus.get(docId) ??
      (s.portfolioReviewStatus as string | undefined) ??
      "";

    const cells: [number, string, "green" | "grey" | "yellow" | "red"][] = [
      [0, lastScreened, "grey"],
      [1, openFlags, openFlagLevel],
      [2, highestEntity, highestFlag],
      [3, maxExposure, exposureFlag],
      [4, coRisk, coFlag],
      [5, statusSummary, "grey"],
    ];

    for (const [colIdx, summary, flag] of cells) {
      cellOps.push({
        reviewId: reviewId as mongoose.Types.ObjectId,
        documentId: docId,
        columnIndex: colIdx,
        content: { summary, flag, reasoning: "" },
        status: "done",
      });
    }
  }

  review = await TabularReview.findOneAndUpdate(
    { userId: params.userId, reviewKind: "portfolio_monitoring" },
    {
      $set: {
        userId: params.userId,
        userEmail: params.userEmail,
        title: "Portfolio Sanctions Monitoring",
        projectId: null,
        workflowId: "builtin-portfolio-monitoring",
        reviewKind: "portfolio_monitoring",
        columnsConfig: PORTFOLIO_COLUMNS,
        rowIds,
        rows,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, new: true },
  );

  const rid = review._id as mongoose.Types.ObjectId;
  await TabularCell.deleteMany({ reviewId: rid });
  if (cellOps.length > 0) {
    await TabularCell.insertMany(
      cellOps.map((c) => ({ ...c, reviewId: rid })),
    );
  }

  return { reviewId: String(rid), rowCount: rows.length };
}

/** Copy entity review statuses into tabular Status column for entity_screening reviews. */
export async function syncEntityReviewStatusesToTabular(
  startupId: string,
  reviewId: string,
): Promise<void> {
  const reviews = await EntityReview.find({ startupId }).lean();
  if (reviews.length === 0) return;

  for (const r of reviews) {
    const docId = `entity:${encodeURIComponent(r.entityName as string)}`;
    await TabularCell.findOneAndUpdate(
      {
        reviewId,
        documentId: docId,
        columnIndex: 9,
      },
      {
        $set: {
          content: {
            summary: r.status as string,
            flag: "grey",
            reasoning: (r.notes as string) ?? "",
          },
          status: "done",
        },
      },
      { upsert: true },
    );
  }
}
