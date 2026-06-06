"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
    auditLogExportUrl,
    listAuditLogs,
    type AuditLogEntry,
} from "@/app/lib/auditLogApi";
import {
    EVENT_ICONS,
    EVENT_LABELS,
    auditEventDetail,
} from "@/app/components/startups/auditEventDisplay";

interface Props {
    startupId: string;
}

function formatTs(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function AuditLogPanel({ startupId }: Props) {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [open, setOpen] = useState(false);
    const [fetched, setFetched] = useState(false);

    useEffect(() => {
        if (!open || fetched) return;
        let cancelled = false;
        listAuditLogs(startupId)
            .then((result) => {
                if (!cancelled) {
                    setLogs(result);
                    setFetched(true);
                }
            })
            .catch(() => {
                if (!cancelled) setFetched(true);
            });
        return () => {
            cancelled = true;
        };
    }, [open, startupId, fetched]);

    const loading = open && !fetched;

    return (
        <div className="border-t bg-white">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 w-full px-5 py-2.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
                {open ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                )}
                Audit Log
                {logs.length > 0 && !open && (
                    <span className="ml-auto text-gray-400">
                        {logs.length} event{logs.length !== 1 ? "s" : ""}
                    </span>
                )}
            </button>

            {open && (
                <div className="px-5 pb-4">
                    <div className="mb-2">
                        <a
                            href={auditLogExportUrl(startupId)}
                            className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            Export CSV
                        </a>
                    </div>
                    {loading ? (
                        <p className="text-xs text-gray-400 py-2">Loading…</p>
                    ) : logs.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2">
                            No events recorded yet.
                        </p>
                    ) : (
                        <ul className="space-y-2 mt-1">
                            {logs.map((log) => {
                                const detail = auditEventDetail(log);
                                return (
                                    <li
                                        key={log.id}
                                        className="flex items-start gap-2"
                                    >
                                        <span className="mt-0.5 shrink-0">
                                            {EVENT_ICONS[log.eventType]}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-xs text-gray-800">
                                                {EVENT_LABELS[log.eventType]}
                                                {detail && (
                                                    <span className="ml-1 text-gray-500">
                                                        — {detail}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {log.performedByEmail} ·{" "}
                                                {formatTs(log.createdAt)}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
