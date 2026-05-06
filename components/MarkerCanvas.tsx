"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

/**
 * MarkerCanvas — a small marker-pen sketch surface.
 *
 * Strokes are stored as raw point arrays; rendering goes through a
 * quadratic-bezier midpoint smoothing pass so the pen feels like a thick
 * felt-tip rather than a polyline. Undo pops the most recent stroke and
 * the canvas is repainted from the remaining strokes.
 *
 * The parent gets a small imperative API via ref:
 *   - getDataURL(): string  (always returns a PNG data URL)
 *   - clear():       void
 *   - undo():        void
 *   - hasStrokes():  boolean
 */

type Point = { x: number; y: number; t?: number };
type Stroke = {
  color: string;
  width: number;
  alpha: number;
  points: Point[];
};

export type MarkerCanvasHandle = {
  getDataURL: () => string;
  clear: () => void;
  undo: () => void;
  hasStrokes: () => boolean;
};

type MarkerCanvasProps = {
  width: number;
  height: number;
  color?: string;
  lineWidth?: number;
  alpha?: number;
  /** Body color of the canvas (matches dossier panel). */
  background?: string;
  /** Fires when the first stroke begins; lets the parent hide a placeholder. */
  onFirstStroke?: () => void;
  /** Fires whenever the committed stroke count changes (after up / undo / clear). */
  onStrokesChange?: (count: number) => void;
  className?: string;
  style?: React.CSSProperties;
};

const DEFAULT_COLOR = "#292723";
// Chisel tip marker defaults.
// `lineWidth` controls the *long* edge of the nib.
const DEFAULT_WIDTH = 12;
// Semi-transparent ink; overlapping strokes deepen naturally.
const DEFAULT_ALPHA = 0.22;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function dist(a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = clamp(r, 0, Math.min(w, h) / 2);
  // Canvas has roundRect in modern browsers, but keep a fallback.
  const anyCtx = ctx as unknown as { roundRect?: (...args: unknown[]) => void };
  if (anyCtx.roundRect) {
    anyCtx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

function stampNib(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleRad: number,
  longEdge: number,
  shortEdge: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;

  // Soft edges: subtle blur in the same ink color.
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(0.4, shortEdge * 0.85);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const w = longEdge;
  const h = shortEdge;
  const r = Math.min(2.2, h * 0.45);
  ctx.beginPath();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, r);
  ctx.fill();
  ctx.restore();
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const { points, color, width, alpha } = stroke;
  if (points.length === 0) return;

  // Chisel nib: a rotated rounded-rect stamp.
  // - long edge = `width`
  // - short edge proportional to long edge (typical chisel tip)
  const longEdge = width;
  const shortEdge = Math.max(3, width * 0.28);

  // Tilt: constant offset relative to movement direction.
  // (If you later want real stylus tilt, we can plumb PointerEvent tiltX/tiltY.)
  const tiltOffset = -0.7;

  if (points.length === 1) {
    stampNib(ctx, points[0]!.x, points[0]!.y, tiltOffset, longEdge, shortEdge, color, alpha);
    return;
  }

  // Stamp along each segment at a spacing tied to the short edge.
  const spacing = Math.max(1.2, shortEdge * 0.45);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const d = dist(a, b);
    if (d === 0) continue;
    const steps = Math.max(1, Math.floor(d / spacing));
    const dx = (b.x - a.x) / steps;
    const dy = (b.y - a.y) / steps;
    const moveAngle = Math.atan2(b.y - a.y, b.x - a.x);
    const nibAngle = moveAngle + tiltOffset;
    for (let s = 0; s <= steps; s++) {
      const x = a.x + dx * s;
      const y = a.y + dy * s;
      stampNib(ctx, x, y, nibAngle, longEdge, shortEdge, color, alpha);
    }
  }
}

const MarkerCanvas = forwardRef<MarkerCanvasHandle, MarkerCanvasProps>(
  function MarkerCanvas(
    {
      width,
      height,
      color = DEFAULT_COLOR,
      lineWidth = DEFAULT_WIDTH,
      alpha = DEFAULT_ALPHA,
      background = "#F2EFEA",
      onFirstStroke,
      onStrokesChange,
      className,
      style,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const activeRef = useRef<Stroke | null>(null);
    const drawingPointerRef = useRef<number | null>(null);
    const dprRef = useRef(1);
    const [, force] = useState(0);

    const repaint = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      for (const stroke of strokesRef.current) paintStroke(ctx, stroke);
      if (activeRef.current) paintStroke(ctx, activeRef.current);
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      repaint();
    }, [width, height, repaint]);

    useImperativeHandle(
      ref,
      (): MarkerCanvasHandle => ({
        getDataURL: () => {
          const canvas = canvasRef.current;
          if (!canvas) return "";

          // Compose a flat PNG with the dossier background painted in,
          // so the downloaded file looks like the on-screen marker pad.
          const out = document.createElement("canvas");
          const dpr = dprRef.current;
          out.width = Math.floor(width * dpr);
          out.height = Math.floor(height * dpr);
          const ctx = out.getContext("2d");
          if (ctx) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, out.width, out.height);
            ctx.drawImage(canvas, 0, 0);
          }
          return out.toDataURL("image/png");
        },
        clear: () => {
          strokesRef.current = [];
          activeRef.current = null;
          repaint();
          force((n) => n + 1);
          onStrokesChange?.(0);
        },
        undo: () => {
          strokesRef.current.pop();
          repaint();
          force((n) => n + 1);
          onStrokesChange?.(strokesRef.current.length);
        },
        hasStrokes: () => strokesRef.current.length > 0,
      }),
      [width, height, background, repaint, onStrokesChange],
    );

    const localPoint = useCallback((e: React.PointerEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t: e.timeStamp,
      };
    }, []);

    const onPointerDown = (e: React.PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ignore non-capturable pointer types
      }
      drawingPointerRef.current = e.pointerId;
      const wasEmpty =
        strokesRef.current.length === 0 && activeRef.current === null;
      activeRef.current = {
        color,
        width: lineWidth,
        alpha,
        points: [localPoint(e)],
      };
      repaint();
      if (wasEmpty) onFirstStroke?.();
    };

    const onPointerMove = (e: React.PointerEvent) => {
      if (drawingPointerRef.current !== e.pointerId) return;
      const stroke = activeRef.current;
      if (!stroke) return;
      stroke.points.push(localPoint(e));
      // Repaint just the current stroke incrementally on top — simpler is
      // to repaint everything (cheap at this canvas size).
      repaint();
    };

    const finishStroke = (e: React.PointerEvent) => {
      if (drawingPointerRef.current !== e.pointerId) return;
      const stroke = activeRef.current;
      drawingPointerRef.current = null;
      activeRef.current = null;
      if (stroke) {
        strokesRef.current.push(stroke);
        onStrokesChange?.(strokesRef.current.length);
      }
      repaint();
      force((n) => n + 1);
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    };

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          touchAction: "none",
          cursor: "crosshair",
          background,
          display: "block",
          ...style,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={(e) => {
          if (drawingPointerRef.current === e.pointerId) finishStroke(e);
        }}
      />
    );
  },
);

export default MarkerCanvas;
