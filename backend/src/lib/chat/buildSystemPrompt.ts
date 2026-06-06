import {
  UNTRUSTED_DATA_PROMPT_GUARD,
  wrapCsvData,
} from "../shared/promptDelimiters";
import { formatMentionedStartupsContext } from "./startupMentions";
import type { ToolContext } from "../tools/types";
import type { ToolRegistry } from "../tools/registry";
import { SCREEN_CAP_TABLE_TOOL_NAME } from "../tools/screenCapTable";

/**
 * Assembles the dynamic suffix appended to each route's base system prompt.
 * Includes: tool routing section, security guard, CSV context, mentions,
 * active workspace hint, and prior screening summary.
 */
export function buildSystemPrompt(
  basePrompt: string,
  ctx: ToolContext,
  registry: ToolRegistry,
): string {
  const parts: string[] = [basePrompt];

  const routingSection = registry.buildRoutingSection();
  if (routingSection) parts.push(routingSection);

  parts.push(UNTRUSTED_DATA_PROMPT_GUARD);

  if (ctx.csvContent && !ctx.screeningResult) {
    parts.push(
      `A cap-table CSV is attached to this session (${ctx.csvContent.split("\n").length} lines). ` +
        `Call ${SCREEN_CAP_TABLE_TOOL_NAME} when the user wants screening.\n${wrapCsvData(ctx.csvContent)}`,
    );
  } else if (ctx.csvContent) {
    parts.push(
      `A cap-table CSV is loaded in this session (${ctx.csvContent.split("\n").length} lines). ` +
        `Call ${SCREEN_CAP_TABLE_TOOL_NAME} again only if the user explicitly requests a re-screen.`,
    );
  }

  if (ctx.mentionedStartups && ctx.mentionedStartups.length > 0) {
    parts.push(formatMentionedStartupsContext(ctx.mentionedStartups));
  }

  if (ctx.startupId) {
    parts.push(
      `Active startup workspace id: ${ctx.startupId}. ` +
        `For generate_document, omit startup_id — the workspace context is already loaded. ` +
        `When the user asks to re-run or refresh screening, call ${SCREEN_CAP_TABLE_TOOL_NAME} — the saved CSV loads automatically.`,
    );
  }

  if (ctx.screeningResult) {
    parts.push(
      `Prior screening in this session:\n${JSON.stringify({
        totalEntities: ctx.screeningResult.totalEntities,
        flaggedCount: ctx.screeningResult.flaggedCount,
        reviewCount: ctx.screeningResult.reviewCount,
        clearCount: ctx.screeningResult.clearCount,
      })}`,
    );
  }

  return parts.join("\n\n");
}
