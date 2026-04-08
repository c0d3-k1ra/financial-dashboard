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
