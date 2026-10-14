import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import WorkspaceLayout from "../components/WorkspaceLayout";
import AuditTimeline from "../features/quotes/AuditTimeline";
import QuoteActions from "../features/quotes/QuoteActions";
import StatusBadge from "../features/quotes/StatusBadge";
import { formatBudget, formatDate } from "../features/quotes/quotePresentation";
import { quotesApi } from "../features/quotes/quotesApi";
import type { QuoteRequest } from "../features/quotes/types";
import { getApiErrorMessage } from "../lib/api";

function QuoteDetails({ id }: { id: number }) {
    const [quote, setQuote] = useState<QuoteRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [auditRevision, setAuditRevision] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await quotesApi.getById(id, controller.signal);
                if (!controller.signal.aborted) setQuote(response);
            } catch (err) {
                if (!controller.signal.aborted) {
                    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
                    setError(status === 404 ? "This quote was not found. It may have been deleted."
                        : status === 403 ? "You do not have permission to view this quote." : getApiErrorMessage(err));
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void load();
        return () => controller.abort();
    }, [id, refreshKey]);

    if (loading) return <p role="status" className="py-12 text-center text-sm text-slate-500">Loading quote details...</p>;
    if (error || !quote) return (
        <div role="alert" className="rounded-xl border border-red-200 bg-white p-5 text-sm text-red-700">
            <p>{error || "Quote details are unavailable."}</p>
            <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="mt-3 cursor-pointer font-medium underline">Try again</button>
        </div>
    );

    const fields = [
        ["Client name", quote.client_name],
        ["Email", quote.email],
        ["Company", quote.company || "Individual"],
        ["Service type", quote.service_type],
        ["Budget range", formatBudget(quote.budget_range)],
        ["Assigned staff member", quote.assigned_user ? `${quote.assigned_user.name} (${quote.assigned_user.email})` : "Unassigned"],
        ["Created", formatDate(quote.created_at, true)],
        ["Last updated", formatDate(quote.updated_at, true)],
    ];

    return (
        <>
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Quote #{quote.id}</h2>
                    <p className="mt-1 break-words text-sm text-slate-500">{quote.client_name}</p>
                </div>
                <StatusBadge status={quote.status} />
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-6">
                    <section aria-labelledby="request-title" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <h3 id="request-title" className="font-semibold text-slate-900">Request details</h3>
                        <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                            {fields.map(([label, value]) => (
                                <div key={label} className="min-w-0">
                                    <dt className="text-xs font-medium text-slate-500">{label}</dt>
                                    <dd className="mt-1 break-words text-sm text-slate-800">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        <div className="mt-6 border-t border-slate-100 pt-5">
                            <h4 className="text-xs font-medium text-slate-500">Message</h4>
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{quote.message}</p>
                        </div>
                    </section>
                    <AuditTimeline key={`${id}-${auditRevision}`} quoteId={id} />
                </div>
                <QuoteActions quote={quote} onUpdate={(updated) => { setQuote(updated); setAuditRevision((value) => value + 1); }} />
            </div>
        </>
    );
}

export default function QuoteDetailsPage() {
    const { id = "" } = useParams();
    const quoteId = Number(id);
    const validId = /^[1-9]\d*$/.test(id) && Number.isSafeInteger(quoteId);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);

    return (
        <WorkspaceLayout>
            <Link to="/dashboard" className="mb-6 inline-block rounded text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-700">← Back to dashboard</Link>
            {validId ? <QuoteDetails key={id} id={quoteId} /> : <p role="alert" className="text-sm text-red-700">Invalid quote ID.</p>}
        </WorkspaceLayout>
    );
}
