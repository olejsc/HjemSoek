import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const $ = (id) => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const state = {
  mode: "menu",
  pointerLocked: false,
  yaw: 0,
  pitch: 0,
};

const savedFlyPose = {
  initialized: false,
  position: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
};

const keys = new Set();
const menu = $("menu");
const reticle = $("reticle");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec3d8);
scene.fog = new THREE.Fog(0x9ec3d8, 42, 118);

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  220,
);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$("three").appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcfefff, 0x30451f, 1.55));

const sun = new THREE.DirectionalLight(0xfff2cc, 2.35);
sun.position.set(24, 36, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 95;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120, 32, 32),
  new THREE.MeshStandardMaterial({
    color: 0x4f8f36,
    roughness: 0.96,
    metalness: 0,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(120, 40, 0x6c9c4d, 0x477132);
grid.position.y = 0.018;
scene.add(grid);

function addTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14 * scale, 0.22 * scale, 1.25 * scale, 8),
    new THREE.MeshStandardMaterial({ color: 0x6f4a2a, roughness: 0.9 }),
  );
  trunk.position.y = 0.62 * scale;
  trunk.castShadow = true;
  tree.add(trunk);

  const leaves = [
    [0.86, 1.45],
    [0.68, 2.03],
    [0.48, 2.54],
  ];
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x214f2a,
    roughness: 0.88,
  });
  leaves.forEach(([radius, y], index) => {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(radius * scale, 1.18 * scale, 9),
      leafMaterial,
    );
    crown.position.y = y * scale;
    crown.rotation.y = index * 0.42;
    crown.castShadow = true;
    tree.add(crown);
  });

  scene.add(tree);
}

function addRock(x, z, scale = 1, rotation = 0) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(scale, 0),
    new THREE.MeshStandardMaterial({
      color: 0x6d6a60,
      roughness: 0.98,
      metalness: 0,
    }),
  );
  rock.position.set(x, scale * 0.38, z);
  rock.rotation.set(0.3, rotation, -0.12);
  rock.scale.set(1.25, 0.62, 0.82);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
}

[
  [-20, -16, 1.05],
  [-16, -23, 0.88],
  [-24, 4, 1.18],
  [-18, 17, 0.92],
  [-8, 25, 1.08],
  [13, 23, 1.0],
  [24, 14, 1.2],
  [26, -6, 0.9],
  [18, -23, 1.08],
  [7, -30, 0.95],
  [-29, -3, 0.84],
  [31, 5, 1.02],
].forEach(([x, z, scale]) => addTree(x, z, scale));

[
  [-9, -8, 0.7, 0.4],
  [-13, 9, 0.52, 1.2],
  [10, -10, 0.62, 2.7],
  [15, 4, 0.46, 0.2],
  [3, 15, 0.58, 1.8],
  [-25, -25, 0.82, 2.2],
  [27, -20, 0.72, 0.9],
  [-2, -28, 0.46, 1.6],
].forEach(([x, z, scale, rotation]) => addRock(x, z, scale, rotation));

const stronghold = new THREE.Group();
scene.add(stronghold);

const stoneMaterial = new THREE.MeshStandardMaterial({
  color: 0x8d8677,
  roughness: 0.82,
});
const darkStoneMaterial = new THREE.MeshStandardMaterial({
  color: 0x59554e,
  roughness: 0.88,
});
const roofMaterial = new THREE.MeshStandardMaterial({
  color: 0x354742,
  roughness: 0.78,
});
const doorMaterial = new THREE.MeshStandardMaterial({
  color: 0x3d2818,
  roughness: 0.72,
});

const keep = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.7, 4.2), stoneMaterial);
keep.position.y = 1.35;
keep.castShadow = true;
keep.receiveShadow = true;
stronghold.add(keep);

const keepRoof = new THREE.Mesh(
  new THREE.ConeGeometry(3.25, 1.55, 4),
  roofMaterial,
);
keepRoof.position.y = 3.45;
keepRoof.rotation.y = Math.PI / 4;
keepRoof.castShadow = true;
stronghold.add(keepRoof);

const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.25, 0.08), doorMaterial);
door.position.set(0, 0.66, 2.14);
stronghold.add(door);

const towerOffsets = [
  [-2.35, -2.35],
  [2.35, -2.35],
  [-2.35, 2.35],
  [2.35, 2.35],
];

towerOffsets.forEach(([x, z]) => {
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.72, 3.45, 10),
    darkStoneMaterial,
  );
  tower.position.set(x, 1.72, z);
  tower.castShadow = true;
  tower.receiveShadow = true;
  stronghold.add(tower);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.86, 0.86, 10), roofMaterial);
  roof.position.set(x, 3.88, z);
  roof.castShadow = true;
  stronghold.add(roof);
});

for (let i = 0; i < 8; i++) {
  const crenel = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    darkStoneMaterial,
  );
  const side = i < 4 ? -2.18 : 2.18;
  const offset = -1.65 + (i % 4) * 1.1;
  crenel.position.set(offset, 2.92, side);
  crenel.castShadow = true;
  stronghold.add(crenel);
}

for (let i = 0; i < 8; i++) {
  const crenel = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    darkStoneMaterial,
  );
  const side = i < 4 ? -2.18 : 2.18;
  const offset = -1.65 + (i % 4) * 1.1;
  crenel.position.set(side, 2.92, offset);
  crenel.castShadow = true;
  stronghold.add(crenel);
}

const focusMesh = new THREE.Mesh(
  new THREE.BoxGeometry(5.6, 4.8, 5.6),
  new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  }),
);
focusMesh.position.y = 2.35;
stronghold.add(focusMesh);

function makeLabelSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(9, 16, 12, 0.82)";
  ctx.strokeStyle = "rgba(246, 218, 147, 0.86)";
  ctx.lineWidth = 5;
  ctx.fillRect(34, 24, 444, 132);
  ctx.strokeRect(34, 24, 444, 132);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff6d6";
  ctx.font = "700 52px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Stronghold", 256, 72);
  ctx.fillStyle = "#d7e7bd";
  ctx.font = "600 28px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("level 1", 256, 122);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.scale.set(4.9, 1.85, 1);
  return sprite;
}

const strongholdLabel = makeLabelSprite();
strongholdLabel.position.set(0, 5.25, 0);
strongholdLabel.visible = false;
scene.add(strongholdLabel);

const raycaster = new THREE.Raycaster();

function applyCameraRotation() {
  camera.rotation.set(state.pitch, state.yaw, 0, "YXZ");
}

function setCameraPose(position, target) {
  camera.position.copy(position);
  camera.lookAt(target);
  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
  state.pitch = euler.x;
  state.yaw = euler.y;
  applyCameraRotation();
}

function saveFlyPose() {
  savedFlyPose.initialized = true;
  savedFlyPose.position.copy(camera.position);
  savedFlyPose.yaw = state.yaw;
  savedFlyPose.pitch = state.pitch;
}

function restoreFlyPose() {
  if (savedFlyPose.initialized) {
    camera.position.copy(savedFlyPose.position);
    state.yaw = savedFlyPose.yaw;
    state.pitch = savedFlyPose.pitch;
    applyCameraRotation();
    return;
  }

  setCameraPose(new THREE.Vector3(10, 16, 12), new THREE.Vector3(0, 1.8, 0));
}

function setMode(mode) {
  state.mode = mode;
  document.body.classList.toggle("mode-camera", mode === "camera");
  document.body.classList.toggle("mode-commander", mode === "commander");
  menu.classList.toggle("is-visible", mode === "menu");
  reticle.hidden = mode !== "camera";

  if (mode === "menu") {
    keys.clear();
  }

  if (mode === "commander") {
    keys.clear();
    setCameraPose(new THREE.Vector3(18, 28, 18), new THREE.Vector3(0, 0, 0));
  }
}

function enterCameraMode() {
  restoreFlyPose();
  setMode("camera");
  const lockRequest = renderer.domElement.requestPointerLock?.();
  if (lockRequest && typeof lockRequest.catch === "function") {
    lockRequest.catch(() => {
      setMode("menu");
    });
  }
}

function enterCommanderMode() {
  if (state.mode === "camera") saveFlyPose();
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock?.();
  }
  setMode("commander");
}

$("enterCamera").addEventListener("click", enterCameraMode);
$("enterCommander").addEventListener("click", enterCommanderMode);

document.addEventListener("pointerlockchange", () => {
  state.pointerLocked = document.pointerLockElement === renderer.domElement;
  document.body.classList.toggle(
    "camera-locked",
    state.pointerLocked && state.mode === "camera",
  );

  if (!state.pointerLocked && state.mode === "camera") {
    saveFlyPose();
    setMode("menu");
  }
});

document.addEventListener("mousemove", (event) => {
  if (state.mode !== "camera" || !state.pointerLocked) return;

  state.yaw -= event.movementX * 0.0022;
  state.pitch = clamp(
    state.pitch - event.movementY * 0.0022,
    -Math.PI / 2 + 0.08,
    Math.PI / 2 - 0.18,
  );
  applyCameraRotation();
});

document.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && state.mode === "commander") {
    setMode("menu");
    return;
  }

  if (state.mode !== "camera") return;

  if (
    event.code === "KeyW" ||
    event.code === "KeyA" ||
    event.code === "KeyS" ||
    event.code === "KeyD" ||
    event.code === "Space" ||
    event.code === "ShiftLeft" ||
    event.code === "ShiftRight"
  ) {
    event.preventDefault();
    keys.add(event.code);
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
});

function updateFlyCamera(dt) {
  if (state.mode !== "camera" || !state.pointerLocked) return;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const movement = new THREE.Vector3();

  if (keys.has("KeyW")) movement.add(forward);
  if (keys.has("KeyS")) movement.sub(forward);
  if (keys.has("KeyD")) movement.add(right);
  if (keys.has("KeyA")) movement.sub(right);
  if (keys.has("Space")) movement.y += 1;
  if (keys.has("ShiftLeft") || keys.has("ShiftRight")) movement.y -= 1;

  if (movement.lengthSq() > 0) {
    movement.normalize();
    camera.position.addScaledVector(movement, 12 * dt);
    camera.position.x = clamp(camera.position.x, -48, 48);
    camera.position.y = clamp(camera.position.y, 1.8, 34);
    camera.position.z = clamp(camera.position.z, -48, 48);
  }
}

function updateStrongholdLabel() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const focused = raycaster.intersectObject(focusMesh, false).length > 0;
  strongholdLabel.visible = focused;
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();
restoreFlyPose();
setMode("menu");

const clock = new THREE.Clock();

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);

  updateFlyCamera(dt);
  updateStrongholdLabel();
  renderer.render(scene, camera);
}

loop();
