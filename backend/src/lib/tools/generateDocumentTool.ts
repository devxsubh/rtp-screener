import { resolveScreeningDocumentContext } from "./_shared";
import { docTypeRegistry } from "./documentTypes";
import type { ToolDefinition } from "./registry";

export const generateDocumentTool: ToolDefinition = {
  name: "generate_document",
  schema: {
    name: "generate_document",
    description:
      "Generate and save a compliance document for a startup from screening results. " +
      "Call when the user asks to create any written document: IC memo, screening analysis, " +
      "compliance write-up, remediation plan, or any other document type. " +
      "Set doc_type to 'ic_memo' for Investment Committee memos, 'screening_analysis' for analyst " +
      "write-ups, or any free-form label for custom documents — the LLM writes the content.",
    input_schema: {
      type: "object",
      properties: {
        doc_type: {
          type: "string",
          description:
            "Document type. Use 'ic_memo' for IC memos, 'screening_analysis' for analyst write-ups, " +
            "or a free-form label for any other type (e.g. 'compliance_email', 'remediation_plan'). " +
            "The model picks this based on user intent.",
        },
        content_intent: {
          type: "string",
          description:
            "Plain-language description of what the document should cover. " +
            "For standard types this is optional. For custom doc types, be specific.",
        },
        startup_id: {
          type: "string",
          description:
            "Optional startup id. Omit when workspace context is already active.",
        },
      },
      required: ["doc_type"],
    },
  },
  handler: async (input, ctx) => {
    const args = input as {
      doc_type?: string;
      content_intent?: string;
      startup_id?: string;
    };
    const docType = args.doc_type?.trim() ?? "screening_analysis";

    const resolved = await resolveScreeningDocumentContext(ctx, {
      startup_id: args.startup_id,
    });
    if ("error" in resolved) return { content: resolved.error };

    return docTypeRegistry.dispatch(docType, {
      resolved,
      ctx,
      contentIntent: args.content_intent,
    });
  },
  get routingHint() {
    return (
      `### generate_document\n` +
      `Call when the user asks to create any written document from screening results:\n` +
      `${docTypeRegistry.getRoutingExamples()}\n` +
      `- Any other type (compliance email, remediation plan, etc.) → doc_type=<free-form label>, content_intent=<what to cover>\n` +
      `Reply with one short confirmation sentence after the tool succeeds. Do NOT paste the document content in chat.`
    );
  },
};
