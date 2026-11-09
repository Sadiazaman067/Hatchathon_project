import * as THREE from "three";

const PAPER = 0xf3f1eb;
const SHEET = 0xf3eee4;
const INK = 0x1c1b19;
const MUTED = 0x5c584f;
const RED = 0xb42318;
const GREEN = 0x067647;
const FRAME = 0xb7b09f;
const BELT = 0x6a655c;
const LOAD = 0xc4a574;
const HOUSING = 0x8d887c;
const GROUND = 0xe8e2d4;

export interface ConveyorVisual {
  motorOn: boolean;
  startPressed: boolean;
  stopPressed: boolean;
  /** 0 at the start of the belt, 1 at the far end. */
  boxAlong: number;
  idle: boolean;
  /** Smooth slide toward boxAlong. Snap when false. */
  sliding: boolean;
  /** Extra boxes at the end while the motor stays on past FULL_BELT. */
  stacked: number;
  /** 0–1 fall off the end after the stack fills. */
  fall: number;
}

export interface ConveyorHandle {
  setSize: (width: number, height: number) => void;
  setVisual: (visual: ConveyorVisual) => void;
  dispose: () => void;
}

const BELT_LEN = 5.6;
const BOX_TRAVEL = BELT_LEN - 1.2;
/** Match Presentation step length so the box finishes a slide as the step advances. */
const SLIDE_MS = 1500;
const BELT_SPEED = 0.0011;

function matte(
  geometry: THREE.BufferGeometry,
  color: number,
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
  extra?: { roughness?: number; metalness?: number },
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: extra?.roughness ?? 0.9,
    metalness: extra?.metalness ?? 0.04,
  });
  materials.push(material);
  geometries.push(geometry);
  return material;
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material);
  object.castShadow = true;
  object.receiveShadow = true;
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function makeLabelSprite(text: string, inkHex = "#1c1b19"): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#fbfaf6";
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = "#1c1b19";
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, 250, 58);
    ctx.fillStyle = inkHex;
    ctx.font = "700 28px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 34);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.05, 0.26, 1);
  sprite.userData.texture = texture;
  sprite.userData.material = material;
  return sprite;
}

export function mountConveyor(canvas: HTMLCanvasElement): ConveyorHandle {
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(PAPER, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 90);
  camera.position.set(8.4, 6.1, 9.2);
  camera.lookAt(0, 0.95, 0.15);

  const hemi = new THREE.HemisphereLight(0xf5f1e8, 0x8a8478, 0.7);
  scene.add(hemi);

  const fill = new THREE.DirectionalLight(0xf3eee6, 0.35);
  fill.position.set(-4, 3, -2);
  scene.add(fill);

  const key = new THREE.DirectionalLight(0xfff8ee, 1.15);
  key.position.set(4.5, 8, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 5;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 22;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  scene.add(key);

  const lampGlow = new THREE.PointLight(GREEN, 0, 2.4, 2);
  lampGlow.position.set(-2.85, 1.55, 1.15);
  scene.add(lampGlow);

  const groundGeom = new THREE.PlaneGeometry(14, 14);
  const groundMat = new THREE.MeshLambertMaterial({ color: GROUND });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  materials.push(groundMat);
  geometries.push(groundGeom);

  const machine = new THREE.Group();
  scene.add(machine);

  const frameGeom = new THREE.BoxGeometry(BELT_LEN + 0.4, 0.28, 1.6);
  const frameMat = matte(frameGeom, FRAME, materials, geometries);
  mesh(frameGeom, frameMat, machine, 0, 0.36, 0);

  const beltGeom = new THREE.BoxGeometry(BELT_LEN, 0.08, 1.12);
  const beltCanvas = document.createElement("canvas");
  beltCanvas.width = 64;
  beltCanvas.height = 16;
  const beltCtx = beltCanvas.getContext("2d");
  if (beltCtx) {
    beltCtx.fillStyle = "#6a655c";
    beltCtx.fillRect(0, 0, 64, 16);
    beltCtx.fillStyle = "#585349";
    beltCtx.fillRect(0, 0, 10, 16);
    beltCtx.fillRect(32, 0, 10, 16);
  }
  const beltTex = new THREE.CanvasTexture(beltCanvas);
  beltTex.wrapS = THREE.RepeatWrapping;
  beltTex.wrapT = THREE.RepeatWrapping;
  beltTex.repeat.set(6, 1);
  beltTex.colorSpace = THREE.SRGBColorSpace;
  const beltMat = new THREE.MeshStandardMaterial({
    color: BELT,
    map: beltTex,
    roughness: 0.96,
    metalness: 0,
  });
  materials.push(beltMat);
  geometries.push(beltGeom);
  mesh(beltGeom, beltMat, machine, 0, 0.54, 0);

  const rollerGeom = new THREE.CylinderGeometry(0.2, 0.2, 1.22, 24);
  const rollerMat = matte(rollerGeom, HOUSING, materials, geometries, { roughness: 0.55, metalness: 0.12 });
  const rollers: THREE.Mesh[] = [];
  for (const x of [-BELT_LEN / 2 + 0.12, BELT_LEN / 2 - 0.12]) {
    const roller = mesh(rollerGeom, rollerMat, machine, x, 0.54, 0);
    roller.rotation.x = Math.PI / 2;
    rollers.push(roller);
  }

  const railGeom = new THREE.BoxGeometry(BELT_LEN, 0.12, 0.1);
  const railMat = matte(railGeom, INK, materials, geometries, { roughness: 0.7, metalness: 0.08 });
  mesh(railGeom, railMat, machine, 0, 0.68, -0.66);
  mesh(railGeom, railMat, machine, 0, 0.68, 0.66);

  const legGeom = new THREE.BoxGeometry(0.14, 0.52, 0.14);
  const legMat = matte(legGeom, MUTED, materials, geometries);
  for (const [x, z] of [
    [-2.4, -0.58],
    [2.4, -0.58],
    [-2.4, 0.58],
    [2.4, 0.58],
  ] as const) {
    mesh(legGeom, legMat, machine, x, 0.18, z);
  }

  const houseGeom = new THREE.BoxGeometry(0.9, 0.72, 0.9);
  const houseMat = matte(houseGeom, HOUSING, materials, geometries, { roughness: 0.78, metalness: 0.08 });
  mesh(houseGeom, houseMat, machine, -2.85, 0.95, 1.15);

  const lampGeom = new THREE.SphereGeometry(0.18, 24, 16);
  const lampMat = new THREE.MeshStandardMaterial({
    color: MUTED,
    roughness: 0.45,
    metalness: 0.05,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  materials.push(lampMat);
  geometries.push(lampGeom);
  const lamp = mesh(lampGeom, lampMat, machine, -2.85, 1.5, 1.15);

  const pedestalGeom = new THREE.BoxGeometry(1.28, 0.28, 0.72);
  const pedestalMat = matte(pedestalGeom, FRAME, materials, geometries);
  mesh(pedestalGeom, pedestalMat, machine, 2.7, 0.7, 1.15);

  const btnGeom = new THREE.CylinderGeometry(0.2, 0.22, 0.16, 24);
  const startMat = new THREE.MeshStandardMaterial({
    color: SHEET,
    roughness: 0.65,
    metalness: 0.02,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  const stopMat = startMat.clone();
  materials.push(startMat, stopMat);
  geometries.push(btnGeom);
  const startBtn = mesh(btnGeom, startMat, machine, 2.42, 0.92, 1.15);
  const stopBtn = mesh(btnGeom, stopMat, machine, 2.98, 0.92, 1.15);

  const startLabel = makeLabelSprite("START", "#067647");
  startLabel.position.set(2.42, 1.28, 1.15);
  const stopLabel = makeLabelSprite("STOP", "#b42318");
  stopLabel.position.set(2.98, 1.28, 1.15);
  const motorLabel = makeLabelSprite("MOTOR");
  motorLabel.position.set(-2.85, 1.86, 1.15);
  machine.add(startLabel, stopLabel, motorLabel);

  const boxGeom = new THREE.BoxGeometry(0.58, 0.48, 0.58);
  const boxMat = matte(boxGeom, LOAD, materials, geometries, { roughness: 0.92, metalness: 0 });
  const box = mesh(boxGeom, boxMat, machine, 0, 0.86, 0);
  const boxLabel = makeLabelSprite("LOAD");
  box.add(boxLabel);
  boxLabel.position.set(0, 0.46, 0);
  const stackedBoxes = [0, 1, 2].map((i) => {
    const extra = mesh(boxGeom, boxMat, machine, 0, 0.86 + (i + 1) * 0.5, 0);
    extra.visible = false;
    return extra;
  });
  const fallingBox = mesh(boxGeom, boxMat, machine, 0, 0.86, 0);
  fallingBox.visible = false;

  let raf = 0;
  let disposed = false;
  let visual: ConveyorVisual = {
    motorOn: false,
    startPressed: false,
    stopPressed: false,
    boxAlong: 0,
    idle: true,
    sliding: false,
    stacked: 0,
    fall: 0,
  };
  let displayedAlong = 0;
  let slideFrom = 0;
  let slideTo = 0;
  let slideStart = 0;
  let sliding = false;
  let beltPhase = 0;
  let lastNow = performance.now();

  function applyVisual(now: number): void {
    const dt = Math.min(64, now - lastNow);
    lastNow = now;
    const active = !visual.idle;
    hemi.intensity = active ? 0.7 : 0.38;
    key.intensity = active ? 1.15 : 0.4;
    fill.intensity = active ? 0.35 : 0.18;

    const motorLit = visual.motorOn && active;
    lampMat.color.setHex(motorLit ? GREEN : MUTED);
    lampMat.emissive.setHex(motorLit ? GREEN : 0x000000);
    lampMat.emissiveIntensity = motorLit ? 0.85 : 0;
    lampGlow.intensity = motorLit ? 1.4 : 0;
    lamp.scale.setScalar(motorLit ? 1.08 : 1);

    startMat.color.setHex(visual.startPressed ? GREEN : SHEET);
    startMat.emissive.setHex(visual.startPressed ? GREEN : 0x000000);
    startMat.emissiveIntensity = visual.startPressed ? 0.25 : 0;
    stopMat.color.setHex(visual.stopPressed ? RED : SHEET);
    stopMat.emissive.setHex(visual.stopPressed ? RED : 0x000000);
    stopMat.emissiveIntensity = visual.stopPressed ? 0.25 : 0;
    startBtn.position.y = visual.startPressed ? 0.84 : 0.92;
    stopBtn.position.y = visual.stopPressed ? 0.84 : 0.92;

    if (sliding) {
      const u = Math.min(1, (now - slideStart) / SLIDE_MS);
      displayedAlong = slideFrom + (slideTo - slideFrom) * u;
      if (u >= 1) {
        displayedAlong = slideTo;
        sliding = false;
      }
    }

    const along = Math.max(0, Math.min(1, displayedAlong));
    const endX = -BOX_TRAVEL / 2 + along * BOX_TRAVEL;
    box.position.x = endX;
    box.position.y = 0.86;
    const stackedCount = visual.idle ? 0 : Math.max(0, Math.min(3, Math.round(visual.stacked)));
    stackedBoxes.forEach((extra, i) => {
      extra.visible = i < stackedCount;
      extra.position.x = endX;
      extra.position.y = 0.86 + (i + 1) * 0.5;
    });
    const fall = visual.idle ? 0 : Math.max(0, Math.min(1, visual.fall));
    fallingBox.visible = fall > 0;
    fallingBox.position.x = endX + fall * 0.9;
    fallingBox.position.y = 0.86 - fall * 1.6;

    if (motorLit) {
      beltPhase += dt * BELT_SPEED;
      for (const roller of rollers) roller.rotation.z = beltPhase * 8;
      beltTex.offset.x = beltPhase % 1;
    }
  }

  function layout(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function tick(now: number): void {
    if (disposed) return;
    applyVisual(now);
    renderer.render(scene, camera);
    raf = window.requestAnimationFrame(tick);
  }

  applyVisual(performance.now());
  raf = window.requestAnimationFrame(tick);

  return {
    setSize(width, height) {
      layout(width, height);
    },
    setVisual(next) {
      const along = Math.max(0, Math.min(1, next.boxAlong));
      if (!next.sliding || next.idle) {
        sliding = false;
        displayedAlong = along;
      } else if (along !== slideTo) {
        slideFrom = displayedAlong;
        slideTo = along;
        slideStart = performance.now();
        sliding = true;
      }
      visual = {
        ...next,
        boxAlong: along,
        stacked: next.stacked ?? 0,
        fall: next.fall ?? 0,
      };
    },
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(raf);
      for (const sprite of [startLabel, stopLabel, motorLabel, boxLabel]) {
        sprite.userData.texture?.dispose();
        (sprite.userData.material as THREE.Material | undefined)?.dispose();
      }
      beltTex.dispose();
      for (const mat of materials) mat.dispose();
      for (const geom of geometries) geom.dispose();
      renderer.dispose();
    },
  };
}
