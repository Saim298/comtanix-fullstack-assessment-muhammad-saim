import { api } from "../../lib/api.ts";
import type {
    QuoteFilters,
    PaginatedQuotesResponse,
    QuoteRequest,
    AssignedUser,
    QuoteStatus,
    PaginatedAuditResponse,
    PublicQuoteInput,
    PublicQuoteReceipt,
} from "./types";

export const quotesApi = {
    async createPublic(input: PublicQuoteInput): Promise<PublicQuoteReceipt> {
        const { client_name, email, company, service_type, budget_range, message, website } = input;
        const response = await api.post<{ data: PublicQuoteReceipt }>("/public/quote-requests", {
            client_name, email, company, service_type, budget_range, message, website,
        }, { headers: { Authorization: false } });

        if (response.status !== 201 || !Number.isSafeInteger(response.data?.data?.id) || response.data.data.id <= 0) {
            throw new Error("Quote submission could not be confirmed.");
        }

        return { id: response.data.data.id };
    },

    async getAll(
        filters: QuoteFilters = {},
        signal?: AbortSignal
    ): Promise<PaginatedQuotesResponse> {
        const response = await api.get<PaginatedQuotesResponse>(
            "/quote-requests",
            {
                params: filters,
                signal,
            }
        );

        return response.data;
    },

    async getById(id: number, signal?: AbortSignal): Promise<QuoteRequest> {
        const response = await api.get<{ data: QuoteRequest }>(
            `/quote-requests/${id}`,
            { signal }
        );

        return response.data.data;
    },

    async getStaff(signal?: AbortSignal): Promise<AssignedUser[]> {
        const response = await api.get<{ data: AssignedUser[] }>("/staff-users", { signal });
        return response.data.data;
    },

    async assign(id: number, staffId: number, signal?: AbortSignal): Promise<QuoteRequest> {
        const response = await api.patch<{ data: QuoteRequest }>(
            `/quote-requests/${id}/assign`,
            { assigned_user_id: staffId },
            { signal }
        );
        return response.data.data;
    },

    async updateStatus(id: number, status: QuoteStatus, signal?: AbortSignal): Promise<QuoteRequest> {
        const response = await api.patch<{ data: QuoteRequest }>(
            `/quote-requests/${id}/status`,
            { status },
            { signal }
        );
        return response.data.data;
    },

    async getEvents(id: number, page: number, signal?: AbortSignal): Promise<PaginatedAuditResponse> {
        const response = await api.get<PaginatedAuditResponse>(`/quote-requests/${id}/events`, {
            params: { page, per_page: 10 },
            signal,
        });
        return response.data;
    },

    async remove(id: number, signal?: AbortSignal): Promise<void> {
        await api.delete(`/quote-requests/${id}`, { signal });
    },
};
