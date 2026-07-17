import type { Request, Response, Router as ExpressRouter } from "express";
import { Router } from "express";

export const privateRouter: ExpressRouter = Router();

privateRouter.get("/status", (req: Request, res: Response) => {
  const session = req.sessionData;
  res.json({
    status: "ok",
    userId: session?.userId,
    sessionId: session?.id,
    timestamp: new Date().toISOString(),
  });
});
