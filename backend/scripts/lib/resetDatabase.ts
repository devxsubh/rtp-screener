import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../../src/lib/infra/db";
import { DEMO_STARTUP_NAME } from "./seedDemoShowcase";

export type ResetMode = "full" | "interview";

export type ResetCounts = {
  collections: Array<{ name: string; deleted: number; kept?: number }>;
  demoStartupIds: string[];
};

async function listCollectionNames(): Promise<string[]> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB not connected");
  const collections = await db.listCollections().toArray();
  return collections.map((c) => c.name).sort();
}

export async function countAllDocuments(): Promise<
  Array<{ name: string; count: number }>
> {
  const names = await listCollectionNames();
  const db = mongoose.connection.db!;
  const out: Array<{ name: string; count: number }> = [];
  for (const name of names) {
    const count = await db.collection(name).countDocuments();
    out.push({ name, count });
  }
  return out;
}

export async function findDemoStartupIds(): Promise<string[]> {
  const db = mongoose.connection.db!;
  const startups = await db
    .collection("startups")
    .find({ $or: [{ isSample: true }, { name: DEMO_STARTUP_NAME }] })
    .project({ _id: 1 })
    .toArray();
  return startups.map((s) => String(s._id));
}

async function deleteFromCollection(
  name: string,
  filter: Record<string, unknown>,
): Promise<number> {
  const db = mongoose.connection.db!;
  const result = await db.collection(name).deleteMany(filter);
  return result.deletedCount ?? 0;
}

/** Wipe every document in every collection. Collections and indexes are preserved. */
export async function eraseAllData(): Promise<ResetCounts> {
  const names = await listCollectionNames();
  const db = mongoose.connection.db!;
  const collections: ResetCounts["collections"] = [];

  for (const name of names) {
    const result = await db.collection(name).deleteMany({});
    collections.push({
      name,
      deleted: result.deletedCount ?? 0,
    });
  }

  return { collections, demoStartupIds: [] };
}

/**
 * Keep all users and the seeded NexaFlow demo workspace (all owners).
 * Delete everything else — sessions, test startups, stray chats, etc.
 */
export async function eraseExceptUsersAndDemo(): Promise<ResetCounts> {
  const demoStartupIds = await findDemoStartupIds();
  const demoStartupObjectIds = demoStartupIds.map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  const db = mongoose.connection.db!;
  const collections: ResetCounts["collections"] = [];

  async function track(name: string, deleted: number, kept?: number) {
    collections.push({ name, deleted, kept });
  }

  // Resolve demo tabular review ids before deleting cells/reviews
  const demoReviewIds =
    demoStartupObjectIds.length > 0
      ? (
          await db
            .collection("tabularreviews")
            .find({ projectId: { $in: demoStartupObjectIds } })
            .project({ _id: 1 })
            .toArray()
        ).map((r) => r._id)
      : [];

  const sampleReviewIds = (
    await db
      .collection("tabularreviews")
      .find({ isSample: true })
      .project({ _id: 1 })
      .toArray()
  ).map((r) => r._id);

  const keepReviewIds = [...new Set([...demoReviewIds, ...sampleReviewIds])];

  if (keepReviewIds.length > 0) {
    track(
      "tabularcells",
      await deleteFromCollection("tabularcells", {
        reviewId: { $nin: keepReviewIds },
      }),
    );
  } else {
    track("tabularcells", await deleteFromCollection("tabularcells", {}));
  }

  track(
    "tabularreviews",
    await deleteFromCollection("tabularreviews", { isSample: { $ne: true } }),
  );

  // Assistant chats — not part of the demo dataset; wipe for a clean slate
  track("assistantchats", await deleteFromCollection("assistantchats", {}));

  // Startup-scoped records
  const startupScoped = [
    "startupchats",
    "entityreviews",
    "startupdocuments",
    "screeningsnapshots",
    "screeningdigests",
    "captablecsvs",
    "auditlogs",
  ] as const;

  for (const coll of startupScoped) {
    if (demoStartupObjectIds.length > 0) {
      track(
        coll,
        await deleteFromCollection(coll, {
          startupId: { $nin: demoStartupObjectIds },
        }),
      );
    } else {
      track(coll, await deleteFromCollection(coll, {}));
    }
  }

  // RAG docs (explicit collection names)
  if (demoStartupObjectIds.length > 0) {
    const ragIds = (
      await db
        .collection("rag_documents")
        .find({ startupId: { $in: demoStartupObjectIds } })
        .project({ _id: 1 })
        .toArray()
    ).map((d) => d._id);

    if (ragIds.length > 0) {
      track(
        "doc_chunks",
        await deleteFromCollection("doc_chunks", {
          documentId: { $nin: ragIds },
        }),
      );
    } else {
      track("doc_chunks", await deleteFromCollection("doc_chunks", {}));
    }

    track(
      "rag_documents",
      await deleteFromCollection("rag_documents", {
        startupId: { $nin: demoStartupObjectIds },
      }),
    );
  } else {
    track("doc_chunks", await deleteFromCollection("doc_chunks", {}));
    track("rag_documents", await deleteFromCollection("rag_documents", {}));
  }

  // Uploaded files — keep only demo project attachments
  if (demoStartupObjectIds.length > 0) {
    track(
      "storeddocuments",
      await deleteFromCollection("storeddocuments", {
        $or: [
          { projectId: { $nin: demoStartupObjectIds } },
          { projectId: null },
        ],
      }),
    );
  } else {
    track("storeddocuments", await deleteFromCollection("storeddocuments", {}));
  }

  track(
    "startups",
    await deleteFromCollection("startups", { isSample: { $ne: true } }),
  );

  // Auth/session data — always clear (users re-login)
  track("authtokens", await deleteFromCollection("authtokens", {}));
  track("emailtokens", await deleteFromCollection("emailtokens", {}));

  const apiKeyNames = ["userapikeys", "user_api_keys"];
  for (const name of apiKeyNames) {
    const exists = (await listCollectionNames()).includes(name);
    if (exists) {
      track(name, await deleteFromCollection(name, {}));
    }
  }

  // Custom workflows / shares — builtins live in code
  for (const name of ["workflows", "workflowshares", "hiddenworkflows"]) {
    const exists = (await listCollectionNames()).includes(name);
    if (exists) {
      track(name, await deleteFromCollection(name, {}));
    }
  }

  // Users are intentionally preserved
  const userCount = await db.collection("users").countDocuments();
  track("users", 0, userCount);

  return { collections, demoStartupIds };
}

export async function runReset(mode: ResetMode): Promise<ResetCounts> {
  await connectDb();
  try {
    if (mode === "full") {
      return await eraseAllData();
    }
    return await eraseExceptUsersAndDemo();
  } finally {
    await disconnectDb();
  }
}

export function printResetSummary(
  mode: ResetMode,
  counts: ResetCounts,
): void {
  const totalDeleted = counts.collections.reduce((n, c) => n + c.deleted, 0);

  console.log("\n✓ Database reset complete\n");
  console.log(`  Mode:             ${mode === "full" ? "Complete erase" : "Interview prep (users + demo)"}`);
  if (mode === "interview") {
    console.log(
      `  Demo startups:    ${counts.demoStartupIds.length} (“${DEMO_STARTUP_NAME}”)`,
    );
    if (counts.demoStartupIds.length === 0) {
      console.log(
        `  ⚠ No demo startup found — run: pnpm run seed:demo`,
      );
    } else {
      for (const id of counts.demoStartupIds) {
        console.log(`    - ${id}`);
      }
    }
  }
  console.log(`  Documents deleted: ${totalDeleted}\n`);

  const withDeletes = counts.collections.filter((c) => c.deleted > 0 || c.kept);
  if (withDeletes.length > 0) {
    console.log("  Collection breakdown:");
    for (const c of withDeletes) {
      if (c.kept != null && c.kept > 0) {
        console.log(`    ${c.name}: kept ${c.kept}`);
      } else if (c.deleted > 0) {
        console.log(`    ${c.name}: deleted ${c.deleted}`);
      }
    }
  }

  console.log(
    "\n  Note: Redis cache and R2 object storage are not cleared by this script.",
  );
  if (mode === "interview") {
    console.log(
      "  Users must sign in again (refresh tokens were cleared).",
    );
  }
}
