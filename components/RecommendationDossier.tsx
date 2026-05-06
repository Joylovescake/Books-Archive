"use client";

import { toPng } from "html-to-image";
import { useEffect, useMemo, useRef, useState } from "react";
import MarkerCanvas, { type MarkerCanvasHandle } from "./MarkerCanvas";

/**
 * RecommendationDossier
 *
 * The "electronic archive" modal that fades in after the books-v2 terrain
 * collapses and the falling-text physics settles. Visual language matches
 * the books-v2 cartography palette / typography.
 *
 * Layout
 *   ┌────────────────── ARCHIVE / RECOMMENDATION ──────────────────┐
 *   │ LEGERE                                │ [marker canvas]       │
 *   │ 01 — Most-loved book recently?       │ Undo  Clear             │
 *   │ 02 — What's its genre?               │ Download PNG  Share X   │
 *   │ 03 — Why this one?                   │                         │
 *   │                            Submit ▸  │                         │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Submit only persists the answers (POST /api/recommendations → Google
 * Sheets). PNG download / share to X are now standalone right-column
 * actions; both capture the whole archive card via html-to-image.
 *
 * The parent owns the after-submit transition: when the API returns,
 * the dossier calls `onSubmitted({ id, book })` and the parent swaps
 * the page to the "title rain" scene. This component does not show a
 * thank-you screen.
 */

const COLORS = {
  bg: "#F2EFEA",
  bright: "#292723",
  mid: "#595650",
  dim: "#8A857D",
  faint: "#B3AEA5",
  hairline: "rgba(89, 86, 80, 0.4)",
  hairlineSoft: "rgba(89, 86, 80, 0.18)",
} as const;

const FIELD_LIMITS = { book: 160, genre: 80, why: 600 } as const;

const MARKER_PALETTE = [
  { id: "red", label: "RED", hex: "#C53D3D" },
  { id: "orange", label: "ORANGE", hex: "#D97A2B" },
  { id: "yellow", label: "YELLOW", hex: "#D6B21B" },
  { id: "green", label: "GREEN", hex: "#3C8C5E" },
  { id: "blue", label: "BLUE", hex: "#2F6DB0" },
  { id: "purple", label: "PURPLE", hex: "#6A4EB7" },
  { id: "black", label: "BLACK", hex: "#292723" },
] as const;

type DossierProps = {
  open: boolean;
  /** Called when the user explicitly dismisses the dossier (close or reset). */
  onReset: () => void;
  /**
   * Fires once the answers have been persisted server-side. The parent
   * uses this to advance to the "title rain" scene.
   */
  onSubmitted?: (payload: { id: string; book: string }) => void;
  /** Skip saving and jump straight to the next page/scene. */
  onNextPage?: () => void;
};

type Step = 0 | 1 | 2;
type Phase = "form" | "submitting" | "error";
type CaptureKind = "download" | "share";

type FormState = {
  book: string;
  genre: string;
  why: string;
};

const QUESTIONS: ReadonlyArray<{
  key: keyof FormState;
  index: string;
  label: string;
  placeholder: string;
  multiline: boolean;
  max: number;
}> = [
  {
    key: "book",
    index: "01",
    label: "Most-loved book recently?",
    placeholder: "Title and author…",
    multiline: false,
    max: FIELD_LIMITS.book,
  },
  {
    key: "genre",
    index: "02",
    label: "What's its genre?",
    placeholder: "Memoir, sci-fi, poetry, …",
    multiline: false,
    max: FIELD_LIMITS.genre,
  },
  {
    key: "why",
    index: "03",
    label: "Why this one?",
    placeholder: "A few sentences are plenty.",
    multiline: true,
    max: FIELD_LIMITS.why,
  },
];

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function openXCompose(text: string) {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// Fixed share caption requested by the product brief. Multi-line and emoji
// kept verbatim — keep this in sync with the design doc.
const X_SHARE_TEXT = `No book to read lately? here's my most-loved book recently 🔗 share it forward

somewhere between reading and creating
maybe you'll find something worth keeping.`;

export default function RecommendationDossier({
  open,
  onReset,
  onSubmitted,
  onNextPage,
}: DossierProps) {
  const [phase, setPhase] = useState<Phase>("form");
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormState>({ book: "", genre: "", why: "" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [markerColor, setMarkerColor] = useState<string>(MARKER_PALETTE[6].hex);
  const [busyCapture, setBusyCapture] = useState<CaptureKind | null>(null);
  const hasDrawn = strokeCount > 0;

  const markerRef = useRef<MarkerCanvasHandle | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Fade-in via direct DOM mutation: paint once at opacity 0 and flip to 1
  // on the next frame so the CSS transition has a starting frame. We do
  // this imperatively to avoid setState-in-effect cascading renders.
  useEffect(() => {
    if (!open) return;
    const node = overlayRef.current;
    if (!node) return;
    node.style.opacity = "0";
    let r1 = 0;
    let r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        const live = overlayRef.current;
        if (live) live.style.opacity = "1";
      });
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [open]);

  const stamp = useMemo(() => todayStamp(), []);

  if (!open) return null;

  const canAdvance = (idx: Step) => form[QUESTIONS[idx]!.key].trim().length > 0;
  const canSubmit =
    form.book.trim().length > 0 &&
    form.genre.trim().length > 0 &&
    form.why.trim().length > 0;

  const handleNextQuestion = () => {
    if (!canAdvance(step)) return;
    if (step < 2) setStep((s) => ((s + 1) as Step));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPhase("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          book: form.book.trim(),
          genre: form.genre.trim(),
          why: form.why.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data && (data.error as string)) || `Request failed (${res.status})`,
        );
      }
      const { id } = (await res.json()) as { id: string };
      onSubmitted?.({ id, book: form.book.trim() });
    } catch (err) {
      console.error("[dossier] submit failed", err);
      setErrorMsg(err instanceof Error ? err.message : "Submission failed.");
      setPhase("error");
    }
  };

  const handleNextPage = () => {
    onNextPage?.();
  };

  // Snapshot the whole archive card (LEGERE + answered questions +
  // drawing) into a PNG dataURL. Controls inside the card are tagged
  // with `data-snapshot-hide` and hidden by CSS while
  // `[data-capturing="true"]` is set, so they don't appear in the
  // exported image.
  const captureArchivePng = async (): Promise<string | null> => {
    const panel = panelRef.current;
    if (!panel) return null;
    try {
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
      }
      panel.dataset.capturing = "true";
      const png = await toPng(panel, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: COLORS.bg,
      });
      return png;
    } catch (err) {
      console.error("[dossier] snapshot failed", err);
      return null;
    } finally {
      delete panel.dataset.capturing;
    }
  };

  const handleDownloadPng = async () => {
    if (busyCapture) return;
    setBusyCapture("download");
    try {
      const png = await captureArchivePng();
      if (png) downloadDataUrl(png, "book-archive.png");
    } finally {
      setBusyCapture(null);
    }
  };

  const handleShareOnX = async () => {
    if (busyCapture) return;
    setBusyCapture("share");
    try {
      const png = await captureArchivePng();
      if (png) downloadDataUrl(png, "book-archive.png");
      // X's web intent does not accept image attachments; the user is
      // prompted to drag the just-downloaded PNG into the compose box.
      openXCompose(X_SHARE_TEXT);
    } finally {
      setBusyCapture(null);
    }
  };

  const handleClose = () => {
    onReset();
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Recommendation archive"
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{
        opacity: 0,
        transition: "opacity 360ms ease",
        background: "rgba(41, 39, 35, 0.18)",
      }}
    >
      <style>{`
        [data-archive-panel][data-capturing="true"] [data-snapshot-hide] {
          visibility: hidden !important;
        }
      `}</style>
      <div
        ref={panelRef}
        data-archive-panel="true"
        className="relative grid w-[min(92vw,920px)] max-h-[90vh] grid-cols-1 overflow-hidden md:grid-cols-[380px_1fr]"
        style={{
          background: COLORS.bg,
          color: COLORS.bright,
          border: `1px solid ${COLORS.mid}`,
          boxShadow: "0 30px 60px rgba(41,39,35,0.22)",
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
      >
        {/* Top strip spans both columns */}
        <header
          className="md:col-span-2 flex items-center justify-between"
          style={{
            padding: "14px 24px",
            borderBottom: `1px solid ${COLORS.hairline}`,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: COLORS.mid,
          }}
        >
          <div className="flex items-baseline gap-5">
            <span style={{ color: COLORS.bright }}>
              ARCHIVE / RECOMMENDATION
            </span>
            <span aria-hidden style={{ color: COLORS.dim }}>
              LEDGER ENTRY · {stamp}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close archive"
            data-snapshot-hide
            style={{
              fontFamily:
                'var(--font-serif), "Playfair Display", "Didot", Times, serif',
              fontSize: 22,
              lineHeight: 1,
              color: COLORS.mid,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        </header>

        {/* Left: LEGERE title + stacked-focus questions */}
        <section
          className="flex flex-col"
          style={{
            padding: "28px 28px 24px",
            borderRight: `1px solid ${COLORS.hairline}`,
            minHeight: 600,
          }}
        >
          {/* Monumental LEGERE title — handwritten flourished script.
                  Occupies ~1/3 of the left column height to anchor the panel. */}
              <h2
                style={{
                  margin: 0,
                  height: "clamp(120px, 33%, 180px)",
                  minHeight: 120,
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 24,
                  // Align the left edge of LEGERE with the question index
                  // ("01", "02"…) — same as the start of each question row.
                  paddingLeft: 0,
                  paddingTop: 10,
                  paddingBottom: 10,
                  fontFamily:
                    'var(--font-bodoni), "Bodoni Moda", Didot, "Bodoni 72", "Times New Roman", serif',
                  fontWeight: 600,
                  letterSpacing: "0.22em",
                  fontSize: 60,
                  lineHeight: 1.05,
                  textTransform: "uppercase",
                  color: COLORS.bright,
                  maxWidth: "100%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "clip",
                }}
              >
                LEGERE
              </h2>
              <ol
                className="flex flex-col gap-5"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {QUESTIONS.map((q, idx) => {
                  const active = step === idx;
                  const value = form[q.key];
                  return (
                    <li key={q.key} style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setStep(idx as Step)}
                        className="w-full text-left"
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: active ? COLORS.bright : COLORS.dim,
                          display: "flex",
                          alignItems: "baseline",
                          gap: 14,
                          fontSize: 12,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                        }}
                      >
                        <span
                          style={{
                            fontFamily:
                              'var(--font-serif), "Playfair Display", Times, serif',
                            fontSize: 18,
                            letterSpacing: "0.02em",
                            color: active ? COLORS.bright : COLORS.faint,
                          }}
                        >
                          {q.index}
                        </span>
                        <span>{q.label}</span>
                      </button>
                      {!active && value.trim().length > 0 ? (
                        <div
                          style={{
                            marginTop: 10,
                            paddingLeft: 36,
                            fontFamily:
                              'var(--font-serif), "Playfair Display", Times, serif',
                            fontSize: 18,
                            lineHeight: 1.4,
                            letterSpacing: "0.01em",
                            color: COLORS.bright,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {value}
                        </div>
                      ) : null}
                      {active ? (
                        <div style={{ marginTop: 10 }}>
                          {q.multiline ? (
                            <textarea
                              autoFocus
                              value={value}
                              maxLength={q.max}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  [q.key]: e.target.value,
                                }))
                              }
                              placeholder={q.placeholder}
                              rows={4}
                              style={inputStyle({ multiline: true })}
                            />
                          ) : (
                            <input
                              autoFocus
                              type="text"
                              value={value}
                              maxLength={q.max}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  [q.key]: e.target.value,
                                }))
                              }
                              placeholder={q.placeholder}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleNextQuestion();
                                }
                              }}
                              style={inputStyle({ multiline: false })}
                            />
                          )}
                          <div
                            data-snapshot-hide
                            style={{
                              marginTop: 6,
                              fontSize: 10,
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              color: COLORS.dim,
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>
                              {value.length} / {q.max}
                            </span>
                            <span aria-hidden>↵ NEXT</span>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>

              <div
                className="mt-auto flex items-center justify-between"
                data-snapshot-hide
                style={{ paddingTop: 24 }}
              >
                {errorMsg ? (
                  <span style={{ fontSize: 11, color: "#a33" }}>
                    {errorMsg}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: COLORS.dim,
                    }}
                  >
                    {step + 1} / {QUESTIONS.length}
                  </span>
                )}
                <div className="flex flex-wrap items-end justify-end" style={{ gap: 10 }}>
                  <PillButton
                    onClick={handleSubmit}
                    disabled={!canSubmit || phase === "submitting"}
                    label={phase === "submitting" ? "Saving…" : "Save"}
                  />
                  <PillButton
                    onClick={handleNextPage}
                    label="Throw it to the universe"
                    allowLongLabel
                  />
                </div>
              </div>
        </section>

        {/* Right: marker canvas */}
        <section
          style={{
            padding: "28px 28px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minHeight: 600,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: COLORS.mid,
            }}
          >
            Anything you want to draw or write?
          </div>

          <div
            style={{
              position: "relative",
              flex: 1,
              minHeight: 320,
              border: `1px dashed ${COLORS.hairlineSoft}`,
              background: COLORS.bg,
            }}
          >
            <MarkerCanvas
              ref={markerRef}
              width={420}
              height={320}
              color={markerColor}
              // Chisel-tip marker settings
              lineWidth={15}
              alpha={0.22}
              background={COLORS.bg}
              onStrokesChange={setStrokeCount}
              style={{ width: "100%", height: "100%" }}
            />

            {!hasDrawn ? (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  fontFamily:
                    'var(--font-serif), "Playfair Display", Times, serif',
                  color: COLORS.faint,
                  fontSize: 16,
                  letterSpacing: "0.02em",
                }}
              >
                a marker, a margin, a thought
              </div>
            ) : null}
          </div>

          <div
            className="flex items-center justify-between"
            data-snapshot-hide
            style={{ gap: 12 }}
          >
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: COLORS.dim,
              }}
            >
              MARKER · INK · 15PX
            </span>
            <div className="flex items-center" style={{ gap: 8 }}>
              <div className="hidden items-center sm:flex" style={{ gap: 6 }}>
                {MARKER_PALETTE.map((c) => {
                  const active = markerColor === c.hex;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setMarkerColor(c.hex)}
                      aria-label={`Marker color: ${c.label}`}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 9999,
                        background: c.hex,
                        border: active
                          ? `1px solid ${COLORS.bright}`
                          : `1px solid ${COLORS.hairlineSoft}`,
                        boxShadow: active
                          ? "0 0 0 2px rgba(242,239,234,1)"
                          : "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  );
                })}
              </div>
              <GhostButton
                onClick={() => markerRef.current?.undo()}
                disabled={!hasDrawn}
                label="Undo"
              />
              <GhostButton
                onClick={() => markerRef.current?.clear()}
                disabled={!hasDrawn}
                label="Clear"
              />
            </div>
          </div>

          {/* Standalone PNG actions. Both capture the whole archive
              card (LEGERE + answered questions + drawing). They are
              tagged data-snapshot-hide so the buttons themselves don't
              appear in the exported image. */}
          <div
            className="flex items-center justify-end"
            data-snapshot-hide
            style={{ gap: 8, marginTop: "auto" }}
          >
            <GhostButton
              onClick={handleDownloadPng}
              disabled={busyCapture !== null}
              label={
                busyCapture === "download" ? "Capturing…" : "Download PNG"
              }
            />
            <GhostButton
              onClick={handleShareOnX}
              disabled={busyCapture !== null}
              label={busyCapture === "share" ? "Capturing…" : "Share on X"}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function inputStyle({ multiline }: { multiline: boolean }): React.CSSProperties {
  return {
    width: "100%",
    fontFamily: 'var(--font-serif), "Playfair Display", Times, serif',
    fontSize: 18,
    lineHeight: 1.4,
    letterSpacing: "0.01em",
    color: COLORS.bright,
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${COLORS.hairline}`,
    outline: "none",
    padding: "8px 0",
    resize: multiline ? "vertical" : undefined,
    minHeight: multiline ? 84 : undefined,
  };
}

function PillButton({
  onClick,
  disabled,
  label,
  allowLongLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  /** Multi-line friendly label (wider button, wrapped text). */
  allowLongLabel?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: allowLongLabel ? 10 : 11,
        letterSpacing: allowLongLabel ? "0.12em" : "0.18em",
        textTransform: "uppercase",
        color: disabled ? COLORS.faint : COLORS.bg,
        background: disabled ? "transparent" : COLORS.bright,
        border: `1px solid ${disabled ? COLORS.faint : COLORS.bright}`,
        padding: allowLongLabel ? "10px 14px" : "9px 18px",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 160ms ease, color 160ms ease",
        ...(allowLongLabel
          ? {
              whiteSpace: "normal",
              lineHeight: 1.25,
              maxWidth: 240,
              textAlign: "center",
            }
          : {}),
      }}
    >
      {label}
    </button>
  );
}

function GhostButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: 10,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: disabled ? COLORS.faint : COLORS.mid,
        background: "transparent",
        border: `1px solid ${disabled ? COLORS.hairlineSoft : COLORS.hairline}`,
        padding: "7px 12px",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

