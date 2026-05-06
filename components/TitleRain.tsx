"use client";

import Matter from "matter-js";
import { useEffect, useMemo, useRef, useState } from "react";

const BG = "#F2EFEA";
const FG = "#292723";
const FG_MID = "#595650";

// Match books-v2 poem terrain typography for falling titles.
const TITLE_LINE_HEIGHT = 16;
const TITLE_FONT = '10px "Helvetica Neue", Helvetica, Arial, sans-serif';
const TITLE_PADDING_X = 6;

const QUOTE_LINE_1 = "“We read to know";
const QUOTE_LINE_2 = "we are not alone.”";
const QUOTE_AUTHOR = "— C. S. Lewis";

type RainItem = {
  id: number;
  body: Matter.Body;
  w: number;
  h: number;
};

function makeSeedTitles(count: number): string[] {
  // Plain fictional titles only (no chapters / numbers). Must be *unique*
  // so we actually get 500 visible bodies (the physics spawner dedupes
  // identical strings).
  const adj = [
    "Quiet",
    "Blue",
    "Small",
    "Soft",
    "Hidden",
    "Salt",
    "Paper",
    "Winter",
    "Morning",
    "Distant",
    "Bright",
    "Broken",
    "Tender",
    "Private",
    "Open",
    "Last",
    "First",
    "Strange",
    "Narrow",
    "Wide",
    "Clear",
    "Dark",
    "Golden",
    "Pale",
  ];
  const noun = [
    "Atlas",
    "Ledger",
    "Index",
    "Archive",
    "Map",
    "River",
    "Sea",
    "Horizon",
    "Margin",
    "Lantern",
    "Room",
    "Garden",
    "Stair",
    "Letter",
    "Dust",
    "Weather",
    "Silence",
    "Mirror",
    "Stone",
    "Ink",
    "Paper",
    "Bird",
    "Door",
    "Field",
    "Window",
  ];
  const tail = [
    "of Night",
    "of Light",
    "of Water",
    "of Weather",
    "of Dust",
    "of Quiet",
    "of Salt",
    "of Ink",
    "for Leaving",
    "for Returning",
    "for the Sea",
    "for the Future",
    "at the Edge",
    "in the Margin",
    "in the Room",
    "under a Lamp",
  ];

  const patterns: Array<() => string> = [
    () => `The ${adjRand()} ${nounRand()}`,
    () => `The ${nounRand()} ${tailRand()}`,
    () => `${adjRand()} ${nounRand()} ${tailRand()}`,
    () => `A ${nounRand()} ${tailRand()}`,
  ];
  function adjRand() {
    return adj[Math.floor(Math.random() * adj.length)]!;
  }
  function nounRand() {
    return noun[Math.floor(Math.random() * noun.length)]!;
  }
  function tailRand() {
    return tail[Math.floor(Math.random() * tail.length)]!;
  }

  const out: string[] = [];
  const seen = new Set<string>();
  // Ensure we can always finish (combinatorics are huge, but add a cap anyway).
  let guard = 0;
  while (out.length < count && guard < count * 50) {
    guard += 1;
    const title = patterns[Math.floor(Math.random() * patterns.length)]!()
      .replace(/\s+/g, " ")
      .trim();
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  // If we somehow didn't hit the target (extremely unlikely), fill with
  // deterministic variations that still look like titles.
  while (out.length < count) {
    out.push(`The ${adj[out.length % adj.length] ?? "Quiet"} ${noun[out.length % noun.length] ?? "Atlas"}`);
  }
  return out;
}

export default function TitleRain() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);

  const [booksCount, setBooksCount] = useState<number>(0);
  const seeded = useMemo(() => makeSeedTitles(150), []);

  // Physics state (kept stable for lifetime of component).
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const wallsRef = useRef<Matter.Body[]>([]);
  const itemsRef = useRef<RainItem[]>([]);
  const elementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());
  const nextIdRef = useRef(1);
  const rafRef = useRef(0);

  const spawn = useRef<
    (text: string, mode: "pile" | "drop", idx?: number) => void
  >(() => {});

  // Fade in (cross-fade with terrain handled by parent).
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    node.style.opacity = "0";
    let r1 = 0;
    let r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        const live = containerRef.current;
        if (live) live.style.opacity = "1";
      });
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);

  // Mount: create world, seed pile (150 random titles).
  useEffect(() => {
    const container = containerRef.current;
    const layer = layerRef.current;
    if (!container || !layer) return;

    let width = container.clientWidth;
    let height = container.clientHeight;

    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");
    if (!measureCtx) return;
    measureCtx.font = TITLE_FONT;
    measureCtxRef.current = measureCtx;

    const engine = Matter.Engine.create();
    engine.gravity.y = 1.0;
    engineRef.current = engine;

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    const wallThickness = 220;
    const buildWalls = () => {
      const walls = wallsRef.current;
      if (walls.length) Matter.World.remove(engine.world, walls);
      wallsRef.current = [
        Matter.Bodies.rectangle(
          width / 2,
          height + wallThickness / 2,
          width + wallThickness * 2,
          wallThickness,
          { isStatic: true, label: "floor" },
        ),
        Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 3, {
          isStatic: true,
          label: "left",
        }),
        Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 3, {
          isStatic: true,
          label: "right",
        }),
      ];
      Matter.World.add(engine.world, wallsRef.current);
    };
    buildWalls();

    const spawnImpl = (text: string, mode: "pile" | "drop", idx = 0) => {
      const key = text.trim().toLowerCase();
      if (!key) return;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);

      const ctx = measureCtxRef.current;
      if (!ctx) return;
      ctx.font = TITLE_FONT;
      const measuredW = ctx.measureText(text).width;
      const w = Math.min(width - 40, measuredW + TITLE_PADDING_X * 2);
      const h = TITLE_LINE_HEIGHT;

      // Pile mode: deterministic-ish placement to create a compact
      // mound. Drop mode: spawn from above with wide x jitter.
      let x: number;
      let y: number;
      let angle: number;
      if (mode === "pile") {
        const pileCols = Math.max(14, Math.floor(width / 28));
        const col = idx % pileCols;
        const row = Math.floor(idx / pileCols);
        const colW = (width - 120) / pileCols;
        x = 60 + col * colW + (Math.random() - 0.5) * (colW * 0.35);

        // Raise the stack as row increases, but keep everything near
        // the bottom so the pile reads as a mountain immediately.
        const rowH = 14; // vertical step per "row"
        y = height - 70 - row * rowH - Math.random() * 18;
        angle = (Math.random() - 0.5) * 0.25;
      } else {
        x = 60 + Math.random() * Math.max(1, width - 120);
        y = -80 - Math.random() * 600;
        angle = (Math.random() - 0.5) * 0.6;
      }

      const body = Matter.Bodies.rectangle(x, y, w, h, {
        restitution: mode === "pile" ? 0.01 : 0.05,
        friction: mode === "pile" ? 0.92 : 0.85,
        frictionStatic: mode === "pile" ? 1.0 : 0.9,
        frictionAir: mode === "pile" ? 0.02 : 0.012,
        chamfer: { radius: 4 },
      });
      Matter.Body.setAngle(body, angle);
      Matter.Body.setVelocity(body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(
        body,
        mode === "pile" ? (Math.random() - 0.5) * 0.02 : (Math.random() - 0.5) * 0.04,
      );
      Matter.World.add(engine.world, body);

      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.font = TITLE_FONT;
      el.style.lineHeight = `${TITLE_LINE_HEIGHT}px`;
      el.style.color = FG;
      el.style.whiteSpace = "nowrap";
      el.style.pointerEvents = "none";
      el.style.userSelect = "none";
      el.style.opacity = "0.95";
      el.style.willChange = "transform";
      el.style.filter = "drop-shadow(0 10px 18px rgba(0,0,0,0.12))";
      el.textContent = text;
      layer.appendChild(el);

      const id = nextIdRef.current++;
      elementsRef.current.set(id, el);
      itemsRef.current.push({ id, body, w, h });
    };
    spawn.current = spawnImpl;

    // Seed the initial mountain.
    for (let i = 0; i < seeded.length; i++) {
      spawnImpl(seeded[i]!, "pile", i);
    }

    const tick = () => {
      const items = itemsRef.current;
      const elements = elementsRef.current;
      for (const it of items) {
        const el = elements.get(it.id);
        if (!el) continue;
        const { x, y } = it.body.position;
        const a = it.body.angle;
        el.style.transform = `translate3d(${x - it.w / 2}px, ${y - it.h / 2}px, 0) rotate(${a}rad)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const onResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      buildWalls();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);

      const runnerLive = runnerRef.current;
      if (runnerLive) Matter.Runner.stop(runnerLive);
      const engineLive = engineRef.current;
      if (engineLive) {
        Matter.World.clear(engineLive.world, false);
        Matter.Engine.clear(engineLive);
      }
      engineRef.current = null;
      runnerRef.current = null;

      for (const el of elementsRef.current.values()) el.remove();
      elementsRef.current.clear();
      itemsRef.current = [];
      seenRef.current.clear();
    };
  }, [seeded]);

  // Fetch real titles + count and drop any new ones from above.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/recommendations/titles", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { titles: [], count: 0 }))
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data?.titles) ? (data.titles as unknown[]) : [];
        const cleaned = arr
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim());
        const count =
          typeof data?.count === "number" && Number.isFinite(data.count)
            ? Math.max(0, Math.floor(data.count))
            : 0;
        setBooksCount(count);

        for (const t of cleaned) spawn.current(t, "drop");
      })
      .catch(() => {
        if (!cancelled) setBooksCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[40]"
      style={{
        background: BG,
        color: FG,
        overflow: "hidden",
        pointerEvents: "none",
        opacity: 0,
        transition: "opacity 520ms ease",
      }}
      aria-label="Recommendation title rain"
    >
      {/* Top-left count */}
      <div
        className="absolute left-10 top-10 z-[6]"
        style={{
          fontFamily:
            'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: FG_MID,
        }}
      >
        Book count · {booksCount}
      </div>

      {/* Falling titles layer (DOM-synced from physics bodies). */}
      <div
        ref={layerRef}
        className="absolute inset-0"
        aria-hidden
        style={{ pointerEvents: "none" }}
      />

      {/* Static centered quote. Sits above the falling titles. */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          zIndex: 5,
          color: FG,
          maxWidth: "min(86vw, 1100px)",
        }}
      >
        <div
          style={{
            fontFamily:
              'var(--font-bodoni), "Bodoni Moda", Didot, "Bodoni 72", "Times New Roman", serif',
            fontWeight: 500,
            fontStyle: "italic",
            fontSize: 50,
            lineHeight: 1.15,
            letterSpacing: "0.01em",
          }}
        >
          <div>{QUOTE_LINE_1}</div>
          <div>{QUOTE_LINE_2}</div>
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: 14,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: FG_MID,
          }}
        >
          {QUOTE_AUTHOR}
        </div>
      </div>
    </div>
  );
}
