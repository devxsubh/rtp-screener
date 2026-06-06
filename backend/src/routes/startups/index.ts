import { Router } from "express";
import { startupIcMemoRouter } from "../documents/startupIcMemo";
import { portfolioStartupAliasesRouter } from "../portfolio/startupAliases";
import { startupEntityReviewsRouter } from "../screening/entityReviews";
import { startupScreeningRouter } from "../screening/startupRoutes";
import { startupsChatRouter } from "./chat";
import {
  startupsCrudDetailRouter,
  startupsCrudListRouter,
} from "./crud";
import { startupsCsvAnalyzeRouter, startupsCsvRouter } from "./csvs";
import { ragDocumentsRouter } from "./ragDocuments";
import {
  connectDbMiddleware,
  requireStartupOwner,
  startupsBaseMiddleware,
} from "./middleware";

export const startupsRouter = Router();

startupsRouter.use(startupsBaseMiddleware[0]);
startupsRouter.use(connectDbMiddleware);

// Routes without :id ownership guard
startupsRouter.use(portfolioStartupAliasesRouter);
startupsRouter.use(startupsCsvAnalyzeRouter);
startupsRouter.use(startupsCrudListRouter);

startupsRouter.param("id", requireStartupOwner);

// Routes scoped to an owned startup
startupsRouter.use(startupsCrudDetailRouter);
startupsRouter.use(startupsCsvRouter);
startupsRouter.use(startupScreeningRouter);
startupsRouter.use(startupIcMemoRouter);
startupsRouter.use(startupEntityReviewsRouter);
startupsRouter.use(startupsChatRouter);
startupsRouter.use(ragDocumentsRouter);
