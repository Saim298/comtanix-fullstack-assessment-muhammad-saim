import { z } from "zod";

export const eventSchema = z.object({
    eventId: z.uuid(),
    type: z.enum([
        "quote.created",
        "quote.assigned",
        "quote.status_changed",
    ]),
    quoteRequestId: z.number().int().positive(),
    actorId: z.number().int().positive().nullable(),
    data: z.record(z.string(), z.unknown()),
    occurredAt: z.iso.datetime({ offset: true }),
}).strict();

export type AuditEventInput = z.infer<typeof eventSchema>;
