class ParamError extends Error {
  readonly isParamError = true;
  constructor(message: string) {
    super(message);
    this.name = "ParamError";
  }
}

export function parseIntParam(value: string, name: string = "id"): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ParamError(`Invalid ${name} parameter`);
  }
  return num;
}

export function isZodError(e: unknown): boolean {
  return !!(e && typeof e === "object" && "name" in e && e.name === "ZodError");
}

export function isParamError(e: unknown): boolean {
  return e instanceof ParamError;
}

export function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as Record<string, unknown>;
  if (err.code === "23505") return true;
  if (err.cause && typeof err.cause === "object" && (err.cause as Record<string, unknown>).code === "23505") return true;
  if (typeof err.message === "string" && err.message.includes("unique constraint")) return true;
  return false;
}
