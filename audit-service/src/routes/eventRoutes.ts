import { Router, raw } from "express";
import { createEvent } from "../controllers/eventController.js";
import { verifySignature } from "../middleware/verifySignature.js";
import { listEvents } from "../controllers/eventController.js";
import { verifyReadToken } from "../middleware/verifyReadToken.js";

const router = Router();

router.post(
    "/",
    raw({
        type: "application/json",
        limit: "64kb",
    }),
    verifySignature,
    createEvent
);

router.get("/", verifyReadToken, listEvents);

export default router;
