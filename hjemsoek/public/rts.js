import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const $ = (id) => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const easeOutCubic = (value) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);

const WORKER_BUILD_TIME = 5;
const BUILD_PROGRESS_REQUIRED = 100;
const BUILD_PROGRESS_PER_WORKER = 1;
const DEFAULT_BUILD_COST = { money: 0, crystals: 500 };
const DEFAULT_BUILD_TIME = 100;
const UPGRADE_TIME = 60;
const MAX_WORKERS = 10;
const RTS_MIN_ZOOM = 16;
const RTS_DEFAULT_ZOOM = 30;
const RTS_MAX_ZOOM = 48;
const RTS_VIEW_OFFSET = new THREE.Vector3(0, 0.84, 0.54).normalize();
const RTS_VIEW_HORIZONTAL = Math.hypot(RTS_VIEW_OFFSET.x, RTS_VIEW_OFFSET.z);
const RTS_ORBIT_SENSITIVITY = 0.006;
const TOWER_COST = { money: 1500, crystals: 250 };
const TOWER_UPGRADE_COST = { money: 3000, crystals: 500 };
const GARRISON_COST = { money: 1000, crystals: 1000 };
const BUILD_WORK_RANGE = 1.25;
const BUILDING_OVERLAP_LIMIT = 0.1;
const ROTATION_STEP = Math.PI / 12;
const UI_LIVE_REFRESH_INTERVAL = 0.1;
const CRYSTAL_NODE_AMOUNT = 10000;
const WORKER_CRYSTAL_CAPACITY = 100;
const WORKER_CRYSTAL_MINE_RATE = 10;
const RESOURCE_WORK_RANGE = 1.05;

const BUILDING_HP_BY_TYPE = {
  stronghold: 2400,
  garrisonOutpost: 900,
  guardTower: 650,
  arsenal: 850,
  electricalFactorium: 780,
  magneticFactorium: 780,
  chemicalFactorium: 780,
  monastery: 760,
  researchCenter: 820,
  siegeWorkshop: 980,
  shockTower: 820,
  shieldTower: 900,
  mortarTower: 860,
};

const dep = {
  strongholdLevel: (level) => ({ kind: "strongholdLevel", level }),
  building: (type) => ({ kind: "building", type }),
};

const BUILDING_DEFS = {
  stronghold: {
    name: "Stronghold",
    icon: "SH",
    cost: { money: 0, crystals: 0 },
    deps: [],
    footprint: { width: 6.1, depth: 6.1, height: 5.2 },
  },
  garrisonOutpost: {
    name: "Garrison Outpost",
    shortName: "Garrison",
    icon: "GO",
    cost: GARRISON_COST,
    deps: [dep.strongholdLevel(1)],
    footprint: { width: 4.6, depth: 4.2, height: 2.8 },
  },
  guardTower: {
    name: "Guard Tower",
    shortName: "Tower",
    icon: "GT",
    cost: TOWER_COST,
    deps: [dep.strongholdLevel(1)],
    footprint: { width: 2.6, depth: 2.6, height: 4.8 },
  },
  arsenal: {
    name: "Arsenal",
    icon: "AR",
    cost: DEFAULT_BUILD_COST,
    deps: [dep.strongholdLevel(1)],
    footprint: { width: 4.8, depth: 3.8, height: 3.1 },
  },
  electricalFactorium: {
    name: "Electrical Factorium",
    shortName: "Electrical",
    icon: "EF",
    cost: DEFAULT_BUILD_COST,
    deps: [dep.building("arsenal")],
    footprint: { width: 4.4, depth: 4.2, height: 3.5 },
  },
  magneticFactorium: {
    name: "Magnetic Factorium",
    shortName: "Magnetic",
    icon: "MF",
    cost: DEFAULT_BUILD_COST,
    deps: [dep.building("arsenal")],
    footprint: { width: 4.4, depth: 4.2, height: 3.5 },
  },
  chemicalFactorium: {
    name: "Chemical Factorium",
    shortName: "Chemical",
    icon: "CF",
    cost: DEFAULT_BUILD_COST,
    deps: [dep.building("arsenal")],
    footprint: { width: 4.4, depth: 4.2, height: 3.5 },
  },
  monastery: {
    name: "Monastery",
    icon: "MO",
    cost: DEFAULT_BUILD_COST,
    deps: [dep.building("arsenal")],
    footprint: { width: 4.8, depth: 4.4, height: 4.2 },
  },
  researchCenter: {
    name: "Research Center",
    shortName: "Research",
    icon: "RC",
    cost: DEFAULT_BUILD_COST,
    deps: [dep.building("arsenal")],
    footprint: { width: 4.8, depth: 4.4, height: 3.8 },
  },
  siegeWorkshop: {
    name: "Siege Workshop",
    shortName: "Siege",
    icon: "SW",
    cost: DEFAULT_BUILD_COST,
    deps: [dep.building("arsenal"), dep.strongholdLevel(2)],
    footprint: { width: 5.8, depth: 4.4, height: 3.5 },
  },
  shockTower: {
    name: "Shock Tower",
    icon: "ST",
    cost: TOWER_UPGRADE_COST,
    deps: [],
    footprint: { width: 2.8, depth: 2.8, height: 5.4 },
  },
  shieldTower: {
    name: "Shield Tower",
    icon: "SD",
    cost: TOWER_UPGRADE_COST,
    deps: [],
    footprint: { width: 3.0, depth: 3.0, height: 5.1 },
  },
  mortarTower: {
    name: "Mortar Tower",
    icon: "MT",
    cost: TOWER_UPGRADE_COST,
    deps: [],
    footprint: { width: 3.2, depth: 3.2, height: 5.0 },
  },
};

const WORKER_BUILD_ORDER = [
  "garrisonOutpost",
  "guardTower",
  "arsenal",
  "electricalFactorium",
  "magneticFactorium",
  "chemicalFactorium",
  "monastery",
  "researchCenter",
  "siegeWorkshop",
];

const UPGRADE_DEFS = {
  stronghold2: {
    name: "Stronghold Level 2",
    shortName: "Level II",
    icon: "II",
    cost: DEFAULT_BUILD_COST,
    time: UPGRADE_TIME,
    appliesTo: "stronghold",
    fromLevel: 1,
    targetLevel: 2,
    deps: [dep.strongholdLevel(1), dep.building("arsenal")],
  },
  stronghold3: {
    name: "Stronghold Level 3",
    shortName: "Level III",
    icon: "III",
    cost: DEFAULT_BUILD_COST,
    time: UPGRADE_TIME,
    appliesTo: "stronghold",
    fromLevel: 2,
    targetLevel: 3,
    deps: [
      dep.strongholdLevel(2),
      dep.building("siegeWorkshop"),
      dep.building("researchCenter"),
    ],
  },
  shockTower: {
    name: "Shock Tower",
    icon: "ST",
    cost: TOWER_UPGRADE_COST,
    time: UPGRADE_TIME,
    appliesTo: "guardTower",
    targetType: "shockTower",
    deps: [dep.strongholdLevel(2), dep.building("electricalFactorium")],
  },
  shieldTower: {
    name: "Shield Tower",
    icon: "SD",
    cost: TOWER_UPGRADE_COST,
    time: UPGRADE_TIME,
    appliesTo: "guardTower",
    targetType: "shieldTower",
    deps: [dep.strongholdLevel(2), dep.building("magneticFactorium")],
  },
  mortarTower: {
    name: "Mortar Tower",
    icon: "MT",
    cost: TOWER_UPGRADE_COST,
    time: UPGRADE_TIME,
    appliesTo: "guardTower",
    targetType: "mortarTower",
    deps: [dep.strongholdLevel(2), dep.building("chemicalFactorium")],
  },
};

const state = {
  mode: "menu",
  pointerLocked: false,
  yaw: 0,
  pitch: 0,
  selectedWorkerIds: new Set(),
  selectedBuildingId: null,
  hoveredBuildingId: null,
  placement: null,
  selectionDrag: null,
  elapsed: 0,
  uiDirty: true,
  nextLiveUiRefresh: 0,
  liveUiKey: "",
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
const resourceHud = $("resourceHud");
const commandPanel = $("commandPanel");
const commandTitle = $("commandTitle");
const commandStatus = $("commandStatus");
const commandGrid = $("commandGrid");
const queuePanel = $("queuePanel");
const selectionBox = $("selectionBox");
const moneyValue = $("moneyValue");
const crystalsValue = $("crystalsValue");
const workersValue = $("workersValue");
const queueCount = $("queueCount");
const queueSlots = $("queueSlots");
const queueProgressFill = $("queueProgressFill");
const queueSlotElements = [];
const commandButtons = [];

for (let i = 0; i < 9; i++) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "command-cell is-empty";
  button.disabled = true;
  button.setAttribute("aria-label", "Empty slot");
  commandGrid.appendChild(button);
  commandButtons.push(button);
}

for (let i = 0; i < MAX_WORKERS; i++) {
  const slot = document.createElement("div");
  slot.className = "queue-slot";
  queueSlots.appendChild(slot);
  queueSlotElements.push(slot);
}

const economy = {
  money: 10000,
  crystals: 2000,
  queue: [],
  progress: 0,
};

const rtsCamera = {
  target: new THREE.Vector3(0, 0, 0),
  zoom: RTS_DEFAULT_ZOOM,
  orbitYaw: 0,
  transition: null,
  drag: {
    active: false,
    anchor: new THREE.Vector3(),
  },
  orbitDrag: {
    active: false,
    lastX: 0,
  },
};

const workers = [];
const buildings = [];
const crystalResources = [];
const selectableMeshes = [];
let nextWorkerId = 1;
let nextBuildingId = 1;
let nextResourceId = 1;
let activeConstructionCount = 0;
let lastPointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
};

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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$("three").appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcfefff, 0x30451f, 1.55));

const sun = new THREE.DirectionalLight(0xfff2cc, 2.35);
sun.position.set(24, 36, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
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

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tempVector = new THREE.Vector3();
const shadowSize = new THREE.Vector3();
const pointerNdc = new THREE.Vector2();
const groundHitPoint = new THREE.Vector3();
const rtsCameraPosition = new THREE.Vector3();
const rtsMovement = new THREE.Vector3();
const rtsForward = new THREE.Vector3(0, 0, -1);
const rtsRight = new THREE.Vector3(1, 0, 0);
const flyForward = new THREE.Vector3();
const flyRight = new THREE.Vector3();
const flyMovement = new THREE.Vector3();
const workerDelta = new THREE.Vector3();
const panDelta = new THREE.Vector3();
const placementCandidateBox = {};

function createMaterial(color, roughness = 0.82) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
  });
}

function getScaledGeometrySize(geometry, scale) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  geometry.boundingBox.getSize(shadowSize);
  if (scale) {
    shadowSize.set(
      shadowSize.x * Math.abs(scale[0]),
      shadowSize.y * Math.abs(scale[1]),
      shadowSize.z * Math.abs(scale[2]),
    );
  }
  return shadowSize;
}

function addVisualMesh(group, geometry, color, position, options = {}) {
  const mesh = new THREE.Mesh(
    geometry,
    createMaterial(color, options.roughness ?? 0.82),
  );
  mesh.position.set(position[0], position[1], position[2]);
  if (options.rotation) {
    mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
  }
  if (options.scale) {
    mesh.scale.set(options.scale[0], options.scale[1], options.scale[2]);
  }
  const size = getScaledGeometrySize(geometry, options.scale);
  mesh.castShadow =
    options.castShadow ??
    (Math.max(size.x, size.y, size.z) >= 0.65 && size.y >= 0.2);
  mesh.receiveShadow =
    options.receiveShadow ?? (Math.max(size.x, size.z) >= 1.2 && size.y >= 0.35);
  mesh.userData.visualMesh = true;
  group.add(mesh);
  return mesh;
}

function addTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);

  addVisualMesh(
    tree,
    new THREE.CylinderGeometry(0.14 * scale, 0.22 * scale, 1.25 * scale, 8),
    0x6f4a2a,
    [0, 0.62 * scale, 0],
    { roughness: 0.9 },
  );

  const leaves = [
    [0.86, 1.45],
    [0.68, 2.03],
    [0.48, 2.54],
  ];
  leaves.forEach(([radius, y], index) => {
    addVisualMesh(
      tree,
      new THREE.ConeGeometry(radius * scale, 1.18 * scale, 9),
      0x214f2a,
      [0, y * scale, 0],
      { rotation: [0, index * 0.42, 0], roughness: 0.88 },
    );
  });

  scene.add(tree);
}

function addRock(x, z, scale = 1, rotation = 0) {
  const rock = addVisualMesh(
    scene,
    new THREE.DodecahedronGeometry(scale, 0),
    0x6d6a60,
    [x, scale * 0.38, z],
    {
      rotation: [0.3, rotation, -0.12],
      scale: [1.25, 0.62, 0.82],
      roughness: 0.98,
    },
  );
  rock.castShadow = true;
  rock.receiveShadow = true;
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

function registerSelectable(mesh, kind, id) {
  mesh.userData.selectable = { kind, id };
  selectableMeshes.push(mesh);
}

function unregisterSelectable(mesh) {
  const index = selectableMeshes.indexOf(mesh);
  if (index !== -1) selectableMeshes.splice(index, 1);
}

function getBuildingDef(type) {
  return BUILDING_DEFS[type];
}

function getBuildingFootprint(type, level = 1) {
  const base = getBuildingDef(type).footprint;
  if (type !== "stronghold") return base;
  return {
    width: base.width + (level - 1) * 0.3,
    depth: base.depth + (level - 1) * 0.3,
    height: base.height + (level - 1) * 0.75,
  };
}

function makeSelectionRing(radius, color = 0xf7d984, opacity = 0.86, width = 0.12) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + width, 72),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.055;
  ring.visible = false;
  return ring;
}

function createFocusMesh(footprint) {
  const focusMesh = new THREE.Mesh(
    new THREE.BoxGeometry(footprint.width, footprint.height, footprint.depth),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    }),
  );
  focusMesh.position.y = footprint.height / 2;
  return focusMesh;
}

function addCrystalResourceVisual(group) {
  addVisualMesh(
    group,
    new THREE.DodecahedronGeometry(1.0, 0),
    0x7fd8ff,
    [0, 0.45, 0],
    {
      rotation: [0.12, 0.45, -0.08],
      scale: [1.45, 0.66, 1.05],
      roughness: 0.38,
    },
  );
  addVisualMesh(
    group,
    new THREE.ConeGeometry(0.48, 1.28, 6),
    0xbcefff,
    [-0.72, 0.78, -0.16],
    { rotation: [0.18, -0.32, 0.34], roughness: 0.32 },
  );
  addVisualMesh(
    group,
    new THREE.ConeGeometry(0.58, 1.48, 6),
    0x8fe0ff,
    [0.18, 0.9, 0.15],
    { rotation: [-0.12, 0.18, -0.22], roughness: 0.3 },
  );
  addVisualMesh(
    group,
    new THREE.ConeGeometry(0.4, 1.05, 6),
    0xd8f8ff,
    [0.86, 0.66, -0.08],
    { rotation: [0.22, 0.62, -0.28], roughness: 0.28 },
  );
}

function createCrystalResource(position) {
  const id = nextResourceId++;
  const footprint = { width: 3.1, depth: 2.7, height: 1.7 };
  const group = new THREE.Group();
  group.position.copy(position);
  addCrystalResourceVisual(group);

  const focusMesh = createFocusMesh(footprint);
  registerSelectable(focusMesh, "resource", id);
  group.add(focusMesh);

  const resource = {
    id,
    type: "crystals",
    amount: CRYSTAL_NODE_AMOUNT,
    position: position.clone(),
    radius: Math.max(footprint.width, footprint.depth) / 2,
    box: writeRectBox(
      {},
      footprint.width,
      footprint.depth,
      footprint.height,
      position,
      0,
    ),
    group,
    focusMesh,
    depleted: false,
  };
  crystalResources.push(resource);
  scene.add(group);
  return resource;
}

function addStrongholdVisual(group, level = 1) {
  const keepHeight = 2.7 + level * 0.32;
  addVisualMesh(
    group,
    new THREE.BoxGeometry(4.2 + level * 0.22, keepHeight, 4.2 + level * 0.22),
    0x8d8677,
    [0, keepHeight / 2, 0],
  );
  addVisualMesh(
    group,
    new THREE.ConeGeometry(3.25 + level * 0.12, 1.55, 4),
    0x354742,
    [0, keepHeight + 0.78, 0],
    { rotation: [0, Math.PI / 4, 0], roughness: 0.78 },
  );
  addVisualMesh(
    group,
    new THREE.BoxGeometry(0.9, 1.25, 0.08),
    0x3d2818,
    [0, 0.66, 2.18 + level * 0.08],
    { roughness: 0.72 },
  );

  [
    [-2.35, -2.35],
    [2.35, -2.35],
    [-2.35, 2.35],
    [2.35, 2.35],
  ].forEach(([x, z]) => {
    const towerHeight = 3.35 + level * 0.36;
    addVisualMesh(
      group,
      new THREE.CylinderGeometry(0.62, 0.72, towerHeight, 10),
      0x59554e,
      [x, towerHeight / 2, z],
      { roughness: 0.88 },
    );
    addVisualMesh(
      group,
      new THREE.ConeGeometry(0.86, 0.86, 10),
      0x354742,
      [x, towerHeight + 0.43, z],
      { roughness: 0.78 },
    );
  });

  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -2.18 : 2.18;
    const offset = -1.65 + (i % 4) * 1.1;
    addVisualMesh(
      group,
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      0x59554e,
      [offset, keepHeight + 0.34, side],
      { roughness: 0.88 },
    );
    addVisualMesh(
      group,
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      0x59554e,
      [side, keepHeight + 0.34, offset],
      { roughness: 0.88 },
    );
  }

  if (level >= 2) {
    addVisualMesh(
      group,
      new THREE.BoxGeometry(2.7, 1.05, 2.7),
      0xa8a092,
      [0, keepHeight + 0.65, 0],
    );
    addVisualMesh(
      group,
      new THREE.CylinderGeometry(0.16, 0.16, 1.8, 8),
      0x4d3422,
      [0, keepHeight + 1.95, 0],
      { roughness: 0.7 },
    );
  }

  if (level >= 3) {
    addVisualMesh(
      group,
      new THREE.SphereGeometry(0.38, 20, 12),
      0xf7d984,
      [0, keepHeight + 2.95, 0],
      { roughness: 0.48 },
    );
    addVisualMesh(
      group,
      new THREE.BoxGeometry(0.16, 0.9, 0.74),
      0x9e1b32,
      [0.45, keepHeight + 2.45, 0],
      { roughness: 0.64 },
    );
  }
}

function addTowerVisual(group, type) {
  const colorByType = {
    guardTower: 0x54565f,
    shockTower: 0x315f93,
    shieldTower: 0x49786f,
    mortarTower: 0x705d48,
  };
  const accentByType = {
    guardTower: 0x2f3d3a,
    shockTower: 0x9fd8ff,
    shieldTower: 0xa7e8c5,
    mortarTower: 0xdaa15d,
  };
  const height = type === "guardTower" ? 3.9 : 4.35;
  const radius = type === "mortarTower" ? 0.86 : 0.72;

  addVisualMesh(
    group,
    new THREE.CylinderGeometry(radius * 0.82, radius, height, 12),
    colorByType[type],
    [0, height / 2, 0],
    { roughness: 0.86 },
  );

  if (type === "mortarTower") {
    addVisualMesh(
      group,
      new THREE.CylinderGeometry(0.2, 0.2, 1.15, 12),
      0x2d2924,
      [0, height + 0.46, 0.18],
      { rotation: [Math.PI / 2.7, 0, 0], roughness: 0.72 },
    );
  } else {
    addVisualMesh(
      group,
      new THREE.ConeGeometry(radius * 1.2, 0.86, 12),
      accentByType[type],
      [0, height + 0.43, 0],
      { roughness: 0.7 },
    );
  }

  if (type === "shockTower") {
    addVisualMesh(
      group,
      new THREE.TorusGeometry(0.72, 0.055, 8, 24),
      0xbdeaff,
      [0, height + 1.08, 0],
      { rotation: [Math.PI / 2, 0, 0], roughness: 0.5 },
    );
  }

  if (type === "shieldTower") {
    addVisualMesh(
      group,
      new THREE.SphereGeometry(1.02, 24, 12),
      0x7bd6b3,
      [0, height + 0.22, 0],
      { roughness: 0.38 },
    ).material.opacity = 0.34;
    group.children[group.children.length - 1].material.transparent = true;
  }
}

function addGarrisonVisual(group) {
  addVisualMesh(group, new THREE.BoxGeometry(3.6, 1.45, 3.1), 0x7c6f5c, [0, 0.72, 0]);
  addVisualMesh(
    group,
    new THREE.ConeGeometry(2.65, 1.1, 4),
    0x49604e,
    [0, 2.0, 0],
    { rotation: [0, Math.PI / 4, 0], roughness: 0.78 },
  );
  addVisualMesh(group, new THREE.BoxGeometry(1.3, 0.9, 0.12), 0x3d2818, [0, 0.48, 1.6]);
  addVisualMesh(group, new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), 0x4a2f1e, [-1.45, 0.6, 1.66]);
  addVisualMesh(group, new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), 0x4a2f1e, [1.45, 0.6, 1.66]);
}

function addArsenalVisual(group) {
  addVisualMesh(group, new THREE.BoxGeometry(4.2, 1.8, 3.1), 0x685f56, [0, 0.9, 0]);
  addVisualMesh(
    group,
    new THREE.ConeGeometry(3.0, 1.1, 4),
    0x3f4d4a,
    [0, 2.35, 0],
    { rotation: [0, Math.PI / 4, 0], roughness: 0.76 },
  );
  addVisualMesh(group, new THREE.BoxGeometry(0.16, 1.8, 0.16), 0x262421, [-1.65, 1.05, 1.15]);
  addVisualMesh(group, new THREE.BoxGeometry(0.16, 1.8, 0.16), 0x262421, [1.65, 1.05, 1.15]);
}

function addFactoriumVisual(group, type) {
  const accent = {
    electricalFactorium: 0x67c7ff,
    magneticFactorium: 0xd2a1ff,
    chemicalFactorium: 0x8ce36b,
  }[type];
  const wall = {
    electricalFactorium: 0x52606f,
    magneticFactorium: 0x5d536d,
    chemicalFactorium: 0x58694d,
  }[type];

  addVisualMesh(group, new THREE.BoxGeometry(3.8, 1.8, 3.35), wall, [0, 0.9, 0]);
  addVisualMesh(group, new THREE.BoxGeometry(2.7, 0.8, 2.3), 0x383d3b, [0, 2.2, 0]);
  addVisualMesh(group, new THREE.CylinderGeometry(0.28, 0.34, 1.65, 10), 0x2c2d2b, [1.35, 3.05, -0.88]);
  addVisualMesh(group, new THREE.SphereGeometry(0.36, 18, 10), accent, [-1.05, 2.88, 0.95], {
    roughness: 0.42,
  });
  addVisualMesh(
    group,
    new THREE.TorusGeometry(0.62, 0.045, 8, 24),
    accent,
    [-1.05, 2.88, 0.95],
    { rotation: [Math.PI / 2, 0, 0], roughness: 0.42 },
  );
}

function addMonasteryVisual(group) {
  addVisualMesh(group, new THREE.BoxGeometry(3.8, 2.0, 3.4), 0x827966, [0, 1.0, 0]);
  addVisualMesh(
    group,
    new THREE.ConeGeometry(2.65, 1.18, 4),
    0x4d4c5c,
    [0, 2.58, 0],
    { rotation: [0, Math.PI / 4, 0], roughness: 0.76 },
  );
  addVisualMesh(group, new THREE.CylinderGeometry(0.34, 0.44, 1.65, 8), 0x6c6457, [0, 3.24, -1.14]);
  addVisualMesh(group, new THREE.ConeGeometry(0.58, 0.9, 8), 0x4d4c5c, [0, 4.52, -1.14]);
}

function addResearchVisual(group) {
  addVisualMesh(group, new THREE.BoxGeometry(3.9, 1.7, 3.4), 0x596770, [0, 0.85, 0]);
  addVisualMesh(group, new THREE.SphereGeometry(1.32, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0x9bbbc7, [
    0,
    1.7,
    0,
  ]);
  addVisualMesh(
    group,
    new THREE.TorusGeometry(1.25, 0.055, 8, 32),
    0xe5d8a3,
    [0, 2.08, 0],
    { rotation: [Math.PI / 2, 0, 0] },
  );
  addVisualMesh(group, new THREE.CylinderGeometry(0.16, 0.16, 1.3, 10), 0x2f3336, [1.45, 1.28, -1.05]);
}

function addSiegeWorkshopVisual(group) {
  addVisualMesh(group, new THREE.BoxGeometry(5.0, 1.6, 3.5), 0x6d6254, [0, 0.8, 0]);
  addVisualMesh(
    group,
    new THREE.ConeGeometry(3.3, 1.15, 4),
    0x3f4d4a,
    [0, 2.18, 0],
    { rotation: [0, Math.PI / 4, 0], roughness: 0.76 },
  );
  addVisualMesh(group, new THREE.BoxGeometry(0.22, 2.7, 0.22), 0x47351f, [2.15, 1.85, -1.1]);
  addVisualMesh(group, new THREE.BoxGeometry(1.7, 0.16, 0.16), 0x47351f, [1.42, 3.18, -1.1]);
  addVisualMesh(group, new THREE.BoxGeometry(0.14, 0.74, 0.14), 0x2b231b, [0.6, 2.78, -1.1]);
}

function createBuildingModel(type, level = 1) {
  const group = new THREE.Group();

  if (type === "stronghold") addStrongholdVisual(group, level);
  if (
    type === "guardTower" ||
    type === "shockTower" ||
    type === "shieldTower" ||
    type === "mortarTower"
  ) {
    addTowerVisual(group, type);
  }
  if (type === "garrisonOutpost") addGarrisonVisual(group);
  if (type === "arsenal") addArsenalVisual(group);
  if (
    type === "electricalFactorium" ||
    type === "magneticFactorium" ||
    type === "chemicalFactorium"
  ) {
    addFactoriumVisual(group, type);
  }
  if (type === "monastery") addMonasteryVisual(group);
  if (type === "researchCenter") addResearchVisual(group);
  if (type === "siegeWorkshop") addSiegeWorkshopVisual(group);

  return group;
}

function setVisualOpacity(group, opacity) {
  group.traverse((child) => {
    if (!child.isMesh || !child.userData.visualMesh) return;
    child.material.transparent = opacity < 1;
    child.material.opacity = opacity;
    child.material.depthWrite = opacity >= 1;
  });
}

function createBuildingEntity(type, position, rotationY = 0, options = {}) {
  const building = {
    id: nextBuildingId++,
    type,
    level: options.level ?? 1,
    position: position.clone(),
    rotationY,
    completed: options.completed ?? false,
    progress: options.completed ? BUILD_PROGRESS_REQUIRED : 0,
    buildSeconds: options.buildSeconds ?? DEFAULT_BUILD_TIME,
    assignedWorkerIds: new Set(),
    upgrade: null,
    group: null,
    focusMesh: null,
    selectionRing: null,
    hoverRing: null,
    progressBar: null,
    footprint: null,
    box: null,
  };
  building.maxHp = options.maxHp ?? getBuildingMaxHp(building.type, building.level);
  building.hp = options.hp ?? building.maxHp;

  installBuildingGroup(building);
  if (!building.completed) {
    activeConstructionCount += 1;
    createConstructionProgressBar(building);
  }
  buildings.push(building);
  return building;
}

function installBuildingGroup(building) {
  const footprint = getBuildingFootprint(building.type, building.level);
  const group = createBuildingModel(building.type, building.level);
  group.position.copy(building.position);
  group.rotation.y = building.rotationY;

  const focusMesh = createFocusMesh(footprint);
  registerSelectable(focusMesh, "building", building.id);
  group.add(focusMesh);

  const radius = Math.max(footprint.width, footprint.depth) * 0.57;
  const ring = makeSelectionRing(radius);
  group.add(ring);

  const hoverRing = makeSelectionRing(radius + 0.18, 0x8fe0ff, 0.9, 0.14);
  group.add(hoverRing);

  building.group = group;
  building.focusMesh = focusMesh;
  building.selectionRing = ring;
  building.hoverRing = hoverRing;
  building.footprint = footprint;
  building.box = writeFootprintBox(
    building.box ?? {},
    building.type,
    building.level,
    building.position,
    building.rotationY,
  );

  setVisualOpacity(group, building.completed ? 1 : 0.45);
  scene.add(group);
}

function replaceBuildingVisual(building) {
  if (building.focusMesh) unregisterSelectable(building.focusMesh);
  if (building.group) scene.remove(building.group);
  installBuildingGroup(building);
  syncSelectionVisuals();
}

function createConstructionProgressBar(building) {
  if (building.progressBar) return;

  const group = new THREE.Group();
  group.renderOrder = 50;

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(2.35, 0.28),
    new THREE.MeshBasicMaterial({
      color: 0x07100b,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
      depthWrite: false,
    }),
  );

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(2.05, 0.16),
    new THREE.MeshBasicMaterial({
      color: 0xf7d984,
      transparent: true,
      opacity: 0.94,
      depthTest: false,
      depthWrite: false,
    }),
  );

  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 0.42),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      depthTest: false,
      depthWrite: false,
      wireframe: true,
    }),
  );

  group.add(background, fill, frame);
  building.progressBar = { group, fill };
  scene.add(group);
  updateConstructionProgressBar(building);
}

function removeConstructionProgressBar(building) {
  if (!building.progressBar) return;
  scene.remove(building.progressBar.group);
  building.progressBar = null;
}

function updateConstructionProgressBar(building) {
  if (!building.progressBar) return;

  const progress = clamp(building.progress / BUILD_PROGRESS_REQUIRED, 0, 1);
  const fillWidth = 2.05;
  building.progressBar.group.position.copy(building.position);
  building.progressBar.group.position.y = building.footprint.height + 0.72;
  building.progressBar.group.quaternion.copy(camera.quaternion);
  building.progressBar.fill.scale.x = Math.max(progress, 0.001);
  building.progressBar.fill.position.x = (-fillWidth + fillWidth * progress) / 2;
}

function updateConstructionProgressBars() {
  if (activeConstructionCount === 0) return;

  buildings.forEach((building) => {
    if (building.completed) {
      removeConstructionProgressBar(building);
      return;
    }
    if (!building.progressBar) createConstructionProgressBar(building);
    updateConstructionProgressBar(building);
  });
}

function buildingDisplayName(building) {
  if (building.type === "stronghold") return `Stronghold Level ${building.level}`;
  return getBuildingDef(building.type).name;
}

function getBuildingMaxHp(type, level = 1) {
  return (BUILDING_HP_BY_TYPE[type] ?? 700) + (type === "stronghold" ? (level - 1) * 650 : 0);
}

function buildingStatusText(building) {
  const hpText = `HP ${Math.ceil(building.hp)} / ${building.maxHp}`;
  if (!building.completed) return `${hpText} - construction ${Math.floor(building.progress)}%`;
  if (building.upgrade) {
    const upgrade = UPGRADE_DEFS[building.upgrade.id];
    return `${hpText} - ${upgrade.name} ${Math.floor(
      (building.upgrade.elapsed / building.upgrade.time) * 100,
    )}%`;
  }
  return hpText;
}

function dependencyLabel(requirement) {
  if (requirement.kind === "strongholdLevel") {
    return `Stronghold Level ${requirement.level}`;
  }
  return getBuildingDef(requirement.type).name;
}

function hasCompletedBuilding(type) {
  return buildings.some((building) => building.completed && building.type === type);
}

function hasStrongholdLevel(level) {
  return buildings.some(
    (building) =>
      building.completed && building.type === "stronghold" && building.level >= level,
  );
}

function isDependencyMet(requirement) {
  if (requirement.kind === "strongholdLevel") {
    return hasStrongholdLevel(requirement.level);
  }
  return hasCompletedBuilding(requirement.type);
}

function getMissingDependencies(requirements) {
  return requirements.filter((requirement) => !isDependencyMet(requirement));
}

function canAfford(cost) {
  return economy.money >= cost.money && economy.crystals >= cost.crystals;
}

function spendCost(cost) {
  if (!canAfford(cost)) return false;
  economy.money -= cost.money;
  economy.crystals -= cost.crystals;
  return true;
}

function costText(cost) {
  const parts = [];
  if (cost.money > 0) parts.push(`${cost.money} money`);
  if (cost.crystals > 0) parts.push(`${cost.crystals} crystals`);
  return parts.length > 0 ? parts.join(" / ") : "Free";
}

function actionTitle(name, cost, deps, extra = "") {
  const lines = [name, `Cost: ${costText(cost)}`];
  if (deps.length > 0) {
    lines.push(`Requires: ${deps.map(dependencyLabel).join(", ")}`);
  }
  const missing = getMissingDependencies(deps);
  if (missing.length > 0) {
    lines.push(`Missing: ${missing.map(dependencyLabel).join(", ")}`);
  }
  if (extra) lines.push(extra);
  return lines.join("\n");
}

const labelCanvas = document.createElement("canvas");
labelCanvas.width = 512;
labelCanvas.height = 192;
const labelContext = labelCanvas.getContext("2d");
const labelTexture = new THREE.CanvasTexture(labelCanvas);
labelTexture.colorSpace = THREE.SRGBColorSpace;
const selectionLabel = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: labelTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  }),
);
selectionLabel.scale.set(5.7, 2.1, 1);
selectionLabel.visible = false;
scene.add(selectionLabel);
let labelCache = "";

function setSelectionLabel(title, subtitle) {
  const key = `${title}|${subtitle}`;
  if (key === labelCache) return;
  labelCache = key;

  labelContext.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
  labelContext.fillStyle = "rgba(9, 16, 12, 0.82)";
  labelContext.strokeStyle = "rgba(246, 218, 147, 0.86)";
  labelContext.lineWidth = 5;
  labelContext.fillRect(34, 24, 444, 132);
  labelContext.strokeRect(34, 24, 444, 132);

  labelContext.textAlign = "center";
  labelContext.textBaseline = "middle";
  labelContext.fillStyle = "#fff6d6";
  labelContext.font = "700 46px system-ui, -apple-system, Segoe UI, sans-serif";
  labelContext.fillText(title, 256, 72, 410);
  labelContext.fillStyle = "#d7e7bd";
  labelContext.font = "600 28px system-ui, -apple-system, Segoe UI, sans-serif";
  labelContext.fillText(subtitle, 256, 122, 410);
  labelTexture.needsUpdate = true;
}

function pointerToNdc(clientX, clientY) {
  pointerNdc.set(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1,
  );
  return pointerNdc;
}

function raycastGround(clientX, clientY, out = groundHitPoint) {
  raycaster.setFromCamera(pointerToNdc(clientX, clientY), camera);
  return raycaster.ray.intersectPlane(groundPlane, out);
}

function getSelectableHit(clientX, clientY) {
  raycaster.setFromCamera(pointerToNdc(clientX, clientY), camera);
  const hits = raycaster.intersectObjects(selectableMeshes, false);
  if (hits.length === 0) return null;
  return hits[0].object.userData.selectable;
}

function isUiTarget(target) {
  return (
    target instanceof Element &&
    target.closest(
      "button,input,label,select,textarea,.menu,.resource-hud,.command-panel,.queue-panel",
    )
  );
}

function computeRtsCameraPosition(
  target = rtsCamera.target,
  zoom = rtsCamera.zoom,
  out = new THREE.Vector3(),
) {
  const sin = Math.sin(rtsCamera.orbitYaw);
  const cos = Math.cos(rtsCamera.orbitYaw);
  return out.set(
    target.x + sin * RTS_VIEW_HORIZONTAL * zoom,
    target.y + RTS_VIEW_OFFSET.y * zoom,
    target.z + cos * RTS_VIEW_HORIZONTAL * zoom,
  );
}

function applyRtsCameraPose() {
  camera.position.copy(
    computeRtsCameraPosition(rtsCamera.target, rtsCamera.zoom, rtsCameraPosition),
  );
  camera.lookAt(rtsCamera.target);
}

function beginRtsCameraTransition() {
  const target = new THREE.Vector3(0, 0, 0);
  const zoom = RTS_DEFAULT_ZOOM;
  const finalPosition = computeRtsCameraPosition(target, zoom);
  const finalPose = new THREE.Object3D();

  finalPose.position.copy(finalPosition);
  finalPose.lookAt(target);

  rtsCamera.target.copy(target);
  rtsCamera.zoom = zoom;
  rtsCamera.transition = {
    elapsed: 0,
    duration: 0.85,
    startPosition: camera.position.clone(),
    startQuaternion: camera.quaternion.clone(),
    finalPosition,
    finalQuaternion: finalPose.quaternion.clone(),
  };
}

function updateRtsCamera(dt) {
  if (state.mode !== "commander") return;

  const transition = rtsCamera.transition;
  if (transition) {
    transition.elapsed += dt;
    const amount = easeOutCubic(transition.elapsed / transition.duration);
    camera.position.lerpVectors(
      transition.startPosition,
      transition.finalPosition,
      amount,
    );
    camera.quaternion.slerpQuaternions(
      transition.startQuaternion,
      transition.finalQuaternion,
      amount,
    );
    if (amount >= 1) {
      rtsCamera.transition = null;
      applyRtsCameraPose();
    }
    return;
  }

  const movement = rtsMovement.set(0, 0, 0);

  if (keys.has("KeyW")) movement.add(rtsForward);
  if (keys.has("KeyS")) movement.sub(rtsForward);
  if (keys.has("KeyD")) movement.add(rtsRight);
  if (keys.has("KeyA")) movement.sub(rtsRight);

  if (movement.lengthSq() > 0) {
    movement.normalize();
    rtsCamera.target.addScaledVector(movement, 18 * dt);
    rtsCamera.target.x = clamp(rtsCamera.target.x, -46, 46);
    rtsCamera.target.z = clamp(rtsCamera.target.z, -46, 46);
  }

  applyRtsCameraPose();
}

function getWorker(id) {
  return workers.find((worker) => worker.id === id) ?? null;
}

function getBuilding(id) {
  return buildings.find((building) => building.id === id) ?? null;
}

function getCrystalResource(id) {
  return crystalResources.find((resource) => resource.id === id) ?? null;
}

function getSelectedWorkers() {
  return [...state.selectedWorkerIds]
    .map((id) => getWorker(id))
    .filter((worker) => worker !== null);
}

function getSelectedBuilding() {
  if (state.selectedBuildingId === null) return null;
  return getBuilding(state.selectedBuildingId);
}

function getHoveredBuilding() {
  if (state.hoveredBuildingId === null) return null;
  return getBuilding(state.hoveredBuildingId);
}

function syncSelectionVisuals() {
  workers.forEach((worker) => {
    worker.selected = state.selectedWorkerIds.has(worker.id);
    worker.selectionRing.visible = worker.selected;
  });

  buildings.forEach((building) => {
    building.selectionRing.visible = state.selectedBuildingId === building.id;
    building.hoverRing.visible =
      state.selectedWorkerIds.size > 0 && state.hoveredBuildingId === building.id;
  });
}

function setHoveredBuilding(buildingId) {
  if (state.hoveredBuildingId === buildingId) return;
  state.hoveredBuildingId = buildingId;
  syncSelectionVisuals();
}

function clearSelection() {
  state.selectedWorkerIds.clear();
  state.selectedBuildingId = null;
  syncSelectionVisuals();
  updateRtsUi();
}

function selectOnlyWorker(workerId) {
  state.selectedBuildingId = null;
  state.selectedWorkerIds.clear();
  state.selectedWorkerIds.add(workerId);
  syncSelectionVisuals();
  updateRtsUi();
}

function toggleWorkerSelection(workerId) {
  state.selectedBuildingId = null;
  if (state.selectedWorkerIds.has(workerId)) {
    state.selectedWorkerIds.delete(workerId);
  } else {
    state.selectedWorkerIds.add(workerId);
  }
  syncSelectionVisuals();
  updateRtsUi();
}

function selectBuilding(buildingId) {
  state.selectedWorkerIds.clear();
  state.selectedBuildingId = buildingId;
  setHoveredBuilding(null);
  syncSelectionVisuals();
  updateRtsUi();
}

function makeWorkerUnit(index) {
  const id = nextWorkerId++;
  const workerGroup = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.3, 0.82, 10),
    createMaterial(0x315f7c, 0.72),
  );
  body.position.y = 0.48;
  body.castShadow = true;
  registerSelectable(body, "worker", id);
  workerGroup.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 12),
    createMaterial(0xd7a46d, 0.68),
  );
  head.position.y = 1.04;
  head.castShadow = true;
  registerSelectable(head, "worker", id);
  workerGroup.add(head);

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    createMaterial(0xf1c84b, 0.62),
  );
  helmet.position.y = 1.12;
  helmet.castShadow = true;
  registerSelectable(helmet, "worker", id);
  workerGroup.add(helmet);

  const ring = makeSelectionRing(0.52);
  workerGroup.add(ring);

  const column = (index % 5) - 2;
  const row = Math.floor(index / 5);
  workerGroup.position.set(column * 0.78, 0, 5.35 + row * 0.82);
  workerGroup.rotation.y = Math.PI;
  scene.add(workerGroup);

  const worker = {
    id,
    group: workerGroup,
    head,
    baseHeadY: head.position.y,
    selectionRing: ring,
    target: null,
    buildTargetId: null,
    miningResourceId: null,
    miningState: null,
    depositTargetId: null,
    cargoCrystals: 0,
    mineProgress: 0,
    working: false,
    speed: 4.2,
    selected: false,
  };
  workers.push(worker);
  return worker;
}

function canQueueWorker() {
  return workers.length + economy.queue.length < MAX_WORKERS;
}

function enqueueWorker() {
  if (!canQueueWorker()) return;
  economy.queue.push({ type: "worker" });
  updateRtsUi();
}

function updateProduction(dt) {
  if (economy.queue.length === 0) {
    economy.progress = 0;
    return;
  }

  economy.progress += dt;
  let producedAny = false;

  while (economy.queue.length > 0 && economy.progress >= WORKER_BUILD_TIME) {
    economy.progress -= WORKER_BUILD_TIME;
    economy.queue.shift();
    if (workers.length < MAX_WORKERS) {
      makeWorkerUnit(workers.length);
      producedAny = true;
    }
  }

  if (economy.queue.length === 0) economy.progress = 0;
  if (producedAny) markRtsUiDirty();
}

function formationOffset(index, count, spacing = 0.78) {
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return new THREE.Vector3(
    (column - (columns - 1) / 2) * spacing,
    0,
    (row - (rows - 1) / 2) * spacing,
  );
}

function removeWorkerBuildAssignment(worker) {
  if (worker.buildTargetId === null) return;
  const previousBuilding = getBuilding(worker.buildTargetId);
  if (previousBuilding) previousBuilding.assignedWorkerIds.delete(worker.id);
  worker.buildTargetId = null;
}

function stopWorkerMining(worker) {
  worker.miningResourceId = null;
  worker.miningState = null;
  worker.depositTargetId = null;
  worker.mineProgress = 0;
}

function orderSelectedWorkersTo(point) {
  const selectedWorkers = getSelectedWorkers();
  selectedWorkers.forEach((worker, index) => {
    removeWorkerBuildAssignment(worker);
    stopWorkerMining(worker);
    worker.target = point.clone().add(formationOffset(index, selectedWorkers.length));
  });
  updateRtsUi();
}

function getWorkerBuildSpot(worker, building, assignedIndex = 0, assignedCount = 1) {
  const radius = Math.max(building.footprint.width, building.footprint.depth) * 0.58 + 0.95;
  const angle = (assignedIndex / Math.max(assignedCount, 1)) * Math.PI * 2 + worker.id * 0.37;
  return building.position
    .clone()
    .add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
}

function distanceToBuildingFootprint(point, building) {
  const dx = point.x - building.position.x;
  const dz = point.z - building.position.z;
  const cos = Math.cos(building.rotationY);
  const sin = Math.sin(building.rotationY);
  const localX = dx * cos + dz * sin;
  const localZ = -dx * sin + dz * cos;
  const outsideX = Math.max(Math.abs(localX) - building.footprint.width / 2, 0);
  const outsideZ = Math.max(Math.abs(localZ) - building.footprint.depth / 2, 0);
  return Math.hypot(outsideX, outsideZ);
}

function assignWorkersToBuilding(workerIds, building) {
  const assignedWorkers = workerIds.map((id) => getWorker(id)).filter(Boolean);
  assignedWorkers.forEach((worker, index) => {
    removeWorkerBuildAssignment(worker);
    stopWorkerMining(worker);
    worker.buildTargetId = building.id;
    building.assignedWorkerIds.add(worker.id);
    worker.target = getWorkerBuildSpot(worker, building, index, assignedWorkers.length);
  });
  updateRtsUi();
}

function isDropoffBuilding(building) {
  return (
    building.completed &&
    (building.type === "stronghold" || building.type === "garrisonOutpost")
  );
}

function findClosestDropoff(point) {
  let closest = null;
  let closestDistance = Infinity;
  buildings.forEach((building) => {
    if (!isDropoffBuilding(building)) return;
    const distance = point.distanceToSquared(building.position);
    if (distance < closestDistance) {
      closest = building;
      closestDistance = distance;
    }
  });
  return closest;
}

function getWorkerMineSpot(worker, resource) {
  const angle = worker.id * 2.399963229728653;
  const radius = resource.radius + 0.65;
  return resource.position
    .clone()
    .add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
}

function getWorkerDropoffSpot(worker, building) {
  return getWorkerBuildSpot(worker, building, worker.id % 6, 6);
}

function distanceToResource(point, resource) {
  const distance = Math.hypot(
    point.x - resource.position.x,
    point.z - resource.position.z,
  );
  return Math.max(distance - resource.radius, 0);
}

function depleteCrystalResource(resource) {
  if (resource.depleted) return;
  resource.depleted = true;
  resource.amount = 0;
  if (resource.focusMesh) {
    unregisterSelectable(resource.focusMesh);
    resource.focusMesh = null;
  }
  setVisualOpacity(resource.group, 0.24);
}

function sendWorkerToDeposit(worker) {
  const dropoff = findClosestDropoff(worker.group.position);
  if (!dropoff) return false;
  worker.miningState = "toDropoff";
  worker.depositTargetId = dropoff.id;
  worker.target = getWorkerDropoffSpot(worker, dropoff);
  return true;
}

function sendWorkerToCrystal(worker, resource) {
  worker.miningState = "toResource";
  worker.depositTargetId = null;
  worker.target = getWorkerMineSpot(worker, resource);
}

function assignWorkersToCrystalResource(workerIds, resource) {
  if (!resource || resource.amount <= 0) return;
  const assignedWorkers = workerIds.map((id) => getWorker(id)).filter(Boolean);
  assignedWorkers.forEach((worker) => {
    removeWorkerBuildAssignment(worker);
    stopWorkerMining(worker);
    worker.miningResourceId = resource.id;
    if (worker.cargoCrystals >= WORKER_CRYSTAL_CAPACITY) {
      sendWorkerToDeposit(worker);
    } else {
      sendWorkerToCrystal(worker, resource);
    }
  });
  updateRtsUi();
}

function moveWorkerToward(worker, target, dt) {
  const delta = workerDelta.copy(target).sub(worker.group.position);
  delta.y = 0;
  const distance = delta.length();
  if (distance <= 0.08) return false;

  const step = Math.min(worker.speed * dt, distance);
  delta.normalize();
  worker.group.position.addScaledVector(delta, step);
  worker.group.rotation.y = Math.atan2(delta.x, delta.z);
  return true;
}

function updateWorkerMining(worker, dt) {
  const resource = getCrystalResource(worker.miningResourceId);

  if (!resource || (resource.amount <= 0 && worker.cargoCrystals === 0)) {
    stopWorkerMining(worker);
    worker.target = null;
    return;
  }

  if (worker.miningState === "toDropoff") {
    let dropoff = getBuilding(worker.depositTargetId);
    if (!dropoff || !isDropoffBuilding(dropoff)) {
      if (!sendWorkerToDeposit(worker)) {
        stopWorkerMining(worker);
        worker.target = null;
        return;
      }
      dropoff = getBuilding(worker.depositTargetId);
    }
    if (!dropoff) return;

    const moving = worker.target ? moveWorkerToward(worker, worker.target, dt) : false;
    if (!moving && distanceToBuildingFootprint(worker.group.position, dropoff) <= BUILD_WORK_RANGE) {
      if (worker.cargoCrystals > 0) {
        economy.crystals += worker.cargoCrystals;
        worker.cargoCrystals = 0;
        markRtsUiDirty();
      }

      if (resource && resource.amount > 0) {
        sendWorkerToCrystal(worker, resource);
      } else {
        stopWorkerMining(worker);
        worker.target = null;
      }
    }
    return;
  }

  if (!resource || resource.amount <= 0) {
    if (worker.cargoCrystals > 0) sendWorkerToDeposit(worker);
    else {
      stopWorkerMining(worker);
      worker.target = null;
    }
    return;
  }

  if (!worker.target) {
    sendWorkerToCrystal(worker, resource);
  }

  const moving = moveWorkerToward(worker, worker.target, dt);
  if (moving || distanceToResource(worker.group.position, resource) > RESOURCE_WORK_RANGE) {
    return;
  }

  worker.working = true;
  worker.miningState = "mining";
  worker.mineProgress += WORKER_CRYSTAL_MINE_RATE * dt;

  const spaceLeft = WORKER_CRYSTAL_CAPACITY - worker.cargoCrystals;
  const mined = Math.min(Math.floor(worker.mineProgress), spaceLeft, resource.amount);
  if (mined > 0) {
    worker.mineProgress -= mined;
    worker.cargoCrystals += mined;
    resource.amount -= mined;
  }

  if (resource.amount <= 0) depleteCrystalResource(resource);
  if (worker.cargoCrystals >= WORKER_CRYSTAL_CAPACITY || resource.amount <= 0) {
    if (worker.cargoCrystals > 0) sendWorkerToDeposit(worker);
    else {
      stopWorkerMining(worker);
      worker.target = null;
    }
  }
}

function updateWorkers(dt) {
  workers.forEach((worker) => {
    worker.working = false;

    if (worker.miningResourceId !== null) {
      updateWorkerMining(worker, dt);
    } else if (worker.buildTargetId !== null) {
      const building = getBuilding(worker.buildTargetId);
      if (!building || building.completed) {
        removeWorkerBuildAssignment(worker);
        worker.target = null;
      } else if (worker.target) {
        const moving = moveWorkerToward(worker, worker.target, dt);
        worker.working =
          !moving && distanceToBuildingFootprint(worker.group.position, building) <= BUILD_WORK_RANGE;
      }
    } else if (worker.target) {
      const moving = moveWorkerToward(worker, worker.target, dt);
      if (!moving) worker.target = null;
    }

    worker.head.position.y = worker.working
      ? worker.baseHeadY + Math.sin(state.elapsed * 13 + worker.id) * 0.075
      : worker.baseHeadY;
  });
}

function updateConstruction(dt) {
  let completedAny = false;
  buildings.forEach((building) => {
    if (building.completed) return;

    let activeWorkers = 0;
    building.assignedWorkerIds.forEach((id) => {
      const worker = getWorker(id);
      if (worker?.working) activeWorkers += 1;
    });

    if (activeWorkers === 0) return;

    building.progress += activeWorkers * BUILD_PROGRESS_PER_WORKER * dt;

    if (building.progress >= BUILD_PROGRESS_REQUIRED) {
      building.progress = BUILD_PROGRESS_REQUIRED;
      building.completed = true;
      activeConstructionCount = Math.max(0, activeConstructionCount - 1);
      setVisualOpacity(building.group, 1);
      removeConstructionProgressBar(building);
      building.assignedWorkerIds.forEach((workerId) => {
        const worker = getWorker(workerId);
        if (worker) {
          worker.buildTargetId = null;
          worker.target = null;
          worker.working = false;
        }
      });
      building.assignedWorkerIds.clear();
      completedAny = true;
    }
  });

  if (completedAny) markRtsUiDirty();
}

function updateUpgrades(dt) {
  let completedAny = false;
  buildings.forEach((building) => {
    if (!building.upgrade) return;
    building.upgrade.elapsed += dt;
    if (building.upgrade.elapsed < building.upgrade.time) return;

    const upgrade = UPGRADE_DEFS[building.upgrade.id];
    if (upgrade.targetLevel) building.level = upgrade.targetLevel;
    if (upgrade.targetType) building.type = upgrade.targetType;
    const previousMaxHp = building.maxHp;
    building.maxHp = getBuildingMaxHp(building.type, building.level);
    building.hp = Math.min(
      building.maxHp,
      Math.ceil((building.hp / previousMaxHp) * building.maxHp),
    );
    building.upgrade = null;
    replaceBuildingVisual(building);
    completedAny = true;
  });

  if (completedAny) markRtsUiDirty();
}

function ensureBoxCorners(out) {
  if (!out.corners) {
    out.corners = [
      { x: 0, z: 0 },
      { x: 0, z: 0 },
      { x: 0, z: 0 },
      { x: 0, z: 0 },
    ];
  }
  return out.corners;
}

function setBoxCorner(corner, position, localX, localZ, cos, sin) {
  corner.x = position.x + localX * cos - localZ * sin;
  corner.z = position.z + localX * sin + localZ * cos;
}

function writeRectBox(out, width, depth, height, position, rotationY) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const corners = ensureBoxCorners(out);

  setBoxCorner(corners[0], position, -halfWidth, -halfDepth, cos, sin);
  setBoxCorner(corners[1], position, halfWidth, -halfDepth, cos, sin);
  setBoxCorner(corners[2], position, halfWidth, halfDepth, cos, sin);
  setBoxCorner(corners[3], position, -halfWidth, halfDepth, cos, sin);

  const extentX = Math.abs(cos) * halfWidth + Math.abs(sin) * halfDepth;
  const extentZ = Math.abs(sin) * halfWidth + Math.abs(cos) * halfDepth;

  out.minX = position.x - extentX;
  out.maxX = position.x + extentX;
  out.minZ = position.z - extentZ;
  out.maxZ = position.z + extentZ;
  out.height = height;
  out.volume = width * depth * height;
  return out;
}

function writeFootprintBox(out, type, level, position, rotationY) {
  const footprint = getBuildingFootprint(type, level);
  return writeRectBox(
    out,
    footprint.width,
    footprint.depth,
    footprint.height,
    position,
    rotationY,
  );
}

function getFootprintBox(type, level, position, rotationY) {
  return writeFootprintBox({}, type, level, position, rotationY);
}

function getBuildingBox(building) {
  if (!building.box) {
    building.box = writeFootprintBox(
      {},
      building.type,
      building.level,
      building.position,
      building.rotationY,
    );
  }
  return building.box;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.z - next.x * current.z;
  }
  return Math.abs(area) / 2;
}

function edgeCross(start, end, point) {
  return (end.x - start.x) * (point.z - start.z) - (end.z - start.z) * (point.x - start.x);
}

function isInsideClipEdge(point, edgeStart, edgeEnd) {
  return edgeCross(edgeStart, edgeEnd, point) >= -0.000001;
}

function lineIntersection(start, end, edgeStart, edgeEnd) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const edgeDx = edgeEnd.x - edgeStart.x;
  const edgeDz = edgeEnd.z - edgeStart.z;
  const denominator = dx * edgeDz - dz * edgeDx;
  if (Math.abs(denominator) < 0.000001) return { x: end.x, z: end.z };

  const t =
    ((edgeStart.x - start.x) * edgeDz - (edgeStart.z - start.z) * edgeDx) /
    denominator;
  return {
    x: start.x + dx * t,
    z: start.z + dz * t,
  };
}

function polygonOverlapArea(subjectPolygon, clipPolygon) {
  let output = subjectPolygon;

  for (let i = 0; i < clipPolygon.length; i++) {
    const edgeStart = clipPolygon[i];
    const edgeEnd = clipPolygon[(i + 1) % clipPolygon.length];
    const input = output;
    output = [];
    if (input.length === 0) return 0;

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const previous = input[(j + input.length - 1) % input.length];
      const currentInside = isInsideClipEdge(current, edgeStart, edgeEnd);
      const previousInside = isInsideClipEdge(previous, edgeStart, edgeEnd);

      if (currentInside) {
        if (!previousInside) {
          output.push(lineIntersection(previous, current, edgeStart, edgeEnd));
        }
        output.push(current);
      } else if (previousInside) {
        output.push(lineIntersection(previous, current, edgeStart, edgeEnd));
      }
    }
  }

  return output.length >= 3 ? polygonArea(output) : 0;
}

function overlapRatio(a, b) {
  const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
  if (overlapX <= 0 || overlapZ <= 0) return 0;
  const overlapArea = polygonOverlapArea(a.corners, b.corners);
  if (overlapArea <= 0) return 0;
  const overlapVolume = overlapArea * Math.min(a.height, b.height);
  return overlapVolume / Math.min(a.volume, b.volume);
}

function isPlacementValid(type, position, rotationY) {
  if (!position) return false;

  const footprint = getBuildingFootprint(type, 1);
  const edgePadding = Math.max(footprint.width, footprint.depth) / 2;
  if (
    position.x < -60 + edgePadding ||
    position.x > 60 - edgePadding ||
    position.z < -60 + edgePadding ||
    position.z > 60 - edgePadding
  ) {
    return false;
  }

  const candidate = writeFootprintBox(placementCandidateBox, type, 1, position, rotationY);
  for (const building of buildings) {
    if (overlapRatio(candidate, getBuildingBox(building)) > BUILDING_OVERLAP_LIMIT) {
      return false;
    }
  }
  for (const resource of crystalResources) {
    if (
      resource.amount > 0 &&
      overlapRatio(candidate, resource.box) > BUILDING_OVERLAP_LIMIT
    ) {
      return false;
    }
  }
  return true;
}

function tintPreview(group, valid) {
  const color = valid ? 0xffffff : 0xff4a42;
  group.traverse((child) => {
    if (!child.isMesh || !child.userData.visualMesh) return;
    if (!child.userData.previewMaterial) {
      child.material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.72,
        metalness: 0,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      });
      child.userData.previewMaterial = child.material;
    }
    child.material.color.setHex(color);
    child.castShadow = false;
    child.receiveShadow = false;
  });
}

function cancelPlacement() {
  if (!state.placement) return;
  scene.remove(state.placement.group);
  state.placement = null;
  updateRtsUi();
}

function beginPlacement(type) {
  const def = getBuildingDef(type);
  if (getMissingDependencies(def.deps).length > 0 || !canAfford(def.cost)) return;
  const selectedWorkerIds = [...state.selectedWorkerIds];
  if (selectedWorkerIds.length === 0) return;

  cancelPlacement();

  const group = createBuildingModel(type, 1);
  scene.add(group);
  state.placement = {
    type,
    group,
    rotationY: 0,
    valid: false,
    tintValid: null,
    position: new THREE.Vector3(),
    selectedWorkerIds,
  };
  updatePlacementPreview(lastPointer.x, lastPointer.y);
  updateRtsUi();
}

function updatePlacementPreview(clientX, clientY) {
  if (!state.placement) return;
  const hit = raycastGround(clientX, clientY);
  if (!hit) {
    state.placement.valid = false;
    state.placement.group.visible = false;
    return;
  }

  state.placement.position.copy(hit);
  state.placement.group.visible = true;
  state.placement.group.position.copy(hit);
  state.placement.group.rotation.y = state.placement.rotationY;
  const valid = isPlacementValid(
    state.placement.type,
    state.placement.position,
    state.placement.rotationY,
  );
  state.placement.valid = valid;
  if (state.placement.tintValid !== valid) {
    tintPreview(state.placement.group, valid);
    state.placement.tintValid = valid;
  }
}

function confirmPlacement() {
  if (!state.placement || !state.placement.valid) return;
  const def = getBuildingDef(state.placement.type);
  if (!spendCost(def.cost)) {
    updateRtsUi();
    return;
  }

  const building = createBuildingEntity(
    state.placement.type,
    state.placement.position,
    state.placement.rotationY,
    { completed: false },
  );
  const workerIds = state.placement.selectedWorkerIds.filter((id) => getWorker(id));
  scene.remove(state.placement.group);
  state.placement = null;
  assignWorkersToBuilding(workerIds, building);
  updateRtsUi();
}

function makeBuildAction(type) {
  const def = getBuildingDef(type);
  const missing = getMissingDependencies(def.deps);
  const affordable = canAfford(def.cost);
  const enabled = missing.length === 0 && affordable;
  return {
    key: `build:${type}`,
    label: def.shortName ?? def.name,
    icon: def.icon,
    cost: def.cost,
    enabled,
    locked: !enabled,
    title: actionTitle(
      def.name,
      def.cost,
      def.deps,
      affordable ? "" : "Missing resources",
    ),
    run: () => beginPlacement(type),
  };
}

function makeUpgradeAction(building, upgradeId) {
  const upgrade = UPGRADE_DEFS[upgradeId];
  const missing = getMissingDependencies(upgrade.deps);
  const affordable = canAfford(upgrade.cost);
  const levelMatches = upgrade.fromLevel ? building.level === upgrade.fromLevel : true;
  const typeMatches = building.type === upgrade.appliesTo;
  const busy = Boolean(building.upgrade);
  const enabled = typeMatches && levelMatches && missing.length === 0 && affordable && !busy;
  return {
    key: `upgrade:${building.id}:${upgradeId}`,
    label: upgrade.shortName ?? upgrade.name,
    icon: upgrade.icon,
    cost: upgrade.cost,
    enabled,
    locked: !enabled,
    title: actionTitle(
      upgrade.name,
      upgrade.cost,
      upgrade.deps,
      [
        `${upgrade.time}s upgrade`,
        busy ? "Building is already upgrading" : "",
        affordable ? "" : "Missing resources",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    run: () => startUpgrade(building.id, upgradeId),
  };
}

function startUpgrade(buildingId, upgradeId) {
  const building = getBuilding(buildingId);
  if (!building || !building.completed || building.upgrade) return;

  const action = makeUpgradeAction(building, upgradeId);
  if (!action.enabled || !spendCost(UPGRADE_DEFS[upgradeId].cost)) return;

  const upgrade = UPGRADE_DEFS[upgradeId];
  building.upgrade = {
    id: upgradeId,
    elapsed: 0,
    time: upgrade.time,
  };
  updateRtsUi();
}

function getBuildingActions(building) {
  if (!building.completed) return [];

  if (building.type === "stronghold") {
    const actions = [
      {
        key: "queue:worker",
        label: "Worker",
        icon: "WK",
        cost: { money: 0, crystals: 0 },
        enabled: canQueueWorker(),
        locked: !canQueueWorker(),
        title: canQueueWorker() ? "Queue Worker\nBuild time: 5s" : "Worker capacity is full",
        run: enqueueWorker,
      },
    ];
    if (building.level === 1) actions.push(makeUpgradeAction(building, "stronghold2"));
    if (building.level === 2) actions.push(makeUpgradeAction(building, "stronghold3"));
    return actions;
  }

  if (building.type === "guardTower") {
    return [
      makeUpgradeAction(building, "shockTower"),
      makeUpgradeAction(building, "shieldTower"),
      makeUpgradeAction(building, "mortarTower"),
    ];
  }

  return [];
}

function actionRenderKey(action) {
  return [
    action.key,
    action.label,
    action.icon,
    costText(action.cost),
    action.enabled ? "enabled" : "disabled",
    action.locked ? "locked" : "unlocked",
    action.title,
  ].join("|");
}

function renderCommandButton(button, action) {
  if (!action) {
    if (button.dataset.renderKey !== "empty") {
      button.replaceChildren();
      button.dataset.renderKey = "empty";
      button.className = "command-cell is-empty";
      button.disabled = true;
      button.title = "";
      button.setAttribute("aria-label", "Empty slot");
    }
    button.onmousedown = null;
    button.onclick = null;
    return;
  }

  const renderKey = actionRenderKey(action);
  if (button.dataset.renderKey !== renderKey) {
    button.replaceChildren();
    button.dataset.renderKey = renderKey;
    button.className = `command-cell${action.locked ? " is-locked" : ""}`;
    button.disabled = !action.enabled;
    button.title = action.title;
    button.setAttribute("aria-label", action.label);

    const icon = document.createElement("span");
    icon.className = "command-icon";
    icon.textContent = action.icon;

    const label = document.createElement("span");
    label.className = "command-label";
    label.textContent = action.label;

    const cost = document.createElement("span");
    cost.className = "command-cost";
    cost.textContent = costText(action.cost);

    button.append(icon, label, cost);

    const runAction = () => {
      if (action.enabled) action.run();
    };
    button.onmousedown = action.enabled
      ? (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          button.dataset.mouseActivated = "true";
          runAction();
        }
      : null;
    button.onclick = action.enabled
      ? (event) => {
          if (button.dataset.mouseActivated === "true") {
            button.dataset.mouseActivated = "";
            event.preventDefault();
            return;
          }
          runAction();
        }
      : null;
  }
}

function setTextIfChanged(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function setHiddenIfChanged(element, hidden) {
  if (element.hidden !== hidden) element.hidden = hidden;
}

function selectedBuildingProgressKey(building) {
  if (!building) return "";
  if (!building.completed) return `build:${Math.floor(building.progress)}`;
  if (!building.upgrade) return "ready";
  return `upgrade:${building.upgrade.id}:${Math.floor(
    (building.upgrade.elapsed / building.upgrade.time) * 100,
  )}`;
}

function getLiveUiKey() {
  const selectedBuilding = getSelectedBuilding();
  const queueProgress =
    economy.queue.length > 0
      ? Math.floor(clamp(economy.progress / WORKER_BUILD_TIME, 0, 1) * 100)
      : 0;
  const buildingKey = selectedBuilding
    ? [
        selectedBuilding.id,
        selectedBuilding.type,
        selectedBuilding.level,
        selectedBuilding.completed ? 1 : 0,
        Math.ceil(selectedBuilding.hp),
        selectedBuilding.maxHp,
        selectedBuildingProgressKey(selectedBuilding),
      ].join(":")
    : "";

  return [
    state.mode,
    state.selectedWorkerIds.size,
    buildingKey,
    economy.money,
    economy.crystals,
    workers.length,
    economy.queue.length,
    queueProgress,
    state.placement?.type ?? "",
    state.placement?.valid ? 1 : 0,
  ].join("|");
}

function markRtsUiDirty() {
  state.uiDirty = true;
}

function flushRtsUi() {
  if (state.uiDirty) {
    updateRtsUi();
    return;
  }

  if (state.mode !== "commander" || state.elapsed < state.nextLiveUiRefresh) return;

  state.nextLiveUiRefresh = state.elapsed + UI_LIVE_REFRESH_INTERVAL;
  const liveUiKey = getLiveUiKey();
  if (liveUiKey !== state.liveUiKey) updateRtsUi(liveUiKey);
}

function updateCommandPanel() {
  const selectedWorkers = getSelectedWorkers();
  const selectedBuilding = getSelectedBuilding();
  let title = "";
  let status = "";
  let actions = [];

  if (selectedWorkers.length > 0) {
    title = `${selectedWorkers.length} Worker${selectedWorkers.length === 1 ? "" : "s"}`;
    status = state.placement
      ? `Placing ${getBuildingDef(state.placement.type).name}`
      : "Build structures, click crystals to mine, or click ground to move.";
    actions = WORKER_BUILD_ORDER.map(makeBuildAction);
  } else if (selectedBuilding) {
    title = buildingDisplayName(selectedBuilding);
    status = buildingStatusText(selectedBuilding);
    actions = getBuildingActions(selectedBuilding);
  }

  setTextIfChanged(commandTitle, title);
  setTextIfChanged(commandStatus, status);
  commandButtons.forEach((button, index) => {
    renderCommandButton(button, actions[index]);
  });
}

function updateRtsUi(liveUiKey = getLiveUiKey()) {
  state.uiDirty = false;
  state.liveUiKey = liveUiKey;
  state.nextLiveUiRefresh = state.elapsed + UI_LIVE_REFRESH_INTERVAL;

  const selectedWorkers = getSelectedWorkers();
  const selectedBuilding = getSelectedBuilding();
  const hasCommands =
    state.mode === "commander" && (selectedWorkers.length > 0 || selectedBuilding);

  setHiddenIfChanged(resourceHud, state.mode !== "commander");
  setHiddenIfChanged(commandPanel, !hasCommands);
  setHiddenIfChanged(
    queuePanel,
    state.mode !== "commander" ||
      !selectedBuilding ||
      selectedBuilding.type !== "stronghold" ||
      economy.queue.length === 0,
  );

  setTextIfChanged(moneyValue, String(economy.money));
  setTextIfChanged(crystalsValue, String(economy.crystals));
  setTextIfChanged(workersValue, `${workers.length} / ${MAX_WORKERS}`);
  setTextIfChanged(queueCount, `${economy.queue.length} / ${MAX_WORKERS}`);

  queueSlotElements.forEach((slot, index) => {
    const hasItem = index < economy.queue.length;
    setTextIfChanged(slot, hasItem ? "👷🏻" : "");
    slot.classList.toggle("is-active", index === 0 && hasItem);
  });

  const progress =
    economy.queue.length > 0 ? clamp(economy.progress / WORKER_BUILD_TIME, 0, 1) : 0;
  const progressWidth = `${Math.floor(progress * 100)}%`;
  if (queueProgressFill.style.width !== progressWidth) {
    queueProgressFill.style.width = progressWidth;
  }

  if (hasCommands) updateCommandPanel();
}

function beginRtsPan(event) {
  const anchor = raycastGround(event.clientX, event.clientY);
  if (!anchor) return;

  event.preventDefault();
  rtsCamera.transition = null;
  rtsCamera.drag.active = true;
  rtsCamera.drag.anchor.copy(anchor);
}

function updateRtsPan(event) {
  if (!rtsCamera.drag.active) return;

  const currentHit = raycastGround(event.clientX, event.clientY);
  if (!currentHit) return;

  const delta = panDelta.copy(rtsCamera.drag.anchor).sub(currentHit);
  rtsCamera.target.add(delta);
  rtsCamera.target.x = clamp(rtsCamera.target.x, -46, 46);
  rtsCamera.target.z = clamp(rtsCamera.target.z, -46, 46);
  applyRtsCameraPose();
}

function endRtsPan() {
  rtsCamera.drag.active = false;
}

function beginRtsOrbit(event) {
  event.preventDefault();
  rtsCamera.transition = null;
  rtsCamera.orbitDrag.active = true;
  rtsCamera.orbitDrag.lastX = event.clientX;
  endRtsPan();
  state.selectionDrag = null;
  selectionBox.hidden = true;
}

function updateRtsOrbit(event) {
  if (!rtsCamera.orbitDrag.active) return;

  event.preventDefault();
  const deltaX = event.clientX - rtsCamera.orbitDrag.lastX;
  rtsCamera.orbitDrag.lastX = event.clientX;
  rtsCamera.orbitYaw -= deltaX * RTS_ORBIT_SENSITIVITY;
  applyRtsCameraPose();
}

function endRtsOrbit() {
  rtsCamera.orbitDrag.active = false;
}

function updateCommanderHover(event) {
  if (state.placement || isUiTarget(event.target)) {
    setHoveredBuilding(null);
    return;
  }

  const hit = getSelectableHit(event.clientX, event.clientY);
  setHoveredBuilding(hit?.kind === "building" ? hit.id : null);
}

function beginSelectionDrag(event) {
  state.selectionDrag = {
    active: true,
    moved: false,
    shiftKey: event.shiftKey,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY,
  };
  selectionBox.hidden = true;
}

function updateSelectionBox() {
  const drag = state.selectionDrag;
  if (!drag || !drag.moved) {
    selectionBox.hidden = true;
    return;
  }

  const left = Math.min(drag.startX, drag.currentX);
  const top = Math.min(drag.startY, drag.currentY);
  const width = Math.abs(drag.currentX - drag.startX);
  const height = Math.abs(drag.currentY - drag.startY);
  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
  selectionBox.hidden = false;
}

function updateSelectionDrag(event) {
  const drag = state.selectionDrag;
  if (!drag?.active) return;

  drag.currentX = event.clientX;
  drag.currentY = event.clientY;

  const distance = Math.hypot(drag.currentX - drag.startX, drag.currentY - drag.startY);
  if (distance > 6) drag.moved = true;
  updateSelectionBox();
}

function screenRectFromDrag(drag) {
  return {
    left: Math.min(drag.startX, drag.currentX),
    right: Math.max(drag.startX, drag.currentX),
    top: Math.min(drag.startY, drag.currentY),
    bottom: Math.max(drag.startY, drag.currentY),
  };
}

function selectWorkersInRect(rect, append) {
  const nextSelection = append ? new Set(state.selectedWorkerIds) : new Set();
  workers.forEach((worker) => {
    tempVector.copy(worker.group.position);
    tempVector.y += 0.8;
    tempVector.project(camera);

    const x = ((tempVector.x + 1) / 2) * window.innerWidth;
    const y = ((-tempVector.y + 1) / 2) * window.innerHeight;
    const inFront = tempVector.z > -1 && tempVector.z < 1;
    if (
      inFront &&
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {
      nextSelection.add(worker.id);
    }
  });

  state.selectedBuildingId = null;
  state.selectedWorkerIds = nextSelection;
  syncSelectionVisuals();
  updateRtsUi();
}

function finishSelectionDrag(event) {
  const drag = state.selectionDrag;
  if (!drag?.active) return;

  state.selectionDrag = null;
  selectionBox.hidden = true;

  if (drag.moved) {
    selectWorkersInRect(screenRectFromDrag(drag), drag.shiftKey);
    return;
  }

  handleCommanderClick(event, drag.shiftKey);
}

function handleCommanderClick(event, shiftKey = event.shiftKey) {
  const hit = getSelectableHit(event.clientX, event.clientY);
  if (hit?.kind === "worker") {
    if (shiftKey) toggleWorkerSelection(hit.id);
    else selectOnlyWorker(hit.id);
    return;
  }

  if (hit?.kind === "building") {
    const building = getBuilding(hit.id);
    if (!building) return;
    const selectedWorkers = getSelectedWorkers();
    if (!building.completed && selectedWorkers.length > 0 && !shiftKey) {
      assignWorkersToBuilding([...state.selectedWorkerIds], building);
      return;
    }
    selectBuilding(building.id);
    return;
  }

  if (hit?.kind === "resource") {
    const resource = getCrystalResource(hit.id);
    const selectedWorkers = getSelectedWorkers();
    if (resource && resource.amount > 0 && selectedWorkers.length > 0 && !shiftKey) {
      assignWorkersToCrystalResource([...state.selectedWorkerIds], resource);
      return;
    }
    clearSelection();
    return;
  }

  const groundHit = raycastGround(event.clientX, event.clientY);
  if (groundHit && state.selectedWorkerIds.size > 0) {
    orderSelectedWorkersTo(groundHit);
    return;
  }

  clearSelection();
}

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
    setHoveredBuilding(null);
    cancelPlacement();
  }

  if (mode === "commander") {
    keys.clear();
    clearSelection();
    endRtsPan();
    endRtsOrbit();
    beginRtsCameraTransition();
  } else {
    endRtsPan();
    endRtsOrbit();
    rtsCamera.transition = null;
    setHoveredBuilding(null);
    clearSelection();
  }

  updateRtsUi();
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

function updateFlyCamera(dt) {
  if (state.mode !== "camera" || !state.pointerLocked) return;

  const forward = flyForward;
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = flyRight.crossVectors(forward, camera.up).normalize();
  const movement = flyMovement.set(0, 0, 0);

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

function updateSelectionLabel() {
  let building = null;

  if (state.mode === "commander") {
    building = getHoveredBuilding() ?? getSelectedBuilding();
  } else if (state.mode === "camera") {
    raycaster.setFromCamera(pointerNdc.set(0, 0), camera);
    const hit = raycaster.intersectObjects(selectableMeshes, false).find((item) => {
      return item.object.userData.selectable?.kind === "building";
    });
    if (hit) building = getBuilding(hit.object.userData.selectable.id);
  }

  if (!building) {
    selectionLabel.visible = false;
    return;
  }

  setSelectionLabel(buildingDisplayName(building), buildingStatusText(building));
  selectionLabel.position.copy(building.position);
  selectionLabel.position.y = building.footprint.height + 1.1;
  selectionLabel.visible = true;
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
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
  lastPointer.x = event.clientX;
  lastPointer.y = event.clientY;

  if (state.mode === "commander") {
    updateRtsOrbit(event);
    updatePlacementPreview(event.clientX, event.clientY);
    updateSelectionDrag(event);
    updateRtsPan(event);
    updateCommanderHover(event);
    return;
  }

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
    if (state.placement) {
      cancelPlacement();
    } else {
      setMode("menu");
    }
    return;
  }

  if (state.mode === "commander") {
    if (
      event.code === "KeyW" ||
      event.code === "KeyA" ||
      event.code === "KeyS" ||
      event.code === "KeyD"
    ) {
      event.preventDefault();
      rtsCamera.transition = null;
      keys.add(event.code);
    }
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
  endRtsPan();
  endRtsOrbit();
  state.selectionDrag = null;
  selectionBox.hidden = true;
});

document.addEventListener("mousedown", (event) => {
  if (state.mode !== "commander") return;

  if (isUiTarget(event.target)) return;

  if (event.button === 2) {
    beginRtsOrbit(event);
    return;
  }

  if (event.button === 1) {
    beginRtsPan(event);
    return;
  }

  if (event.button === 0) {
    event.preventDefault();
    if (state.placement) {
      confirmPlacement();
      return;
    }
    beginSelectionDrag(event);
  }
});

document.addEventListener("mouseup", (event) => {
  if (event.button === 1) endRtsPan();
  if (event.button === 2) endRtsOrbit();
  if (state.mode === "commander" && event.button === 0) finishSelectionDrag(event);
});

document.addEventListener("auxclick", (event) => {
  if (event.button === 1) event.preventDefault();
});

document.addEventListener("contextmenu", (event) => {
  if (state.mode !== "commander") return;
  event.preventDefault();
});

document.addEventListener(
  "wheel",
  (event) => {
    if (state.mode !== "commander" || isUiTarget(event.target)) return;

    event.preventDefault();
    if (state.placement) {
      const direction = Math.sign(event.deltaY) || 1;
      state.placement.rotationY += direction * ROTATION_STEP;
      updatePlacementPreview(lastPointer.x, lastPointer.y);
      return;
    }

    rtsCamera.transition = null;
    rtsCamera.zoom = clamp(
      rtsCamera.zoom + event.deltaY * 0.018,
      RTS_MIN_ZOOM,
      RTS_MAX_ZOOM,
    );
    applyRtsCameraPose();
  },
  { passive: false },
);

window.addEventListener("resize", resize);

createBuildingEntity("stronghold", new THREE.Vector3(0, 0, 0), 0, {
  completed: true,
  level: 1,
});

[
  new THREE.Vector3(8.5, 0, 6.5),
  new THREE.Vector3(-18, 0, 13),
  new THREE.Vector3(21, 0, -14),
].forEach((position) => createCrystalResource(position));

resize();
restoreFlyPose();
setMode("menu");

const clock = new THREE.Clock();

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  state.elapsed += dt;

  updateFlyCamera(dt);
  updateRtsCamera(dt);
  updateProduction(dt);
  updateWorkers(dt);
  updateConstruction(dt);
  updateUpgrades(dt);
  updateConstructionProgressBars();
  flushRtsUi();
  updateSelectionLabel();
  renderer.render(scene, camera);
}

loop();
