"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import {
  prepareWithSegments,
  layoutNextLine,
  type LayoutCursor,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";
import BooksV2MusicBar from "../../../components/BooksV2MusicBar";
import BookListDrawer from "../../../components/BookListDrawer";
import RecommendationDossier from "../../../components/RecommendationDossier";
import TitleRain from "../../../components/TitleRain";

const BOOKS_V2_PUBLIC_ONLY = process.env.NEXT_PUBLIC_BOOKS_V2_ONLY === "true";

/**
 * Subpage 1-1 (V2) — `/chapter-1/books-v2`
 *
 * "Pretext Terrain" cartography renderer where the topography is composed
 * entirely of Audre Lorde poems. Drag to pan, wheel/pinch to zoom.
 *
 * Each elevation band loops one full poem independently via
 * `Pretext.layoutNextLine`, so contour stripes are made of words.
 *
 * Visual chrome (HUD, legend, crosshair, palette, font sizes, easing)
 * is a direct port of the reference design HTML — only the language is
 * recontextualized: latitude/longitude/zoom → STANZA / LINE / PROXIMITY,
 * legend rows → poem titles + years.
 */

const FONT_SIZE = 10;
const LINE_HEIGHT = 16;
const FONT_STR = `${FONT_SIZE}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
/** Horizontal scan resolution for elevation sampling (px per probe). */
const SCAN_STEP = 3;
const BG = "#F2EFEA";
const FG_MID = "#595650";
const FG_BRIGHT = "#292723";
const DIAMOND_CURSOR =
  'url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2712%27%20height=%2712%27%20viewBox=%270%200%2012%2012%27%3E%3Cpath%20d=%27M6%200%20L12%206%20L6%2012%20L0%206%20Z%27%20fill=%27%23000%27/%3E%3C/svg%3E") 6 6, auto';

type Poem = {
  title: string;
  year: string;
  color: string;
  text: string;
};

const POEMS: readonly Poem[] = [
  {
    title: "AFTERIMAGE",
    year: "1981",
    color: "#B3AEA5",
    text: `Afterimage/1981/
I
However the image enters
its force remains within
my eyes
rockstrewn caves where dragonfish evolve
wild for life, relentless and acquisitive
learning to survive
where there is no food
my eyes are always hungry
and remembering
however the image enters
its force remains.
A white woman stands bereft and empty
a black boy hacked into a murderous lesson
recalled in me forever
like a lurch of earth on the edge of sleep
etched into my visions
food for dragonfish that learn
to live upon whatever they must eat
fused images beneath my pain.

II
The Pearl River floods through the streets of Jackson
A Mississippi summer televised.
Trapped houses kneel like sinners in the rain
a white woman climbs from her roof to a passing boat
her fingers tarry for a moment on the chimney
now awash
tearless and no longer young, she holds
a tattered baby's blanket in her arms.
In a flickering afterimage of the nightmare rain
a microphone
thrust up against her flat bewildered words
“we jest come from the bank yestiddy
borrowing money to pay the income tax
now everything's gone. I never knew
it could be so hard.”
Despair weighs down her voice like Pearl River mud
caked around the edges
her pale eyes scanning the camera for help or explanation
unanswered
she shifts her search across the watered street, dry-eyed
“hard, but not this hard.”
Two tow-headed children hurl themselves against her
hanging upon her coat like mirrors
until a man with ham-like hands pulls her aside
snarling “She ain't got nothing more to say!”
and that lie hangs in his mouth
like a shred of rotting meat.

III
I inherited Jackson, Mississippi.
For my majority it gave me Emmett Till
his 15 years puffed out like bruises
on plump boy-cheeks
his only Mississippi summer
whistling a 21 gun salute to Dixie
as a white girl passed him in the street
and he was baptized my son forever
in the midnight waters of the Pearl.

His broken body is the afterimage of my 21st year
when I walked through a northern summer
my eyes averted
from each corner's photographies
newspapers protest posters magazines
Police Story, Confidential, True
the avid insistence of detail
pretending insight or information
the length of gash across the dead boy's loins
his grieving mother's lamentation
the severed lips, how many burns
his gouged out eyes
sewed shut upon the screaming covers
louder than life
all over
the veiled warning, the secret relish
of a black child's mutilated body
fingered by street-corner eyes
bruise upon livid bruise
and wherever I looked that summer
I learned to be at home with children's blood
with savored violence
with pictures of black broken flesh
used, crumpled, and discarded
lying amid the sidewalk refuse
like a raped woman's face.

A black boy from Chicago
whistled on the streets of Jackson, Mississippi
testing what he'd been taught was a manly thing to do
his teachers
ripped his eyes out his sex his tongue
and flung him to the Pearl weighted with stone
in the name of white womanhood
they took their aroused honor
back to Jackson
and celebrated in a whorehouse
the double ritual of white manhood
confirmed.

IV
“If earth and air and water do not judge them who are
we to refuse a crust of bread?”

Emmett Till rides the crest of the Pearl, whistling
24 years his ghost lay like the shade of a raped woman
and a white girl has grown older in costly honor
(what did she pay to never know its price?)
now the Pearl River speaks its muddy judgment
and I can withhold my pity and my bread.

“Hard, but not this hard.”
Her face is flat with resignation and despair
with ancient and familiar sorrows
a woman surveying her crumpled future
as the white girl besmirched by Emmett's whistle
never allowed her own tongue
without power or conclusion
unvoiced
she stands adrift in the ruins of her honor
and a man with an executioner's face
pulls her away.

Within my eyes
the flickering afterimages of a nightmare rain
a woman wrings her hands
beneath the weight of agonies remembered
I wade through summer ghosts
betrayed by vision
hers and my own
becoming dragonfish to survive
the horrors we are living
with tortured lungs
adapting to breathe blood.

A woman measures her life's damage
my eyes are caves, chunks of etched rock
tied to the ghost of a black boy
whistling
crying and frightened
her tow-headed children cluster
like little mirrors of despair
their father's hands upon them
and soundlessly
a woman begins to weep.`,
  },
  {
    title: "COAL",
    year: "1976",
    color: "#8A857D",
    text: `Coal/1976
I
Is the total black, being spoken
From the earth's inside.
There are many kinds of open.
How a diamond comes into a knot of flame
How a sound comes into a word, coloured
By who pays what for speaking.

Some words are open
Like a diamond on glass windows
Singing out within the crash of passing sun
Then there are words like stapled wagers
In a perforated book—buy and sign and tear apart—
And come whatever wills all chances
The stub remains
An ill-pulled tooth with a ragged edge.
Some words live in my throat
Breeding like adders. Others know sun
Seeking like gypsies over my tongue
To explode through my lips
Like young sparrows bursting from shell.
Some words
Bedevil me.

Love is a word another kind of open—
As a diamond comes into a knot of flame
I am black because I come from the earth's inside
Take my word for jewel in your open light.`,
  },
  {
    title: "WHO SAID IT WAS SIMPLE",
    year: "1973",
    color: "#595650",
    text: `Who Said It Was Simple / 1973
There are so many roots to the tree of anger
that sometimes the branches shatter
before they bear.

Sitting in Nedicks
the women rally before they march
discussing the problematic girls
they hire to make them free.
An almost white counterman passes
a waiting brother to serve them first
and the ladies neither notice nor reject
the slighter pleasures of their slavery.
But I who am bound by my mirror
as well as my bed
see causes in colour
as well as sex

and sit here wondering
which me will survive
all these liberations.`,
  },
  {
    title: "POWER",
    year: "1978",
    color: "#292723",
    text: `Power / 1978
The difference between poetry and rhetoric
is being ready to kill
yourself
instead of your children.

I am trapped on a desert of raw gunshot wounds
and a dead child dragging his shattered black
face off the edge of my sleep
blood from his punctured cheeks and shoulders
is the only liquid for miles
and my stomach
churns at the imagined taste while
my mouth splits into dry lips
without loyalty or reason
thirsting for the wetness of his blood
as it sinks into the whiteness
of the desert where I am lost
without imagery or magic
trying to make power out of hatred and destruction
trying to heal my dying son with kisses
only the sun will bleach his bones quicker.

A policeman who shot down a ten year old in Queens
stood over the boy with his cop shoes in childish blood
and a voice said “Die you little motherfucker” and
there are tapes to prove it. At his trial
this policeman said in his own defense
“I didn't notice the size nor nothing else
only the color”. And
there are tapes to prove that, too.

Today that 37 year old white man
with 13 years of police forcing
was set free
by eleven white men who said they were satisfied
justice had been done
and one Black Woman who said
“They convinced me” meaning
they had dragged her 4'10'' black Woman's frame
over the hot coals
of four centuries of white male approval
until she let go
the first real power she ever had
and lined her own womb with cement
to make a graveyard for our children.

I have not been able to touch the destruction
within me.
But unless I learn to use
the difference between poetry and rhetoric
my power too will run corrupt as poisonous mold
or lie limp and useless as an unconnected wire
and one day I will take my teenaged plug
and connect it to the nearest socket
raping an 85 year old white woman
who is somebody's mother
and as I beat her senseless and set a torch to her bed
a greek chorus will be singing in 3/4 time
“Poor thing. She never hurt a soul. What beasts they are.”`,
  },
] as const;

const ELEVATION_BANDS = [
  { min: 0.15, max: 0.22 },
  { min: 0.35, max: 0.42 },
  { min: 0.55, max: 0.62 },
  { min: 0.75, max: 0.82 },
] as const;

/** Same procedural terrain as the reference: 4 octaves of trig noise. */
function getElevation(x: number, y: number) {
  let e = 0;
  let amp = 1.0;
  let freq = 0.003;
  for (let i = 0; i < 4; i++) {
    e += Math.sin(x * freq + Math.cos(y * freq * 0.8)) * amp;
    e += Math.cos(y * freq + Math.sin(x * freq * 1.2)) * amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return (e + 2.5) / 5.0;
}

type Contour = {
  min: number;
  max: number;
  color: string;
  prepared: PreparedTextWithSegments;
  cursor: LayoutCursor;
};

type DrawItem = { text: string; x: number; y: number };

type PhysTextItem = {
  id: number;
  body: Matter.Body;
  text: string;
  color: string;
  w: number;
  h: number;
  rot: number;
};

export default function Chapter1BooksV2Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const physLayerRef = useRef<HTMLDivElement | null>(null);
  const stopPhysicsRef = useRef<(() => void) | null>(null);
  const collapsedRef = useRef(false);
  const sceneRef = useRef<"terrain" | "rain">("terrain");
  const [dossierOpen, setDossierOpen] = useState(false);
  // Bumping this key on close forces RecommendationDossier to fully remount,
  // so its internal form/canvas state resets without any setState-in-effect.
  const [dossierKey, setDossierKey] = useState(0);
  // Scene state machine. After a successful submission we tear down the
  // terrain and mount the title-rain takeover full-screen.
  const [scene, setScene] = useState<"terrain" | "rain">("terrain");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const latestBatchesRef: { current: DrawItem[][] } = { current: [] };
    let nextPhysId = 1;
    let physRafId = 0;
    let engine: Matter.Engine | null = null;
    let runner: Matter.Runner | null = null;
    let walls: Matter.Body[] = [];
    let physItems: PhysTextItem[] = [];
    const physEls = new Map<number, HTMLDivElement>();
    const mousePos = { x: -9999, y: -9999 };
    let mousePusher: Matter.Body | null = null;
    let mouseRingEl: HTMLDivElement | null = null;

    const PHYS_TEXT_CATEGORY = 0x0002;
    const PHYS_MOUSE_CATEGORY = 0x0004;
    const PHYS_MOUSE_RADIUS = 26;

    const contours: Contour[] = POEMS.map((poem, i) => {
      const band = ELEVATION_BANDS[i] ?? ELEVATION_BANDS[ELEVATION_BANDS.length - 1]!;
      // Repeat the poem so layoutNextLine has plenty of runway between cursor resets.
      const prepared = prepareWithSegments(poem.text.repeat(20), FONT_STR);
      return {
        min: band.min,
        max: band.max,
        color: poem.color,
        prepared,
        cursor: { segmentIndex: 0, graphemeIndex: 0 },
      };
    });

    let targetPanX = 0;
    let targetPanY = 0;
    let targetZoom = 1.0;
    let panX = 0;
    let panY = 0;
    let zoom = 1.0;

    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.font = FONT_STR;
      ctx.textBaseline = "top";
    };

    resize();
    window.addEventListener("resize", resize);

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // older browsers / non-capturable pointer types
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;
      if (!isDragging) return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      targetPanX += dx;
      targetPanY += dy;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    // Suppress browser default touch panning / Safari pinch-zoom so our
    // own pan-and-zoom owns the gesture surface entirely.
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    document.body.addEventListener("touchmove", onTouchMove, { passive: false });

    const onGesture = (e: Event) => {
      e.preventDefault();
    };
    // Safari-only "gesture*" events. Cast through Document because the names
    // aren't in the standard DocumentEventMap typings.
    const doc = document as Document;
    doc.addEventListener("gesturestart", onGesture as EventListener, { passive: false });
    doc.addEventListener("gesturechange", onGesture as EventListener, { passive: false });
    doc.addEventListener("gestureend", onGesture as EventListener, { passive: false });

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.002;
      // Pinch (ctrlKey set on macOS trackpad pinch) gets accelerated zoom.
      const delta = e.ctrlKey ? -e.deltaY * zoomSpeed * 2 : -e.deltaY * zoomSpeed;
      const newZoom = Math.max(0.1, Math.min(targetZoom * (1 + delta), 15.0));
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const mapX = (mouseX - targetPanX) / targetZoom;
      const mapY = (mouseY - targetPanY) / targetZoom;
      targetZoom = newZoom;
      targetPanX = mouseX - mapX * targetZoom;
      targetPanY = mouseY - mapY * targetZoom;
    };
    window.addEventListener("wheel", onWheel, { passive: false });

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "-" || e.key === "0")) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const requestTextLayout = (
      contourIdx: number,
      x: number,
      y: number,
      availableWidth: number,
      batches: DrawItem[][],
    ) => {
      const c = contours[contourIdx];
      if (!c) return;
      let line = layoutNextLine(c.prepared, c.cursor, availableWidth);
      if (!line) {
        // ran past the prepared text — wrap the cursor and try once more.
        c.cursor = { segmentIndex: 0, graphemeIndex: 0 };
        line = layoutNextLine(c.prepared, c.cursor, availableWidth);
      }
      if (line) {
        batches[contourIdx]!.push({ text: line.text, x, y });
        c.cursor = line.end;
      }
    };

    let rafId = 0;
    const render = () => {
      panX += (targetPanX - panX) * 0.15;
      panY += (targetPanY - panY) * 0.15;
      zoom += (targetZoom - zoom) * 0.15;

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      const batches: DrawItem[][] = contours.map(() => []);
      // Cursors reset every frame so contour stripes always start with the
      // poem's first grapheme — pan/zoom doesn't shuffle word order.
      for (const c of contours) c.cursor = { segmentIndex: 0, graphemeIndex: 0 };

      for (let y = 0; y < height; y += LINE_HEIGHT) {
        const mapY = (y - panY) / zoom;
        let activeIdx = -1;
        let segStartX = 0;
        for (let x = 0; x <= width; x += SCAN_STEP) {
          const mapX = (x - panX) / zoom;
          const elev = getElevation(mapX, mapY);
          let foundIdx = -1;
          for (let i = 0; i < contours.length; i++) {
            const band = contours[i]!;
            if (elev >= band.min && elev <= band.max) {
              foundIdx = i;
              break;
            }
          }
          if (foundIdx !== activeIdx) {
            if (activeIdx !== -1) {
              const segWidth = x - segStartX;
              if (segWidth > 20) requestTextLayout(activeIdx, segStartX, y, segWidth, batches);
            }
            activeIdx = foundIdx;
            segStartX = x;
          }
        }
        if (activeIdx !== -1) {
          const segWidth = width - segStartX;
          if (segWidth > 20) requestTextLayout(activeIdx, segStartX, y, segWidth, batches);
        }
      }

      batches.forEach((batch, idx) => {
        if (batch.length === 0) return;
        ctx.fillStyle = contours[idx]!.color;
        for (const item of batch) {
          ctx.fillText(item.text, item.x, item.y);
        }
      });

      latestBatchesRef.current = batches;
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);

    let settleRafId = 0;

    const stopPhysics = () => {
      cancelAnimationFrame(physRafId);
      physRafId = 0;
      cancelAnimationFrame(settleRafId);
      settleRafId = 0;
      if (runner && engine) Matter.Runner.stop(runner);
      if (engine) {
        if (walls.length) Matter.World.remove(engine.world, walls);
        if (mousePusher) Matter.World.remove(engine.world, mousePusher);
        if (physItems.length) Matter.World.remove(engine.world, physItems.map((i) => i.body));
        Matter.World.clear(engine.world, false);
        Matter.Engine.clear(engine);
      }
      engine = null;
      runner = null;
      walls = [];
      physItems = [];
      physEls.clear();
      if (physLayerRef.current) physLayerRef.current.replaceChildren();
      mousePusher = null;
      mouseRingEl = null;
      collapsedRef.current = false;
      canvas.style.opacity = "1";
    };
    stopPhysicsRef.current = stopPhysics;

    const startPhysicsFromText = () => {
      const layer = physLayerRef.current;
      if (!layer) return;
      if (collapsedRef.current) return;
      collapsedRef.current = true;

      // Freeze the terrain view visually by hiding the canvas. We keep the render RAF
      // running (cheap) but it won't paint; physics takes over the visible output.
      canvas.style.opacity = "0";

      engine = Matter.Engine.create();
      engine.gravity.y = 1.05;
      runner = Matter.Runner.create();
      Matter.Runner.run(runner, engine);

      mousePusher = Matter.Bodies.circle(mousePos.x, mousePos.y, PHYS_MOUSE_RADIUS, {
        isStatic: true,
        restitution: 0.15,
        friction: 0.0,
        frictionStatic: 0.0,
        frictionAir: 0.0,
        collisionFilter: { category: PHYS_MOUSE_CATEGORY, mask: PHYS_TEXT_CATEGORY },
      });
      Matter.World.add(engine.world, mousePusher);

      // Visual hint for the pusher radius (matches the physics circle).
      mouseRingEl = document.createElement("div");
      mouseRingEl.style.position = "fixed";
      mouseRingEl.style.left = "0";
      mouseRingEl.style.top = "0";
      mouseRingEl.style.width = `${PHYS_MOUSE_RADIUS * 2}px`;
      mouseRingEl.style.height = `${PHYS_MOUSE_RADIUS * 2}px`;
      mouseRingEl.style.borderRadius = "9999px";
      mouseRingEl.style.border = "1px solid rgba(41,39,35,0.14)";
      mouseRingEl.style.background = "rgba(41,39,35,0.035)";
      mouseRingEl.style.boxShadow = "inset 0 0 12px rgba(255,255,255,0.35)";
      mouseRingEl.style.pointerEvents = "none";
      mouseRingEl.style.zIndex = "30";
      mouseRingEl.style.willChange = "transform";
      mouseRingEl.style.transform = "translate3d(-9999px, -9999px, 0)";
      layer.appendChild(mouseRingEl);

      const t = 220;
      const inset = 28;
      walls = [
        Matter.Bodies.rectangle(width / 2, height + t / 2, width + t * 2, t, {
          isStatic: true,
          label: "floor",
        }),
        Matter.Bodies.rectangle(-t / 2 + inset, height / 2, t, height * 3, {
          isStatic: true,
          label: "left",
        }),
        Matter.Bodies.rectangle(width + t / 2 - inset, height / 2, t, height * 3, {
          isStatic: true,
          label: "right",
        }),
      ];
      Matter.World.add(engine.world, walls);

      // Flatten the latest render into candidate segments.
      const flat: Array<{ item: DrawItem; color: string }> = [];
      const batches = latestBatchesRef.current;
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i] ?? [];
        const color = contours[i]?.color ?? FG_BRIGHT;
        for (const item of batch) flat.push({ item, color });
      }

      const MAX_BODIES = 260;
      const step = flat.length <= MAX_BODIES ? 1 : Math.ceil(flat.length / MAX_BODIES);
      const chosen: Array<{ item: DrawItem; color: string }> = [];
      for (let i = 0; i < flat.length; i += step) chosen.push(flat[i]!);

      physItems = chosen.map(({ item, color }, idx) => {
        // measure the text width for a rectangular physics proxy
        const w = Math.max(14, Math.min(width * 0.78, ctx.measureText(item.text).width));
        const h = LINE_HEIGHT;
        const x = item.x + w / 2;
        // Spawn above the viewport so it feels like the map collapses downward.
        const y = -60 - (idx % 22) * 14;
        const rot = (Math.random() - 0.5) * 0.9;
        const body = Matter.Bodies.rectangle(x, y, w + 10, h + 8, {
          restitution: 0.06,
          friction: 0.82,
          frictionStatic: 0.95,
          frictionAir: 0.018,
          chamfer: { radius: 6 },
          collisionFilter: { category: PHYS_TEXT_CATEGORY, mask: 0xffffffff },
        });
        Matter.Body.setAngle(body, rot);
        Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.06);
        const id = nextPhysId++;

        const el = document.createElement("div");
        el.dataset.id = String(id);
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.top = "0";
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        el.style.font = FONT_STR;
        el.style.lineHeight = `${LINE_HEIGHT}px`;
        el.style.whiteSpace = "nowrap";
        el.style.color = color;
        el.style.pointerEvents = "none";
        el.style.userSelect = "none";
        el.style.opacity = "0.95";
        el.style.willChange = "transform";
        el.style.filter = "drop-shadow(0 10px 18px rgba(0,0,0,0.12))";
        el.textContent = item.text;
        layer.appendChild(el);
        physEls.set(id, el);

        return { id, body, text: item.text, color, w, h, rot };
      });

      Matter.World.add(engine.world, physItems.map((p) => p.body));

      const tickPhys = () => {
        if (mousePusher) {
          Matter.Body.setPosition(mousePusher, mousePos);
        }
        if (mouseRingEl) {
          mouseRingEl.style.transform = `translate3d(${mousePos.x - PHYS_MOUSE_RADIUS}px, ${mousePos.y - PHYS_MOUSE_RADIUS}px, 0)`;
        }
        for (const p of physItems) {
          const el = physEls.get(p.id);
          if (!el) continue;
          const { x, y } = p.body.position;
          const a = p.body.angle;
          el.style.transform = `translate3d(${x - p.w / 2}px, ${y - p.h / 2}px, 0) rotate(${a}rad)`;
        }
        physRafId = requestAnimationFrame(tickPhys);
      };
      physRafId = requestAnimationFrame(tickPhys);

      // Wait for the pile to come to rest (or hit a hard cap), then surface
      // the recommendation dossier. Mirrors the pattern used in V1 books.
      const settleStart = performance.now();
      let stableFrames = 0;
      const settleLoop = () => {
        if (!engine) return;
        let allSlow = true;
        for (const p of physItems) {
          const v = p.body.velocity;
          if (Math.abs(v.x) + Math.abs(v.y) > 0.35) {
            allSlow = false;
            break;
          }
        }
        if (allSlow) stableFrames += 1;
        else stableFrames = 0;
        if (stableFrames >= 18 || performance.now() - settleStart > 4000) {
          setDossierOpen(true);
          settleRafId = 0;
          return;
        }
        settleRafId = requestAnimationFrame(settleLoop);
      };
      settleRafId = requestAnimationFrame(settleLoop);
    };

    const onDoubleClick = (e: MouseEvent) => {
      // Ignore double-clicking on the top-right Back link.
      const t = e.target;
      if (t instanceof HTMLElement && t.closest("a")) return;
      // Priority:
      // - Only allow toggling the list after the "book count" scene (rain) is entered.
      // - In terrain (including after collapse), keep the original behavior and do not toggle.
      const isRain = sceneRef.current === "rain";
      if (!isRain) {
        startPhysicsFromText();
        return;
      }
      setDrawerOpen((v) => !v);
    };
    window.addEventListener("dblclick", onDoubleClick);

    return () => {
      window.removeEventListener("dblclick", onDoubleClick);
      stopPhysics();
      stopPhysicsRef.current = null;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("touchmove", onTouchMove);
      document.body.removeEventListener("touchmove", onTouchMove);
      doc.removeEventListener("gesturestart", onGesture as EventListener);
      doc.removeEventListener("gesturechange", onGesture as EventListener);
      doc.removeEventListener("gestureend", onGesture as EventListener);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Keep the dblclick handler's scene check fresh without re-binding listeners.
  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  const handleDossierReset = useCallback(() => {
    setDossierOpen(false);
    setDossierKey((k) => k + 1);
    stopPhysicsRef.current?.();
  }, []);

  const handleDossierSubmitted = useCallback(() => {
    // Tear the terrain physics down and unmount the dossier; the
    // TitleRain component takes over the full viewport.
    stopPhysicsRef.current?.();
    setDossierOpen(false);
    setDossierKey((k) => k + 1);
    setScene("rain");
  }, []);

  const handleDossierNextPage = useCallback(() => {
    stopPhysicsRef.current?.();
    setDossierOpen(false);
    setDossierKey((k) => k + 1);
    setScene("rain");
  }, []);

  const leaveRainToTerrain = useCallback(() => {
    stopPhysicsRef.current?.();
    setDossierOpen(false);
    setDrawerOpen(false);
    setScene("terrain");
  }, []);

  return (
    <main
      className="relative h-[100dvh] w-[100vw] overflow-hidden"
      style={{
        background: BG,
        color: FG_BRIGHT,
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
        overscrollBehavior: "none",
        cursor: DIAMOND_CURSOR,
      }}
      aria-label="Audre Lorde poem terrain (V2)"
    >
      <BooksV2MusicBar />

      <div className="absolute right-10 top-10 z-50 flex items-center gap-5">
        {scene === "rain" ? (
          <button
            type="button"
            className="font-mono text-[11px] tracking-[0.18em] uppercase underline underline-offset-4 transition"
            style={{
              color: FG_MID,
              textDecorationColor: "rgba(89, 86, 80, 0.4)",
              background: "none",
              border: 0,
              padding: 0,
              cursor: "pointer",
            }}
            onClick={leaveRainToTerrain}
          >
            Go back
          </button>
        ) : BOOKS_V2_PUBLIC_ONLY ? null : (
          <Link
            href="/chapter-1"
            className="font-mono text-[11px] tracking-[0.18em] uppercase underline underline-offset-4 transition"
            style={{
              color: FG_MID,
              textDecorationColor: "rgba(89, 86, 80, 0.4)",
            }}
          >
            Back to reading corner
          </Link>
        )}
      </div>

      <div
        className="pointer-events-none absolute z-10 flex flex-col"
        style={{
          top: 40,
          left: 40,
          gap: 8,
          opacity: scene === "rain" ? 0 : 1,
          transition: "opacity 520ms ease",
        }}
        aria-hidden
      >
        {POEMS.map((p) => (
          <div
            key={p.title}
            className="flex items-center uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              color: FG_MID,
              gap: 12,
            }}
          >
            <span
              aria-hidden
              className="inline-block"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: p.color,
              }}
            />
            <span style={{ color: p.color }}>
              {p.title} — {p.year}
            </span>
          </div>
        ))}
      </div>

      <div
        className="pointer-events-none absolute"
        style={{
          top: "50%",
          left: "50%",
          width: 40,
          height: 40,
          transform: "translate(-50%, -50%)",
          zIndex: 5,
          opacity: scene === "rain" ? 0 : 1,
          transition: "opacity 520ms ease",
        }}
        aria-hidden
      >
        <span
          className="absolute"
          style={{
            top: "50%",
            left: 0,
            right: 0,
            height: 1,
            background: "rgba(41, 39, 35, 0.15)",
          }}
        />
        <span
          className="absolute"
          style={{
            left: "50%",
            top: 0,
            bottom: 0,
            width: 1,
            background: "rgba(41, 39, 35, 0.15)",
          }}
        />
      </div>

      {/* Canvas + physics layer stay mounted so the terrain useEffect's
          long-running rAF loops don't blow up mid-transition. We just
          hide them when the rain scene takes over. */}
      <canvas
        ref={canvasRef}
        className="block"
        style={{
          width: "100vw",
          height: "100vh",
          cursor: DIAMOND_CURSOR,
          touchAction: "none",
          transition: "opacity 450ms ease",
          opacity: scene === "rain" ? 0 : 1,
          pointerEvents: scene === "rain" ? "none" : "auto",
        }}
      />

      <div
        ref={physLayerRef}
        className="pointer-events-none absolute inset-0 z-20"
        aria-hidden
        style={{
          opacity: scene === "rain" ? 0 : 1,
          transition: "opacity 450ms ease",
        }}
      />

      <RecommendationDossier
        key={dossierKey}
        open={scene === "terrain" ? dossierOpen : false}
        onReset={handleDossierReset}
        onSubmitted={handleDossierSubmitted}
        onNextPage={handleDossierNextPage}
      />

      {scene === "rain" ? <TitleRain /> : null}

      <BookListDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </main>
  );
}
