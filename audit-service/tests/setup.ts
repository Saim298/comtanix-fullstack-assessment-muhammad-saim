import "dotenv/config";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";
import { AuditEvent } from "../src/models/AuditEvent.js";
process.env.AUDIT_READ_TOKEN = randomBytes(32).toString("hex");

beforeAll(async () => {
    const uri = process.env.MONGODB_TEST_URI;

    if (!uri) {
        throw new Error("MONGODB_TEST_URI is not configured");
    }

    const parsed = new URL(uri);

    if (
        parsed.pathname !== "/comtanix_audit_test" ||
        !["localhost", "127.0.0.1"].includes(parsed.hostname)
    ) {
        throw new Error("Refusing to connect to an unsafe test database");
    }

    process.env.AUDIT_SHARED_SECRET = randomBytes(32).toString("hex");

    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
    });

    await AuditEvent.init();
});

afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
        await AuditEvent.deleteMany({});
    }
});

afterAll(async () => {
    await mongoose.disconnect();
});
