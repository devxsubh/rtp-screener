import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { requireAuth } from "../middleware/requireAuth";
import * as store from "../lib/workflows/workflowMemory";
import { connectDb } from "../lib/infra/db";
import { sendEmailSafe, sendWorkflowInviteEmail } from "../lib/auth/email";
import { resolveInviterLabel } from "../lib/auth/inviterLabel";
import { WorkflowModel } from "../models";
import { workflowListCache, TTL, cacheKey } from "../lib/infra/cache";

export const workflowsRouter = Router();

type AsyncRoute = (req: Request, res: Response) => Promise<unknown>;

function asyncRoute(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}

workflowsRouter.use(requireAuth);
workflowsRouter.use(async (_req, _res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
});

// GET /workflows
workflowsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string;
    const { type } = req.query as { type?: string };
    if (type && type !== "assistant" && type !== "tabular") {
      res.status(400).json({ detail: "type must be 'assistant' or 'tabular'" });
      return;
    }
    const key = cacheKey.workflowList(userId, userEmail, type);
    const cached = await workflowListCache.get(key);
    if (cached !== null) {
      res.json(cached);
      return;
    }
    const result = await store.listCustomWorkflows(
      userId,
      userEmail,
      type as store.WorkflowType | undefined,
    );
    await workflowListCache.set(key, result, TTL.workflowList);
    res.json(result);
  }),
);

// POST /workflows
workflowsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string;
    const { title, type, prompt_md, columns_config, practice } = req.body as {
      title?: string;
      type?: string;
      prompt_md?: string;
      columns_config?: store.ColumnConfig[];
      practice?: string | null;
    };

    if (!title?.trim()) {
      res.status(400).json({ detail: "title is required" });
      return;
    }
    if (type !== "assistant" && type !== "tabular") {
      res.status(400).json({ detail: "type must be 'assistant' or 'tabular'" });
      return;
    }

    const created = await store.createWorkflow(userId, {
      title,
      type,
      prompt_md,
      columns_config,
      practice,
    });
    await workflowListCache.invalidatePrefix(`workflows:list:${userId}:${userEmail}`);
    res.status(201).json(created);
  }),
);

async function handleWorkflowUpdate(req: Request, res: Response) {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const { workflowId } = req.params;
  const updates: {
    title?: string;
    prompt_md?: string;
    columns_config?: store.ColumnConfig[];
    practice?: string | null;
  } = {};
  if (req.body.title != null) updates.title = req.body.title;
  if (req.body.prompt_md != null) updates.prompt_md = req.body.prompt_md;
  if (req.body.columns_config != null) {
    updates.columns_config = req.body.columns_config;
  }
  if ("practice" in req.body) updates.practice = req.body.practice ?? null;

  const updated = await store.updateWorkflow(workflowId, userId, userEmail, updates);
  if (!updated) {
    res.status(404).json({ detail: "Workflow not found or not editable" });
    return;
  }
  const access = await store.getWorkflowById(workflowId, userId, userEmail);
  workflowListCache.invalidatePrefix(`workflows:list:${userId}:${userEmail}`);
  res.json({
    ...updated,
    allow_edit: access?.allow_edit ?? false,
    is_owner: access?.is_owner ?? false,
    shared_by_name: null,
  });
}

workflowsRouter.put("/:workflowId", asyncRoute(handleWorkflowUpdate));
workflowsRouter.patch("/:workflowId", asyncRoute(handleWorkflowUpdate));

// DELETE /workflows/:workflowId
workflowsRouter.delete(
  "/:workflowId",
  asyncRoute(async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string;
    const { workflowId } = req.params;
    if (!(await store.deleteWorkflow(workflowId, userId))) {
      res.status(404).json({ detail: "Workflow not found" });
      return;
    }
    await workflowListCache.invalidatePrefix(`workflows:list:${userId}:${userEmail}`);
    res.status(204).send();
  }),
);

// GET /workflows/hidden
workflowsRouter.get(
  "/hidden",
  asyncRoute(async (_req, res) => {
    const userId = res.locals.userId as string;
    res.json(await store.listHiddenWorkflowIds(userId));
  }),
);

// POST /workflows/hidden
workflowsRouter.post(
  "/hidden",
  asyncRoute(async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string;
    const { workflow_id } = req.body as { workflow_id?: string };
    if (!workflow_id?.trim()) {
      res.status(400).json({ detail: "workflow_id is required" });
      return;
    }
    await store.hideWorkflow(userId, workflow_id);
    await workflowListCache.invalidatePrefix(`workflows:list:${userId}:${userEmail}`);
    res.status(204).send();
  }),
);

// DELETE /workflows/hidden/:workflowId
workflowsRouter.delete(
  "/hidden/:workflowId",
  asyncRoute(async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string;
    const { workflowId } = req.params;
    await store.unhideWorkflow(userId, workflowId);
    await workflowListCache.invalidatePrefix(`workflows:list:${userId}:${userEmail}`);
    res.status(204).send();
  }),
);

// GET /workflows/:workflowId/shares
workflowsRouter.get(
  "/:workflowId/shares",
  asyncRoute(async (req, res) => {
    const userId = res.locals.userId as string;
    const { workflowId } = req.params;
    const rows = await store.listWorkflowShares(workflowId, userId);
    if (!rows) {
      res.status(404).json({ detail: "Workflow not found" });
      return;
    }
    res.json(rows);
  }),
);

// DELETE /workflows/:workflowId/shares/:shareId
workflowsRouter.delete(
  "/:workflowId/shares/:shareId",
  asyncRoute(async (req, res) => {
    const userId = res.locals.userId as string;
    const { workflowId, shareId } = req.params;
    if (!(await store.deleteWorkflowShare(workflowId, userId, shareId))) {
      res.status(404).json({ detail: "Share not found" });
      return;
    }
    res.status(204).send();
  }),
);

// POST /workflows/:workflowId/share
workflowsRouter.post(
  "/:workflowId/share",
  asyncRoute(async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string;
    const { workflowId } = req.params;
    const { emails, allow_edit } = req.body as {
      emails?: string[];
      allow_edit?: boolean;
    };

    if (!emails?.length) {
      res.status(400).json({ detail: "emails is required" });
      return;
    }

    const allowEdit = allow_edit ?? false;
    const err = await store.shareWorkflow(
      workflowId,
      userId,
      userEmail,
      emails,
      allowEdit,
    );
    if (err) {
      const status = err.includes("yourself") ? 400 : 404;
      res.status(status).json({ detail: err });
      return;
    }

    const wfDoc = (await WorkflowModel.findById(workflowId).lean()) as
      | Record<string, unknown>
      | null;
    const workflowTitle =
      typeof wfDoc?.title === "string" ? wfDoc.title : "Compliance workflow";
    const inviterLabel = await resolveInviterLabel(userId, userEmail);
    for (const to of emails.map((e) => e.trim().toLowerCase()).filter(Boolean)) {
      sendEmailSafe(() =>
        sendWorkflowInviteEmail({
          to,
          inviterLabel,
          workflowTitle,
          workflowId,
          allowEdit,
        }),
      );
    }

    res.status(204).send();
  }),
);

// GET /workflows/:workflowId
workflowsRouter.get(
  "/:workflowId",
  asyncRoute(async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string;
    const { workflowId } = req.params;
    const access = await store.getWorkflowById(workflowId, userId, userEmail);
    if (!access) {
      res.status(404).json({ detail: "Workflow not found" });
      return;
    }
    res.json({ ...access, shared_by_name: null });
  }),
);

workflowsRouter.use(
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    console.error("[workflows] unhandled route error", err);
    res.status(500).json({ detail: "Failed to process workflow request" });
  },
);
