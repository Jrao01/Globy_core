import type { Request, Response, RequestHandler } from "express";

export const Ping : RequestHandler = async (_req: Request, res: Response) : Promise<void> => {
  res.json({ message: "Pong" });
};