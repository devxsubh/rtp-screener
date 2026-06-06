import express from "express";
import multer from "multer";
import { friendlyLlmError } from "../lib/llm/friendlyError";
import { runScreening } from "../lib/screening/runScreening";
import { explainMatch } from "../lib/screening/explain";
import type { ScreeningProgressFn } from "../lib/screening/screeningProgress";
import {
  isAllowedCsvMime,
  looksLikeCsvText,
} from "../lib/screening/csvUpload";
import { WatchmanUnavailableError } from "../lib/screening/watchman";
import { requireAuth } from "../middleware/requireAuth";
import type { RiskLevel } from "../lib/screening/classify";
import type { WatchmanMatch } from "../lib/screening/watchman";

export const screenRouter = express.Router();

screenRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedCsvMime(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are accepted (text/csv or text/plain)"));
    }
  },
});

async function screenCsvContent(
  csv: string,
  filename?: string,
  onProgress?: ScreeningProgressFn,
) {
  return runScreening(csv, { filename, onProgress });
}

screenRouter.post("/", upload.single("csv"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ detail: "No CSV file provided" });
    return;
  }

  if (!looksLikeCsvText(req.file.buffer)) {
    res.status(400).json({ detail: "Uploaded file does not look like CSV text" });
    return;
  }

  const csv = req.file.buffer.toString("utf-8");

  try {
    const result = await screenCsvContent(csv, req.file.originalname);
    res.json(result);
  } catch (err) {
    if (err instanceof WatchmanUnavailableError) {
      res.status(503).json({ detail: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "Screening failed";
    res.status(400).json({ detail: msg });
  }
});

screenRouter.post("/stream", upload.single("csv"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ detail: "No CSV file provided" });
    return;
  }

  if (!looksLikeCsvText(req.file.buffer)) {
    res.status(400).json({ detail: "Uploaded file does not look like CSV text" });
    return;
  }

  const csv = req.file.buffer.toString("utf-8");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const write = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const result = await screenCsvContent(csv, req.file.originalname, (event) => {
      write({ type: "screening_progress", ...event });
    });
    write({ type: "done", screeningResult: result });
  } catch (err) {
    write({ type: "error", detail: friendlyLlmError(err) });
  }

  res.end();
});

screenRouter.post("/explain", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = body.type === "person" || body.type === "company" ? body.type : null;
  const riskLevel = body.riskLevel as RiskLevel | undefined;

  if (!name || !type || !riskLevel) {
    res.status(400).json({ detail: "name, type, and riskLevel are required" });
    return;
  }

  const matches = Array.isArray(body.matches) ? (body.matches as WatchmanMatch[]) : [];
  const ownershipPath = Array.isArray(body.ownershipPath)
    ? body.ownershipPath.filter((p): p is string => typeof p === "string")
    : [];

  try {
    const explanation = await explainMatch(
      { name, type },
      matches,
      ownershipPath,
      riskLevel,
      {
        startupName: typeof body.startupName === "string" ? body.startupName : undefined,
        role: typeof body.role === "string" ? body.role : undefined,
        indirectOwnershipPct:
          typeof body.indirectOwnershipPct === "number"
            ? body.indirectOwnershipPct
            : null,
        exposureStatement:
          typeof body.exposureStatement === "string"
            ? body.exposureStatement
            : undefined,
        ownershipRuleFlags: Array.isArray(body.ownershipRuleFlags)
          ? body.ownershipRuleFlags.filter((f): f is string => typeof f === "string")
          : undefined,
      },
    );
    res.json({ explanation });
  } catch (err) {
    res.status(500).json({ detail: friendlyLlmError(err) });
  }
});
