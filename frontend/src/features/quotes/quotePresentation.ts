import type { AuditEvent, QuoteRequest, QuoteStatus } from "./types";

export const statusLabels: Record<QuoteStatus, string> = {
    new: "New",
    in_review: "In Review",
    quoted: "Quoted",
    closed: "Closed",
};

export const statusStyles: Record<QuoteStatus, string> = {
    new: "bg-blue-50 text-blue-700 ring-blue-200",
    in_review: "bg-amber-50 text-amber-700 ring-amber-200",
    quoted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

const transitions: Record<QuoteStatus, QuoteStatus[]> = {
    new: ["in_review"],
    in_review: ["quoted", "closed"],
    quoted: ["closed"],
    closed: [],
};

export function permittedStatuses(
    quote: Pick<QuoteRequest, "status" | "assigned_user_id">,
    user: { id: number; role: string } | null
): QuoteStatus[] {
    if (!user || (user.role !== "admin" && !(user.role === "staff" && quote.assigned_user_id === user.id))) {
        return [];
    }

    return transitions[quote.status];
}

export function formatBudget(value: string): string {
    const labels: Record<string, string> = {
        under_1000: "Under 1,000",
        "1000_5000": "1,000 – 5,000",
        "5000_10000": "5,000 – 10,000",
        above_10000: "Above 10,000",
        not_sure: "Not sure",
    };

    return labels[value] ?? value;
}

export function formatDate(value: string | null, includeTime = false): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...(includeTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const : {}),
    }).format(date);
}

export function auditChanges(event: AuditEvent): { label: string; previous: string; next: string }[] {
    switch (event.type) {
        case "quote.created":
            return [
                { label: "Service", previous: "—", next: event.data.serviceType },
                { label: "Budget", previous: "—", next: formatBudget(event.data.budgetRange) },
            ];
        case "quote.assigned":
            return [{
                label: "Assigned staff",
                previous: event.data.oldAssignedUserId === null ? "Unassigned" : `Staff #${event.data.oldAssignedUserId}`,
                next: `Staff #${event.data.newAssignedUserId}`,
            }];
        case "quote.status_changed":
            return [{ label: "Status", previous: statusLabels[event.data.oldStatus], next: statusLabels[event.data.newStatus] }];
    }
}
