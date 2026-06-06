import "./loadEnv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { logAuthStartupWarnings } from "./lib/auth/config";
import { logEncryptionSecretWarnings } from "./lib/auth/encryptionSecret";
import { logEmailStartupWarnings } from "./lib/auth/emailConfig";
import { logR2StartupWarnings } from "./lib/infra/r2Config";
import { logRagStartupWarnings } from "./lib/rag/embed";
import {
  projectDocumentsRouter,
  singleDocumentsRouter,
} from "./routes/documents/singleDocuments";
import { projectsRouter } from "./routes/projects/index";
import { screenRouter } from "./routes/screen";
import { chatRouter } from "./routes/chat";
import { assistantChatRouter } from "./routes/assistantChat";
import { workflowsRouter } from "./routes/workflows";
import { startupsRouter } from "./routes/startups/index";
import { auditLogsRouter } from "./routes/auditLogs";
import { chatsRouter } from "./routes/chats";
import { configRouter } from "./routes/config";
import { tabularReviewRouter } from "./routes/tabularReview";
import { portfolioRouter } from "./routes/portfolioMonitoring";
import { authRouter } from "./routes/auth";
import { userRouter } from "./routes/user";
import { getAnthropicModel } from "./lib/llm/models";
import { validateAnthropicKeyLive } from "./lib/llm/validateKey";
import { checkWatchmanHealth } from "./lib/screening/watchman";
import { startRescreenScheduler } from "./lib/portfolio/rescreenScheduler";
import { disconnectDb } from "./lib/infra/db";
import { startupDocumentDownloadRouter } from "./routes/documents/startupDocumentDownload";
import { requireAuth } from "./middleware/requireAuth";
import {
  assistantChatLimiter,
  screenerChatLimiter,
} from "./lib/infra/chatRateLimits";
import { isCacheRedis } from "./lib/infra/cache";

const app = express();
const PORT = process.env.PORT ?? 3001;
const isProduction = process.env.NODE_ENV === "production";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function minutes(value: number): number {
  return value * 60 * 1000;
}

const generalLimiter = rateLimit({
  windowMs: minutes(envInt("RATE_LIMIT_GENERAL_WINDOW_MINUTES", 15)),
  max: envInt("RATE_LIMIT_GENERAL_MAX", 300),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  message: { detail: "Too many requests. Please try again later." },
});

const screenLimiter = rateLimit({
  windowMs: minutes(15),
  max: 20,
  message: { detail: "Too many screening requests. Please try again later." },
});

app.disable("x-powered-by");
app.set("trust proxy", envInt("TRUST_PROXY_HOPS", 1));

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: isProduction
      ? { maxAge: 15552000, includeSubDomains: true }
      : false,
    referrerPolicy: { policy: "no-referrer" },
  }),
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.use(generalLimiter);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

app.post("/api/screen", screenLimiter);
app.use("/api/screen", screenRouter);

// Separate per-user rate buckets — screener and assistant do not share limits.
app.use("/api/chat", requireAuth, screenerChatLimiter, chatRouter);
app.use("/chat", requireAuth, assistantChatLimiter, assistantChatRouter);

app.use("/workflows", workflowsRouter);
app.use("/single-documents", singleDocumentsRouter);
app.use("/projects", projectsRouter);
app.use("/projects", projectDocumentsRouter);

app.use("/api/startups", startupsRouter);
app.use("/api/documents", startupDocumentDownloadRouter);
app.use("/api/chats", chatsRouter);
app.use("/api/audit-logs", auditLogsRouter);
app.use("/api/config", configRouter);
app.use("/api/portfolio", portfolioRouter);
app.use("/tabular-review", tabularReviewRouter);
app.use("/auth", authRouter);
app.use("/user", userRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

// 404 — must come after all route registrations
app.use((_req, res) => {
  res.status(404).json({ detail: "Not found" });
});

// Global error handler — the 4-arg signature is what tells Express this is an error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;

  // Respect status codes carried on the error (http-errors / body-parser style)
  const rawStatus = (err as Record<string, unknown>)?.status ?? (err as Record<string, unknown>)?.statusCode;
  const status: number =
    typeof rawStatus === "number" && rawStatus >= 400 && rawStatus < 600
      ? rawStatus
      : err instanceof SyntaxError
        ? 400
        : 500;

  if (status >= 500) {
    console.error(err);
  }

  const message =
    isProduction && status >= 500
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "An error occurred";

  res.status(status).json({ detail: message });
});

const server = app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  logAuthStartupWarnings();
  logEncryptionSecretWarnings();
  logEmailStartupWarnings();
  logR2StartupWarnings();
  logRagStartupWarnings();
  console.log(`Anthropic model: ${getAnthropicModel()}`);
  console.log(`Cache backend: ${isCacheRedis() ? "Upstash Redis" : "in-memory (no UPSTASH_REDIS_REST_URL set)"}`);
  console.log("IC memo: POST /api/startups/:id/ic-memo");
  void validateAnthropicKeyLive();
  void checkWatchmanHealth();
  startRescreenScheduler();
});

function shutdown(signal: string): void {
  console.log(`${signal} received — starting graceful shutdown`);

  // Force-exit if drain takes too long (e.g. hung keep-alive or SSE stream)
  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000);
  // Don't let this timer alone keep the process alive
  forceExit.unref();

  server.close(() => {
    disconnectDb()
      .then(() => {
        clearTimeout(forceExit);
        process.exit(0);
      })
      .catch((err) => {
        console.error("Error closing MongoDB connection:", err);
        process.exit(1);
      });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
