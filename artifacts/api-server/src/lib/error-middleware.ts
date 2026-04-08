import type { Request, Response, NextFunction } from "express";
import { isZodError, isParamError, isUniqueViolation } from "./parse-params";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  req.log.error({ err }, `Request failed: ${req.method} ${req.originalUrl}`);

  if (err instanceof SyntaxError && "type" in err && (err as Record<string, unknown>).type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON in request body" });
    return;
  }

  if (isZodError(err)) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  if (isParamError(err)) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  if (isUniqueViolation(err)) {
    res.status(400).json({ error: "A record with that name already exists." });
    return;
  }

  res.status(500).json({ error: "Internal error" });
}
