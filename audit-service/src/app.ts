
import express from "express";
import eventRoutes from "./routes/eventRoutes.js";

const app = express();

app.use("/events", eventRoutes);

export default app;
