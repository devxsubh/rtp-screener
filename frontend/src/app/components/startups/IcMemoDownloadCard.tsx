"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { getIcMemoDocument } from "@/lib/startupsApi";
import { downloadIcMemoAsDoc } from "@/lib/downloadIcMemo";

interface Props {
  startupId: string;
  documentId: string;
  title: string;
}

export function IcMemoDownloadCard({ startupId, documentId, title }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const doc = await getIcMemoDocument(startupId, documentId);
      downloadIcMemoAsDoc(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2.5 mt-2">
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
          <p className="text-xs text-gray-600 mt-0.5">
            IC compliance memo ready
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 shrink-0 rounded-md bg-white border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Download .doc
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
