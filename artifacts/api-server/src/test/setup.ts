import { vi, beforeEach } from "vitest";
import { db, pool, mockChain } from "./db-mock";

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  return {
    ...schema,
    db,
    pool,
  };
});

vi.mock("@workspace/db/migrate", () => ({
  runStartupMigrations: vi.fn(),
}));

vi.mock("../lib/rate-limit", () => ({
  aiRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  globalRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

beforeEach(() => {
  vi.resetAllMocks();

  db.select.mockImplementation(() => mockChain([]));
  db.insert.mockImplementation(() => mockChain([]));
  db.update.mockImplementation(() => mockChain([]));
  db.delete.mockImplementation(() => mockChain([]));
  db.execute.mockResolvedValue({ rows: [] });
  db.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
});
