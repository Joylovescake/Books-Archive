"use client";

import { useEffect, useMemo, useState } from "react";

const BG = "#F2EFEA";
const FG = "#292723";
const FG_MID = "#595650";

type Rec = {
  id: string;
  createdAt: string;
  book: string;
  genre: string;
  why: string;
};

type ApiResponse = { records: Rec[] };

function formatDate(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export default function BookListDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [records, setRecords] = useState<Rec[]>([]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("loading");
    fetch("/api/recommendations/list", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: ApiResponse) => {
        if (cancelled) return;
        const next = Array.isArray(data?.records) ? data.records : [];
        setRecords(next);
        setPhase("ready");
      })
      .catch((err) => {
        console.error("[BookListDrawer] load failed", err);
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const title = useMemo(() => {
    if (phase === "loading") return "Loading…";
    return "Book list";
  }, [phase]);

  return (
    <div
      className="fixed inset-0 z-[80]"
      aria-hidden={!open}
      style={{
        pointerEvents: open ? "auto" : "none",
      }}
    >
      {/* Dimmer */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
        style={{
          background: open ? "rgba(41, 39, 35, 0.18)" : "rgba(41, 39, 35, 0)",
          transition: "background 220ms ease",
        }}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Book list"
        className="absolute right-0 top-0 h-full w-[min(420px,92vw)] overflow-hidden"
        style={{
          background: BG,
          color: FG,
          borderLeft: "1px solid rgba(89, 86, 80, 0.45)",
          boxShadow: "0 40px 80px rgba(41,39,35,0.22)",
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          transform: open ? "translate3d(0,0,0)" : "translate3d(100%,0,0)",
          transition: "transform 260ms cubic-bezier(0.2, 0.9, 0.2, 1)",
        }}
      >
        <header
          className="flex items-center justify-between"
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid rgba(89, 86, 80, 0.35)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: FG_MID,
            }}
          >
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              fontFamily:
                'var(--font-serif), "Playfair Display", "Didot", Times, serif',
              fontSize: 22,
              lineHeight: 1,
              color: FG_MID,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        </header>

        <div className="h-full overflow-auto" style={{ padding: "16px 18px 110px" }}>
          {phase === "error" ? (
            <div style={{ color: FG_MID, fontSize: 13, lineHeight: 1.55 }}>
              Failed to load the list. Double-click to close and try again.
            </div>
          ) : phase === "loading" ? (
            <div style={{ color: FG_MID, fontSize: 13, lineHeight: 1.55 }}>
              Fetching recent recommendations…
            </div>
          ) : records.length === 0 ? (
            <div style={{ color: FG_MID, fontSize: 13, lineHeight: 1.55 }}>
              No recommendations yet.
            </div>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              {records.map((r, idx) => (
                <li
                  key={`${r.id}-${idx}`}
                  style={{
                    border: "1px solid rgba(89, 86, 80, 0.22)",
                    borderRadius: 14,
                    padding: "12px 12px",
                    background: "rgba(242, 239, 234, 0.9)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <div
                      style={{
                        fontFamily:
                          'var(--font-bodoni), "Bodoni Moda", Didot, "Bodoni 72", "Times New Roman", serif',
                        fontSize: 18,
                        lineHeight: 1.25,
                        letterSpacing: "0.01em",
                        color: FG,
                      }}
                    >
                      {r.book}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: FG_MID,
                        whiteSpace: "nowrap",
                      }}
                      aria-hidden
                    >
                      {formatDate(r.createdAt)}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 10,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: FG_MID,
                    }}
                  >
                    {r.genre}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontFamily:
                        'var(--font-serif), "Playfair Display", Times, serif',
                      fontSize: 14,
                      lineHeight: 1.55,
                      letterSpacing: "0.01em",
                      color: FG,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {r.why}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

