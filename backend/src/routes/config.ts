import express from "express";
import { getAnthropicModel } from "../lib/llm/models";
import { getScreeningThresholds } from "../lib/screening/screeningConfig";
import { isEmbeddingEnabled } from "../lib/rag/embed";

export const configRouter = express.Router();

/** Public runtime config — model selection lives on the server only. */
configRouter.get("/", (_req, res) => {
  res.json({
    llm: {
      provider: "anthropic",
      model: getAnthropicModel(),
    },
    screening: getScreeningThresholds(),
    ragEnabled: isEmbeddingEnabled(),
  });
});
