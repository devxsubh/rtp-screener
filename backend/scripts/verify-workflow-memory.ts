/**
 * Live MongoDB verification for workflowMemory.ts CRUD paths.
 * Run: pnpm --filter vc-screener-backend exec tsx scripts/verify-workflow-memory.ts
 */
import "../src/loadEnv";
import mongoose from "mongoose";
import { connectDb } from "../src/lib/infra/db";
import { BUILTIN_WORKFLOWS } from "../src/lib/workflows/builtinWorkflows";
import {
  buildWorkflowStore,
  createWorkflow,
  deleteWorkflow,
  deleteWorkflowShare,
  getWorkflowById,
  hideWorkflow,
  listCustomWorkflows,
  listHiddenWorkflowIds,
  listWorkflowShares,
  shareWorkflow,
  unhideWorkflow,
  updateWorkflow,
} from "../src/lib/workflows/workflowMemory";
import { WorkflowModel } from "../src/models";
import { WorkflowShareModel } from "../src/models";
import { HiddenWorkflowModel } from "../src/models";

const OWNER_ID = "verify-wf-owner";
const OWNER_EMAIL = "owner@verify.local";
const SHARED_ID = "verify-wf-shared";
const SHARED_EMAIL = "shared@verify.local";

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];

function pass(name: string, detail?: string) {
  checks.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string) {
  checks.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

async function cleanup(ids: string[]) {
  await WorkflowShareModel.deleteMany({
    $or: [
      { workflow_id: { $in: ids } },
      { shared_by_user_id: { $in: [OWNER_ID, SHARED_ID] } },
    ],
  });
  await HiddenWorkflowModel.deleteMany({
    user_id: { $in: [OWNER_ID, SHARED_ID] },
    workflow_id: { $in: ids },
  });
  await WorkflowModel.deleteMany({ _id: { $in: ids } });
}

async function main() {
  console.log("workflowMemory live MongoDB verification\n");

  await connectDb();
  pass("connectDb", `readyState=${mongoose.connection.readyState}`);

  const createdIds: string[] = [];

  try {
    // ── createWorkflow (assistant + tabular) ──────────────────────────────
    const assistant = await createWorkflow(OWNER_ID, {
      title: "Verify Assistant WF",
      type: "assistant",
      prompt_md: "Test prompt for verification",
      practice: "compliance",
    });
    createdIds.push(assistant.id);
    if (assistant.id && assistant.title === "Verify Assistant WF") {
      pass("createWorkflow (assistant)", assistant.id);
    } else {
      fail("createWorkflow (assistant)", JSON.stringify(assistant));
    }

    const tabular = await createWorkflow(OWNER_ID, {
      title: "Verify Tabular WF",
      type: "tabular",
      columns_config: [
        { index: 0, name: "Entity", prompt: "Entity name" },
        { index: 1, name: "Risk", prompt: "Risk level" },
      ],
    });
    createdIds.push(tabular.id);
    if (tabular.type === "tabular" && tabular.columns_config?.length === 2) {
      pass("createWorkflow (tabular)", tabular.id);
    } else {
      fail("createWorkflow (tabular)", JSON.stringify(tabular));
    }

    // ── listCustomWorkflows ─────────────────────────────────────────────
    const listed = await listCustomWorkflows(OWNER_ID, OWNER_EMAIL);
    const listedIds = new Set(listed.map((w) => w.id));
    if (listedIds.has(assistant.id) && listedIds.has(tabular.id)) {
      pass("listCustomWorkflows", `${listed.length} workflow(s)`);
    } else {
      fail("listCustomWorkflows", `missing created ids in ${[...listedIds].join(", ")}`);
    }

    const assistantOnly = await listCustomWorkflows(
      OWNER_ID,
      OWNER_EMAIL,
      "assistant",
    );
    if (
      assistantOnly.every((w) => w.type === "assistant") &&
      assistantOnly.some((w) => w.id === assistant.id)
    ) {
      pass("listCustomWorkflows (type filter)");
    } else {
      fail("listCustomWorkflows (type filter)", JSON.stringify(assistantOnly));
    }

    // ── getWorkflowById ───────────────────────────────────────────────────
    const fetched = await getWorkflowById(assistant.id, OWNER_ID, OWNER_EMAIL);
    if (fetched?.is_owner && fetched.allow_edit) {
      pass("getWorkflowById (owner)");
    } else {
      fail("getWorkflowById (owner)", JSON.stringify(fetched));
    }

    const denied = await getWorkflowById(assistant.id, SHARED_ID, SHARED_EMAIL);
    if (denied === null) {
      pass("getWorkflowById (no access before share)");
    } else {
      fail("getWorkflowById (no access before share)", JSON.stringify(denied));
    }

    // ── updateWorkflow ──────────────────────────────────────────────────
    const updated = await updateWorkflow(
      assistant.id,
      OWNER_ID,
      OWNER_EMAIL,
      { title: "Verify Assistant WF (updated)" },
    );
    if (updated?.title === "Verify Assistant WF (updated)") {
      pass("updateWorkflow (owner)");
    } else {
      fail("updateWorkflow (owner)", JSON.stringify(updated));
    }

    const blocked = await updateWorkflow(assistant.id, SHARED_ID, SHARED_EMAIL, {
      title: "Should not apply",
    });
    if (blocked === null) {
      pass("updateWorkflow (denied without share)");
    } else {
      fail("updateWorkflow (denied without share)", JSON.stringify(blocked));
    }

    // ── shareWorkflow ───────────────────────────────────────────────────
    const shareErr = await shareWorkflow(
      assistant.id,
      OWNER_ID,
      OWNER_EMAIL,
      [SHARED_EMAIL],
      true,
    );
    if (shareErr === null) {
      pass("shareWorkflow");
    } else {
      fail("shareWorkflow", shareErr);
    }

    const sharedAccess = await getWorkflowById(
      assistant.id,
      SHARED_ID,
      SHARED_EMAIL,
    );
    if (sharedAccess && !sharedAccess.is_owner && sharedAccess.allow_edit) {
      pass("getWorkflowById (shared with edit)");
    } else {
      fail("getWorkflowById (shared with edit)", JSON.stringify(sharedAccess));
    }

    const sharedUpdate = await updateWorkflow(
      assistant.id,
      SHARED_ID,
      SHARED_EMAIL,
      { prompt_md: "Updated by shared user" },
    );
    if (sharedUpdate?.prompt_md === "Updated by shared user") {
      pass("updateWorkflow (shared editor)");
    } else {
      fail("updateWorkflow (shared editor)", JSON.stringify(sharedUpdate));
    }

    const sharedListed = await listCustomWorkflows(SHARED_ID, SHARED_EMAIL);
    if (sharedListed.some((w) => w.id === assistant.id && !w.is_owner)) {
      pass("listCustomWorkflows (shared recipient)");
    } else {
      fail("listCustomWorkflows (shared recipient)", JSON.stringify(sharedListed));
    }

    // ── listWorkflowShares + deleteWorkflowShare ────────────────────────
    const shares = await listWorkflowShares(assistant.id, OWNER_ID);
    if (shares && shares.length === 1 && shares[0].shared_with_email === SHARED_EMAIL) {
      pass("listWorkflowShares", shares[0].id);
      const removed = await deleteWorkflowShare(
        assistant.id,
        OWNER_ID,
        shares[0].id,
      );
      if (removed) {
        pass("deleteWorkflowShare");
      } else {
        fail("deleteWorkflowShare", "returned false");
      }
    } else {
      fail("listWorkflowShares", JSON.stringify(shares));
    }

    // ── hide / unhide ───────────────────────────────────────────────────
    await hideWorkflow(OWNER_ID, assistant.id);
    const hidden = await listHiddenWorkflowIds(OWNER_ID);
    if (hidden.includes(assistant.id)) {
      pass("hideWorkflow + listHiddenWorkflowIds");
    } else {
      fail("hideWorkflow + listHiddenWorkflowIds", JSON.stringify(hidden));
    }

    await unhideWorkflow(OWNER_ID, assistant.id);
    const unhidden = await listHiddenWorkflowIds(OWNER_ID);
    if (!unhidden.includes(assistant.id)) {
      pass("unhideWorkflow");
    } else {
      fail("unhideWorkflow", JSON.stringify(unhidden));
    }

    // ── buildWorkflowStore (assistantChat dependency) ───────────────────
    const store = await buildWorkflowStore(OWNER_ID, OWNER_EMAIL);
    const builtinIds = BUILTIN_WORKFLOWS.map((w) => w.id);
    const missingBuiltins = builtinIds.filter((id) => !store.has(id));
    if (missingBuiltins.length === 0) {
      pass("buildWorkflowStore (builtins)", `${builtinIds.length} builtin(s)`);
    } else {
      fail("buildWorkflowStore (builtins)", `missing: ${missingBuiltins.join(", ")}`);
    }

    if (store.has(assistant.id) && store.get(assistant.id)?.prompt_md) {
      pass("buildWorkflowStore (custom assistant)");
    } else {
      fail("buildWorkflowStore (custom assistant)", `keys: ${[...store.keys()].join(", ")}`);
    }

    if (!store.has(tabular.id)) {
      pass("buildWorkflowStore (excludes tabular)");
    } else {
      fail("buildWorkflowStore (excludes tabular)", "tabular workflow in store");
    }

    // Re-share for shared-store check
    await shareWorkflow(assistant.id, OWNER_ID, OWNER_EMAIL, [SHARED_EMAIL], false);
    const sharedStore = await buildWorkflowStore(SHARED_ID, SHARED_EMAIL);
    if (sharedStore.has(assistant.id)) {
      pass("buildWorkflowStore (shared assistant)");
    } else {
      fail("buildWorkflowStore (shared assistant)", `keys: ${[...sharedStore.keys()].join(", ")}`);
    }

    // ── deleteWorkflow (cascade shares) ─────────────────────────────────
    const deleted = await deleteWorkflow(assistant.id, OWNER_ID);
    if (deleted) {
      pass("deleteWorkflow (owner)");
      createdIds.splice(createdIds.indexOf(assistant.id), 1);
    } else {
      fail("deleteWorkflow (owner)", "returned false");
    }

    const gone = await getWorkflowById(assistant.id, OWNER_ID, OWNER_EMAIL);
    if (gone === null) {
      pass("deleteWorkflow (gone from DB)");
    } else {
      fail("deleteWorkflow (gone from DB)", JSON.stringify(gone));
    }

    const orphanShares = await WorkflowShareModel.countDocuments({
      workflow_id: assistant.id,
    });
    if (orphanShares === 0) {
      pass("deleteWorkflow (cascade shares)");
    } else {
      fail("deleteWorkflow (cascade shares)", `${orphanShares} orphan share(s)`);
    }

    const deletedTabular = await deleteWorkflow(tabular.id, OWNER_ID);
    if (deletedTabular) {
      pass("deleteWorkflow (tabular)");
      createdIds.splice(createdIds.indexOf(tabular.id), 1);
    } else {
      fail("deleteWorkflow (tabular)", "returned false");
    }
  } finally {
    if (createdIds.length > 0) await cleanup(createdIds);
    await mongoose.disconnect();
  }

  console.log("\n── Summary ──");
  const failed = checks.filter((c) => !c.ok);
  console.log(`  ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) {
    console.error("\nFailed checks:");
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nAll workflowMemory paths verified against live MongoDB.");
}

main().catch((err) => {
  console.error("\nVerification aborted:", err);
  void mongoose.disconnect();
  process.exit(1);
});
