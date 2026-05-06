export type RecommendationRecord = {
  id: string;
  createdAt: string;
  book: string;
  genre: string;
  why: string;
};

const KEY_RECORDS = "recommendations:records";
const KEY_COUNT = "recommendations:count";

async function getRedis() {
  const { createClient } = await import("redis");
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("Missing required environment variable REDIS_URL");
  }
  const g = globalThis as unknown as { __booksV2Redis?: ReturnType<typeof createClient> };
  if (!g.__booksV2Redis) {
    g.__booksV2Redis = createClient({ url });
    g.__booksV2Redis.on("error", (err) => {
      console.error("[redis] client error", err);
    });
  }
  if (!g.__booksV2Redis.isOpen) await g.__booksV2Redis.connect();
  return g.__booksV2Redis;
}

export async function appendRecord(record: RecommendationRecord): Promise<void> {
  // Keep newest first.
  const redis = await getRedis();
  await redis.lPush(KEY_RECORDS, JSON.stringify(record));
  await redis.incr(KEY_COUNT);
  // Optional: cap list length to keep payload small.
  await redis.lTrim(KEY_RECORDS, 0, 499);
}

export async function readRecentRecords(limit = 50): Promise<RecommendationRecord[]> {
  const redis = await getRedis();
  const raw = await redis.lRange(KEY_RECORDS, 0, Math.max(0, limit - 1));
  return raw
    .map((s) => {
      try {
        return JSON.parse(s) as Partial<RecommendationRecord>;
      } catch {
        return null;
      }
    })
    .filter((v): v is Partial<RecommendationRecord> => v !== null)
    .map((r) => ({
      id: String(r.id ?? ""),
      createdAt: String(r.createdAt ?? ""),
      book: String(r.book ?? ""),
      genre: String(r.genre ?? ""),
      why: String(r.why ?? ""),
    }))
    .filter((r) => r.book.trim().length > 0 && r.genre.trim().length > 0 && r.why.trim().length > 0);
}

export async function readBookTitles(): Promise<string[]> {
  const recs = await readRecentRecords(500);
  return recs.map((r) => r.book);
}

export async function readSubmissionCount(): Promise<number> {
  const redis = await getRedis();
  const v = await redis.get(KEY_COUNT);
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

