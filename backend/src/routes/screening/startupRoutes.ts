import { Router } from "express";
import mongoose from "mongoose";
import { syncPortfolioMonitoringReview } from "../../lib/portfolio/portfolioGrid";
import { runScreening } from "../../lib/screening/runScreening";
import {
  computeScreeningDelta,
  getStartupScreeningDelta,
  saveScreeningSnapshot,
} from "../../lib/screening/screeningDelta";
import { CapTableCsv, Startup } from "../../models";
import type { RosterPurpose, ScreeningResult } from "../../types/screening";
import { toStartup } from "../startups/serializers";
import { authIdentityOr500 } from "../../middleware/userIdentity";
import { WatchmanUnavailableError } from "../../lib/screening/watchman";

export const startupScreeningRouter = Router();

function screeningUpdateForPurpose(
  purpose: RosterPurpose,
  result: ScreeningResult,
  csvId: unknown,
): Record<string, unknown> {
  if (purpose === "co_investor") {
    return {
      lastCoInvestorScreeningResult: result,
      lastCoInvestorScreenedAt: new Date(),
    };
  }
  if (purpose === "vendor") {
    return {
      lastVendorScreeningResult: result,
      lastVendorScreenedAt: new Date(),
    };
  }
  return {
    lastScreeningResult: result,
    lastScreenedAt: new Date(),
    lastScreenedCsvId: csvId,
  };
}

startupScreeningRouter.post("/:id/screen", async (req, res) => {
  const { csvId, purpose: purposeBody } = (req.body ?? {}) as {
    csvId?: string;
    purpose?: string;
  };

  const startup = (await Startup.findById(req.params.id).lean()) as
    | Record<string, unknown>
    | null;
  if (!startup) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }

  const purposeKey =
    purposeBody === "co_investor" || purposeBody === "vendor"
      ? purposeBody
      : "cap_table";

  let csvDoc = null as Record<string, unknown> | null;

  if (csvId && mongoose.Types.ObjectId.isValid(csvId)) {
    csvDoc = (await CapTableCsv.findOne({
      _id: csvId,
      startupId: req.params.id,
    }).lean()) as Record<string, unknown> | null;
  } else {
    const byPurpose = startup.latestCsvByPurpose as
      | Record<string, string>
      | undefined;
    const mappedId = byPurpose?.[purposeKey];
    if (mappedId) {
      csvDoc = (await CapTableCsv.findById(mappedId).lean()) as Record<
        string,
        unknown
      > | null;
    }
  }
  if (!csvDoc && purposeKey === "cap_table" && startup.latestCsvId) {
    csvDoc = (await CapTableCsv.findById(startup.latestCsvId as string).lean()) as
      | Record<string, unknown>
      | null;
  }
  if (!csvDoc) {
    csvDoc = (await CapTableCsv.findOne({
      startupId: req.params.id,
      rosterPurpose:
        purposeKey === "cap_table"
          ? { $in: ["cap_table", "entity_roster"] }
          : purposeKey,
    })
      .sort({ uploadedAt: -1 })
      .lean()) as Record<string, unknown> | null;
  }
  if (!csvDoc) {
    res.status(400).json({ detail: "No cap-table CSV uploaded for this startup" });
    return;
  }
  if (csvDoc.parseStatus === "invalid") {
    res.status(400).json({
      detail: "Latest CSV has parse errors — fix and re-upload before screening",
      parseErrors: csvDoc.parseErrors ?? [],
    });
    return;
  }
  if (csvDoc.parseStatus === "needs_review") {
    res.status(400).json({
      detail:
        "Latest CSV needs review — confirm the detected column mapping before screening",
      parseStatus: "needs_review",
    });
    return;
  }

  try {
    const result = await runScreening(csvDoc.content as string, {
      csvId: String(csvDoc._id),
      filename: csvDoc.filename as string | undefined,
    });
    const purpose = (csvDoc.rosterPurpose as RosterPurpose) ?? "cap_table";
    const storagePurpose =
      purpose === "co_investor"
        ? "co_investor"
        : purpose === "vendor"
          ? "vendor"
          : "cap_table";

    let delta = null;
    if (storagePurpose === "cap_table") {
      delta = await computeScreeningDelta(req.params.id, result);
      await saveScreeningSnapshot(req.params.id, "cap_table", result);
    }

    const update = screeningUpdateForPurpose(purpose, result, csvDoc._id);
    const updated = await Startup.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true },
    ).lean();
    if (!updated) {
      res.status(404).json({ detail: "Startup not found" });
      return;
    }

    const identity = authIdentityOr500(res);
    if (identity) {
      await syncPortfolioMonitoringReview({
        userId: identity.userId,
        userEmail: identity.userEmail,
      }).catch(() => {});
    }
    res.json({
      screeningResult: result,
      startup: toStartup(updated),
      delta,
      purpose: storagePurpose,
    });
  } catch (err) {
    if (err instanceof WatchmanUnavailableError) {
      res.status(503).json({ detail: err.message });
      return;
    }
    const detail = err instanceof Error ? err.message : "Screening failed";
    res.status(400).json({ detail });
  }
});

startupScreeningRouter.get("/:id/screening-delta", async (req, res) => {
  const startup = (await Startup.findById(req.params.id).lean()) as
    | Record<string, unknown>
    | null;
  if (!startup?.lastScreeningResult) {
    res.json({
      hasPrevious: false,
      previousScreenedAt: null,
      changes: [],
      summary: "No screening on file.",
    });
    return;
  }
  const delta = await getStartupScreeningDelta(
    req.params.id,
    startup.lastScreeningResult as ScreeningResult,
  );
  res.json(delta);
});

startupScreeningRouter.get("/:id/screening-report", async (req, res) => {
  const format = (req.query.format as string) ?? "json";
  const startup = (await Startup.findById(req.params.id).lean()) as
    | Record<string, unknown>
    | null;
  if (!startup) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }
  const result = startup.lastScreeningResult as ScreeningResult | null;
  if (!result) {
    res.status(400).json({ detail: "No screening result" });
    return;
  }

  if (format === "csv") {
    const disclaimer =
      "DRAFT AI NARRATIVE — screening aid only; not a legal determination or sanctions confirmation";
    const header =
      "entity,type,risk,match_score,ultimate_owner,ownership_path,sanctions_match,explanation,ai_narrative_disclaimer\n";
    const rows = result.entities.map((e) => {
      const match = e.matches[0]?.sdnName ?? "";
      const path = e.ownershipPath.join(" → ");
      const score = e.topScore != null ? String(Math.round(e.topScore * 100)) : "";
      const explanation = e.explanation ?? "";
      const rowDisclaimer = explanation ? disclaimer : "";
      return [
        `"${e.name.replace(/"/g, '""')}"`,
        e.type,
        e.riskLevel,
        score,
        `"${(e.ultimateOwner ?? "").replace(/"/g, '""')}"`,
        `"${path.replace(/"/g, '""')}"`,
        `"${match.replace(/"/g, '""')}"`,
        `"${explanation.replace(/"/g, '""')}"`,
        `"${rowDisclaimer.replace(/"/g, '""')}"`,
      ].join(",");
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${(startup.name as string).replace(/\s+/g, "-")}-screening.csv"`,
    );
    res.send(header + rows.join("\n"));
    return;
  }

  res.json({
    startupName: startup.name,
    screenedAt: startup.lastScreenedAt,
    screeningResult: result,
  });
});

