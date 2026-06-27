import type { Request, Response, RequestHandler } from "express";

export const Ping : RequestHandler = async (_req: Request, res: Response) : Promise<void> => {
  console.log("[IndexControllers] [Ping]");
  res.json({ message: "Pong" });
};