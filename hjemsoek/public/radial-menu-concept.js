import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
const CONFIG = {
  defaultLifetime: 4,
  samples: 180,
  manaRechargePerSecond: 0.12,
  projectileSpeedMultiplier: 1.5,
};
const DIRS = [
  ["up", "Lift", "↑", -90, 0, 1],
  ["ur", "Lift + Curve Right", "↗", -45, 1, 0.75],
  ["r", "Curve Right", "→", 0, 1, 0],
  ["dr", "Drop + Curve Right", "↘", 45, 1, -0.65],
  ["down", "Drop", "↓", 90, 0, -1],
  ["dl", "Drop + Curve Left", "↙", 135, -1, -0.65],
  ["l", "Curve Left", "←", 180, -1, 0],
  ["ul", "Lift + Curve Left", "↖", 225, -1, 0.75],
].map(([id, label, icon, angle, x, y]) => ({ id, label, icon, angle, x, y }));
const $ = (id) => document.getElementById(id);
const radialWrap = document.querySelector(".radial-wrap");
const state = {
  planning: false,
  armed: false,
  turns: [],
  progress: 0,
  mana: 0.35,
  influence: 15,
  slow: 1,
  auto: false,
  infiniteMana: false,
  hidePreviewWhilePlanning: false,
  single: false,
  compound: true,
  move: 0,
  aimYaw: 0,
  aimPitch: 0,
  aimDirty: false,
  pointerLocked: false,
  middleHeld: false,
  radialX: 0,
  radialY: 0,
  hoverDirId: null,
  shot: false,
  shotStart: 0,
};
const clamp = (v, min, max) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : min));
const smoothstep = (v) => {
  v = clamp(v, 0, 1);
  return v * v * (3 - 2 * v);
};
const intervalIndex = (t) =>
  clamp(Math.floor(Number(t) || 0), 0, CONFIG.defaultLifetime - 1);
const canAddTurn = (time) =>
  !state.turns.some((t) => intervalIndex(t.time) === intervalIndex(time));
function makeTrajectory(
  turns = state.turns,
  influencePercent = state.influence,
  compound = state.compound,
) {
  const scale = clamp(influencePercent, 1, 30) / 15;
  let prevX = 0,
    prevY = 0;
  const effective = turns.map((turn) => {
    if (!compound) return turn;
    const out = {
      ...turn,
      x: clamp(turn.x + prevX * 0.25, -1.35, 1.35),
      y: clamp(turn.y + prevY * 0.25, -1.35, 1.35),
    };
    prevX = clamp(prevX + turn.x * 0.5, -2, 2);
    prevY = clamp(prevY + turn.y * 0.5, -2, 2);
    return out;
  });
  const pts = [];
  for (let i = 0; i <= CONFIG.samples; i++) {
    const t = i / CONFIG.samples;
    let x = 0,
      y = 1.25 + Math.sin(t * Math.PI) * 2.4,
      z = -t * 38;
    for (const turn of effective) {
      const inf = smoothstep((t - turn.time / CONFIG.defaultLifetime) / 0.36);
      x += turn.x * inf * 5.7 * scale;
      y += turn.y * inf * 2.5 * scale;
    }
    pts.push(new THREE.Vector3(x, Math.max(0.25, y), z));
  }
  return pts;
}
function makeAimedTrajectory(
  turns = state.turns,
  influencePercent = state.influence,
  compound = state.compound,
) {
  const c = Math.cos(state.aimYaw),
    s = Math.sin(state.aimYaw),
    lift = Math.tan(state.aimPitch) * 0.42;
  return makeTrajectory(turns, influencePercent, compound).map(
    (p) =>
      new THREE.Vector3(
        p.x * c - p.z * s,
        Math.max(0.25, p.y + -p.z * lift),
        p.x * s + p.z * c,
      ),
  );
}
function pointInsideBox(p, b) {
  return (
    Math.abs(p.x - b.center.x) <= b.half.x &&
    Math.abs(p.y - b.center.y) <= b.half.y &&
    Math.abs(p.z - b.center.z) <= b.half.z
  );
}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070c);
scene.fog = new THREE.Fog(0x07070c, 28, 76);
const camera = new THREE.PerspectiveCamera(
  58,
  innerWidth / innerHeight,
  0.1,
  140,
);
camera.position.set(0, 6.4, 12.5);
camera.lookAt(0, 2, -18);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
$("three").appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0x9888b8, 0.72));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(6, 12, 7);
sun.castShadow = true;
scene.add(sun);
scene.add(new THREE.PointLight(0x8b5cf6, 3.2, 15));
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(82, 110),
  new THREE.MeshStandardMaterial({ color: 0x111018, roughness: 0.9 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.z = -22;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(82, 82, 0x6d4a9c, 0x2b203b);
grid.position.z = -22;
grid.position.y = 0.02;
scene.add(grid);
const aimReticle = new THREE.Group();
scene.add(aimReticle);
const aimRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.48, 0.025, 8, 42),
  new THREE.MeshBasicMaterial({
    color: 0xa5f3fc,
    transparent: true,
    opacity: 0.9,
  }),
);
aimRing.rotation.x = Math.PI / 2;
aimReticle.add(aimRing);
const aimDot = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xecfeff }),
);
aimReticle.add(aimDot);
const aimLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(0, 0, -1),
  ]),
  new THREE.LineBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.35,
  }),
);
scene.add(aimLine);
const unit = new THREE.Group();
unit.position.set(0, 0, 2);
unit.rotation.y = Math.PI;
scene.add(unit);
const bodyMat = new THREE.MeshStandardMaterial({
  color: 0x5b5068,
  roughness: 0.55,
  emissive: 0x26123f,
  emissiveIntensity: 0.2,
});
const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.25, 0.65), bodyMat);
body.position.y = 1.25;
body.castShadow = true;
unit.add(body);
const head = new THREE.Mesh(
  new THREE.BoxGeometry(0.62, 0.42, 0.48),
  new THREE.MeshStandardMaterial({
    color: 0xc8b8da,
    emissive: 0x34204f,
    emissiveIntensity: 0.7,
  }),
);
head.position.y = 2.58;
unit.add(head);
const core = new THREE.Mesh(
  new THREE.SphereGeometry(0.25, 32, 32),
  new THREE.MeshStandardMaterial({
    color: 0xd9b3ff,
    emissive: 0x9b35ff,
    emissiveIntensity: 3.3,
  }),
);
core.position.set(0, 1.48, -0.72);
unit.add(core);
const coreLight = new THREE.PointLight(0xa855f7, 4, 8);
coreLight.position.copy(core.position);
unit.add(coreLight);
const armMat = new THREE.MeshStandardMaterial({ color: 0x766886 });
[-0.62, 0.62].forEach((x) => {
  const a = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.55, 0.22), armMat);
  a.position.set(x, 1.25, -0.12);
  a.rotation.z = x < 0 ? -0.35 : 0.35;
  unit.add(a);
});
const towers = new THREE.Group();
scene.add(towers);
const boxes = [];
function makeTextSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(127,29,29,.76)";
  ctx.strokeStyle = "rgba(254,202,202,.9)";
  ctx.lineWidth = 5;
  ctx.fillRect(18, 22, 476, 84);
  ctx.strokeRect(18, 22, 476, 84);
  ctx.fillStyle = "#fee2e2";
  ctx.font = "700 46px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.scale.set(5.2, 1.3, 1);
  return sprite;
}
function addTower(x, z, h, w = 1.9, color = 0x4a3e4d, name = "tower") {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, w),
    new THREE.MeshStandardMaterial({ color, roughness: 0.86 }),
  );
  m.position.set(x, h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  towers.add(m);
  boxes.push({
    name,
    center: m.position.clone(),
    half: new THREE.Vector3(w / 2, h / 2, w / 2),
  });
  return m;
}
addTower(0, -15.2, 4.4, 1.9, 0x302b45, "front tower");
addTower(-1.55, -10.6, 4.2);
addTower(1.55, -10.6, 4.2);
[
  [-6.5, -23, 5.2],
  [0, -27, 6.5],
  [5.5, -31, 4.8],
  [-2.5, -35, 7.5],
  [8, -40, 5.5],
  [-7, -45, 6.2],
  [2, -49, 5.6],
].forEach(([x, z, h], i) => {
  const isShieldTower = i === 1;
  addTower(
    x,
    z,
    h,
    2.2,
    isShieldTower ? 0x7f1d1d : i % 2 ? 0x34314a : 0x262338,
    isShieldTower ? "shield tower" : "rear tower",
  );
  if (isShieldTower) {
    const label = makeTextSprite("shield tower");
    label.position.set(x, h + 1.25, z);
    towers.add(label);
  }
});
const pathGroup = new THREE.Group();
scene.add(pathGroup);
let activeCurve = new THREE.CatmullRomCurve3(makeAimedTrajectory());
let shotCurve = activeCurve;
const shotOrigin = new THREE.Vector3();
function disposeGroup(g) {
  while (g.children.length) {
    const c = g.children.pop();
    c.geometry?.dispose?.();
    c.material?.dispose?.();
  }
}
function makeTube(points, r, color, opacity) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(12, points.length - 1), r, 8, false),
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }),
  );
  return [mesh, curve];
}
function pathOrigin() {
  return new THREE.Vector3(unit.position.x, 0, unit.position.z - 2);
}
function rebuildPath() {
  disposeGroup(pathGroup);
  pathGroup.position.copy(pathOrigin());
  activeCurve = new THREE.CatmullRomCurve3(makeAimedTrajectory());
  if (!state.planning && !state.armed) return;
  if (state.planning && state.hidePreviewWhilePlanning) return;
  const [tube, curve] = makeTube(
    makeAimedTrajectory(),
    0.055,
    0xbd63ff,
    state.planning ? 0.78 : 0.42,
  );
  activeCurve = curve;
  pathGroup.add(tube);
  for (let i = 0; i < 24; i++) {
    const d = new THREE.Mesh(
      new THREE.SphereGeometry(i % 2 === 0 ? 0.08 : 0.05, 10, 10),
      new THREE.MeshBasicMaterial({
        color: 0xf0d5ff,
        transparent: true,
        opacity: 0.75,
      }),
    );
    d.position.copy(activeCurve.getPoint(i / 23));
    pathGroup.add(d);
  }
}
const projectileGroup = new THREE.Group();
scene.add(projectileGroup);
projectileGroup.visible = false;
const projectile = new THREE.Mesh(
  new THREE.SphereGeometry(0.29, 32, 32),
  new THREE.MeshStandardMaterial({
    color: 0xefd6ff,
    emissive: 0x9d35ff,
    emissiveIntensity: 4,
  }),
);
projectileGroup.add(projectile);
const pl = new THREE.PointLight(0xb864ff, 8, 8);
projectileGroup.add(pl);
const trail = [];
for (let i = 0; i < 18; i++) {
  const p = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0xb863ff,
      transparent: true,
      opacity: 0.35 * (1 - i / 18),
    }),
  );
  projectileGroup.add(p);
  trail.push(p);
}
function radialPoint(time, radius = 169) {
  const a =
    clamp(time / CONFIG.defaultLifetime, 0, 1) * Math.PI * 2 - Math.PI / 2;
  return { x: 144 + Math.cos(a) * radius, y: 144 + Math.sin(a) * radius };
}
function aimVectors() {
  const forward = new THREE.Vector3(
    Math.sin(state.aimYaw),
    0,
    -Math.cos(state.aimYaw),
  );
  const right = new THREE.Vector3(
    Math.cos(state.aimYaw),
    0,
    Math.sin(state.aimYaw),
  );
  return { forward, right };
}
function updateAimFromMouse(e) {
  const nx = clamp((e.clientX / innerWidth - 0.5) * 2, -1, 1);
  const ny = clamp((e.clientY / innerHeight - 0.5) * 2, -1, 1);
  state.aimYaw = nx * 1.05;
  state.aimPitch = clamp(-ny * 0.42, -0.22, 0.42);
  state.aimDirty = true;
}
function updateAimFromLockedMouse(e) {
  state.aimYaw = clamp(state.aimYaw + e.movementX * 0.0035, -1.25, 1.25);
  state.aimPitch = clamp(state.aimPitch - e.movementY * 0.0028, -0.22, 0.42);
  state.aimDirty = true;
}
function updateAimVisual() {
  const { forward, right } = aimVectors();
  const origin = new THREE.Vector3(
    unit.position.x,
    1.55,
    unit.position.z - 1.1,
  );
  const target = origin.clone().add(forward.clone().multiplyScalar(32));
  target.y = clamp(2.1 + Math.tan(state.aimPitch) * 28, 0.45, 13);
  aimReticle.position.copy(target);
  aimReticle.rotation.y = state.aimYaw;
  aimLine.geometry.setFromPoints([origin, target]);
  unit.rotation.y = Math.PI + state.aimYaw;
  const cameraTarget = origin.clone().add(forward.clone().multiplyScalar(15));
  cameraTarget.y = clamp(1.55 + Math.tan(state.aimPitch) * 7, 0.9, 5.6);
  const cameraPos = new THREE.Vector3(unit.position.x, 0, unit.position.z)
    .add(forward.clone().multiplyScalar(-9.5))
    .add(right.multiplyScalar(0.45));
  cameraPos.y = 3.85;
  camera.position.lerp(cameraPos, 0.18);
  camera.lookAt(cameraTarget);
}
function updateUI() {
  const progressRatio = clamp(state.progress / CONFIG.defaultLifetime, 0, 1);
  $("progressText").textContent =
    `${state.progress.toFixed(1)}s / ${CONFIG.defaultLifetime.toFixed(1)}s`;
  $("lifeFill").style.width = `${progressRatio * 100}%`;
  $("radialProgress").style.setProperty(
    "--progress",
    `${progressRatio * 100}%`,
  );
  radialWrap.classList.toggle("visible", state.planning);
  $("radialProgress").classList.toggle("active", state.planning);
  $("manaText").textContent = state.infiniteMana
    ? "Infinite"
    : state.mana >= 1
      ? "Ready"
      : `${Math.round(state.mana * 100)}%`;
  $("manaFill").style.width = `${(state.infiniteMana ? 1 : state.mana) * 100}%`;
  $("influenceText").textContent = `${state.influence}%`;
  $("slowText").textContent = `${state.slow.toFixed(2)}x fill speed`;
  $("windowText").textContent =
    `Real-time planning window: ${(CONFIG.defaultLifetime / state.slow).toFixed(1)}s`;
  $("radial").classList.toggle("active", state.planning);
  $("radialNote").textContent = state.planning
    ? "Hold middle mouse and aim by moving the cursor."
    : "Hold middle mouse to plan.";
  $("arm").textContent =
    state.progress >= CONFIG.defaultLifetime || state.armed
      ? "Complete arming"
      : "Arm";
  document.querySelectorAll(".turn-mark").forEach((e) => e.remove());
  $("radialMarkers")
    .querySelectorAll(".radial-turn-marker")
    .forEach((e) => e.remove());
  state.turns.forEach((t) => {
    const m = document.createElement("div");
    m.className = "turn-mark";
    m.style.left = `${(t.time / CONFIG.defaultLifetime) * 100}%`;
    $("lifeBar").appendChild(m);
    const rm = document.createElement("div");
    const p = radialPoint(t.time);
    rm.className = "radial-turn-marker";
    rm.style.left = `${p.x}px`;
    rm.style.top = `${p.y}px`;
    rm.textContent = t.icon || "•";
    rm.title = `${t.label} at ${t.time.toFixed(1)}s`;
    $("radialMarkers").appendChild(rm);
  });
}
let noticeTimer = 0;
function notice(s) {
  const el = $("centerNotice");
  el.textContent = s;
  el.classList.add("visible");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.classList.remove("visible"), 1400);
}
function msg(s) {
  $("message").textContent = s;
}
function resetRadialInput() {
  state.radialX = 0;
  state.radialY = 0;
  $("radialCursor").style.left = "144px";
  $("radialCursor").style.top = "144px";
  setAimedDirection(null);
}
function start() {
  state.planning = true;
  state.armed = false;
  state.turns = [];
  state.progress = 0;
  state.hoverDirId = null;
  resetRadialInput();
  msg("Planning started. Add turns as intervals become available.");
  rebuildPath();
  updateUI();
}
function arm() {
  if (!state.planning) {
    msg("Start planning first.");
    return;
  }
  state.progress = CONFIG.defaultLifetime;
  state.planning = false;
  state.armed = true;
  rebuildPath();
  if (state.auto) fire(true);
  else
    msg(
      "Armed. Remaining path continues straight. Left-click to fire when mana is full.",
    );
  updateUI();
}
function fire(auto = false) {
  if (!state.armed) {
    msg("Prepare a shot before firing.");
    return;
  }
  if (!state.infiniteMana && state.mana < 1) {
    notice(auto ? "Auto-fire needs full mana." : "Mana is not full yet.");
    msg(
      auto
        ? "Auto-fire failed: mana is not full yet."
        : "Mana is not full yet.",
    );
    return;
  }
  state.shot = true;
  state.shotStart = clock.getElapsedTime();
  shotOrigin.copy(pathGroup.position);
  shotCurve = activeCurve;
  projectileGroup.visible = true;
  if (!state.infiniteMana) state.mana = 0;
  state.planning = false;
  state.armed = false;
  msg(auto ? "Auto-shot fired." : "Fired.");
  updateUI();
}
function cancel() {
  state.planning = false;
  state.armed = false;
  state.turns = [];
  state.progress = 0;
  state.middleHeld = false;
  state.hoverDirId = null;
  document.body.classList.remove("radial-planning");
  resetRadialInput();
  projectileGroup.visible = false;
  msg("Cancelled.");
  rebuildPath();
  updateUI();
}
function addTurn(d) {
  if (!state.planning) return;
  if (state.single && state.turns.length >= 1) {
    msg("Single Turn Only is enabled.");
    return;
  }
  if (state.progress >= CONFIG.defaultLifetime) {
    msg("The 4-second budget is full.");
    return;
  }
  if (!canAddTurn(state.progress)) {
    msg("This interval already has a turn.");
    return;
  }
  state.turns.push({
    time: state.progress,
    x: d.x,
    y: d.y,
    label: d.label,
    icon: d.icon,
  });
  msg(`${d.label} added at ${state.progress.toFixed(1)}s.`);
  rebuildPath();
  updateUI();
}
function setAimedDirection(dirId) {
  state.hoverDirId = dirId;
  radial
    .querySelectorAll(".seg")
    .forEach((btn) => btn.classList.toggle("aimed", btn.dataset.dir === dirId));
}
function directionFromRadialInput() {
  if (Math.hypot(state.radialX, state.radialY) < 28) return null;
  const angle =
    ((Math.atan2(state.radialY, state.radialX) * 180) / Math.PI + 360) % 360;
  return DIRS.reduce(
    (best, d) => {
      const dirAngle = (Number(d.angle) + 360) % 360;
      const dist = Math.abs(((angle - dirAngle + 540) % 360) - 180);
      return dist < best.dist ? { dir: d, dist } : best;
    },
    { dir: null, dist: Infinity },
  ).dir;
}
function updateRadialFromMovement(e) {
  state.radialX += e.movementX || 0;
  state.radialY += e.movementY || 0;
  const r = Math.hypot(state.radialX, state.radialY),
    max = 108;
  if (r > max) {
    state.radialX = (state.radialX / r) * max;
    state.radialY = (state.radialY / r) * max;
  }
  $("radialCursor").style.left = `${144 + state.radialX}px`;
  $("radialCursor").style.top = `${144 + state.radialY}px`;
  const d = directionFromRadialInput();
  setAimedDirection(d?.id ?? null);
}
function tryAddHoveredTurn() {
  if (!state.middleHeld || !state.planning || !state.hoverDirId) return;
  if (state.single && state.turns.length >= 1) return;
  if (state.progress >= CONFIG.defaultLifetime || !canAddTurn(state.progress))
    return;
  const d = DIRS.find((dir) => dir.id === state.hoverDirId);
  if (d) addTurn(d);
}
function beginMiddlePlanning(e) {
  e.preventDefault();
  requestAimLock();
  state.middleHeld = true;
  document.body.classList.add("radial-planning");
  start();
  tryAddHoveredTurn();
}
function finishMiddlePlanning() {
  state.middleHeld = false;
  document.body.classList.remove("radial-planning");
  resetRadialInput();
  if (state.planning) arm();
  else updateUI();
}
const radial = $("radial");
DIRS.forEach((d) => {
  const btn = document.createElement("button");
  btn.className = "seg";
  btn.dataset.dir = d.id;
  btn.textContent = d.icon;
  btn.title = d.label;
  const r = 104,
    rad = (d.angle * Math.PI) / 180;
  btn.style.left = `${144 + Math.cos(rad) * r}px`;
  btn.style.top = `${144 + Math.sin(rad) * r}px`;
  btn.onclick = () => addTurn(d);
  radial.appendChild(btn);
});
for (let mark = 0; mark <= CONFIG.defaultLifetime; mark++) {
  const m = document.createElement("div");
  m.className = "mark";
  m.style.left = `${(mark / CONFIG.defaultLifetime) * 100}%`;
  $("lifeBar").appendChild(m);
  if (mark < CONFIG.defaultLifetime) {
    const rt = document.createElement("div");
    const p = radialPoint(mark);
    rt.className = "radial-tick";
    rt.style.left = `${p.x}px`;
    rt.style.top = `${p.y}px`;
    rt.style.transform = `translate(-50%, -50%) rotate(${(mark / CONFIG.defaultLifetime) * 360}deg)`;
    $("radialMarkers").appendChild(rt);
  }
}
$("start").onclick = start;
$("arm").onclick = arm;
$("fire").onclick = () => fire(false);
$("cancel").onclick = cancel;
$("influence").oninput = (e) => {
  state.influence = Number(e.target.value);
  rebuildPath();
  updateUI();
};
$("slow").oninput = (e) => {
  state.slow = Number(e.target.value);
  updateUI();
};
$("auto").onchange = (e) => (state.auto = e.target.checked);
$("infiniteMana").onchange = (e) => {
  state.infiniteMana = e.target.checked;
  if (state.infiniteMana) state.mana = 1;
  updateUI();
};
$("hidePreview").onchange = (e) => {
  state.hidePreviewWhilePlanning = e.target.checked;
  rebuildPath();
};
$("single").onchange = (e) => (state.single = e.target.checked);
$("compound").onchange = (e) => {
  state.compound = e.target.checked;
  rebuildPath();
};
const moveInput = {
  leftButton: false,
  rightButton: false,
  leftKey: false,
  rightKey: false,
};
function syncMove() {
  state.move =
    (moveInput.rightButton || moveInput.rightKey ? 1 : 0) +
    (moveInput.leftButton || moveInput.leftKey ? -1 : 0);
}
function setButtonMove(side, pressed) {
  moveInput[side === "left" ? "leftButton" : "rightButton"] = pressed;
  syncMove();
}
$("left").onpointerdown = (e) => {
  e.preventDefault();
  setButtonMove("left", true);
};
$("right").onpointerdown = (e) => {
  e.preventDefault();
  setButtonMove("right", true);
};
["left", "right"].forEach((id) => {
  $(id).onpointerup = () => setButtonMove(id, false);
  $(id).onpointerleave = () => setButtonMove(id, false);
  $(id).onpointercancel = () => setButtonMove(id, false);
});
addEventListener("keydown", (e) => {
  if (e.code === "KeyA") {
    e.preventDefault();
    moveInput.leftKey = true;
    syncMove();
  }
  if (e.code === "KeyD") {
    e.preventDefault();
    moveInput.rightKey = true;
    syncMove();
  }
});
addEventListener("keyup", (e) => {
  if (e.code === "KeyA") {
    moveInput.leftKey = false;
    syncMove();
  }
  if (e.code === "KeyD") {
    moveInput.rightKey = false;
    syncMove();
  }
});
addEventListener("blur", () => {
  moveInput.leftKey = false;
  moveInput.rightKey = false;
  moveInput.leftButton = false;
  moveInput.rightButton = false;
  syncMove();
  if (state.middleHeld) finishMiddlePlanning();
});
function isControlTarget(target) {
  return (
    target instanceof Element &&
    target.closest("button,input,label,select,textarea")
  );
}
function requestAimLock() {
  if (document.pointerLockElement !== renderer.domElement)
    renderer.domElement.requestPointerLock?.();
}
document.addEventListener("pointerlockchange", () => {
  state.pointerLocked = document.pointerLockElement === renderer.domElement;
  document.body.classList.toggle("aim-locked", state.pointerLocked);
  if (state.pointerLocked) notice("Mouse locked. Press Esc to release.");
});
addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("auxclick", (e) => {
  if (e.button === 1) e.preventDefault();
});
addEventListener("mousedown", (e) => {
  if (e.button === 1) {
    beginMiddlePlanning(e);
    return;
  }
  if (e.button === 2 && (state.planning || state.armed)) cancel();
  if (e.button === 0 && !isControlTarget(e.target)) {
    requestAimLock();
    fire(false);
  }
});
addEventListener("mousemove", (e) => {
  if (state.planning) {
    e.preventDefault();
    if (state.middleHeld) {
      updateRadialFromMovement(e);
      tryAddHoveredTurn();
    }
    return;
  }
  if (state.pointerLocked) updateAimFromLockedMouse(e);
  else if (!isControlTarget(e.target)) updateAimFromMouse(e);
});
addEventListener("mouseup", (e) => {
  if (e.button !== 1 || !state.middleHeld) return;
  e.preventDefault();
  finishMiddlePlanning();
});
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
const clock = new THREE.Clock();
let velocity = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = clamp(clock.getDelta(), 0, 0.05);
  state.mana = state.infiniteMana
    ? 1
    : clamp(state.mana + dt * CONFIG.manaRechargePerSecond, 0, 1);
  if (state.planning) {
    const next = clamp(
      state.progress + dt * state.slow,
      0,
      CONFIG.defaultLifetime,
    );
    if (
      next >= CONFIG.defaultLifetime &&
      state.progress < CONFIG.defaultLifetime
    ) {
      state.progress = CONFIG.defaultLifetime;
      if (!state.middleHeld) arm();
    } else state.progress = next;
    tryAddHoveredTurn();
  }
  velocity += (state.move - velocity) * 0.16;
  unit.position.x = clamp(unit.position.x + velocity * 0.18, -6, 6);
  pathGroup.position.copy(pathOrigin());
  if (state.aimDirty && (state.planning || state.armed)) {
    rebuildPath();
  }
  state.aimDirty = false;
  updateAimVisual();
  bodyMat.emissive.setHex(
    state.armed ? 0x7c3aed : state.planning ? 0x5221a3 : 0x26123f,
  );
  bodyMat.emissiveIntensity = state.armed || state.planning ? 0.38 : 0.12;
  core.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5) * 0.08);
  if (projectileGroup.visible) {
    const t = clamp(
      ((clock.elapsedTime - state.shotStart) *
        CONFIG.projectileSpeedMultiplier) /
        CONFIG.defaultLifetime,
      0,
      1,
    );
    const pos = shotCurve.getPoint(t).clone().add(shotOrigin);
    projectile.position.copy(pos);
    pl.position.copy(pos);
    trail.forEach((tr, i) => {
      const tp = shotCurve
        .getPoint(clamp(t - i * 0.009, 0, 1))
        .clone()
        .add(shotOrigin);
      tr.position.copy(tp);
      tr.scale.setScalar(Math.max(0.05, 1 - i / trail.length));
    });
    const hit = boxes.find((b) => pointInsideBox(pos, b));
    if (hit || t >= 1) {
      projectileGroup.visible = false;
      state.turns = [];
      state.progress = 0;
      rebuildPath();
    }
  }
  updateUI();
  renderer.render(scene, camera);
}
updateUI();
rebuildPath();
loop();
