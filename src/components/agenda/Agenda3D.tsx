"use client";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Line, OrbitControls, RoundedBox } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { addDays, toISODate, type BookingDTO } from "@/lib/agenda";
import { CH, CW, cellRect, drawPage, hitTest, type Hit, type PageSide } from "./pageTexture";

/* ---------- dimensioni ---------- */
const PW = 2.1; // larghezza pagina
const PH = 2.9; // altezza pagina
const GAP = 0.14; // metà dorso
const PC = GAP + PW / 2; // centro pagina (x assoluto)
const PAGE_Y = 0.121;
const FLIP_Y = 0.126;
const FLIP_MS = 1100;

const noRaycast = () => {};

export type HoverInfo = { day: string; hour: number; booking: BookingDTO | null } | null;

export type FlipRequest = { target: Date; dir: 1 | -1; n: number } | null;

type Props = {
  monday: Date;
  getWeekBookings: (monday: Date) => BookingDTO[];
  version: number;
  today: string;
  flipRequest: FlipRequest;
  onFlipDone: (m: Date) => void;
  onSlot: (day: string, hour: number, booking: BookingDTO | null) => void;
  onHover: (h: HoverInfo) => void;
  onFlipRequest: (dir: 1 | -1) => void;
};

/* ---------- texture pelle procedurale con caching ---------- */
let cachedLeatherTexture: THREE.CanvasTexture | null = null;

function makeLeatherTexture(): THREE.CanvasTexture {
  if (cachedLeatherTexture) return cachedLeatherTexture;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#a35a2b";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const a = Math.random();
    ctx.fillStyle = a > 0.5 ? `rgba(60,30,12,${0.05 + Math.random() * 0.12})` : `rgba(230,160,100,${0.03 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + Math.random() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  cachedLeatherTexture = t;
  return t;
}

/* ---------- Copertina ---------- */
function Cover() {
  const leather = useMemo(() => makeLeatherTexture(), []);
  const W = 2 * (GAP + PW) + 0.36;
  const D = PH + 0.34;
  const stitch = useMemo(() => {
    const w = W / 2 - 0.12;
    const d = D / 2 - 0.12;
    return [
      [-w, 0.075, -d],
      [w, 0.075, -d],
      [w, 0.075, d],
      [-w, 0.075, d],
      [-w, 0.075, -d],
    ] as [number, number, number][];
  }, [W, D]);

  const tabColors = ["#e8542f", "#4fb3bf", "#f2b632", "#3b6fd1"];

  return (
    <group>
      {/* base pelle */}
      <RoundedBox args={[W, 0.07, D]} radius={0.03} smoothness={4} position={[0, 0.035, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={leather} bumpMap={leather} bumpScale={0.02} roughness={0.85} metalness={0} />
      </RoundedBox>
      {/* scamosciato interno */}
      <mesh position={[0, 0.0705, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W - 0.22, D - 0.22]} />
        <meshStandardMaterial color="#b8703f" roughness={1} />
      </mesh>
      {/* cuciture */}
      <Line points={stitch} color="#f0c69a" lineWidth={1.2} dashed dashSize={0.06} gapSize={0.04} />
      {/* piega centrale */}
      <mesh position={[0, 0.0712, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.12, D - 0.22]} />
        <meshStandardMaterial color="#8a4a22" roughness={1} />
      </mesh>
      {/* tasche a sinistra (sotto le pagine, visibili ai bordi) */}
      {[0, 1, 2].map((i) => (
        <RoundedBox
          key={i}
          args={[0.16, 0.012, D - 0.5 - i * 0.28]}
          radius={0.005}
          position={[-W / 2 + 0.17 + i * 0.03, 0.078 + i * 0.006, 0.1 + i * 0.05]}
        >
          <meshStandardMaterial color={i % 2 ? "#9d5127" : "#ad6335"} roughness={0.9} />
        </RoundedBox>
      ))}
      {/* cinturino con bottone */}
      <RoundedBox args={[0.62, 0.05, 0.42]} radius={0.02} position={[W / 2 + 0.16, 0.05, 0]} castShadow>
        <meshStandardMaterial map={leather} roughness={0.85} />
      </RoundedBox>
      <mesh position={[W / 2 + 0.3, 0.083, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.02, 24]} />
        <meshStandardMaterial color="#b87333" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* passante penna */}
      <mesh position={[W / 2 + 0.06, 0.09, -D / 2 + 0.5]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.07, 0.014, 10, 24, Math.PI]} />
        <meshStandardMaterial color="#7d3f1c" roughness={0.9} />
      </mesh>
      {/* linguette colorate */}
      {tabColors.map((c, i) => (
        <RoundedBox
          key={c}
          args={[0.14, 0.02, 0.34]}
          radius={0.01}
          position={[PC + PW / 2 + 0.05, PAGE_Y - 0.015 - i * 0.008, -PH / 2 + 0.45 + i * 0.46]}
        >
          <meshStandardMaterial color={c} roughness={0.7} />
        </RoundedBox>
      ))}
    </group>
  );
}

/* ---------- anelli ---------- */
function Rings() {
  const zs = [-1.0, -0.82, -0.64, 0.64, 0.82, 1.0];
  return (
    <group>
      {zs.map((z) => (
        <mesh key={z} position={[0, 0.095, z]} castShadow>
          <torusGeometry args={[0.1, 0.014, 12, 32]} />
          <meshStandardMaterial color="#c2803c" metalness={0.95} roughness={0.25} />
        </mesh>
      ))}
      {/* meccanismo */}
      <RoundedBox args={[0.08, 0.03, PH - 0.3]} radius={0.01} position={[0, 0.085, 0]}>
        <meshStandardMaterial color="#b8763a" metalness={0.8} roughness={0.35} />
      </RoundedBox>
    </group>
  );
}

/* ---------- pile di pagine ---------- */
function PageStacks() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * PC, 0.0955, 0]} receiveShadow castShadow>
            <boxGeometry args={[PW, 0.05, PH]} />
            <meshStandardMaterial color="#efe8dc" roughness={0.95} />
          </mesh>
          {/* righe dei fogli sul bordo */}
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[s * (PC + (PW / 2) * 1.0005), 0.075 + i * 0.012, 0]}>
              <boxGeometry args={[0.002, 0.003, PH - 0.02 - i * 0.01]} />
              <meshStandardMaterial color="#d6ccbc" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ---------- Penna 3D ---------- */
function Pen({
  pointer,
  hovering,
  press,
}: {
  pointer: React.RefObject<THREE.Vector3>;
  hovering: React.RefObject<boolean>;
  press: React.RefObject<number>;
}) {
  const g = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const rest = useMemo(() => new THREE.Vector3(2.9, PAGE_Y, 0.5), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    if (!g.current) return;
    const target = hovering.current ? pointer.current : rest;
    tmp.copy(target);
    const k = 1 - Math.pow(0.0001, dt);
    g.current.position.lerp(tmp, k);
    // pressione
    press.current = Math.max(0, press.current - dt * 4);
    const p = press.current;
    const lift = hovering.current ? 0.02 : 0.06;
    g.current.position.y = target.y + lift - p * 0.05 + (hovering.current ? 0 : Math.sin(state.clock.elapsedTime * 1.5) * 0.01);
    g.current.rotation.set(0.55 - p * 0.15, 0, -0.5 + p * 0.1);
    if (shadow.current) {
      shadow.current.position.set(g.current.position.x + 0.18, PAGE_Y + 0.003, g.current.position.z + 0.12);
      const s = 1 + (g.current.position.y - PAGE_Y) * 3;
      shadow.current.scale.set(s, s * 0.7, 1);
    }
  });

  return (
    <>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0.4]} raycast={noRaycast}>
        <circleGeometry args={[0.09, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <group ref={g} position={rest.toArray()}>
        {/* punta */}
        <mesh position={[0, 0.08, 0]} rotation={[0, 0, Math.PI]} raycast={noRaycast} castShadow>
          <coneGeometry args={[0.032, 0.16, 24]} />
          <meshStandardMaterial color="#1a1816" metalness={0.6} roughness={0.35} />
        </mesh>
        {/* impugnatura */}
        <mesh position={[0, 0.24, 0]} raycast={noRaycast}>
          <cylinderGeometry args={[0.04, 0.036, 0.18, 24]} />
          <meshStandardMaterial color="#141210" roughness={0.6} />
        </mesh>
        {/* corpo */}
        <mesh position={[0, 0.78, 0]} raycast={noRaycast} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.9, 24]} />
          <meshStandardMaterial color="#e8542f" roughness={0.45} />
        </mesh>
        {/* anello */}
        <mesh position={[0, 1.24, 0]} raycast={noRaycast}>
          <cylinderGeometry args={[0.043, 0.043, 0.03, 24]} />
          <meshStandardMaterial color="#c2803c" metalness={0.9} roughness={0.3} />
        </mesh>
        {/* cappuccio */}
        <mesh position={[0, 1.37, 0]} raycast={noRaycast}>
          <cylinderGeometry args={[0.042, 0.04, 0.24, 24]} />
          <meshStandardMaterial color="#141210" roughness={0.5} />
        </mesh>
        {/* clip */}
        <mesh position={[0.05, 1.32, 0]} raycast={noRaycast}>
          <boxGeometry args={[0.02, 0.26, 0.035]} />
          <meshStandardMaterial color="#c2803c" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.5, 0]} raycast={noRaycast}>
          <sphereGeometry args={[0.042, 16, 16]} />
          <meshStandardMaterial color="#141210" roughness={0.5} />
        </mesh>
      </group>
    </>
  );
}

/* ---------- texture pagina (cache) ---------- */
function useTextures(getWeekBookings: (m: Date) => BookingDTO[], version: number, today: string) {
  const cache = useRef(new Map<string, THREE.CanvasTexture>());
  const [fontsTick, setFontsTick] = useState(0);

  useEffect(() => {
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => setFontsTick((t) => t + 1));
    }
  }, []);

  const gen = useRef("");
  const currentGen = `${version}:${fontsTick}:${today}`;

  useEffect(() => {
    const c = cache.current;
    return () => {
      c.forEach((t) => t.dispose());
      c.clear();
    };
  }, []);

  return useCallback(
    (monday: Date, side: PageSide, mirror = false): THREE.CanvasTexture => {
      if (gen.current !== currentGen) {
        cache.current.forEach((t) => t.dispose());
        cache.current.clear();
        gen.current = currentGen;
      }
      const key = `${toISODate(monday)}:${side}:${mirror ? "m" : "n"}`;
      const hit = cache.current.get(key);
      if (hit) return hit;
      const c = document.createElement("canvas");
      c.width = CW;
      c.height = CH;
      drawPage(c, { side, monday, bookings: getWeekBookings(monday), today, now: new Date() });
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      if (mirror) {
        t.wrapS = THREE.RepeatWrapping;
        t.repeat.x = -1;
        t.offset.x = 1;
      }
      t.needsUpdate = true;
      cache.current.set(key, t);
      return t;
    },
    [getWeekBookings, today, currentGen],
  );
}

/* ---------- pagina che si sfoglia ---------- */
function FlippingPage({
  front,
  back,
  progressRef,
}: {
  front: THREE.Texture;
  back: THREE.Texture;
  progressRef: React.RefObject<number>;
}) {
  const g = useRef<THREE.Group>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(PW, PH, 28, 1), []);
  const base = useMemo(() => (geo.attributes.position.array as Float32Array).slice(), [geo]);

  useFrame(() => {
    const p = progressRef.current;
    if (g.current) g.current.rotation.z = p * Math.PI;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const amp = Math.sin(p * Math.PI) * 0.32;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const d = (x + PW / 2) / PW; // 0 al dorso, 1 al bordo
      const z = amp * Math.sin(d * Math.PI) * (1 - d * 0.35);
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <group ref={g} position={[0, FLIP_Y, 0]}>
      <mesh geometry={geo} position={[PC, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial map={front} side={THREE.FrontSide} roughness={0.9} />
      </mesh>
      <mesh geometry={geo} position={[PC, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial map={back} side={THREE.BackSide} roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ---------- Scena ---------- */
function Scene(props: Props) {
  const { monday, getWeekBookings, version, today, flipRequest, onFlipDone, onSlot, onHover, onFlipRequest } = props;
  const getTexture = useTextures(getWeekBookings, version, today);

  const [shown, setShown] = useState<Date>(monday);
  const [flip, setFlip] = useState<{ from: Date; to: Date; dir: 1 | -1 } | null>(null);
  const progress = useRef(0);
  const flipStart = useRef(0);
  const doneRef = useRef(false);
  const lastReq = useRef<number>(-1);

  const pointer = useRef(new THREE.Vector3(2.9, PAGE_Y, 0.5));
  const hovering = useRef(false);
  const press = useRef(0);
  const [hover, setHover] = useState<{ side: PageSide; dayIdx: number; hour: number; busy: boolean } | null>(null);
  const hoverKey = useRef("");

  // sincronizza da fuori quando non stiamo sfogliando
  useEffect(() => {
    if (!flip && toISODate(monday) !== toISODate(shown)) setShown(monday);
  }, [monday, flip, shown]);

  // avvia sfogliata
  useEffect(() => {
    if (!flipRequest || flipRequest.n === lastReq.current || flip) return;
    lastReq.current = flipRequest.n;
    if (toISODate(flipRequest.target) === toISODate(shown)) return;
    progress.current = flipRequest.dir === 1 ? 0 : 1;
    flipStart.current = performance.now();
    doneRef.current = false;
    setFlip({ from: shown, to: flipRequest.target, dir: flipRequest.dir });
    setHover(null);
    onHover(null);
  }, [flipRequest, flip, shown, onHover]);

  useFrame(() => {
    if (!flip || doneRef.current) return;
    const t = Math.min(1, (performance.now() - flipStart.current) / FLIP_MS);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    progress.current = flip.dir === 1 ? e : 1 - e;
    if (t >= 1) {
      doneRef.current = true;
      const to = flip.to;
      setShown(to);
      setFlip(null);
      onFlipDone(to);
    }
  });

  // texture statiche
  const weekBookings = getWeekBookings(shown);
  const leftTex = useMemo(
    () => getTexture(flip && flip.dir === -1 ? flip.to : shown, "left"),
    [getTexture, flip, shown],
  );
  const rightTex = useMemo(
    () => getTexture(flip && flip.dir === 1 ? flip.to : shown, "right"),
    [getTexture, flip, shown],
  );
  const flipFront = useMemo(
    () => (flip ? getTexture(flip.dir === 1 ? flip.from : flip.to, "right") : null),
    [getTexture, flip],
  );
  const flipBack = useMemo(
    () => (flip ? getTexture(flip.dir === 1 ? flip.to : flip.from, "left", true) : null),
    [getTexture, flip],
  );

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => toISODate(addDays(shown, i))), [shown]);

  const findBooking = useCallback(
    (day: string, hour: number) => weekBookings.find((b) => b.day === day && b.hour === hour) ?? null,
    [weekBookings],
  );

  const handleMove = (side: PageSide) => (e: ThreeEvent<PointerEvent>) => {
    if (flip || !e.uv) return;
    const hit: Hit = hitTest(side, e.uv.x, e.uv.y);
    const key = hit ? (hit.type === "slot" ? `${side}:${hit.dayIdx}:${hit.hour}` : `flip:${hit.dir}`) : "";
    if (key === hoverKey.current) return;
    hoverKey.current = key;
    if (hit && hit.type === "slot") {
      const day = days[hit.dayIdx];
      const b = findBooking(day, hit.hour);
      setHover({ side, dayIdx: hit.dayIdx, hour: hit.hour, busy: !!b });
      onHover({ day, hour: hit.hour, booking: b });
    } else {
      setHover(null);
      onHover(null);
    }
  };

  const handleClick = (side: PageSide) => (e: ThreeEvent<MouseEvent>) => {
    if (flip || !e.uv) return;
    e.stopPropagation();
    press.current = 1;
    const hit = hitTest(side, e.uv.x, e.uv.y);
    if (!hit) return;
    if (hit.type === "flip") {
      onFlipRequest(hit.dir);
      return;
    }
    const day = days[hit.dayIdx];
    onSlot(day, hit.hour, findBooking(day, hit.hour));
  };

  const leavePage = () => {
    hoverKey.current = "";
    setHover(null);
    onHover(null);
  };

  // rettangolo evidenziato
  const hl = useMemo(() => {
    if (!hover) return null;
    const r = cellRect(hover.side, hover.dayIdx, hover.hour);
    const cx = (hover.side === "left" ? -PC : PC) + ((r.x + r.w / 2) / CW - 0.5) * PW;
    const cz = -((0.5 - (r.y + r.h / 2) / CH) * PH);
    return { x: cx, z: cz, w: (r.w / CW) * PW, h: (r.h / CH) * PH };
  }, [hover]);

  return (
    <>
      <hemisphereLight args={["#fff6ea", "#c9b8a6", 0.9]} />
      <directionalLight
        position={[3.5, 7, 3]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      >
        <orthographicCamera attach="shadow-camera" args={[-5, 5, 5, -5, 0.5, 20]} />
      </directionalLight>
      <directionalLight position={[-4, 4, -2]} intensity={0.5} color="#ffe9d6" />

      {/* scrivania */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#ebe1d5" roughness={1} />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.5} scale={9} blur={2.2} far={2} color="#4a3120" />

      {/* piano invisibile per il tracciamento della penna */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, FLIP_Y, 0]}
        onPointerMove={(e) => {
          pointer.current.copy(e.point);
          hovering.current = true;
        }}
        onPointerEnter={() => (hovering.current = true)}
        onPointerLeave={() => {
          hovering.current = false;
        }}
      >
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Cover />
      <Rings />
      <PageStacks />

      {/* pagina sinistra */}
      <mesh
        position={[-PC, PAGE_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handleMove("left")}
        onPointerLeave={leavePage}
        onClick={handleClick("left")}
        receiveShadow
      >
        <planeGeometry args={[PW, PH]} />
        <meshStandardMaterial map={leftTex} roughness={0.9} />
      </mesh>
      {/* pagina destra */}
      <mesh
        position={[PC, PAGE_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handleMove("right")}
        onPointerLeave={leavePage}
        onClick={handleClick("right")}
        receiveShadow
      >
        <planeGeometry args={[PW, PH]} />
        <meshStandardMaterial map={rightTex} roughness={0.9} />
      </mesh>

      {flip && flipFront && flipBack && <FlippingPage front={flipFront} back={flipBack} progressRef={progress} />}

      {/* evidenziazione slot */}
      {hl && !flip && (
        <mesh position={[hl.x, PAGE_Y + 0.004, hl.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <planeGeometry args={[hl.w - 0.01, hl.h - 0.01]} />
          <meshBasicMaterial color={hover?.busy ? "#e8542f" : "#4fb3bf"} transparent opacity={0.32} depthWrite={false} />
        </mesh>
      )}

      <Pen pointer={pointer} hovering={hovering} press={press} />

      <OrbitControls
        enablePan={false}
        minDistance={4.5}
        maxDistance={11}
        minPolarAngle={0.15}
        maxPolarAngle={1.15}
        minAzimuthAngle={-0.6}
        maxAzimuthAngle={0.6}
        target={[0, 0, -0.1]}
        makeDefault
      />
    </>
  );
}

export default function Agenda3D(props: Props) {
  return (
    <div className="cursor-none-canvas h-full w-full">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 5.9, 4.3], fov: 33, near: 0.1, far: 60 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={({ gl }) => {
          gl.setClearColor("#ebe1d5");
        }}
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
