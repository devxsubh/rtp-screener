import express from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/requireAuth";
import { connectDb } from "../lib/infra/db";
import { TabularReview } from "../models";
import { Startup } from "../models";
import {
  seedEntityScreeningReview,
  syncEntityReviewStatusesToTabular,
  syncPortfolioMonitoringReview,
} from "../lib/portfolio/portfolioGrid";
import { getLatestDigest, runPortfolioRescreen } from "../lib/portfolio/rescreenScheduler";
import { compareStartupsWithSharedOwners } from "../lib/portfolio/portfolioCompare";
import type { ScreeningResult } from "../types/screening";

export const portfolioRouter = express.Router();

portfolioRouter.use(requireAuth);
portfolioRouter.use(async (_req, _res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
});

portfolioRouter.post("/sync", async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const result = await syncPortfolioMonitoringReview({ userId, userEmail });
  res.json(result);
});

portfolioRouter.get("/review", async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  let review = await TabularReview.findOne({
    userId,
    reviewKind: "portfolio_monitoring",
  }).lean();

  if (!review) {
    await syncPortfolioMonitoringReview({ userId, userEmail });
    review = await TabularReview.findOne({
      userId,
      reviewKind: "portfolio_monitoring",
    }).lean();
  }

  if (!review) {
    res.status(404).json({ detail: "Portfolio review not found" });
    return;
  }

  res.json({ reviewId: String((review as Record<string, unknown>)._id) });
});

portfolioRouter.post("/rescreen", async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const result = await runPortfolioRescreen({ ownerId: userId, userEmail });
  res.json(result);
});

portfolioRouter.get("/digest", async (_req, res) => {
  const digest = (await getLatestDigest()) as Record<string, unknown> | null;
  if (!digest) {
    res.json(null);
    return;
  }
  res.json({
    id: String(digest._id),
    generatedAt: digest.generatedAt,
    rescreenedCount: digest.rescreenedCount,
    newFlagCount: digest.newFlagCount,
    newReviewCount: digest.newReviewCount,
    changes: digest.changes,
    summaryText: digest.summaryText,
  });
});

portfolioRouter.post("/startups/:startupId/entity-review", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.startupId)) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }

  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;

  const startup = (await Startup.findOne({
    _id: req.params.startupId,
    ownerId: userId,
  }).lean()) as Record<string, unknown> | null;

  if (!startup) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }
  if (!startup.lastScreeningResult) {
    res.status(400).json({
      detail: "No screening result — run a screen on this startup first",
    });
    return;
  }

  const { reviewId } = await seedEntityScreeningReview({
    userId,
    userEmail,
    startupId: req.params.startupId,
    startupName: startup.name as string,
    screeningResult: startup.lastScreeningResult as ScreeningResult,
  });

  await syncEntityReviewStatusesToTabular(req.params.startupId, reviewId);

  res.status(201).json({ reviewId });
});

portfolioRouter.get("/compare", async (req, res) => {
  const idsParam = (req.query.ids as string) ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length < 2) {
    res.status(400).json({ detail: "Provide at least two startup ids via ids=" });
    return;
  }
  const userId = res.locals.userId as string;
  res.json(await compareStartupsWithSharedOwners(ids, userId));
});
