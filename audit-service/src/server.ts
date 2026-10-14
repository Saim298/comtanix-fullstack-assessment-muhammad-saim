
import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { AuditEvent } from "./models/AuditEvent.js";

const PORT = Number(process.env.PORT || 4001);

const startServer = async (): Promise<void> => {
    try {
        if (!process.env.AUDIT_SHARED_SECRET) {
            throw new Error("AUDIT_SHARED_SECRET is not configured");
        }

        await connectDatabase();
        await AuditEvent.init();
        app.listen(PORT, () => {
            console.log(`Audit service running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start audit service:", error);
        process.exit(1);
    }
};

startServer();
