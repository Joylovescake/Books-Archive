import { nanoid } from "nanoid";
import { appendRecord, readRecentRecords } from "../../../lib/recommendations-store-kv";

/**
 * POST /api/recommendations
 *
 * Body: { book: string, genre: string, why: string }
 *
 * Response: { id: string }
 *
 * Persistence (see [`lib/recommendations-store-kv.ts`](lib/recommendations-store-kv.ts)):
 *   - Persists to Vercel KV.
 *
 * The PNG side of the dossier (download / share-to-X) is now handled
 * entirely on the client; the server no longer accepts drawing payloads.
 */

export const runtime = "nodejs";

const LIMITS = {
  book: 160,
  genre: 80,
  why: 600,
} as const;

type Body = {
  book?: unknown;
  genre?: unknown;
  why?: unknown;
};

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

function trimString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const book = trimString(body.book, LIMITS.book);
  const genre = trimString(body.genre, LIMITS.genre);
  const why = trimString(body.why, LIMITS.why);
  if (!book) return badRequest("Field `book` is required.");
  if (!genre) return badRequest("Field `genre` is required.");
  if (!why) return badRequest("Field `why` is required.");

  const record = {
    id: nanoid(10),
    createdAt: new Date().toISOString(),
    book,
    genre,
    why,
  };

  try {
    await appendRecord(record);
  } catch (err) {
    console.error("[recommendations] persist failed", err);
    return Response.json(
      { error: "Failed to persist recommendation." },
      { status: 500 },
    );
  }

  return Response.json({ id: record.id });
}

/**
 * GET /api/recommendations
 *
 * Admin-only export. Returns the most recent 50 records when the request
 * carries `?token=<RECOMMENDATIONS_ADMIN_TOKEN>` and that env is set.
 * 401 in every other case so we never expose recommendations publicly.
 */
export async function GET(req: Request) {
  const adminToken = process.env.RECOMMENDATIONS_ADMIN_TOKEN;
  const url = new URL(req.url);
  const supplied = url.searchParams.get("token");
  if (!adminToken || !supplied || supplied !== adminToken) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const records = await readRecentRecords(50);
    return Response.json({
      backend: "kv",
      records,
    });
  } catch (err) {
    console.error("[recommendations] read failed", err);
    return Response.json(
      { error: "Failed to read recommendations." },
      { status: 500 },
    );
  }
}
