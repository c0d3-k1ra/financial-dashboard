import type { Request, Response, NextFunction } from "express";
import { isZodError, isParamError } from "./parse-params";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  req.log.error({ err }, `Request failed: ${req.method} ${req.originalUrl}`);

  if (isZodError(err)) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  if (isParamError(err)) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  res.status(500).json({ error: "Internal error" });
}
