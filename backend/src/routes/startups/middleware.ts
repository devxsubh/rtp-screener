import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { connectDb } from "../../lib/infra/db";
import { Startup } from "../../models";
import { requireAuth } from "../../middleware/requireAuth";

export function ownerFilter(userId: string) {
  return { ownerId: userId };
}

export async function findOwnedStartup(id: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Startup.findOne({ _id: id, ...ownerFilter(userId) }).lean();
}

export async function connectDbMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
}

export function requireStartupOwner(
  req: Request,
  res: Response,
  next: NextFunction,
  id: string,
): void {
  void (async () => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ detail: "Startup not found" });
      return;
    }
    const userId = res.locals.userId as string;
    const owned = await findOwnedStartup(id, userId);
    if (!owned) {
      res.status(404).json({ detail: "Startup not found" });
      return;
    }
    next();
  })().catch(next);
}

export const startupsBaseMiddleware = [requireAuth, connectDbMiddleware] as const;
