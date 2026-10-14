import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { api } from "../src/lib/api.ts";
import { AUTH_TOKEN_KEY } from "../src/lib/authSession.ts";
import { quotesApi } from "../src/features/quotes/quotesApi.ts";
import { budgetOptions, createPublicQuoteSubmission, emptyPublicQuote, publicQuoteError, validatePublicQuote } from "../src/features/quotes/publicQuoteForm.ts";

const valid = { ...emptyPublicQuote(), client_name: "Public Client", email: "client@example.test", service_type: "Custom service", budget_range: "not_sure", message: "Please help us build a business website." };
const originalAdapter = api.defaults.adapter;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");

beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); },
        removeItem: (key: string) => { storage.delete(key); },
    } });
});

afterEach(() => {
    api.defaults.adapter = originalAdapter;
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
});

function failure(status?: number, data: unknown = {}, code = "ERR_BAD_RESPONSE") {
    return new AxiosError("Private exception", code, undefined, undefined,
        status ? { status, statusText: String(status), data, headers: {}, config: {} as InternalAxiosRequestConfig } : undefined);
}

test("required fields, whitespace, invalid email and budgets are rejected", () => {
    assert.deepEqual(Object.keys(validatePublicQuote(emptyPublicQuote())).sort(), ["client_name", "email", "service_type", "budget_range", "message"].sort());
    assert.ok(validatePublicQuote({ ...valid, email: "invalid" }).email);
    assert.ok(validatePublicQuote({ ...valid, budget_range: "other" }).budget_range);
    assert.ok(validatePublicQuote({ ...valid, message: "               " }).message);
    assert.ok(validatePublicQuote({ ...valid, client_name: "   ", service_type: "   " }).client_name);
    for (const [budget_range] of budgetOptions) assert.deepEqual(validatePublicQuote({ ...valid, budget_range }), {});
});

test("client validation enforces Laravel field length limits", () => {
    for (const [field, limit] of [["client_name", 150], ["email", 255], ["company", 150], ["service_type", 100], ["message", 5000]] as const) {
        assert.ok(validatePublicQuote({ ...valid, [field]: "x".repeat(limit + 1) })[field]);
    }
    assert.ok(validatePublicQuote({ ...valid, message: "short" }).message);
    assert.deepEqual(validatePublicQuote({ ...valid, client_name: "é".repeat(150), message: "m".repeat(5000) }), {});
});

test("422 errors map to visible fields without exposing unknown fields or the server summary", () => {
    const result = publicQuoteError(failure(422, { message: "Private exception", errors: { email: ["The email must be valid."], message: ["Please add details."], status: ["Internal"], website: ["Spam"] } }));
    assert.deepEqual(result.fields, { email: "The email must be valid.", message: "Please add details." });
    assert.equal(result.message, "Please check your details and try again.");
});

test("rate limits get actionable feedback and temporary failures hide technical details", () => {
    assert.match(publicQuoteError(failure(429)).message, /wait/i);
    for (const error of [failure(500, { trace: "secret", message: "password" }), failure(503), failure(undefined, {}, "ERR_NETWORK"), failure(undefined, {}, "ECONNABORTED")]) {
        const result = publicQuoteError(error);
        assert.match(result.message, /may already have been received/);
        assert.doesNotMatch(result.message, /secret|password|Private/);
        assert.deepEqual(result.fields, {});
    }
});

test("public API sends only allowed fields, omits auth and uses the confirmed 201 reference", async () => {
    for (const token of [null, "staff-token"]) {
        if (token) sessionStorage.setItem(AUTH_TOKEN_KEY, token);
        api.defaults.adapter = async (config) => {
            assert.equal(config.url, "/public/quote-requests");
            assert.equal(config.headers.get("Authorization"), false);
            assert.deepEqual(JSON.parse(config.data), valid);
            return { config, status: 201, statusText: "Created", headers: {}, data: { data: { id: 321, status: "new", assigned_user_id: null } } };
        };
        const receipt = await quotesApi.createPublic({ ...valid, status: "closed", assigned_user_id: 9, id: 123, created_at: "yesterday" } as typeof valid);
        assert.deepEqual(receipt, { id: 321 });
        assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), token);
    }
});

test("an unconfirmed response never produces a success receipt", async () => {
    for (const [status, id] of [[200, 321], [201, undefined], [201, -1]]) {
        api.defaults.adapter = async (config) => ({ config, status: status!, statusText: "OK", headers: {}, data: { data: { id } } });
        await assert.rejects(quotesApi.createPublic(valid));
    }
});

test("repeated submissions while pending send once and preserve the returned reference", async () => {
    let complete!: (receipt: { id: number }) => void;
    let requests = 0;
    const submit = createPublicQuoteSubmission(async () => {
        requests += 1;
        return new Promise<{ id: number }>((resolve) => { complete = resolve; });
    });
    const pending = submit(valid);
    assert.equal(await submit(valid), null);
    assert.equal(await submit(valid), null);
    assert.equal(requests, 1);
    complete({ id: 321 });
    assert.deepEqual(await pending, { receipt: { id: 321 } });
});

test("ambiguous network failures keep form values and never automatically retry", async () => {
    let requests = 0;
    const input = { ...valid };
    const submit = createPublicQuoteSubmission(async () => { requests += 1; throw failure(undefined, {}, "ECONNABORTED"); });
    const result = await submit(input);
    assert.equal(requests, 1);
    assert.deepEqual(input, valid);
    assert.match(result?.error?.message ?? "", /may already have been received/);
    assert.equal(result?.receipt, undefined);
});
