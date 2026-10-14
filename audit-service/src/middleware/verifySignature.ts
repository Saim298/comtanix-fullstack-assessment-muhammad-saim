
import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export const verifySignature: RequestHandler = (req, res, next) => {
    const secret = process.env.AUDIT_SHARED_SECRET;
    const signature = req.get("X-Signature");

    if (!secret) {
        res.status(503).json({
            message: "Audit signing is not configured.",
        });
        return;
    }

    if (!Buffer.isBuffer(req.body)) {
        res.status(415).json({
            message: "Expected an application/json request body.",
        });
        return;
    }

    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
        res.status(401).json({
            message: "Missing or invalid signature.",
        });
        return;
    }

    const expected = createHmac("sha256", secret)
        .update(req.body)
        .digest();

    const received = Buffer.from(signature, "hex");

    if (!timingSafeEqual(expected, received)) {
        res.status(401).json({
            message: "Missing or invalid signature.",
        });
        return;
    }

    next();
};
