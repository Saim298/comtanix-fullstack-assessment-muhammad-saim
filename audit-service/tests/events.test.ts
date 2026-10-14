
import { createHmac, randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";
import { AuditEvent } from "../src/models/AuditEvent.js";

const makeEvent = () => ({
    eventId: randomUUID(),
    type: "quote.created",
    quoteRequestId: 1,
    actorId: null,
    data: {
        clientName: "Ahmed Khan",
        serviceType: "Web Development",
    },
    occurredAt: new Date().toISOString(),
});

const signBody = (body: string): string => {
    const secret = process.env.AUDIT_SHARED_SECRET;

    if (!secret) {
        throw new Error("AUDIT_SHARED_SECRET is missing");
    }

    return createHmac("sha256", secret)
        .update(body)
        .digest("hex");
};

const sendSignedEvent = (
    body: string,
    signature?: string
) => {
    return request(app)
        .post("/events")
        .set("Content-Type", "application/json")
        .set("X-Signature", signature ?? signBody(body))
        .send(body);
};

describe("Audit Event API", () => {

    it("rejects audit history requests without a read token", async () => {
        const response = await request(app).get("/events");

        expect(response.status).toBe(401);
    });

    it("filters audit events and returns newest first", async () => {
        const older = {
            ...makeEvent(),
            type: "quote.assigned",
            quoteRequestId: 42,
            occurredAt: "2026-10-14T10:00:00.000Z",
        };

        const newer = {
            ...makeEvent(),
            type: "quote.assigned",
            quoteRequestId: 42,
            occurredAt: "2026-10-14T11:00:00.000Z",
        };

        const unrelated = {
            ...makeEvent(),
            quoteRequestId: 99,
            occurredAt: "2026-10-14T12:00:00.000Z",
        };


        for (const event of [older, newer, unrelated]) {
            await new AuditEvent({
                ...event,
                occurredAt: new Date(event.occurredAt),
            }).save();
        }

        const token = process.env.AUDIT_READ_TOKEN!;

        const firstPage = await request(app)
            .get("/events?quoteRequestId=42&type=quote.assigned&page=1&per_page=1")
            .set("X-Audit-Read-Token", token);

        expect(firstPage.status).toBe(200);
        expect(firstPage.body.meta.total).toBe(2);
        expect(firstPage.body.data).toHaveLength(1);
        expect(firstPage.body.data[0].eventId).toBe(newer.eventId);

        const secondPage = await request(app)
            .get("/events?quoteRequestId=42&type=quote.assigned&page=2&per_page=1")
            .set("X-Audit-Read-Token", token);

        expect(secondPage.status).toBe(200);
        expect(secondPage.body.data).toHaveLength(1);
        expect(secondPage.body.data[0].eventId).toBe(older.eventId);
    });

    it("stores a correctly signed audit event", async () => {
        const event = makeEvent();
        const body = JSON.stringify(event);

        const response = await sendSignedEvent(body);

        expect(response.status).toBe(201);
        expect(response.body.eventId).toBe(event.eventId);

        const stored = await AuditEvent.findOne({
            eventId: event.eventId,
        });

        expect(stored).not.toBeNull();
        expect(stored?.type).toBe("quote.created");
        expect(stored?.quoteRequestId).toBe(1);
    });

    it("rejects an invalid HMAC signature", async () => {
        const body = JSON.stringify(makeEvent());

        const response = await sendSignedEvent(
            body,
            "0".repeat(64)
        );

        expect(response.status).toBe(401);
        expect(await AuditEvent.countDocuments()).toBe(0);
    });

    it("rejects requests without a signature", async () => {
        const body = JSON.stringify(makeEvent());

        const response = await request(app)
            .post("/events")
            .set("Content-Type", "application/json")
            .send(body);

        expect(response.status).toBe(401);
        expect(await AuditEvent.countDocuments()).toBe(0);
    });

    it("processes duplicate events only once", async () => {
        const event = makeEvent();
        const body = JSON.stringify(event);

        const firstResponse = await sendSignedEvent(body);
        const secondResponse = await sendSignedEvent(body);

        expect(firstResponse.status).toBe(201);
        expect(secondResponse.status).toBe(200);

        const count = await AuditEvent.countDocuments({
            eventId: event.eventId,
        });

        expect(count).toBe(1);
    });

    it("rejects invalid event payloads", async () => {
        const invalidEvent = {
            ...makeEvent(),
            eventId: "invalid-uuid",
        };

        const body = JSON.stringify(invalidEvent);

        const response = await sendSignedEvent(body);

        expect(response.status).toBe(422);
        expect(await AuditEvent.countDocuments()).toBe(0);
    });

    it("rejects malformed JSON", async () => {
        const body = '{"eventId":';

        const response = await sendSignedEvent(body);

        expect(response.status).toBe(400);
        expect(await AuditEvent.countDocuments()).toBe(0);
    });
});
