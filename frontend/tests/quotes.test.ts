import assert from "node:assert/strict";
import test from "node:test";
import { auditChanges, formatBudget, formatDate, permittedStatuses } from "../src/features/quotes/quotePresentation.ts";
import type { AuditEvent, QuoteStatus } from "../src/features/quotes/types.ts";

test("Admin can perform only the allowed transitions", () => {
    const expected: Record<QuoteStatus, QuoteStatus[]> = {
        new: ["in_review"], in_review: ["quoted", "closed"], quoted: ["closed"], closed: [],
    };
    for (const status of Object.keys(expected) as QuoteStatus[]) {
        assert.deepEqual(permittedStatuses({ status, assigned_user_id: null }, { id: 1, role: "admin" }), expected[status]);
    }
});

test("Staff actions require assignment to the current user", () => {
    const quote = { status: "in_review" as const, assigned_user_id: 2 };
    assert.deepEqual(permittedStatuses(quote, { id: 2, role: "staff" }), ["quoted", "closed"]);
    assert.deepEqual(permittedStatuses(quote, { id: 3, role: "staff" }), []);
    assert.deepEqual(permittedStatuses({ ...quote, assigned_user_id: null }, { id: 2, role: "staff" }), []);
    assert.deepEqual(permittedStatuses(quote, { id: 2, role: "unknown" }), []);
    assert.deepEqual(permittedStatuses(quote, null), []);
});

test("Closed quotes never expose a transition", () => {
    assert.deepEqual(permittedStatuses({ status: "closed", assigned_user_id: 2 }, { id: 2, role: "staff" }), []);
});

test("Audit changes preserve previous and new values", () => {
    const base = { eventId: "test-event", quoteRequestId: 7, actorId: 1, occurredAt: "2026-10-14T10:00:00Z" };
    const assignment: AuditEvent = { ...base, type: "quote.assigned", data: { oldAssignedUserId: null, newAssignedUserId: 2 } };
    assert.deepEqual(auditChanges(assignment), [{ label: "Assigned staff", previous: "Unassigned", next: "Staff #2" }]);
    assert.equal(auditChanges({ ...assignment, data: { oldAssignedUserId: 3, newAssignedUserId: 2 } })[0].previous, "Staff #3");
    assert.deepEqual(auditChanges({ ...base, type: "quote.status_changed", data: { oldStatus: "in_review", newStatus: "quoted" } }), [{ label: "Status", previous: "In Review", next: "Quoted" }]);
    assert.deepEqual(auditChanges({ ...base, type: "quote.created", data: { serviceType: "Web Development", budgetRange: "1000_5000" } }), [
        { label: "Service", previous: "—", next: "Web Development" },
        { label: "Budget", previous: "—", next: "1,000 – 5,000" },
    ]);
});

test("Budget and timestamp fallbacks are readable", () => {
    assert.equal(formatBudget("not_sure"), "Not sure");
    assert.equal(formatBudget("under_1000"), "Under 1,000");
    assert.equal(formatBudget("custom"), "custom");
    assert.equal(formatDate(null), "—");
    assert.equal(formatDate("invalid"), "—");
    assert.match(formatDate("2026-10-14T10:00:00Z", true), /2026/);
});
