"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Building2, RefreshCw } from "lucide-react";
import { HeaderSearchBtn } from "@/app/components/shared/HeaderSearchBtn";
import { ToolbarTabs } from "@/app/components/shared/ToolbarTabs";
import { RowActions } from "@/app/components/shared/RowActions";
import {
    listStartups,
    deleteStartup,
    listScreeningSummary,
    screenStartup,
    rescreenAll,
    type StartupRecord,
    type ScreeningSummaryRow,
} from "@/lib/startupsApi";
import { NewStartupModal } from "./NewStartupModal";
import { PortfolioMonitoringCard } from "./PortfolioMonitoringCard";
import { ScreeningDigestBanner } from "./ScreeningDigestBanner";
import { CompareStartupsModal } from "./CompareStartupsModal";
import { syncPortfolioGrid } from "@/lib/portfolioApi";

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

type Tab = "all" | "flagged" | "review" | "not-screened";

const NAME_COL_W = "w-[280px] shrink-0";

function screeningLabel(summary?: ScreeningSummaryRow): {
    text: string;
    className: string;
} {
    if (!summary?.lastScreenedAt) {
        return { text: "—", className: "text-gray-300" };
    }
    const parts: string[] = [];
    if (summary.flaggedCount > 0) {
        parts.push(`${summary.flaggedCount} flagged`);
    }
    if (summary.reviewCount > 0) {
        parts.push(`${summary.reviewCount} review`);
    }
    if (parts.length > 0) {
        return {
            text: parts.join(", "),
            className: summary.flaggedCount > 0 ? "text-red-600" : "text-amber-600",
        };
    }
    return { text: "Clear", className: "text-gray-500" };
}

export function StartupsPage() {
    const [startups, setStartups] = useState<StartupRecord[]>([]);
    const [summary, setSummary] = useState<ScreeningSummaryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("all");
    const [search, setSearch] = useState("");
    const [rescreeningId, setRescreeningId] = useState<string | null>(null);
    const [rescreeningAll, setRescreeningAll] = useState(false);
    const [digestRefreshKey, setDigestRefreshKey] = useState(0);
    const [compareOpen, setCompareOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const router = useRouter();

    const summaryById = useMemo(() => {
        const map = new Map<string, ScreeningSummaryRow>();
        for (const row of summary) map.set(row.startupId, row);
        return map;
    }, [summary]);

    function refreshList() {
        setFetchError(null);
        Promise.all([listStartups(), listScreeningSummary()])
            .then(([startupList, summaryList]) => {
                setStartups(startupList);
                setSummary(summaryList);
            })
            .catch(() => {
                setFetchError("Failed to refresh startups. Please try again.");
            });
    }

    useEffect(() => {
        let cancelled = false;
        Promise.all([listStartups(), listScreeningSummary()])
            .then(([startupList, summaryList]) => {
                if (cancelled) return;
                setStartups(startupList);
                setSummary(summaryList);
            })
            .catch(() => {
                if (!cancelled) {
                    setFetchError("Failed to load startups. Check your connection and refresh.");
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function handleDelete(id: string) {
        await deleteStartup(id).catch(() => {});
        setStartups((prev) => prev.filter((s) => s.id !== id));
        setSummary((prev) => prev.filter((r) => r.startupId !== id));
    }

    async function handleRescreen(id: string) {
        setRescreeningId(id);
        try {
            await screenStartup(id, {});
            const [startupList, summaryList] = await Promise.all([
                listStartups(),
                listScreeningSummary(),
            ]);
            setStartups(startupList);
            setSummary(summaryList);
        } catch {
            // screening failure is non-fatal — user can see the error on the startup page
        } finally {
            setRescreeningId(null);
        }
    }

    async function handleRescreenAll() {
        setRescreeningAll(true);
        try {
            await rescreenAll();
            await syncPortfolioGrid().catch(() => {});
            setDigestRefreshKey((k) => k + 1);
            const [startupList, summaryList] = await Promise.all([
                listStartups(),
                listScreeningSummary(),
            ]);
            setStartups(startupList);
            setSummary(summaryList);
        } catch {
            // non-fatal
        } finally {
            setRescreeningAll(false);
        }
    }

    const flaggedTotal = summary.reduce((n, r) => n + r.flaggedCount, 0);
    const reviewTotal = summary.reduce((n, r) => n + r.reviewCount, 0);

    const q = search.toLowerCase();
    const filtered = startups
        .filter((s) => !q || s.name.toLowerCase().includes(q))
        .filter((s) => {
            const row = summaryById.get(s.id);
            if (activeTab === "all") return true;
            if (activeTab === "not-screened") return !row?.lastScreenedAt;
            if (activeTab === "flagged")
                return (row?.flaggedCount ?? 0) > 0;
            if (activeTab === "review")
                return (
                    !!row?.lastScreenedAt &&
                    (row.flaggedCount ?? 0) === 0 &&
                    (row.reviewCount ?? 0) > 0
                );
            return true;
        });

    const compareIds = useMemo(() => {
        const picked = filtered.filter((s) => selectedIds.has(s.id)).map((s) => s.id);
        if (picked.length >= 2) return picked;
        return filtered.slice(0, 8).map((s) => s.id);
    }, [filtered, selectedIds]);

    function toggleSelected(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const tabs: { id: Tab; label: string }[] = [
        { id: "all", label: "All" },
        { id: "flagged", label: "Flagged" },
        { id: "review", label: "Review" },
        { id: "not-screened", label: "Not screened" },
    ];

    return (
        <>
            <div className="flex-1 overflow-y-auto bg-white">
                <div className="mb-1 flex items-center justify-between px-4 py-3 md:px-10">
                    <div>
                        <h1 className="text-2xl font-medium font-serif text-gray-900">
                            Startups
                        </h1>
                        {!loading && startups.length > 0 && (
                            <p className="mt-0.5 text-xs text-gray-400">
                                {startups.length} startup
                                {startups.length !== 1 ? "s" : ""} ·{" "}
                                {flaggedTotal} flagged · {reviewTotal} review
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <HeaderSearchBtn
                            value={search}
                            onChange={setSearch}
                            placeholder="Search startups…"
                        />
                        <PortfolioMonitoringCard compact />
                        {filtered.length >= 2 && (
                            <button
                                type="button"
                                onClick={() => setCompareOpen(true)}
                                className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
                                title={
                                    selectedIds.size >= 2
                                        ? `Compare ${selectedIds.size} selected`
                                        : "Compare up to 8 visible startups"
                                }
                            >
                                Compare
                                {selectedIds.size >= 2 ? ` (${selectedIds.size})` : ""}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => void handleRescreenAll()}
                            disabled={rescreeningAll}
                            title="Re-screen all startups"
                            className="flex items-center justify-center p-1.5 text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-40"
                        >
                            <RefreshCw className={`h-4 w-4 ${rescreeningAll ? "animate-spin" : ""}`} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setModalOpen(true)}
                            className="flex items-center justify-center p-1.5 text-gray-500 hover:text-gray-900 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <ToolbarTabs
                    tabs={tabs}
                    active={activeTab}
                    onChange={setActiveTab}
                />

                <ScreeningDigestBanner refreshKey={digestRefreshKey} />

                {fetchError && (
                    <div className="mx-4 md:mx-10 mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                        {fetchError}
                    </div>
                )}

                <div className="w-full overflow-x-auto">
                    <div className="min-w-full w-full">
                        <div className="flex items-center h-8 w-full pr-3 md:pr-10 border-b border-gray-200 text-xs text-gray-500 font-medium select-none">
                            <div className="w-8 shrink-0 pl-2" />
                            <div
                                className={`sticky left-0 z-[60] ${NAME_COL_W} bg-white pl-2 md:pl-6 text-left`}
                            >
                                Name
                            </div>
                            <div className="ml-auto w-36 shrink-0 text-left">
                                Status
                            </div>
                            <div className="w-40 shrink-0 text-left">
                                Highest risk entity
                            </div>
                            <div className="w-24 shrink-0 text-left">
                                Entities
                            </div>
                            <div className="w-36 shrink-0 text-left">
                                Last screened
                            </div>
                            <div className="w-32 shrink-0 text-left">
                                Created
                            </div>
                            <div className="w-16 shrink-0" />
                        </div>

                        {loading ? (
                            <div>
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="flex items-center h-10 w-full pr-3 md:pr-10 border-b border-gray-50"
                                    >
                                        <div
                                            className={`${NAME_COL_W} shrink-0 pl-4 md:pl-10`}
                                        >
                                            <div className="h-3.5 w-40 rounded bg-gray-100 animate-pulse" />
                                        </div>
                                        <div className="ml-auto w-36 shrink-0">
                                            <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
                                        </div>
                                        <div className="w-40 shrink-0">
                                            <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                                        </div>
                                        <div className="w-24 shrink-0">
                                            <div className="h-3 w-8 rounded bg-gray-100 animate-pulse" />
                                        </div>
                                        <div className="w-36 shrink-0">
                                            <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
                                        </div>
                                        <div className="w-32 shrink-0">
                                            <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
                                        </div>
                                        <div className="w-16 shrink-0" />
                                    </div>
                                ))}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-start py-24 pl-4 md:pl-10 max-w-xs">
                                {activeTab === "all" && !search ? (
                                    <>
                                        <Building2 className="h-8 w-8 text-gray-300 mb-4" />
                                        <p className="text-2xl font-medium font-serif text-gray-900">
                                            Startups
                                        </p>
                                        <p className="mt-1 text-xs text-gray-400 max-w-xs">
                                            Create a deal workspace, upload a
                                            cap-table CSV, and screen ownership
                                            against sanctions lists.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setModalOpen(true)}
                                            className="mt-4 inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 transition-colors shadow-md"
                                        >
                                            + Create New
                                        </button>
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-400">
                                        No matching startups
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div>
                                {filtered.map((s) => {
                                    const row = summaryById.get(s.id);
                                    const status = screeningLabel(row);
                                    const isRescreening = rescreeningId === s.id;
                                    return (
                                        <div
                                            key={s.id}
                                            onClick={() =>
                                                router.push(`/startups/${s.id}`)
                                            }
                                            className="group flex items-center h-10 w-full pr-3 md:pr-10 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <div
                                                className="w-8 shrink-0 pl-2 flex items-center"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(s.id)}
                                                    onChange={() => toggleSelected(s.id)}
                                                    className="h-3.5 w-3.5 rounded border-gray-300"
                                                    aria-label={`Select ${s.name}`}
                                                />
                                            </div>
                                            <div
                                                className={`sticky left-0 z-[60] ${NAME_COL_W} bg-white pl-2 md:pl-6 group-hover:bg-gray-50`}
                                            >
                                                <span className="text-sm text-gray-800 truncate block">
                                                    {s.name}
                                                </span>
                                            </div>
                                            <div
                                                className={`ml-auto w-36 shrink-0 text-sm truncate ${status.className}`}
                                            >
                                                {status.text}
                                            </div>
                                            <div className="w-40 shrink-0 text-sm truncate">
                                                {row?.highestRiskEntity ? (
                                                    <span
                                                        className={
                                                            row.highestRiskLevel === "flagged"
                                                                ? "text-red-600"
                                                                : row.highestRiskLevel === "review"
                                                                  ? "text-amber-600"
                                                                  : "text-gray-500"
                                                        }
                                                        title={row.highestRiskEntity}
                                                    >
                                                        {row.highestRiskEntity}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </div>
                                            <div className="w-24 shrink-0 text-sm text-gray-500 truncate">
                                                {row?.lastScreenedAt ? (
                                                    row.totalEntities
                                                ) : (
                                                    <span className="text-gray-300">
                                                        —
                                                    </span>
                                                )}
                                            </div>
                                            <div className="w-36 shrink-0 text-sm text-gray-500 truncate">
                                                {row?.lastScreenedAt ? (
                                                    formatDate(
                                                        row.lastScreenedAt,
                                                    )
                                                ) : (
                                                    <span className="text-gray-300">
                                                        —
                                                    </span>
                                                )}
                                            </div>
                                            <div className="w-32 shrink-0 text-sm text-gray-500 truncate">
                                                {formatDate(s.createdAt)}
                                            </div>
                                            <div
                                                className="w-16 shrink-0 flex items-center justify-end gap-1"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => void handleRescreen(s.id)}
                                                    disabled={isRescreening || rescreeningAll}
                                                    title="Re-screen"
                                                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
                                                >
                                                    <RefreshCw className={`h-3.5 w-3.5 ${isRescreening ? "animate-spin" : ""}`} />
                                                </button>
                                                <RowActions
                                                    onDelete={() =>
                                                        void handleDelete(s.id)
                                                    }
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <NewStartupModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onCreated={refreshList}
            />
            <CompareStartupsModal
                open={compareOpen}
                onClose={() => setCompareOpen(false)}
                startupIds={compareIds}
            />
        </>
    );
}
