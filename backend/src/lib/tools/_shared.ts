import { Startup, CapTableCsv } from "../../models";
import { coalesceStartupId, isValidStartupObjectId } from "../shared/startupId";
import type { ScreeningResult } from "../screening/runScreening";
import type { ToolContext, ToolDocumentResult } from "./types";
import type { StartupDocumentRecord } from "../documents/icMemoDocument";

export async function loadStartupCapTableCsvContent(
  startupId: string,
  userId?: string,
): Promise<string | null> {
  const filter: Record<string, unknown> = { _id: startupId };
  if (userId) filter.ownerId = userId;

  const startup = (await Startup.findOne(filter).lean()) as
    | Record<string, unknown>
    | null;
  if (!startup) return null;

  let csvDoc = null as Record<string, unknown> | null;
  if (startup.latestCsvId) {
    csvDoc = (await CapTableCsv.findById(startup.latestCsvId as string).lean()) as
      | Record<string, unknown>
      | null;
  }
  if (!csvDoc) {
    csvDoc = (await CapTableCsv.findOne({
      startupId,
      rosterPurpose: { $in: ["cap_table", "entity_roster"] },
    })
      .sort({ uploadedAt: -1 })
      .lean()) as Record<string, unknown> | null;
  }
  if (!csvDoc || typeof csvDoc.content !== "string") return null;
  if (csvDoc.parseStatus === "invalid" || csvDoc.parseStatus === "needs_review") {
    return null;
  }
  return csvDoc.content;
}

export async function resolveScreeningForStartup(
  ctx: ToolContext,
  startupId?: string,
): Promise<{ result: ScreeningResult | null; label: string; id: string | null }> {
  const idQ = coalesceStartupId(startupId, ctx.startupId);

  if (idQ) {
    const match = ctx.mentionedStartups?.find((s) => s.id === idQ);
    if (match?.screeningResult) {
      return { result: match.screeningResult, label: match.name, id: match.id };
    }
    if (ctx.startupId === idQ && ctx.screeningResult) {
      return { result: ctx.screeningResult, label: "workspace", id: idQ };
    }
    const startup = (await Startup.findById(idQ).lean()) as
      | Record<string, unknown>
      | null;
    if (startup?.lastScreeningResult) {
      return {
        result: startup.lastScreeningResult as ScreeningResult,
        label: startup.name as string,
        id: idQ,
      };
    }
    return { result: null, label: idQ, id: idQ };
  }

  if (ctx.screeningResult) {
    return {
      result: ctx.screeningResult,
      label: "attached session",
      id: ctx.startupId ?? null,
    };
  }
  if (ctx.mentionedStartups?.length === 1 && ctx.mentionedStartups[0].screeningResult) {
    return {
      result: ctx.mentionedStartups[0].screeningResult,
      label: ctx.mentionedStartups[0].name,
      id: ctx.mentionedStartups[0].id,
    };
  }
  return { result: null, label: "", id: null };
}

export async function resolveScreeningDocumentContext(
  ctx: ToolContext,
  input: { startup_id?: string },
): Promise<{ result: ScreeningResult; id: string } | { error: string }> {
  const toolStartupId = isValidStartupObjectId(input.startup_id)
    ? input.startup_id!.trim()
    : undefined;

  let result: ScreeningResult | null = ctx.screeningResult;
  let id = coalesceStartupId(ctx.startupId, toolStartupId);

  if (!result || !id) {
    const resolved = await resolveScreeningForStartup(ctx, toolStartupId);
    result = resolved.result;
    id = coalesceStartupId(ctx.startupId, resolved.id, toolStartupId);
  }

  if (!id) {
    const nameHint =
      ctx.screeningResult?.startupName?.trim().toLowerCase() ??
      result?.startupName?.trim().toLowerCase();
    if (nameHint && ctx.userId) {
      const owned = (await Startup.findOne({
        ownerId: ctx.userId,
        name: new RegExp(`^${nameHint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      }).lean()) as Record<string, unknown> | null;
      if (owned) id = String(owned._id);
    }
  }

  if (!result) {
    return {
      error:
        "No screening results to build a document. Run a cap-table screen first or @-mention a startup with a completed screen.",
    };
  }
  if (!id) {
    return {
      error:
        "Could not resolve startup workspace id. @-mention the startup or open its screener page and try again.",
    };
  }
  return { result, id };
}

function startupDocumentDownloadUrl(documentId: string): string {
  return `/api/documents/${documentId}/download`;
}

export function toToolDocument(doc: StartupDocumentRecord): ToolDocumentResult {
  return {
    id: doc.id,
    startupId: doc.startupId,
    kind: doc.kind,
    title: doc.title,
    downloadUrl: startupDocumentDownloadUrl(doc.id),
  };
}
