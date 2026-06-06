import { Startup } from "../../models";
import { StartupDocument } from "../../models";
import { AuditLog } from "../../models";
import { buildIcMemo } from "./generateIcMemo";
import { buildScreeningAnalysis } from "./generateScreeningAnalysis";
import { isValidStartupObjectId } from "../shared/startupId";
import type { ScreeningResult } from "../../types/screening";
import type { StartupDocumentKind } from "../../models/documents/startupDocument";

export interface StartupDocumentRecord {
  id: string;
  startupId: string;
  kind: StartupDocumentKind;
  title: string;
  content: string;
  screeningScreenedAt: string | null;
  createdAt: string;
}

function toRecord(doc: Record<string, unknown>): StartupDocumentRecord {
  return {
    id: String(doc._id),
    startupId: String(doc.startupId),
    kind: doc.kind as StartupDocumentKind,
    title: doc.title as string,
    content: doc.content as string,
    screeningScreenedAt: (doc.screeningScreenedAt as string | null) ?? null,
    createdAt: new Date(doc.createdAt as Date).toISOString(),
  };
}

async function createStartupScreeningDocument(params: {
  startupId: string;
  screeningResult: ScreeningResult;
  kind: StartupDocumentKind;
  performedBy?: string;
  performedByEmail?: string;
}): Promise<StartupDocumentRecord> {
  if (!isValidStartupObjectId(params.startupId)) {
    throw new Error("Invalid startup id");
  }

  const startup = (await Startup.findById(params.startupId).lean()) as
    | Record<string, unknown>
    | null;

  const startupName =
    (startup?.name as string | undefined) ??
    params.screeningResult.startupName ??
    "Portfolio company";

  const generated =
    params.kind === "ic_memo"
      ? await buildIcMemo(startupName, params.screeningResult)
      : await buildScreeningAnalysis(startupName, params.screeningResult);

  const doc = await StartupDocument.create({
    startupId: params.startupId,
    kind: params.kind,
    title: generated.title,
    content: generated.content,
    screeningScreenedAt: generated.screeningScreenedAt,
  });

  await AuditLog.create({
    startupId: params.startupId,
    eventType:
      params.kind === "ic_memo"
        ? "ic_memo_generated"
        : "screening_analysis_generated",
    performedBy: params.performedBy ?? "system",
    performedByEmail: params.performedByEmail ?? "system@local",
    details: {
      documentId: String(doc._id),
      title: generated.title,
    },
  });

  return toRecord(doc.toObject() as Record<string, unknown>);
}

export async function createIcMemoDocument(params: {
  startupId: string;
  screeningResult: ScreeningResult;
  performedBy?: string;
  performedByEmail?: string;
}): Promise<StartupDocumentRecord> {
  return createStartupScreeningDocument({ ...params, kind: "ic_memo" });
}

export async function createScreeningAnalysisDocument(params: {
  startupId: string;
  screeningResult: ScreeningResult;
  performedBy?: string;
  performedByEmail?: string;
}): Promise<StartupDocumentRecord> {
  return createStartupScreeningDocument({
    ...params,
    kind: "screening_analysis",
  });
}

export async function getLatestIcMemo(
  startupId: string,
): Promise<StartupDocumentRecord | null> {
  const doc = await StartupDocument.findOne({
    startupId,
    kind: "ic_memo",
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!doc) return null;
  return toRecord(doc as Record<string, unknown>);
}

export async function listIcMemos(
  startupId: string,
): Promise<StartupDocumentRecord[]> {
  const docs = await StartupDocument.find({
    startupId,
    kind: "ic_memo",
  })
    .sort({ createdAt: -1 })
    .lean();

  return docs.map((d) => toRecord(d as Record<string, unknown>));
}

export async function getStartupDocument(
  startupId: string,
  documentId: string,
): Promise<StartupDocumentRecord | null> {
  const doc = await StartupDocument.findOne({
    _id: documentId,
    startupId,
  }).lean();
  if (!doc) return null;
  return toRecord(doc as Record<string, unknown>);
}
