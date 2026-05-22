import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── Renderer ───────────────────────────────────────────────────────────────
const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 100);
camera.position.set(0, 0, 1);

scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(1, 2, 2);
scene.add(dirLight);

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ── 글로우 텍스처 ──────────────────────────────────────────────────────────
function makeGlowTexture() {
  const size = 256, c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0,    'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.4,  'rgba(255,255,255,0.3)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
const glowTex = makeGlowTexture();

// ── Pivot ──────────────────────────────────────────────────────────────────
const stickPivot = new THREE.Group();
stickPivot.visible = false;
scene.add(stickPivot);

// ── 모델 데이터 구조 ───────────────────────────────────────────────────────
// models[i] = { model, headMeshes, pointLight, glowSprite }
const models = [null, null];
let activeIndex = 0;

// 모델별 기본 발광 색상 (NewJeans: 흰색 / NCT: 연두-노랑)
const MODEL_COLORS = [
  new THREE.Color(0xffffff),
  new THREE.Color(0x79f116),
];

function setupModel(gltf, index) {
  const model = gltf.scene;
  const box   = new THREE.Box3().setFromObject(model);
  const size  = box.getSize(new THREE.Vector3());
  model.scale.setScalar(0.35 / Math.max(size.x, size.y, size.z));
  // NewJeans(0): Y=180° / NCT(1): 앞면 반전 위해 Y=0°
  model.rotation.set(0, index === 0 ? Math.PI : 0, 0);
  model.visible = (index === activeIndex);
  stickPivot.add(model);

  const worldBox = new THREE.Box3().setFromObject(model);
  // NCT(1): Object_4/16(큐브 본체) 포함, 손잡이 제외 → 0.68
  // NewJeans(0): 상위 50%
  const splitRatio = index === 1 ? 0.68 : 0.5;
  const midY = worldBox.min.y + (worldBox.max.y - worldBox.min.y) * splitRatio;
  const headTopY = (worldBox.max.y - model.position.y) * 0.85;

  const headMeshes = [];
  model.traverse((child) => {
    if (!child.isMesh) return;
    const mBox  = new THREE.Box3().setFromObject(child);
    const mMidY = (mBox.min.y + mBox.max.y) / 2;
    if (mMidY >= midY) {
      headMeshes.push(child);
      if (child.material) {
        const mat = child.material;
        mat.emissive = mat.color ? mat.color.clone() : new THREE.Color(0xffffff);
        mat.emissiveIntensity = 0;
      }
    }
  });

  // NCT: 범위를 좁혀 손잡이에 빛 안 닿게 / NewJeans: 넓게
  const lightDist = index === 1 ? 0.18 : 1.5;
  const pointLight = new THREE.PointLight(0xffffff, 0, lightDist);
  pointLight.position.set(0, headTopY, 0.05);
  model.add(pointLight);

  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  }));
  glowSprite.scale.set(0.9, 0.9, 1);
  glowSprite.position.set(0, headTopY, 0);
  model.add(glowSprite);

  models[index] = { model, headMeshes, pointLight, glowSprite };
}

// ── GLB 로드 ───────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
loader.load('./newjeans_lightstick_3d_model.glb',
  (g) => setupModel(g, 0), undefined, (e) => console.error('NJ load error', e));
loader.load('./nct_lightstick_v0_1.glb',
  (g) => setupModel(g, 1), undefined, (e) => console.error('NCT load error', e));

// ── MediaPipe ──────────────────────────────────────────────────────────────
const { FilesetResolver, HandLandmarker } = await import(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
);
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
);
const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    delegate: 'GPU',
  },
  numHands: 2,
  runningMode: 'VIDEO',
});

// ── 웹캠 ──────────────────────────────────────────────────────────────────
const video = document.getElementById('video');
const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
video.srcObject = stream;
await new Promise(r => video.addEventListener('loadeddata', r, { once: true }));

// ── 손가락 개수 ────────────────────────────────────────────────────────────
const TIP = [4, 8, 12, 16, 20];
const PIP = [3, 6, 10, 14, 18];
function countFingers(lm) {
  let n = 0;
  for (let i = 0; i < 5; i++) {
    if (i === 0) n += lm[TIP[0]].x < lm[PIP[0]].x ? 1 : 0;
    else         n += lm[TIP[i]].y < lm[PIP[i]].y ? 1 : 0;
  }
  return n;
}

// ── 손 위치 ────────────────────────────────────────────────────────────────
function landmarkToWorld(lm, idx) {
  const p  = lm[idx];
  const nx = -(p.x * 2 - 1), ny = -(p.y * 2 - 1);
  const vec = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
  return camera.position.clone().add(vec.sub(camera.position).normalize().multiplyScalar(0.6));
}

// ── 손 방향 ────────────────────────────────────────────────────────────────
function palmQuaternion(lm) {
  const w  = new THREE.Vector3(lm[0].x, -lm[0].y, -lm[0].z);
  const m  = new THREE.Vector3(lm[9].x, -lm[9].y, -lm[9].z);
  const up = m.clone().sub(w).normalize();
  const camDir = new THREE.Vector3(0, 0, 1);
  const fwd    = camDir.clone().sub(up.clone().multiplyScalar(camDir.dot(up))).normalize();
  const right  = new THREE.Vector3().crossVectors(up, fwd).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, up, fwd)
  );
}

// ── UI 표시 ────────────────────────────────────────────────────────────────
const ui = document.getElementById('ui');
function updateUI() {
  const name = activeIndex === 0 ? '🐰 NewJeans' : '🌟 NCT';
  ui.textContent = `${name} | 오른손: 응원봉 위치  왼손: 조명(1~4손가락) / 전환(5손가락)`;
}
updateUI();

// ── 모델 전환 ──────────────────────────────────────────────────────────────
function switchModel(newIndex) {
  if (!models[0] || !models[1]) return; // 아직 로드 안 됨
  models[activeIndex].model.visible = false;
  activeIndex = newIndex;
  models[activeIndex].model.visible = true;
  updateUI();
}

let prevFiveOpen = false; // 5손가락 상태 전 프레임

// ── 조명 상태 ──────────────────────────────────────────────────────────────
let lightMode = 0;
const hue = { value: 0 };
const clock = new THREE.Clock();

function applyLightMode(dt) {
  const active = models[activeIndex];
  if (!active) return;
  const { headMeshes, pointLight, glowSprite } = active;
  if (!headMeshes.length) return;

  const t = clock.getElapsedTime();
  const baseColor = MODEL_COLORS[activeIndex];
  let color = new THREE.Color(0x000000);
  let emissiveInt = 0;

  if (lightMode === 1) {
    color.copy(baseColor); emissiveInt = 3;
  } else if (lightMode === 2) {
    const on = Math.sin(t * Math.PI * 1.5) > 0;
    color.copy(baseColor); emissiveInt = on ? 3 : 0;
  } else if (lightMode === 3) {
    const on = Math.sin(t * Math.PI * 6) > 0;
    color.copy(baseColor); emissiveInt = on ? 3 : 0;
  } else if (lightMode === 4) {
    hue.value = (hue.value + dt * 0.4) % 1;
    color.setHSL(hue.value, 1, 0.6); emissiveInt = 3;
  }

  const isOn = emissiveInt > 0;
  headMeshes.forEach((m) => {
    if (!m.material) return;
    m.material.emissive.copy(color);
    m.material.emissiveIntensity = emissiveInt;
  });
  pointLight.color.copy(color);
  pointLight.intensity = isOn ? 1.5 : 0;
  glowSprite.material.color.copy(isOn ? color : new THREE.Color(0));
  glowSprite.material.opacity = isOn ? 0.55 : 0;

  // 비활성 모델 조명 끄기
  const other = models[1 - activeIndex];
  if (other) {
    other.headMeshes.forEach((m) => {
      if (m.material) m.material.emissiveIntensity = 0;
    });
    other.pointLight.intensity = 0;
    other.glowSprite.material.opacity = 0;
  }
}

// ── 메인 루프 ──────────────────────────────────────────────────────────────
let lastVideoTime = -1;

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const results = handLandmarker.detectForVideo(video, now);

    let leftLm = null, rightLm = null;
    if (results.landmarks) {
      results.landmarks.forEach((lm, i) => {
        const side = results.handednesses[i][0].categoryName;
        if (side === 'Right') leftLm = lm;
        else rightLm = lm;
      });
    }

    // 왼손: 응원봉 위치/회전
    if (leftLm) {
      stickPivot.visible = true;
      stickPivot.position.lerp(landmarkToWorld(leftLm, 9), 0.3);
      stickPivot.quaternion.slerp(palmQuaternion(leftLm), 0.3);
    } else {
      stickPivot.visible = false;
    }

    // 오른손: 손가락 수 → 조명 or 모델 전환
    if (rightLm) {
      const n = countFingers(rightLm);

      if (n === 5) {
        // 5손가락: 이전 프레임에 안 펼쳤을 때만 전환
        if (!prevFiveOpen) switchModel(1 - activeIndex);
        prevFiveOpen = true;
      } else {
        prevFiveOpen = false;
        // 1~4만 모드 변경, 주먹(0)은 마지막 모드 유지
        if (n >= 1 && n <= 4) lightMode = n;
      }
    }
    // 오른손 없어도 lightMode 유지 (else 제거)
  }

  applyLightMode(clock.getDelta());
  renderer.render(scene, camera);
}

loop();
