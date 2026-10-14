import { useEffect, useState } from "react";
import { getApiErrorMessage } from "../../lib/api";
import { auditChanges, formatDate } from "./quotePresentation";
import { quotesApi } from "./quotesApi";
import type { AuditEvent, PaginatedAuditResponse } from "./types";

const eventLabels: Record<AuditEvent["type"], string> = {
    "quote.created": "Quote created",
    "quote.assigned": "Staff assignment changed",
    "quote.status_changed": "Status changed",
};

export default function AuditTimeline({ quoteId }: { quoteId: number }) {
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const [history, setHistory] = useState<PaginatedAuditResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await quotesApi.getEvents(quoteId, page, controller.signal);
                if (!controller.signal.aborted) {
                    if (page > response.meta.last_page) {
                        setPage(response.meta.last_page);
                    } else {
                        setHistory(response);
                    }
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(getApiErrorMessage(err));
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void load();
        return () => controller.abort();
    }, [quoteId, page, refreshKey]);

    const refresh = () => {
        setPage(1);
        setRefreshKey((value) => value + 1);
    };

    return (
        <section aria-labelledby="audit-title" className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
                <div>
                    <h3 id="audit-title" className="font-semibold text-slate-900">Audit history</h3>
                    <p className="mt-1 text-xs text-slate-500">Recent changes may take a moment to appear. Refresh to check for new activity.</p>
                </div>
                <button type="button" onClick={refresh} disabled={loading} className="shrink-0 cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">
                    Refresh history
                </button>
            </div>
            <div className="p-5" aria-busy={loading}>
                {loading && <p role="status" className="text-sm text-slate-500">Loading audit history...</p>}
                {error && (
                    <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p>Audit history is currently unavailable. Quote details and permitted actions are still available.</p>
                        <p className="mt-1">{error}</p>
                        <button type="button" onClick={refresh} className="mt-3 cursor-pointer font-medium underline">Try again</button>
                    </div>
                )}
                {!loading && !error && history?.data.length === 0 && (
                    <p className="text-sm text-slate-500">No audit events yet.</p>
                )}
                {!loading && !error && history && history.data.length > 0 && (
                    <ol className="space-y-6 pl-5">
                        {history.data.map((event) => (
                            <li key={event.eventId} className="relative min-w-0 border-b border-slate-200 pb-6 last:border-b-0 last:pb-0">
                                <span aria-hidden="true" className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-slate-400 ring-4 ring-white" />
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <h4 className="text-sm font-medium text-slate-900">{eventLabels[event.type]}</h4>
                                    <time dateTime={event.occurredAt} className="text-xs text-slate-500">{formatDate(event.occurredAt, true)}</time>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{event.actorId === null ? "Public submission" : `Actor #${event.actorId}`}</p>
                                <dl className="mt-3 space-y-2 text-sm">
                                    {auditChanges(event).map((change) => (
                                        <div key={change.label}>
                                            <dt className="text-xs text-slate-500">{change.label}</dt>
                                            <dd className="mt-1 break-words text-slate-700">
                                                <span className="sr-only">Previous value: </span>{change.previous}
                                                <span aria-hidden="true" className="px-2 text-slate-400">→</span>
                                                <span className="sr-only">New value: </span>{change.next}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
            {history && !error && (
                <nav aria-label="Audit history pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-sm">
                    <p className="text-slate-500">Page {history.meta.current_page} of {history.meta.last_page} · {history.meta.total} events</p>
                    <div className="flex gap-2">
                        <button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                        <button type="button" disabled={loading || page >= history.meta.last_page} onClick={() => setPage((value) => value + 1)} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                    </div>
                </nav>
            )}
        </section>
    );
}
