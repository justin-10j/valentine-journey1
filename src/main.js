import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import gsap from "gsap";

/* =========================================================
   UI
========================================================= */
const mount = document.getElementById("app");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");

const storyUI = document.getElementById("storyUI");
const cardTitle = document.getElementById("cardTitle");
const cardText = document.getElementById("cardText");
const okBtn = document.getElementById("okBtn");

function hideCard() { storyUI.style.display = "none"; }
function showCard(title, text) {
  cardTitle.textContent = title;
  cardText.textContent = text;
  storyUI.style.display = "grid";
}
okBtn.addEventListener("click", hideCard);
hideCard();

/* =========================================================
   Toronto time helpers (America/Toronto)
========================================================= */
const TIMEZONE = "America/Toronto";

// Build a "zoned now" in Toronto as a Date object (wall-clock accurate)
function nowInZone(timeZone = TIMEZONE) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date());
  const get = (t) => parts.find(p => p.type === t)?.value;
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const hh = Number(get("hour"));
  const mm = Number(get("minute"));
  const ss = Number(get("second"));
  // This Date is "UTC timestamp representing Toronto wall time"
  return new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
}

// Format ms remaining as HH:MM:SS
function fmtHHMMSS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/* =========================================================
   Countdown Gate Overlay
========================================================= */
const gate = document.createElement("div");
gate.style.position = "fixed";
gate.style.inset = "0";
gate.style.display = "none";
gate.style.placeItems = "center";
gate.style.zIndex = "50";
gate.style.background = "radial-gradient(circle at center, rgba(255,255,255,0.06), rgba(0,0,0,0.75))";
gate.innerHTML = `
  <div style="width:min(760px,92vw);padding:22px 22px 18px;border-radius:18px;
              background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.12);
              backdrop-filter: blur(10px); color:#fff; font-family:system-ui;">
    <div id="gateTitle" style="font-size:22px;font-weight:700;display:flex;gap:10px;align-items:center;">
      <span>⏳</span><span>Next chapter unlocks in</span>
    </div>
    <div id="gateTimer" style="margin-top:10px;font-size:38px;font-weight:800;letter-spacing:1px;">
      00:00:00
    </div>
    <div id="gateHint" style="margin-top:10px;opacity:0.9;line-height:1.35;">
      I’ll be waiting right here for you.
    </div>
    <button id="gateBtn" style="margin-top:16px;padding:12px 16px;border-radius:999px;
            border:0;background:#fff;color:#111;font-weight:800;cursor:pointer;opacity:0.5;" disabled>
      Continue ❤️
    </button>
  </div>
`;
document.body.appendChild(gate);
const gateTitle = gate.querySelector("#gateTitle span:last-child");
const gateTimer = gate.querySelector("#gateTimer");
const gateBtn = gate.querySelector("#gateBtn");

function showGate(nextIdx, label) {
  gate.style.display = "grid";
  gateTitle.textContent = label || `Next chapter (${nextIdx + 1}) unlocks in`;
  gateBtn.disabled = true;
  gateBtn.style.opacity = "0.5";
}
function hideGate() { gate.style.display = "none"; }

/* =========================================================
   STORY CONFIG
   - Real date unlocks based on Toronto midnight + 1 day increments
========================================================= */
const USE_REAL_DATES = true; // ✅ Toronto time unlocks
const ROSE_DAY_TORONTO = { y: 2026, m: 2, d: 7 }; // Feb 7, 2026 (Rose Day) in Toronto

// mode: "shop" | "hill" | "valentine"
const days = [
  { title: "🌹 Rose Day", mode: "shop", item: "rose",
    arrive: "A small stop… for your first rose.",
    msg: "This rose is my first step toward you.\nEven from far away, I’m always with you." },

  { title: "💍 Propose Day", mode: "shop", item: "ring",
    arrive: "One more stop… for something meaningful.",
    msg: "Not a proposal… but a promise in my heart.\nI choose you — again and again.\nWill you marry me?" },

  { title: "🍫 Chocolate Day", mode: "shop", item: "chocolate",
    arrive: "A sweet little surprise… just for your smile.",
    msg: "If I could, I’d hand this to you in person.\nTill then — sweetness from me to you." },

  { title: "🧸 Teddy Day", mode: "shop", item: "teddy",
    arrive: "Something soft… for the days you miss me.",
    msg: "So when you feel lonely,\nthis teddy can hold you for me." },

  { title: "🤝 Promise Day", mode: "shop", item: "note",
    arrive: "One promise… written gently, meant truly.",
    msg: "I promise to stand with you —\nin your ups, your downs, your everything." },

  { title: "🤗 Hug Day", mode: "shop", item: "heart",
    arrive: "Close your eyes… imagine I’m right there.",
    msg: "This is my hug — warm, safe, and real.\nHold it whenever you miss me." },

  { title: "💋 Kiss Day", mode: "hill", item: "kiss",
    arrive: "We made it… the hilltop.\nJust you, me, and this calm breeze.",
    msg: "A soft kiss…\nfor everything we built so far. 💋" },

  { title: "❤️ Valentine’s Day", mode: "valentine", item: "video",
    arrive: "I stayed here… from day to night.\nThinking how far we’ve come.",
    msg: "Look up… 💫\nThis is my heart, speaking to you. \nNo matter what happens I'll be there with you.\nI love you a lot. \n never forget to consider at least as a Side chick ." }
];

const STORAGE_KEY = "vj_progress_v3_toronto";
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveProgress(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }

let progress = loadProgress();
let currentDayIndex = Math.max(0, Math.min(days.length - 1, progress.dayIndex ?? 0));
let unlockedUntil = progress.unlockedUntil ?? 0;

function torontoEpochForDayIndex(dayIdx) {
  // dayIdx=0 -> Rose Day date at 00:00 Toronto (converted using our wall-time Date.UTC trick)
  const base = new Date(Date.UTC(ROSE_DAY_TORONTO.y, ROSE_DAY_TORONTO.m - 1, ROSE_DAY_TORONTO.d, 0, 0, 0));
  base.setUTCDate(base.getUTCDate() + dayIdx); // add days in wall-time space
  return base.getTime();
}

function computeUnlockTimeForNextDay() {
  if (!USE_REAL_DATES) return Date.now() + 15_000;
  return torontoEpochForDayIndex(currentDayIndex + 1); // next day at 00:00 Toronto
}

// auto-advance currentDayIndex based on Toronto date (if user opens late)
if (USE_REAL_DATES) {
  const nowTZ = nowInZone();
  // find greatest dayIdx where now >= dayStart
  let idx = 0;
  for (let i = 0; i < days.length; i++) {
    if (nowTZ.getTime() >= torontoEpochForDayIndex(i)) idx = i;
  }
  currentDayIndex = Math.max(currentDayIndex, idx);
}

/* =========================================================
   THREE: Base
========================================================= */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050611);
scene.fog = new THREE.Fog(0x050611, 10, 95);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 6, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
mount.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(8, 14, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0x88aaff, 0.35);
rim.position.set(-10, 8, -10);
scene.add(rim);

/* =========================================================
   ENV: City & Hill
========================================================= */
const envCity = new THREE.Group();
scene.add(envCity);

const envHill = new THREE.Group();
envHill.visible = false;
scene.add(envHill);

function setEnvironment(mode) {
  const isHill = (mode === "hill" || mode === "valentine");
  envCity.visible = !isHill;
  envHill.visible = isHill;

  if (mode === "valentine") {
    scene.background = new THREE.Color(0x02030a);
    scene.fog = new THREE.Fog(0x02030a, 10, 140);
  } else if (isHill) {
    scene.background = new THREE.Color(0x050611);
    scene.fog = new THREE.Fog(0x050611, 10, 140);
  } else {
    scene.background = new THREE.Color(0x050611);
    scene.fog = new THREE.Fog(0x050611, 10, 95);
  }
}

function rand(min, max) { return Math.random() * (max - min) + min; }

/* =========================================================
   CITY
========================================================= */
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(26, 260),
  new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 1 })
);
road.rotation.x = -Math.PI / 2;
road.position.z = -90;
envCity.add(road);

const lines = [];
for (let i = 0; i < 45; i++) {
  const l = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 2.4),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.28,
      roughness: 1
    })
  );
  l.rotation.x = -Math.PI / 2;
  l.position.set(0, 0.01, -i * 4.2);
  envCity.add(l);
  lines.push(l);
}

const city = new THREE.Group();
envCity.add(city);

for (let i = 0; i < 80; i++) {
  const z = -rand(10, 190);
  const h = rand(3, 20);
  const mat = new THREE.MeshStandardMaterial({ color: 0x101a44, roughness: 1 });

  const b1 = new THREE.Mesh(new THREE.BoxGeometry(rand(2, 4), h, rand(2, 4)), mat);
  b1.position.set(rand(7, 12), h / 2, z);
  city.add(b1);

  const b2 = new THREE.Mesh(new THREE.BoxGeometry(rand(2, 4), h, rand(2, 4)), mat);
  b2.position.set(-rand(7, 12), h / 2, z);
  city.add(b2);

  const w = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, h * 0.5),
    new THREE.MeshStandardMaterial({
      color: 0x222,
      emissive: 0xffc76a,
      emissiveIntensity: 0.55
    })
  );
  w.position.set(b1.position.x - 0.01, h * 0.55, z);
  w.rotation.y = Math.PI / 2;
  city.add(w);
}

const lamps = new THREE.Group();
envCity.add(lamps);

function addLamp(x, z) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 2.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 })
  );
  pole.position.set(x, 1.1, z);
  lamps.add(pole);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd29e, emissiveIntensity: 0.9 })
  );
  bulb.position.set(x, 2.25, z);
  lamps.add(bulb);

  const p = new THREE.PointLight(0xffd29e, 0.7, 8);
  p.position.set(x, 2.25, z);
  lamps.add(p);
}
for (let i = 0; i < 12; i++) {
  addLamp(-4.5, -i * 14 - 8);
  addLamp(4.5, -i * 14 - 15);
}

// SHOP
const shop = new THREE.Group();
envCity.add(shop);
shop.position.set(-6.6, 0, -34);

const shopBase = new THREE.Mesh(
  new THREE.BoxGeometry(6.6, 2.9, 3.4),
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1 })
);
shopBase.position.set(0, 1.45, 0);
shop.add(shopBase);

const shopSign = new THREE.Mesh(
  new THREE.PlaneGeometry(4.8, 1.2),
  new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0xff4d6d, emissiveIntensity: 0.9 })
);
shopSign.position.set(0, 2.6, 1.71);
shop.add(shopSign);

const counter = new THREE.Mesh(
  new THREE.BoxGeometry(3.2, 0.9, 1.0),
  new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 })
);
counter.position.set(1.5, 0.45, 1.75);
shop.add(counter);

const stand = new THREE.Mesh(
  new THREE.CylinderGeometry(0.5, 0.6, 0.6, 16),
  new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 1 })
);
stand.position.set(2.8, 0.3, 1.7);
shop.add(stand);

const shopGlow = new THREE.PointLight(0xff4d6d, 2.4, 30);
shopGlow.position.set(0, 2.5, 1.2);
shop.add(shopGlow);

/* =========================================================
   ITEMS
========================================================= */
function makeRose() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.55, 10),
    new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 1 })
  );
  stem.position.y = 0.28;
  const bud = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 18, 18),
    new THREE.MeshStandardMaterial({ color: 0xff2d55, emissive: 0xff2d55, emissiveIntensity: 0.2 })
  );
  bud.position.y = 0.58;
  g.add(stem, bud);
  return g;
}
function makeRing() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.05, 16, 40),
    new THREE.MeshStandardMaterial({ color: 0xffd36a, roughness: 0.3, metalness: 0.8 })
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.12),
    new THREE.MeshStandardMaterial({ color: 0x7bd3ff, emissive: 0x2b8cff, emissiveIntensity: 0.25, roughness: 0.1 })
  );
  gem.position.y = 0.18;
  g.add(gem);
  return g;
}
function makeChocolate() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.18, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x5b2b1a, roughness: 1 })
  );
  g.add(box);
  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.04, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xff4d6d, roughness: 0.9 })
  );
  ribbon.position.y = 0.12;
  g.add(ribbon);
  return g;
}
function makeTeddy() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xcaa17a, roughness: 1 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 24), mat);
  body.position.y = 0.28;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), mat);
  head.position.y = 0.58;
  g.add(head);
  const ear1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 18), mat);
  ear1.position.set(-0.16, 0.74, 0);
  g.add(ear1);
  const ear2 = ear1.clone();
  ear2.position.x = 0.16;
  g.add(ear2);
  return g;
}
function makeNote() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xf6f1e6, roughness: 1 })
  );
  paper.rotation.x = -Math.PI / 2;
  g.add(paper);
  const wax = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.04, 22),
    new THREE.MeshStandardMaterial({ color: 0xff4d6d, roughness: 0.9 })
  );
  wax.position.y = 0.02;
  g.add(wax);
  return g;
}
function makeHeart() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xff4d6d, emissiveIntensity: 0.2, roughness: 0.7 });
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 22, 22), mat);
  s1.position.set(-0.12, 0.14, 0);
  const s2 = s1.clone();
  s2.position.x = 0.12;
  const tri = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.36, 24), mat);
  tri.rotation.x = Math.PI;
  tri.position.y = -0.10;
  g.add(s1, s2, tri);
  return g;
}
function makeKiss() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xff4d6d, emissiveIntensity: 0.25, roughness: 0.6 });
  const lip = new THREE.Mesh(new THREE.TorusKnotGeometry(0.18, 0.06, 60, 12), mat);
  lip.rotation.x = Math.PI / 2;
  g.add(lip);
  return g;
}
function buildItem(kind) {
  switch (kind) {
    case "rose": return makeRose();
    case "ring": return makeRing();
    case "chocolate": return makeChocolate();
    case "teddy": return makeTeddy();
    case "note": return makeNote();
    case "heart": return makeHeart();
    case "kiss": return makeKiss();
    default: return makeRose();
  }
}

// bouquet
const bouquet = new THREE.Group();
bouquet.position.set(2.8, 0.65, 1.7);
shop.add(bouquet);
for (let i = 0; i < 12; i++) {
  const r = makeRose();
  const a = (i / 12) * Math.PI * 2;
  r.position.set(Math.cos(a) * 0.22, 0.05 + (i % 2) * 0.02, Math.sin(a) * 0.22);
  r.rotation.y = a;
  bouquet.add(r);
}

let pickupItem = buildItem(days[currentDayIndex].item);
pickupItem.position.set(1.5, 1.05, 2.2);
shop.add(pickupItem);

function setPickupItemForDay(idx) {
  if (pickupItem && pickupItem.parent) pickupItem.parent.remove(pickupItem);
  pickupItem = buildItem(days[idx].item);
  pickupItem.position.set(1.5, 1.05, 2.2);
  shop.add(pickupItem);
  pickupItem.visible = true;
}

/* =========================================================
   HILLTOP
========================================================= */
const hill = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 220, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0x0b1325, roughness: 1 })
);
hill.rotation.x = -Math.PI / 2;
hill.position.set(0, -0.2, -40);
envHill.add(hill);

const ridge = new THREE.Group();
envHill.add(ridge);
for (let i = 0; i < 40; i++) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(rand(0.6, 2.2), 0),
    new THREE.MeshStandardMaterial({ color: 0x0a0d16, roughness: 1 })
  );
  rock.position.set(rand(-35, 35), rand(0.0, 2.0), -rand(20, 85));
  rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  ridge.add(rock);
}

const stars = new THREE.Group();
envHill.add(stars);
for (let i = 0; i < 250; i++) {
  const s = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 })
  );
  s.position.set(rand(-90, 90), rand(20, 85), -rand(10, 140));
  stars.add(s);
}

const moon = new THREE.PointLight(0x88aaff, 1.2, 220);
moon.position.set(30, 40, -70);
envHill.add(moon);

/* =========================================================
   VALENTINE VIDEO (FIXED: autoplay muted + unmute click)
========================================================= */
const videoEl = document.createElement("video");
videoEl.src = "/video/finale.mp4"; // MUST be public/video/finale.mp4
videoEl.crossOrigin = "anonymous";
videoEl.loop = false;
videoEl.preload = "auto";
videoEl.playsInline = true;
videoEl.muted = true; // ✅ important: autoplay allowed when muted
videoEl.setAttribute("webkit-playsinline", "true");

const videoTex = new THREE.VideoTexture(videoEl);
videoTex.minFilter = THREE.LinearFilter;
videoTex.magFilter = THREE.LinearFilter;
videoTex.colorSpace = THREE.SRGBColorSpace;

// ✅ Use MeshBasicMaterial so lighting doesn't make it dark/grey
const videoPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(28, 15.75),
  new THREE.MeshBasicMaterial({
    map: videoTex,
    toneMapped: false
  })
);
videoPlane.position.set(0, 12.5, -45);
videoPlane.visible = false;
envHill.add(videoPlane);

const videoFrame = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 17.2),
  new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.25
  })
);
videoFrame.position.set(0, 12.5, -45.1);
videoFrame.visible = false;
envHill.add(videoFrame);

// overlay for play/unmute
const videoOverlay = document.createElement("div");
videoOverlay.style.position = "fixed";
videoOverlay.style.left = "0";
videoOverlay.style.top = "0";
videoOverlay.style.width = "100%";
videoOverlay.style.height = "100%";
videoOverlay.style.display = "none";
videoOverlay.style.placeItems = "center";
videoOverlay.style.zIndex = "90";
videoOverlay.style.background = "rgba(0,0,0,0.28)";
videoOverlay.innerHTML = `
  <div style="display:grid;gap:12px;place-items:center;font-family:system-ui;">
    <button id="btnStartVideo"
      style="padding:14px 18px;border-radius:999px;border:0;background:#fff;color:#111;
             font-weight:900;cursor:pointer;font-size:16px;">
      ▶ Play Video (Muted)
    </button>
    <button id="btnUnmute"
      style="padding:12px 16px;border-radius:999px;border:1px solid rgba(255,255,255,0.35);
             background:rgba(0,0,0,0.35);color:#fff;font-weight:800;cursor:pointer;font-size:14px;">
      🔊 Tap to Unmute
    </button>
    <div style="opacity:0.85;color:#fff;font-size:13px;max-width:520px;text-align:center;">
      If your phone blocks audio, press “Tap to Unmute”.
    </div>
  </div>
`;
document.body.appendChild(videoOverlay);

const btnStartVideo = videoOverlay.querySelector("#btnStartVideo");
const btnUnmute = videoOverlay.querySelector("#btnUnmute");

async function startVideoMuted() {
  try {
    videoPlane.visible = true;
    videoFrame.visible = true;
    if (videoEl.readyState < 2) videoEl.load();
    videoEl.currentTime = 0;
    videoEl.muted = true;
    await videoEl.play(); // ✅ should work now
  } catch (e) {
    console.log("Video play blocked or failed:", e);
  }
}

async function unmuteVideo() {
  try {
    videoEl.muted = false; // needs user gesture
    // If browser pauses on unmute attempt, re-play
    if (videoEl.paused) await videoEl.play();
  } catch (e) {
    console.log("Unmute failed:", e);
  }
}

btnStartVideo.addEventListener("click", async () => {
  await startVideoMuted();
  // keep overlay so she can choose to unmute, but make it lighter
  videoOverlay.style.background = "rgba(0,0,0,0.12)";
});
btnUnmute.addEventListener("click", async () => {
  await unmuteVideo();
  // once unmuted, hide overlay
  videoOverlay.style.display = "none";
});

// when video ends, show a final soft message (optional)
videoEl.addEventListener("ended", () => {
  // only show after video ends if we're on valentine day
  if (days[currentDayIndex]?.mode === "valentine") {
    showCard(days[currentDayIndex].title, `${days[currentDayIndex].msg}\n\nForever yours.`);
  }
});

/* =========================================================
   SCOOTER + RIDER
========================================================= */
let scooterRoot = null;

const scooterFallback = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 0.45, 2.4),
  new THREE.MeshStandardMaterial({ color: 0xff4d6d })
);
scooterFallback.position.set(0, 0.55, 1.5);
scene.add(scooterFallback);
scooterRoot = scooterFallback;

// rider
const rider = new THREE.Group();
const skin = new THREE.MeshStandardMaterial({ color: 0xffd6c2, roughness: 0.9 });
const hair = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });
const jacket = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 });
const jeans = new THREE.MeshStandardMaterial({ color: 0x2b4c7e, roughness: 1 });

const headR = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 24), skin);
headR.position.set(0.05, 1.55, 0.25);
rider.add(headR);

const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 24, 24), hair);
hairCap.scale.set(1, 0.7, 1);
hairCap.position.copy(headR.position);
hairCap.position.y += 0.07;
rider.add(hairCap);

const bodyR = new THREE.Mesh(new THREE.CapsuleGeometry(0.20, 0.45, 8, 16), jacket);
bodyR.position.set(0.05, 1.15, 0.20);
rider.add(bodyR);

const leg1R = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.35, 8, 16), jeans);
leg1R.position.set(-0.02, 0.80, 0.35);
leg1R.rotation.x = -0.5;
rider.add(leg1R);

const leg2R = leg1R.clone();
leg2R.position.x = 0.12;
rider.add(leg2R);

const arm1R = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 8, 16), jacket);
arm1R.position.set(-0.10, 1.25, 0.35);
arm1R.rotation.z = 0.6;
arm1R.rotation.x = 0.4;
rider.add(arm1R);

const arm2R = arm1R.clone();
arm2R.position.x = 0.20;
arm2R.rotation.z = -0.6;
rider.add(arm2R);

const handAnchor = new THREE.Group();
handAnchor.position.set(0.26, 1.15, 0.48);
rider.add(handAnchor);

rider.scale.set(1.7, 1.7, 1.7);
rider.position.set(0.08, 0.38, 0.10);

function attachRiderToScooter() {
  if (!scooterRoot) return;
  if (rider.parent) rider.parent.remove(rider);
  scooterRoot.add(rider);
}
attachRiderToScooter();

const loader = new GLTFLoader();
loader.load(
  "/models/scooter.glb",
  (gltf) => {
    scene.remove(scooterFallback);
    const model = gltf.scene;
    model.position.set(0, 0, 1.5);
    model.scale.set(0.9, 0.9, 0.9);
    model.rotation.set(0, -Math.PI / 2, 0);
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material.roughness = 0.7;
        o.material.metalness = 0.1;
      }
    });
    scene.add(model);
    scooterRoot = model;
    attachRiderToScooter();
  },
  undefined,
  () => {}
);

// held item
const held = new THREE.Group();
held.visible = false;
function putItemInHand(kind) {
  held.clear();
  held.add(buildItem(kind));
  held.visible = true;

  if (scooterRoot) {
    if (held.parent) held.parent.remove(held);
    scooterRoot.add(held);

    const handWorld = handAnchor.getWorldPosition(new THREE.Vector3());
    const local = scooterRoot.worldToLocal(handWorld.clone());
    held.position.copy(local);
    held.position.z += 0.10;
    held.rotation.y = Math.PI / 2;
  }
}

/* =========================================================
   STATE
========================================================= */
let started = false;
let phase = "idle"; // ride -> arrive -> pickup -> gift -> freeze -> gate
let timer = 0;

let speed = 0;
let targetSpeed = 0;
const baseSpeed = 0.55;

// Determine current unlock time
if (unlockedUntil === 0) unlockedUntil = torontoEpochForDayIndex(currentDayIndex);

gateBtn.addEventListener("click", async () => {
  const nowTZ = nowInZone().getTime();
  if (nowTZ < unlockedUntil) return;

  hideGate();

  currentDayIndex = Math.min(days.length - 1, currentDayIndex + 1);
  setPickupItemForDay(currentDayIndex);
  held.visible = false;

  setEnvironment(days[currentDayIndex].mode);

  // Valentine: show overlay and start muted video
  if (days[currentDayIndex].mode === "valentine") {
    videoOverlay.style.display = "grid";
    await startVideoMuted();
  } else {
    videoOverlay.style.display = "none";
  }

  phase = "ride";
  timer = 0;
  speed = 0;
  targetSpeed = baseSpeed;

  // next unlock time in Toronto
  unlockedUntil = computeUnlockTimeForNextDay();
  saveProgress({ dayIndex: currentDayIndex, unlockedUntil });
});

// Start
startBtn.addEventListener("click", async () => {
  overlay.style.display = "none";
  hideCard();

  setEnvironment(days[currentDayIndex].mode);

  // lock check based on Toronto now
  const nowTZ = nowInZone().getTime();
  const todayStart = torontoEpochForDayIndex(currentDayIndex);
  unlockedUntil = Math.max(unlockedUntil, todayStart);

  if (USE_REAL_DATES && currentDayIndex < days.length - 1) {
    const nextUnlock = torontoEpochForDayIndex(currentDayIndex + 1);
    unlockedUntil = nextUnlock; // next chapter unlock time
  }

  started = true;
  phase = "ride";
  timer = 0;
  speed = 0;
  targetSpeed = baseSpeed;

  // Valentine: show overlay immediately
  if (days[currentDayIndex].mode === "valentine") {
    videoOverlay.style.display = "grid";
    await startVideoMuted();
  } else {
    videoOverlay.style.display = "none";
  }
});

/* =========================================================
   LOOP
========================================================= */
function animate() {
  requestAnimationFrame(animate);
  attachRiderToScooter();

  if (started) {
    timer += 1 / 60;

    // Gate countdown in Toronto time
    if (phase === "gate") {
      const ms = Math.max(0, unlockedUntil - nowInZone().getTime());
      gateTimer.textContent = fmtHHMMSS(ms);

      if (ms <= 0) {
        gateBtn.disabled = false;
        gateBtn.style.opacity = "1";
      } else {
        gateBtn.disabled = true;
        gateBtn.style.opacity = "0.5";
      }
    }

    const day = days[currentDayIndex];

    // ----- RIDE -----
    if (phase === "ride") {
      speed += (targetSpeed - speed) * 0.02;

      if (day.mode === "shop") {
        for (const l of lines) {
          l.position.z += speed * 1.3;
          if (l.position.z > 8) l.position.z = -190;
        }
        for (const obj of city.children) {
          obj.position.z += speed * 0.55;
          if (obj.position.z > 12) obj.position.z = -190;
        }
        for (const obj of lamps.children) {
          obj.position.z += speed * 0.8;
          if (obj.position.z > 12) obj.position.z = -190;
        }

        const sway = Math.sin(performance.now() * 0.0012) * 0.25;
        camera.position.x += (sway - camera.position.x) * 0.03;
        camera.position.y += (5.1 - camera.position.y) * 0.03;
        camera.position.z += (12.4 - camera.position.z) * 0.03;
        camera.lookAt(0, 1.5, -35 - speed * 35);

        if (timer > 5.0) {
          phase = "arrive";
          timer = 0;
          targetSpeed = 0.08;
          showCard(day.title, day.arrive);
        }
      } else {
        const sway = Math.sin(performance.now() * 0.0010) * 0.35;
        camera.position.x += (sway - camera.position.x) * 0.03;
        camera.position.y += (7.0 - camera.position.y) * 0.03;
        camera.position.z += (18.0 - camera.position.z) * 0.03;
        camera.lookAt(0, 3.0, -55);

        if (timer > 4.5) {
          phase = "arrive";
          timer = 0;
          targetSpeed = 0;
          showCard(day.title, day.arrive);

          if (day.mode === "valentine") {
            videoPlane.visible = true;
            videoFrame.visible = true;
            videoOverlay.style.display = "grid";
            startVideoMuted();
          }
        }
      }

      if (scooterRoot) {
        scooterRoot.rotation.z = Math.sin(performance.now() * 0.004) * 0.02;
        scooterRoot.position.y = 0.55 + Math.sin(performance.now() * 0.002) * 0.05;
        rider.position.y = 0.38 + Math.sin(performance.now() * 0.004) * 0.01;
      }
    }

    // ----- ARRIVE -----
    if (phase === "arrive") {
      if (day.mode === "shop") {
        camera.position.x += (-4.8 - camera.position.x) * 0.03;
        camera.position.y += (3.2 - camera.position.y) * 0.03;
        camera.position.z += (-2.0 - camera.position.z) * 0.03;
        camera.lookAt(shop.position.x, 1.5, shop.position.z + 1.5);

        if (timer > 2.4) {
          phase = "pickup";
          timer = 0;
          hideCard();
        }
      } else {
        camera.position.x += (Math.sin(performance.now() * 0.0006) * 2.8 - camera.position.x) * 0.02;
        camera.position.y += (7.2 - camera.position.y) * 0.02;
        camera.position.z += (17.0 - camera.position.z) * 0.02;
        camera.lookAt(0, 3.0, -60);

        if (timer > 2.8) {
          phase = "gift";
          timer = 0;
          hideCard();

          if (day.mode === "hill") putItemInHand("kiss");

          if (day.mode === "valentine") {
            videoPlane.visible = true;
            videoFrame.visible = true;
            videoOverlay.style.display = "grid";
            startVideoMuted();
          }
        }
      }
    }

    // ----- PICKUP -----
    if (phase === "pickup" && day.mode === "shop") {
      const from = pickupItem.getWorldPosition(new THREE.Vector3());
      const to = handAnchor.getWorldPosition(new THREE.Vector3());

      const flying = buildItem(day.item);
      flying.position.copy(from);
      scene.add(flying);
      pickupItem.visible = false;

      const mid = from.clone().lerp(to, 0.5);
      mid.y += 1.4;

      const tl = gsap.timeline({
        onComplete: () => {
          scene.remove(flying);
          putItemInHand(day.item);
          phase = "gift";
          timer = 0;
        }
      });

      tl.to(flying.position, { x: mid.x, y: mid.y, z: mid.z, duration: 1.4, ease: "power2.out" })
        .to(flying.position, { x: to.x, y: to.y, z: to.z, duration: 1.2, ease: "power2.inOut" }, ">-0.1");

      gsap.to(flying.rotation, { y: Math.PI * 2, duration: 2.6, ease: "none" });
      phase = "pickup_done";
    }

    // ----- GIFT -----
    if (phase === "gift") {
      if (held.visible) held.rotation.y += 0.03;

      if (day.mode === "valentine") {
        camera.position.x += (0 - camera.position.x) * 0.02;
        camera.position.y += (10.0 - camera.position.y) * 0.02;
        camera.position.z += (22.0 - camera.position.z) * 0.02;
        camera.lookAt(0, 12.5, -45);

        // Do NOT cover the video immediately with the big card.
        // Instead: show the card AFTER video ends (handled in videoEl 'ended' listener).
        // We'll just freeze here.
        if (timer > 1.2) {
          phase = "freeze";
          // small hint card only (optional)
          showCard(day.title, `${day.arrive}\n\n(Watch the sky 👆)\n\n`);
        }
      } else if (day.mode === "hill") {
        camera.position.x += (0 - camera.position.x) * 0.02;
        camera.position.y += (7.0 - camera.position.y) * 0.02;
        camera.position.z += (18.5 - camera.position.z) * 0.02;
        camera.lookAt(0, 3.0, -58);

        if (timer > 1.0) {
          phase = "freeze";
          showCard(day.title, `${day.msg}\n\nCome back tomorrow ❤️`);
        }
      } else {
        camera.position.x += (0 - camera.position.x) * 0.02;
        camera.position.y += (4.9 - camera.position.y) * 0.02;
        camera.position.z += (10.8 - camera.position.z) * 0.02;
        camera.lookAt(0, 1.3, -6);

        if (timer > 1.0) {
          phase = "freeze";
          showCard(day.title, `${day.msg}\n\nCome back tomorrow ❤️`);
        }
      }
    }

    // ----- FREEZE -> GATE -----
    if (phase === "freeze") {
      if (storyUI.style.display === "none") {
        if (currentDayIndex < days.length - 1) {
          unlockedUntil = computeUnlockTimeForNextDay();
          saveProgress({ dayIndex: currentDayIndex, unlockedUntil });

          phase = "gate";
          showGate(currentDayIndex + 1, `Next chapter (${days[currentDayIndex + 1].title}) unlocks in`);
        } else {
          phase = "idle";
        }
      }
    }
  }

  renderer.render(scene, camera);
}

animate();

// init
setEnvironment(days[currentDayIndex].mode);
setPickupItemForDay(currentDayIndex);

// resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
