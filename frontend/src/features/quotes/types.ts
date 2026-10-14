export type QuoteStatus =
    | "new"
    | "in_review"
    | "quoted"
    | "closed";

export interface PublicQuoteInput {
    client_name: string;
    email: string;
    company: string;
    service_type: string;
    budget_range: string;
    message: string;
    website: string;
}

export interface PublicQuoteReceipt {
    id: number;
}

export interface AssignedUser {
    id: number;
    name: string;
    email: string;
}

export interface QuoteRequest {
    id: number;
    client_name: string;
    email: string;
    company: string | null;
    service_type: string;
    budget_range: string;
    message: string;
    status: QuoteStatus;
    assigned_user_id: number | null;
    assigned_user: AssignedUser | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface QuoteFilters {
    search?: string;
    status?: QuoteStatus;
    service_type?: string;
    assigned_user_id?: number;
    unassigned?: 1;
    page?: number;
    per_page?: number;
    sort_by?: "created_at";
    sort_direction?: "desc" | "asc";
}

export interface PaginatedQuotesResponse {
    data: QuoteRequest[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number | null;
        to: number | null;
    };
}

interface AuditEventBase {
    eventId: string;
    quoteRequestId: number;
    actorId: number | null;
    occurredAt: string;
    receivedAt?: string;
}

export type AuditEvent = AuditEventBase & (
    | { type: "quote.created"; data: { serviceType: string; budgetRange: string } }
    | { type: "quote.assigned"; data: { oldAssignedUserId: number | null; newAssignedUserId: number } }
    | { type: "quote.status_changed"; data: { oldStatus: QuoteStatus; newStatus: QuoteStatus } }
);

export interface PaginatedAuditResponse {
    data: AuditEvent[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}
