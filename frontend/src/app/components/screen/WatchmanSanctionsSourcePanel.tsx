"use client";

import { Database, RefreshCw } from "lucide-react";
import type { WatchmanListInfo } from "@/lib/screenerTypes";

const LIST_LABELS: Record<string, string> = {
  us_ofac: "US OFAC SDN",
  us_csl: "US CSL",
  eu_csl: "EU CSL",
  uk_csl: "UK CSL",
  uk_sanctions: "UK Sanctions",
  bis_dpl: "BIS DPL",
};

function formatListName(key: string): string {
  return LIST_LABELS[key] ?? key.replace(/_/g, " ").toUpperCase();
}

function formatRefreshTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function WatchmanSanctionsSourcePanel({
  listInfo,
  searchLimit,
}: {
  listInfo?: WatchmanListInfo;
  searchLimit?: number;
}) {
  if (!listInfo) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Database className="h-4 w-4 shrink-0 text-gray-400" />
          <span>
            Sanctions source: Watchman Docker — list metadata unavailable on
            this Watchman version.
          </span>
        </div>
      </div>
    );
  }

  const entries = Object.entries(listInfo.lists).sort((a, b) => b[1] - a[1]);
  const totalIndexed = entries.reduce((sum, [, n]) => sum + n, 0);
  const refreshed = formatRefreshTime(listInfo.endedAt ?? listInfo.fetchedAt);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-4 py-3 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Database className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900">
              Sanctions data source
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              Watchman {listInfo.version ?? "unknown"} ·{" "}
              {totalIndexed.toLocaleString()} indexed entries across{" "}
              {entries.length} list{entries.length === 1 ? "" : "s"}
              {searchLimit != null && (
                <> · up to {searchLimit} hits per entity</>
              )}
            </p>
          </div>
        </div>
        {refreshed && (
          <div className="flex items-center gap-1 shrink-0 text-[10px] text-slate-500">
            <RefreshCw className="h-3 w-3" />
            <span>{refreshed}</span>
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(([key, count]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700"
              title={
                listInfo.listHashes?.[key]
                  ? `Hash: ${listInfo.listHashes[key]}`
                  : undefined
              }
            >
              {formatListName(key)}
              <span className="tabular-nums text-slate-400">
                {count.toLocaleString()}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
