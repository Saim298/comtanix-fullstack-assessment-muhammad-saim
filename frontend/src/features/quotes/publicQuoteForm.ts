import axios from "axios";
import type { PublicQuoteInput, PublicQuoteReceipt } from "./types";

export const budgetOptions = [
    ["under_1000", "Under 1,000"],
    ["1000_5000", "1,000 – 5,000"],
    ["5000_10000", "5,000 – 10,000"],
    ["above_10000", "Above 10,000"],
    ["not_sure", "Not sure"],
] as const;

export const publicQuoteFields = [
    { name: "client_name", label: "Client name", type: "text", required: true, maxLength: 150, autoComplete: "name", placeholder: "Your full name" },
    { name: "email", label: "Email", type: "email", required: true, maxLength: 255, autoComplete: "email", placeholder: "you@example.com" },
    { name: "company", label: "Company", type: "text", required: false, maxLength: 150, autoComplete: "organization", placeholder: "Company or organization" },
    { name: "service_type", label: "Service type", type: "text", required: true, maxLength: 100, autoComplete: "off", placeholder: "e.g. Web development or API integration" },
] as const;

export type QuoteFieldErrors = Partial<Record<keyof PublicQuoteInput, string>>;

export function emptyPublicQuote(): PublicQuoteInput {
    return { client_name: "", email: "", company: "", service_type: "", budget_range: "", message: "", website: "" };
}

export function validatePublicQuote(input: PublicQuoteInput): QuoteFieldErrors {
    const errors: QuoteFieldErrors = {};
    for (const field of publicQuoteFields) {
        const value = input[field.name].trim();
        if (field.required && !value) errors[field.name] = `${field.label} is required.`;
        else if ([...value].length > field.maxLength) errors[field.name] = `${field.label} must be ${field.maxLength} characters or fewer.`;
    }
    if (!errors.email && !/^[^\s@]+@[^\s@]+$/.test(input.email.trim())) errors.email = "Enter a valid email address.";
    if (!budgetOptions.some(([value]) => value === input.budget_range)) errors.budget_range = "Select a budget range.";
    const messageLength = [...input.message.trim()].length;
    if (messageLength < 10) errors.message = "Describe your project in at least 10 characters.";
    else if (messageLength > 5000) errors.message = "Project message must be 5,000 characters or fewer.";
    return errors;
}

export function publicQuoteError(error: unknown): { message: string; fields: QuoteFieldErrors } {
    const fields: QuoteFieldErrors = {};
    if (axios.isAxiosError(error)) {
        if (error.response?.status === 422) {
            const responseErrors: unknown = error.response.data?.errors;
            if (responseErrors && typeof responseErrors === "object") {
                for (const field of [...publicQuoteFields.map(({ name }) => name), "budget_range", "message"] as const) {
                    const messages: unknown = (responseErrors as Record<string, unknown>)[field];
                    if (Array.isArray(messages) && typeof messages[0] === "string") fields[field] = messages[0];
                }
            }
            return { message: "Please check your details and try again.", fields };
        }
        if (error.response?.status === 429) {
            return { message: "Too many requests. Please wait before submitting again.", fields };
        }
    }
    return { message: "We could not confirm your submission. Your details have been kept. Your request may already have been received; please check before submitting again.", fields };
}

export type PublicQuoteResult =
    | { receipt: PublicQuoteReceipt; error?: never }
    | { receipt?: never; error: ReturnType<typeof publicQuoteError> };

export function createPublicQuoteSubmission(send: (input: PublicQuoteInput) => Promise<PublicQuoteReceipt>) {
    let pending = false;
    return async (input: PublicQuoteInput): Promise<PublicQuoteResult | null> => {
        if (pending) return null;
        pending = true;
        try {
            return { receipt: await send(input) };
        } catch (error) {
            return { error: publicQuoteError(error) };
        } finally {
            pending = false;
        }
    };
}
