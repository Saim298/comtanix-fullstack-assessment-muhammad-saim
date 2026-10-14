import type { QuoteFilters, QuoteStatus } from "./types.ts";

export const initialQuoteFilters: QuoteFilters = {
    page: 1,
    per_page: 20,
    sort_by: "created_at",
    sort_direction: "desc",
};

function positiveInteger(value: string | null): number | undefined {
    if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : undefined;
}

export function readQuoteFilters(search: string): QuoteFilters {
    const params = new URLSearchParams(search);
    const filters = { ...initialQuoteFilters };
    const status = params.get("status");
    const page = positiveInteger(params.get("page"));
    const perPage = positiveInteger(params.get("per_page"));
    const assignee = positiveInteger(params.get("assigned_user_id"));
    const client = params.get("search")?.trim();
    const service = params.get("service_type")?.trim();

    if (client) filters.search = client.slice(0, 150);
    if (service) filters.service_type = service.slice(0, 100);
    if (status && ["new", "in_review", "quoted", "closed"].includes(status)) filters.status = status as QuoteStatus;
    if (page) filters.page = page;
    if (perPage && perPage <= 100) filters.per_page = perPage;
    if (params.get("unassigned") === "1") filters.unassigned = 1;
    else if (assignee) filters.assigned_user_id = assignee;
    if (params.get("sort_direction") === "asc") filters.sort_direction = "asc";

    return filters;
}

export function writeQuoteFilters(filters: QuoteFilters): string {
    const params = new URLSearchParams();
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    if (filters.status) params.set("status", filters.status);
    if (filters.service_type?.trim()) params.set("service_type", filters.service_type.trim());
    if (filters.unassigned) params.set("unassigned", "1");
    else if (filters.assigned_user_id) params.set("assigned_user_id", String(filters.assigned_user_id));
    if (filters.page && filters.page !== 1) params.set("page", String(filters.page));
    if (filters.per_page && filters.per_page !== 20) params.set("per_page", String(filters.per_page));
    if (filters.sort_direction === "asc") params.set("sort_direction", "asc");
    return params.toString();
}
