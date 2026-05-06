import { kv } from "@vercel/kv";

export type RecommendationRecord = {
  id: string;
  createdAt: string;
  book: string;
  genre: string;
  why: string;
};

const KEY_RECORDS = "recommendations:records";
const KEY_COUNT = "recommendations:count";

export async function appendRecord(record: RecommendationRecord): Promise<void> {
  // Keep newest first.
  await kv.lpush(KEY_RECORDS, record);
  await kv.incr(KEY_COUNT);
  // Optional: cap list length to keep payload small.
  await kv.ltrim(KEY_RECORDS, 0, 499);
}

export async function readRecentRecords(limit = 50): Promise<RecommendationRecord[]> {
  const raw = (await kv.lrange(KEY_RECORDS, 0, Math.max(0, limit - 1))) as unknown[];
  return raw
    .map((v) => v as Partial<RecommendationRecord>)
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
  const v = await kv.get<number>(KEY_COUNT);
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

