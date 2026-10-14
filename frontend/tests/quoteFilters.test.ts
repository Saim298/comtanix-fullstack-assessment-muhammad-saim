import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { api } from "../src/lib/api.ts";
import { quotesApi } from "../src/features/quotes/quotesApi.ts";
import { initialQuoteFilters, readQuoteFilters, writeQuoteFilters } from "../src/features/quotes/quoteFilters.ts";

test("shared URLs restore every filter and the selected page", () => {
    const expected = { ...initialQuoteFilters, search: "Client & Co", service_type: "API/Cloud", status: "new" as const, assigned_user_id: 3, page: 2, per_page: 10, sort_direction: "asc" as const };
    assert.deepEqual(readQuoteFilters(`?${writeQuoteFilters(expected)}`), expected);
    assert.deepEqual(readQuoteFilters("?status=new&page=2&sort_direction=asc"), { ...initialQuoteFilters, status: "new", page: 2, sort_direction: "asc" });
});

test("unassigned survives sharing and takes precedence over conflicting assignees", () => {
    const filters = readQuoteFilters("?unassigned=1&assigned_user_id=3&page=4");
    assert.deepEqual(filters, { ...initialQuoteFilters, unassigned: 1, page: 4 });
    assert.equal(writeQuoteFilters(filters), "unassigned=1&page=4");
    assert.deepEqual(readQuoteFilters("?unassigned=0&assigned_user_id=3"), { ...initialQuoteFilters, assigned_user_id: 3 });
});

test("malformed URLs cannot inject unsupported filters or sort fields", () => {
    for (const page of ["0", "-1", "1.5", "no", "9007199254740992", "1e2"]) {
        assert.deepEqual(readQuoteFilters(`?page=${page}&assigned_user_id=${page}&per_page=${page}&status=invalid&sort_by=password&sort_direction=invalid&unassigned=true`), initialQuoteFilters);
    }
    assert.equal(readQuoteFilters("?per_page=101").per_page, 20);
    assert.equal(readQuoteFilters(`?search=${"x".repeat(160)}&service_type=${"x".repeat(110)}`).search?.length, 150);
    assert.equal(readQuoteFilters(`?service_type=${"x".repeat(110)}`).service_type?.length, 100);
});

test("zero search text is retained and clearing filters removes the query string", () => {
    const filters = readQuoteFilters("?search=%200%20&service_type=0");
    assert.equal(filters.search, "0");
    assert.equal(filters.service_type, "0");
    assert.equal(writeQuoteFilters(filters), "search=0&service_type=0");
    assert.equal(writeQuoteFilters(initialQuoteFilters), "");
    assert.deepEqual(readQuoteFilters(""), initialQuoteFilters);
});

const originalAdapter = api.defaults.adapter;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
afterEach(() => {
    api.defaults.adapter = originalAdapter;
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
});

test("listing sends combined URL filters, sorting and pagination to Laravel", async () => {
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: () => null } });
    const filters = readQuoteFilters("?search=0&service_type=API&status=new&unassigned=1&page=2&sort_direction=asc");
    const controller = new AbortController();
    api.defaults.adapter = async (config) => {
        assert.equal(config.url, "/quote-requests");
        assert.deepEqual(config.params, filters);
        assert.equal(config.signal, controller.signal);
        return { status: 200, statusText: "OK", headers: {}, config, data: { data: [], meta: { current_page: 2 } } };
    };
    assert.equal((await quotesApi.getAll(filters, controller.signal)).meta.current_page, 2);
});
