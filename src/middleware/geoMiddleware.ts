import type { Request, Response, NextFunction } from "express";
import { getGeoByIP } from "../services/GeoService.js";

declare global {
  namespace Express {
    interface Request {
      geo?: any;
      clientIp?: string;
    }
  }
}

export async function geoMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress
      || "127.0.0.1";

    req.clientIp = ip;
    req.geo = await getGeoByIP(ip);
  } catch {
    // Fallo silencioso en geo
  }

  next();
}
