
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import WorkspaceLayout from "../components/WorkspaceLayout";
import StatusBadge from "../features/quotes/StatusBadge";
import AssigneeFilter from "../features/quotes/AssigneeFilter";
import { initialQuoteFilters, readQuoteFilters, writeQuoteFilters } from "../features/quotes/quoteFilters";
import { formatBudget, formatDate } from "../features/quotes/quotePresentation";
import { getApiErrorMessage } from "../lib/api";
import { quotesApi } from "../features/quotes/quotesApi";
import type {
    PaginatedQuotesResponse,
    QuoteFilters,
    QuoteRequest,
    QuoteStatus,
} from "../features/quotes/types";

function getVisiblePages(current: number, total: number): number[] {
    const count = Math.min(5, total);
    const start = Math.max(1, Math.min(current - 2, total - count + 1));

    return Array.from(
        { length: count },
        (_, index) => start + index
    );
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const notice = (location.state as { notice?: string } | null)?.notice;

    const query = useMemo(() => readQuoteFilters(location.search), [location.search]);
    const [draft, setDraft] = useState<{ key: string; search: string; service: string } | null>(null);
    if (draft && draft.key !== location.key) setDraft(null);
    const searchText = draft?.key === location.key ? draft.search : query.search ?? "";
    const serviceText = draft?.key === location.key ? draft.service : query.service_type ?? "";
    const pendingTextFilters = searchText.trim() !== (query.search ?? "") || serviceText.trim() !== (query.service_type ?? "");
    const [pageInput, setPageInput] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
    const [pagination, setPagination] = useState<
        PaginatedQuotesResponse["meta"] | null
    >(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const updateQuery = useCallback((next: QuoteFilters, replace = false) => {
        const search = writeQuoteFilters(next);
        if (search === location.search.replace(/^\?/, "")) return;
        navigate({ pathname: location.pathname, search }, { replace, state: location.state });
    }, [navigate, location.pathname, location.search, location.state]);

    useEffect(() => {
        if (searchText.trim() === (query.search ?? "") && serviceText.trim() === (query.service_type ?? "")) return;
        const timer = window.setTimeout(() => {
            updateQuery({ ...query, search: searchText.trim() || undefined, service_type: serviceText.trim() || undefined, page: 1 });
            setPageInput("");
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchText, serviceText, query, updateQuery, location.key]);

    useEffect(() => {
        const controller = new AbortController();

        const loadQuotes = async () => {
            setLoading(true);
            setError("");

            try {
                const response = await quotesApi.getAll(
                    query,
                    controller.signal
                );

                if (!controller.signal.aborted) {
                    if ((query.page ?? 1) > response.meta.last_page) {
                        updateQuery({ ...query, page: response.meta.last_page }, true);
                        return;
                    }
                    setQuotes(response.data);
                    setPagination(response.meta);
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setQuotes([]);
                    setPagination(null);
                    setError(getApiErrorMessage(err));
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        void loadQuotes();

        return () => controller.abort();
    }, [query, refreshKey, updateQuery]);

    const changeFilters = (changes: Partial<QuoteFilters>) => {
        updateQuery({
            ...query,
            search: searchText.trim() || undefined,
            service_type: serviceText.trim() || undefined,
            ...changes,
            page: 1,
        });
        setPageInput("");
    };

    const clearFilters = () => {
        setDraft(null);
        setPageInput("");
        updateQuery({ ...initialQuoteFilters });
    };

    const currentPage = query.page ?? 1;
    const totalPages = pagination?.last_page ?? 1;
    const visiblePages = getVisiblePages(currentPage, totalPages);
    const requestedPage = Number(pageInput);

    const validRequestedPage =
        /^[1-9]\d*$/.test(pageInput) &&
        Number.isSafeInteger(requestedPage) &&
        requestedPage <= totalPages;

    const changePage = (nextPage: number) => {
        if (
            pendingTextFilters ||
            !Number.isInteger(nextPage) ||
            nextPage < 1 ||
            nextPage > totalPages ||
            nextPage === currentPage
        ) {
            return;
        }

        updateQuery({
            ...query,
            page: nextPage,
        });

        setPageInput("");
    };

    return (
        <WorkspaceLayout>
                {notice && <p role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
                <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                            Quote Requests
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Review incoming requests and track their progress.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
                            {pagination?.total ?? 0} requests
                        </span>

                        <button
                            type="button"
                            onClick={() => setRefreshKey((value) => value + 1)}
                            disabled={loading}
                            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-3">
                        <div>
                            <label
                                htmlFor="quote-search"
                                className="mb-2 block text-xs font-medium text-slate-600"
                            >
                                Search requests
                            </label>

                            <input
                                id="quote-search"
                                type="search"
                                placeholder="Name, email or company..."
                                value={searchText}
                                maxLength={150}
                                onChange={(event) => setDraft({ key: location.key, search: event.target.value, service: serviceText })}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-700"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="quote-status"
                                className="mb-2 block text-xs font-medium text-slate-600"
                            >
                                Status
                            </label>

                            <select
                                id="quote-status"
                                value={query.status ?? ""}
                                onChange={(event) => changeFilters({ status: event.target.value ? event.target.value as QuoteStatus : undefined })}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-700"
                            >
                                <option value="">All statuses</option>
                                <option value="new">New</option>
                                <option value="in_review">In Review</option>
                                <option value="quoted">Quoted</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>

                        <div>
                            <label
                                htmlFor="quote-service"
                                className="mb-2 block text-xs font-medium text-slate-600"
                            >
                                Service type
                            </label>

                            <input
                                id="quote-service"
                                type="search"
                                placeholder="Search services..."
                                value={serviceText}
                                maxLength={100}
                                onChange={(event) => setDraft({ key: location.key, search: searchText, service: event.target.value })}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-700"
                            />
                        </div>
                        <AssigneeFilter
                            value={query.unassigned ? "unassigned" : String(query.assigned_user_id ?? "")}
                            onChange={(value) => changeFilters({ assigned_user_id: value && value !== "unassigned" ? Number(value) : undefined, unassigned: value === "unassigned" ? 1 : undefined })}
                        />
                        <div>
                            <label htmlFor="quote-sort" className="mb-2 block text-xs font-medium text-slate-600">Submitted date</label>
                            <select id="quote-sort" value={query.sort_direction} onChange={(event) => changeFilters({ sort_direction: event.target.value as "asc" | "desc" })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-700">
                                <option value="desc">Newest first</option>
                                <option value="asc">Oldest first</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                            Clear filters
                        </button>

                        <span role="status" className="text-xs text-slate-500">
                            {loading ? "Updating results..." : error ? "Unable to load results" : "Results up to date"}
                        </span>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                        >
                            <p>{error}</p>

                            <button
                                type="button"
                                onClick={() => setRefreshKey((value) => value + 1)}
                                className="mt-3 cursor-pointer font-medium underline"
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    <div className="overflow-x-auto" aria-busy={loading}>
                        <table className="w-full min-w-[900px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-5 py-4 font-medium">Client</th>
                                    <th className="px-5 py-4 font-medium">Service</th>
                                    <th className="px-5 py-4 font-medium">Budget</th>
                                    <th className="px-5 py-4 font-medium">Status</th>
                                    <th className="px-5 py-4 font-medium">Assigned To</th>
                                    <th className="px-5 py-4 font-medium">Submitted</th>
                                </tr>
                            </thead>

                            <tbody
                                className={`divide-y divide-slate-100 ${
                                    loading ? "opacity-50" : ""
                                }`}
                            >
                                {quotes.map((quote) => (
                                    <tr
                                        key={quote.id}
                                        className="cursor-pointer hover:bg-slate-50 focus-within:bg-slate-50"
                                        onClick={(event) => {
                                            if (event.target instanceof Element && event.target.closest("a")) return;
                                            if (window.getSelection()?.toString()) return;
                                            navigate(`/quotes/${quote.id}`);
                                        }}
                                    >
                                        <td className="px-5 py-4">
                                            <Link to={`/quotes/${quote.id}`} aria-label={`View quote #${quote.id} for ${quote.client_name}`} className="rounded font-medium text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-700">
                                                {quote.client_name}
                                            </Link>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {quote.email}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-400">
                                                #{quote.id} · {quote.company || "Individual"}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4 text-slate-700">
                                            {quote.service_type}
                                        </td>

                                        <td className="px-5 py-4 text-slate-600">
                                            {formatBudget(quote.budget_range)}
                                        </td>

                                        <td className="px-5 py-4">
                                            <StatusBadge status={quote.status} />
                                        </td>

                                        <td className="px-5 py-4 text-slate-600">
                                            {quote.assigned_user?.name || "Unassigned"}
                                        </td>

                                        <td className="px-5 py-4 text-slate-500">
                                            {formatDate(quote.created_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {loading && quotes.length === 0 && (
                            <div
                                role="status"
                                className="py-14 text-center text-sm text-slate-500"
                            >
                                Loading quote requests...
                            </div>
                        )}

                        {!loading && !error && quotes.length === 0 && (
                            <div className="py-14 text-center">
                                <p className="font-medium text-slate-800">
                                    No quote requests found
                                </p>
                                <p className="mt-2 text-sm text-slate-500">
                                    Try changing your search or filters.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-5 py-4">
                        <p className="text-sm text-slate-500">
                            Page {currentPage} of {totalPages}
                            {" · "}
                            {pagination?.total ?? 0} matching requests
                        </p>

                        <nav
                            aria-label="Quote pagination"
                            className="flex flex-wrap items-center gap-2"
                        >
                            <button
                                type="button"
                                disabled={loading || pendingTextFilters || currentPage <= 1}
                                onClick={() => changePage(currentPage - 1)}
                                className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Previous
                            </button>

                            {visiblePages.map((pageNumber) => (
                                <button
                                    key={pageNumber}
                                    type="button"
                                    disabled={loading || pendingTextFilters}
                                    aria-current={
                                        pageNumber === currentPage
                                            ? "page"
                                            : undefined
                                    }
                                    onClick={() => changePage(pageNumber)}
                                    className={`min-w-9 cursor-pointer rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed ${
                                        pageNumber === currentPage
                                            ? "border-slate-900 bg-slate-900 text-white"
                                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                    {pageNumber}
                                </button>
                            ))}

                            <button
                                type="button"
                                disabled={loading || pendingTextFilters || currentPage >= totalPages}
                                onClick={() => changePage(currentPage + 1)}
                                className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next
                            </button>

                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();

                                    if (validRequestedPage) {
                                        changePage(requestedPage);
                                    }
                                }}
                                className="flex items-center gap-2 sm:ml-2"
                            >
                                <input
                                    type="number"
                                    min={1}
                                    max={totalPages}
                                    aria-label="Jump to page"
                                    placeholder="Page"
                                    value={pageInput}
                                    onChange={(event) => setPageInput(event.target.value)}
                                    className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
                                />

                                <button
                                    type="submit"
                                    disabled={loading || pendingTextFilters || !validRequestedPage}
                                    className="cursor-pointer rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Go
                                </button>
                            </form>
                        </nav>
                    </div>
                </div>
        </WorkspaceLayout>
    );
}
