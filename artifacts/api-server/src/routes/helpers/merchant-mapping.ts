import { eq, desc, sql, and, ilike } from "drizzle-orm";
import { likeContains } from "../../lib/escape-like";
import {
  db,
  transactionsTable,
  merchantMappingsTable,
} from "@workspace/db";

export interface MerchantDefaults {
  dominantAccount: { id: number; name: string } | null;
  dominantCategory: string | null;
}

export interface MerchantMapping {
  category: string;
  accountId: number | null;
  useCount: number;
}

export function canonicalizeKeyword(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function getMerchantMapping(description: string): Promise<MerchantMapping | null> {
  if (!description) return null;
  const keyword = canonicalizeKeyword(description);
  if (!keyword) return null;

  const rows = await db
    .select()
    .from(merchantMappingsTable)
    .where(ilike(merchantMappingsTable.keyword, keyword))
    .orderBy(desc(merchantMappingsTable.useCount))
    .limit(1);

  if (rows.length > 0 && rows[0].useCount >= 3) {
    return {
      category: rows[0].category,
      accountId: rows[0].accountId,
      useCount: rows[0].useCount,
    };
  }
  return null;
}

export async function getMerchantMappingCategories(description: string): Promise<{ category: string; count: number }[]> {
  if (!description) return [];
  const keyword = canonicalizeKeyword(description);
  if (!keyword) return [];

  const rows = await db
    .select({
      category: merchantMappingsTable.category,
      useCount: merchantMappingsTable.useCount,
    })
    .from(merchantMappingsTable)
    .where(ilike(merchantMappingsTable.keyword, keyword))
    .orderBy(desc(merchantMappingsTable.useCount));

  return rows.map(r => ({ category: r.category, count: r.useCount }));
}

export async function upsertMerchantMapping(description: string, category: string, accountId: number | null) {
  if (!description || !category || category === "Transfer") return;
  const keyword = canonicalizeKeyword(description);
  if (!keyword) return;

  const existing = await db
    .select()
    .from(merchantMappingsTable)
    .where(and(
      ilike(merchantMappingsTable.keyword, keyword),
      eq(merchantMappingsTable.category, category),
    ))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(merchantMappingsTable)
      .set({
        useCount: sql`${merchantMappingsTable.useCount} + 1`,
        lastUsedAt: new Date(),
        accountId: accountId ?? existing[0].accountId,
      })
      .where(eq(merchantMappingsTable.id, existing[0].id));
  } else {
    await db.insert(merchantMappingsTable).values({
      keyword,
      category,
      accountId,
      useCount: 1,
      lastUsedAt: new Date(),
    });
  }
}

export async function getMerchantDefaults(description: string): Promise<MerchantDefaults> {
  const result: MerchantDefaults = { dominantAccount: null, dominantCategory: null };
  if (!description) return result;

  const rows = await db
    .select({
      accountId: transactionsTable.accountId,
      category: transactionsTable.category,
    })
    .from(transactionsTable)
    .where(ilike(transactionsTable.description, likeContains(description)))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(20);

  if (rows.length < 3) return result;

  const accountCounts: Record<number, number> = {};
  const categoryCounts: Record<string, number> = {};

  for (const row of rows) {
    if (row.accountId) {
      accountCounts[row.accountId] = (accountCounts[row.accountId] || 0) + 1;
    }
    if (row.category && row.category !== "Transfer") {
      categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
    }
  }

  const topAccount = Object.entries(accountCounts).sort((a, b) => b[1] - a[1])[0];
  if (topAccount && topAccount[1] >= 3) {
    result.dominantAccount = { id: Number(topAccount[0]), name: "" };
  }

  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  if (topCategory && topCategory[1] >= 2) {
    result.dominantCategory = topCategory[0];
  }

  return result;
}

export async function getCategoryDominantAccount(category: string): Promise<{ id: number } | null> {
  if (!category) return null;

  const rows = await db
    .select({
      accountId: transactionsTable.accountId,
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.category, category),
      sql`${transactionsTable.type} != 'Transfer'`,
    ))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(30);

  if (rows.length < 3) return null;

  const counts: Record<number, number> = {};
  let total = 0;
  for (const row of rows) {
    if (row.accountId) {
      counts[row.accountId] = (counts[row.accountId] || 0) + 1;
      total++;
    }
  }

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (top && total > 0 && (top[1] / total) >= 0.7) {
    return { id: Number(top[0]) };
  }

  return null;
}

export async function getRecentAccountUsage(): Promise<{ id: number; count: number }[]> {
  const rows = await db
    .select({
      accountId: transactionsTable.accountId,
      cnt: sql<number>`count(*)`.as("cnt"),
    })
    .from(transactionsTable)
    .where(sql`${transactionsTable.type} != 'Transfer' AND ${transactionsTable.accountId} IS NOT NULL`)
    .groupBy(transactionsTable.accountId)
    .orderBy(sql`count(*) DESC`)
    .limit(10);

  return rows
    .filter((r) => r.accountId !== null)
    .map((r) => ({ id: r.accountId!, count: Number(r.cnt) }));
}

export async function getRecentCategoryUsage(): Promise<{ name: string; count: number }[]> {
  const rows = await db
    .select({
      category: transactionsTable.category,
      cnt: sql<number>`count(*)`.as("cnt"),
    })
    .from(transactionsTable)
    .where(sql`${transactionsTable.type} != 'Transfer'`)
    .groupBy(transactionsTable.category)
    .orderBy(sql`count(*) DESC`)
    .limit(10);

  return rows.map((r) => ({ name: r.category, count: Number(r.cnt) }));
}

export async function checkAmbiguousMerchant(
  description: string,
): Promise<{ ambiguous: boolean; categories: { name: string; count: number }[] }> {
  if (!description) return { ambiguous: false, categories: [] };

  const mappings = await getMerchantMappingCategories(description);

  if (mappings.length <= 1) {
    const rows = await db
      .select({
        category: transactionsTable.category,
        cnt: sql<number>`count(*)`.as("cnt"),
      })
      .from(transactionsTable)
      .where(and(
        ilike(transactionsTable.description, likeContains(description)),
        sql`${transactionsTable.type} != 'Transfer'`,
      ))
      .groupBy(transactionsTable.category)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    if (rows.length < 2) return { ambiguous: false, categories: [] };

    const total = rows.reduce((s, r) => s + Number(r.cnt), 0);
    const topPct = Number(rows[0].cnt) / total;

    if (topPct >= 0.8) return { ambiguous: false, categories: [] };

    return {
      ambiguous: true,
      categories: rows.map(r => ({ name: r.category, count: Number(r.cnt) })),
    };
  }

  const total = mappings.reduce((s, m) => s + m.count, 0);
  const topPct = mappings[0].count / total;

  if (topPct >= 0.8) return { ambiguous: false, categories: [] };

  return {
    ambiguous: true,
    categories: mappings,
  };
}

export function findClosestCategories(name: string, categories: { name: string; type: string }[]): string[] {
  const lower = name.toLowerCase();
  const scored = categories.map(c => {
    const cLower = c.name.toLowerCase();
    let score = 0;
    if (cLower.includes(lower) || lower.includes(cLower)) score += 10;
    const words = lower.split(/\s+/);
    for (const w of words) {
      if (cLower.includes(w)) score += 3;
    }
    if (c.type === "Expense") score += 1;
    return { name: c.name, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.name);
}
