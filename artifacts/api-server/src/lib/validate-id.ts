import type { Request, Response } from "express";

export function validateIdParam(req: Request, res: Response): number | null {
  const raw = req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: `Invalid id "${raw}". Must be a positive integer.` });
    return null;
  }
  return id;
}
