import {
  readBookTitles,
  readSubmissionCount,
} from "../../../../lib/recommendations-store-kv";

/**
 * GET /api/recommendations/titles
 *
 * Public, low-information endpoint. Returns *only* book titles (the
 * `book` column) so that the post-submission "title rain" scene on
 * `/chapter-1/books-v2` can drop them onto the page without exposing
 * the genre or "why" fields the user wrote.
 *
 * Response: { titles: string[], count: number }
 *
 * Cached for 60s on the edge so we don't hammer the Sheets API every
 * time someone submits.
 */

export const runtime = "nodejs";
export const revalidate = 60;

const MAX_TITLES = 200;

export async function GET() {
  try {
    const all = await readBookTitles();
    const count = await readSubmissionCount();
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const raw of all) {
      const title = raw.trim();
      if (!title) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(title);
      if (deduped.length >= MAX_TITLES) break;
    }
    return Response.json(
      { titles: deduped, count },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    console.error("[recommendations/titles] read failed", err);
    return Response.json(
      { titles: [] satisfies string[], count: 0 },
      { status: 200 },
    );
  }
}
