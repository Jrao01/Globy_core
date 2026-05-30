import type { Request } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

export interface JwtPayload {
  id: string;
  rol: string;
  correo?: string;
  sucursalId?: number;
}

export interface AuthRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: JwtPayload;
}
