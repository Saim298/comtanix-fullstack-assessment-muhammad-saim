
import type { RequestHandler } from "express";
import { z } from "zod";

import { AuditEvent } from "../models/AuditEvent.js";
import { eventSchema } from "../schemas/eventSchema.js";


export const createEvent: RequestHandler = async (req, res) => {
    let payload: unknown;

    try {
        payload = JSON.parse((req.body as Buffer).toString("utf8"));
    } catch {
        res.status(400).json({
            message: "Invalid JSON body.",
        });
        return;
    }

    const result = eventSchema.safeParse(payload);

    if (!result.success) {
        res.status(422).json({
            message: "Invalid audit event.",
            errors: result.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        });
        return;
    }

    const data = result.data;

    try {
        const event = new AuditEvent({
            eventId: data.eventId,
            type: data.type,
            quoteRequestId: data.quoteRequestId,
            actorId: data.actorId,
            data: data.data,
            occurredAt: new Date(data.occurredAt),
        });

        await event.save();

        res.status(201).json({
            message: "Audit event stored.",
            eventId: data.eventId,
        });
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11000
        ) {
            res.status(200).json({
                message: "Event already processed.",
                eventId: data.eventId,
            });
            return;
        }

        console.error("Audit event persistence failed:", error);

        res.status(500).json({
            message: "Failed to store audit event.",
        });
    }
};


const listEventsSchema = z.object({
    quoteRequestId: z.coerce.number().int().positive().optional(),
    type: z.enum([
        "quote.created",
        "quote.assigned",
        "quote.status_changed",
    ]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export const listEvents: RequestHandler = async (req, res) => {
    const result = listEventsSchema.safeParse(req.query);

    if (!result.success) {
        res.status(422).json({
            message: "Invalid query parameters.",
            errors: result.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        });
        return;
    }

    const { quoteRequestId, type, page, per_page } = result.data;

    const filter: {
        quoteRequestId?: number;
        type?: string;
    } = {};

    if (quoteRequestId !== undefined) {
        filter.quoteRequestId = quoteRequestId;
    }

    if (type) {
        filter.type = type;
    }

    try {
        const [events, total] = await Promise.all([
            AuditEvent.find(filter)
                .select("eventId type quoteRequestId actorId data occurredAt receivedAt -_id")
                .sort({ occurredAt: -1, _id: -1 })
                .skip((page - 1) * per_page)
                .limit(per_page)
                .lean(),
            AuditEvent.countDocuments(filter),
        ]);

        res.status(200).json({
            data: events,
            meta: {
                current_page: page,
                per_page,
                total,
                last_page: Math.max(1, Math.ceil(total / per_page)),
            },
        });
    } catch (error) {
        console.error("Audit event retrieval failed:", error);

        res.status(500).json({
            message: "Failed to retrieve audit events.",
        });
    }
};

