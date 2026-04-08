export function parseIntParam(value: string, name: string = "id"): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    const err = new Error(`Invalid ${name} parameter`);
    (err as any).isParamError = true;
    throw err;
  }
  return num;
}

export function isZodError(e: unknown): boolean {
  return !!(e && typeof e === "object" && "name" in e && (e as { name: string }).name === "ZodError");
}

export function isParamError(e: unknown): boolean {
  return !!(e && typeof e === "object" && "isParamError" in e && (e as any).isParamError === true);
}
