import { readRecentRecords, type RecommendationRecord } from "../../../../lib/recommendations-store-kv";

/**
 * GET /api/recommendations/list
 *
 * Public endpoint that returns recent recommendation records.
 * Response: { records: Array<{ id, createdAt, book, genre, why }> }
 */
export const runtime = "nodejs";
export const revalidate = 60;

const LIMIT = 50;

function cleanRecords(records: RecommendationRecord[]) {
  // Keep the payload predictable and trimmed.
  return records
    .map((r) => ({
      id: String(r.id ?? "").trim(),
      createdAt: String(r.createdAt ?? "").trim(),
      book: String(r.book ?? "").trim(),
      genre: String(r.genre ?? "").trim(),
      why: String(r.why ?? "").trim(),
    }))
    .filter((r) => r.book.length > 0 && r.genre.length > 0 && r.why.length > 0);
}

export async function GET() {
  try {
    const records = await readRecentRecords(LIMIT);
    return Response.json(
      { records: cleanRecords(records) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    console.error("[recommendations/list] read failed", err);
    return Response.json({ records: [] satisfies RecommendationRecord[] }, { status: 200 });
  }
}

