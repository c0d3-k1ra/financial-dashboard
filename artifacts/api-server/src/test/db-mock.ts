import { vi } from "vitest";

export function mockChain(data: unknown = []) {
  const obj: Record<string, unknown> = {};
  const methods = [
    "from", "where", "set", "values", "returning",
    "groupBy", "orderBy", "limit", "offset",
    "innerJoin", "leftJoin", "rightJoin", "fullJoin",
    "on", "as", "having",
  ];
  for (const m of methods) {
    obj[m] = vi.fn().mockReturnValue(obj);
  }
  obj.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(data).then(res, rej);
  obj.catch = (rej: (e: unknown) => unknown) =>
    Promise.resolve(data).catch(rej);
  return obj;
}

export function createMockDb() {
  const mockDb = {
    select: vi.fn((_fields?: unknown) => mockChain([])),
    insert: vi.fn((_table?: unknown) => mockChain([])),
    update: vi.fn((_table?: unknown) => mockChain([])),
    delete: vi.fn((_table?: unknown) => mockChain([])),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockDb)),
  };
  return mockDb;
}

export const db = createMockDb();
export const pool = { end: vi.fn() };
