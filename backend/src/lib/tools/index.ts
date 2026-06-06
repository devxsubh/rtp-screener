import { ToolRegistry } from "./registry";
import { screenCapTableTool } from "./screenCapTable";
import { listWorkflowsTool, readWorkflowTool } from "./workflowTools";
import { listMentionedStartupsTool } from "./mentionTools";
import { queryScreeningDataTool } from "./queryScreeningData";
import { generateDocumentTool } from "./generateDocumentTool";
import {
  searchCompliancePlaybookTool,
  listStartupDocumentsTool,
  searchStartupDocumentsTool,
  screenDocumentEntitiesTool,
} from "./searchTools";
import { webSearchTool } from "./webSearchTool";

export { ToolRegistry } from "./registry";
export type { ToolDefinition } from "./registry";
export type {
  ToolContext,
  ToolExecutorResult,
  ToolDocumentResult,
  ToolActivity,
} from "./types";
export { SCREEN_CAP_TABLE_TOOL_NAME } from "./screenCapTable";

// ── Screener registry (POST /api/chat) ───────────────────────────────────────
// No workflow tools — workflowStore is never populated in the screener route.
// Adding a new screener capability: add one import above + one .register() here.
export const screenerRegistry = new ToolRegistry()
  .register(screenCapTableTool)
  .register(listMentionedStartupsTool)
  .register(queryScreeningDataTool)
  .register(generateDocumentTool)
  .register(searchCompliancePlaybookTool)
  .register(listStartupDocumentsTool)
  .register(searchStartupDocumentsTool)
  .register(screenDocumentEntitiesTool)
  .register(webSearchTool);

// ── Assistant registry (POST /api/assistant-chat) ────────────────────────────
// Superset of screenerRegistry — includes workflow tools.
export const assistantRegistry = new ToolRegistry()
  .register(listWorkflowsTool)
  .register(readWorkflowTool)
  .register(screenCapTableTool)
  .register(listMentionedStartupsTool)
  .register(queryScreeningDataTool)
  .register(generateDocumentTool)
  .register(searchCompliancePlaybookTool)
  .register(listStartupDocumentsTool)
  .register(searchStartupDocumentsTool)
  .register(screenDocumentEntitiesTool)
  .register(webSearchTool);

// Legacy alias — kept so chatTools.ts shim doesn't break any residual imports.
export const appToolRegistry = assistantRegistry;
