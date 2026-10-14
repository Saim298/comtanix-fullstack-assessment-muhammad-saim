
import { Schema, model } from "mongoose";

const auditEventSchema = new Schema(
    {
        eventId: {
            type: String,
            required: true,
            unique: true,
        },
        type: {
            type: String,
            required: true,
            enum: [
                "quote.created",
                "quote.assigned",
                "quote.status_changed",
            ],
        },
        quoteRequestId: {
            type: Number,
            required: true,
        },
        actorId: {
            type: Number,
            default: null,
        },
        data: {
            type: Schema.Types.Mixed,
            required: true,
        },
        occurredAt: {
            type: Date,
            required: true,
        },
    },
    {
        versionKey: false,
        timestamps: {
            createdAt: "receivedAt",
            updatedAt: false,
        },
    }
);

auditEventSchema.index({
    quoteRequestId: 1,
    occurredAt: -1,
    _id: -1,
});

auditEventSchema.index({
    type: 1,
    occurredAt: -1,
});

export const AuditEvent = model("AuditEvent", auditEventSchema);
