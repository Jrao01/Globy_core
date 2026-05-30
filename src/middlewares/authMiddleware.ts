import type { Response, NextFunction, RequestHandler } from "express";
import type { AuthRequest, JwtPayload } from "../types/index.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

export const verifyToken: RequestHandler = <P = any, ResBody = any, ReqBody = any, ReqQuery = any>(
  req: AuthRequest<P, ResBody, ReqBody, ReqQuery>,
  res: Response,
  next: NextFunction
) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ message: "Acceso denegado. Token no proporcionado." });
        return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        res.status(401).json({ message: "Token malformado." });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ message: "Token inválido o expirado." });
    }
};
