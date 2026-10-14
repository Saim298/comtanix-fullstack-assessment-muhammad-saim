import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export const verifyReadToken: RequestHandler = (req, res, next) => {
    const expected = process.env.AUDIT_READ_TOKEN;
    const provided = req.get("X-Audit-Read-Token");

    if (!expected) {
        res.status(503).json({
            message: "Audit read authentication is not configured.",
        });
        return;
    }

    if (!provided) {
        res.status(401).json({
            message: "Unauthorized.",
        });
        return;
    }

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);

    if (
        expectedBuffer.length !== providedBuffer.length ||
        !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
        res.status(401).json({
            message: "Unauthorized.",
        });
        return;
    }

    next();
};
