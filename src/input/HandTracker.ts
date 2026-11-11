import * as THREE from 'three';
import type { HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { CONFIG } from '../config';
import { OneEuroFilter3 } from '../utils/OneEuroFilter';
import type { HandState } from './InputManager';

/**
 * MediaPipe 资源加载策略：**本地优先，CDN 兜底**。
 *
 * 本地资源由 `npm run assets`（自动挂在 predev / prebuild 上）从
 * `node_modules/@mediapipe/tasks-vision/wasm` 复制到 `public/mediapipe/wasm/`，
 * 模型文件 `hand_landmarker.task` 随仓库提交。
 * 这样在断网、校园内网、CDN 抖动的情况下，摄像头模式仍然可用——
 * 教室场景不该因为网络状况而失效。
 */
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_CDN =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const LOCAL_WASM = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const LOCAL_MODEL = `${import.meta.env.BASE_URL}mediapipe/hand_landmarker.task`;

/** HEAD 探测资源是否存在（不下载正文）。失败一律当作「不存在」。 */
async function assetExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

const WRIST = 0;
const MIDDLE_MCP = 9;
const PALM_POINTS = [0, 5, 9, 13, 17];
const FINGERS: Array<{ tip: number; pip: number }> = [
  { tip: 8, pip: 6 },
  { tip: 12, pip: 10 },
  { tip: 16, pip: 14 },
  { tip: 20, pip: 18 },
];

type Handedness = 'Left' | 'Right';

interface TrackedHand {
  filter: OneEuroFilter3;
  position: THREE.Vector3;
  speed: number;
  closedness: number;
  spread: number;
  pinch: number;
  confidence: number;
  indexExtended: boolean;
  lastSeen: number;
  baselineScale: number | null;
}

export class HandTracker {
  video: HTMLVideoElement;
  landmarks: NormalizedLandmark[][] = [];
  detectionFps = 0;
  /** 实际生效的资源来源，用于界面上如实说明「离线可用」是否成立。 */
  assetSource: 'local' | 'cdn' | 'unknown' = 'unknown';

  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private timer: number | null = null;
  private hands: Record<Handedness, TrackedHand> = {
    Left: this.newHand(),
    Right: this.newHand(),
  };
  private lastDetect = 0;
  private disposed = false;

  private constructor(private camera: THREE.PerspectiveCamera) {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.style.display = 'none';
    document.body.appendChild(this.video);
  }

  private newHand(): TrackedHand {
    const { minCutoff, beta, dCutoff } = CONFIG.oneEuro;
    return {
      filter: new OneEuroFilter3(minCutoff, beta, dCutoff),
      position: new THREE.Vector3(0, 0.4, 0),
      speed: 0,
      closedness: 0,
      spread: 0.5,
      pinch: 0,
      confidence: 0,
      indexExtended: false,
      lastSeen: 0,
      baselineScale: null,
    };
  }

  static async create(camera: THREE.PerspectiveCamera): Promise<HandTracker> {
    const tracker = new HandTracker(camera);

    try {
      // 浏览器只在安全上下文（localhost / HTTPS）里暴露摄像头。
      // 学生用手机通过局域网 http 打开时这里会缺失，给出可读的提示而不是一句 TypeError。
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          '摄像头需要 localhost 或 HTTPS 才能启用；当前是局域网 http，请改用鼠标/触屏模式',
        );
      }
      tracker.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      tracker.video.srcObject = tracker.stream;
      await tracker.video.play();

      const vision = await import('@mediapipe/tasks-vision');

      // 先探测本地资源；任何一步失败都回落到 CDN。
      const [hasLocalWasm, hasLocalModel] = await Promise.all([
        assetExists(`${LOCAL_WASM}/vision_wasm_internal.js`),
        assetExists(LOCAL_MODEL),
      ]);
      const attempts: Array<{ wasm: string; model: string; source: 'local' | 'cdn' }> = [];
      if (hasLocalWasm && hasLocalModel) {
        attempts.push({ wasm: LOCAL_WASM, model: LOCAL_MODEL, source: 'local' });
      }
      attempts.push({ wasm: WASM_CDN, model: MODEL_CDN, source: 'cdn' });

      let lastError: unknown = null;
      for (const attempt of attempts) {
        try {
          const fileset = await vision.FilesetResolver.forVisionTasks(attempt.wasm);
          try {
            tracker.landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: attempt.model, delegate: 'GPU' },
              runningMode: 'VIDEO',
              numHands: 2,
            });
          } catch {
            tracker.landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: attempt.model, delegate: 'CPU' },
              runningMode: 'VIDEO',
              numHands: 2,
            });
          }
          tracker.assetSource = attempt.source;
          break;
        } catch (error) {
          lastError = error;
          tracker.landmarker?.close();
          tracker.landmarker = null;
        }
      }
      if (!tracker.landmarker) throw lastError ?? new Error('hand landmarker unavailable');

      tracker.startLoop();
      return tracker;
    } catch (error) {
      tracker.dispose();
      throw error;
    }
  }

  private startLoop(): void {
    const interval = 1000 / CONFIG.detectHz;
    const tick = () => {
      if (this.disposed) return;
      if (!document.hidden) this.detect();
      this.timer = window.setTimeout(tick, interval);
    };
    tick();
  }

  private detect(): void {
    if (!this.landmarker || this.video.readyState < 2) return;
    const now = performance.now();
    if (now - this.lastDetect < 1) return;
    const result = this.landmarker.detectForVideo(this.video, now);
    if (this.lastDetect > 0) {
      this.detectionFps = this.detectionFps * 0.9 + (1000 / (now - this.lastDetect)) * 0.1;
    }
    this.landmarks = result.landmarks ?? [];

    const assigned = new Map<Handedness, { lm: NormalizedLandmark[]; score: number }>();
    const centroids: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < this.landmarks.length; i++) {
      const lm = this.landmarks[i];
      const cat = result.handedness?.[i]?.[0];
      if (!cat) continue;
      const label = (cat.categoryName === 'Left' ? 'Left' : 'Right') as Handedness;

      const c = centroid(lm);
      const isPhantom = centroids.some(
        (o) => Math.hypot(o.x - c.x, o.y - c.y) < CONFIG.phantomMinSeparation,
      );
      centroids.push(c);
      if (isPhantom) continue;

      const existing = assigned.get(label);
      if (!existing || cat.score > existing.score) {
        assigned.set(label, { lm, score: cat.score });
      }
    }

    this.landmarks = [...assigned.values()].map(({ lm }) => lm);
    for (const [label, det] of assigned) {
      this.updateHand(this.hands[label], det.lm, det.score, now);
    }
  }

  private updateHand(
    hand: TrackedHand,
    lm: NormalizedLandmark[],
    confidence: number,
    now: number,
  ): void {
    const dt = hand.lastSeen > 0 ? Math.max((now - hand.lastSeen) / 1000, 1e-3) : 1 / 30;
    const wasStale = now - hand.lastSeen > 300;
    hand.lastSeen = now;
    hand.confidence = confidence;
    if (wasStale) hand.filter.reset();

    const c = centroid(lm);
    const nx = (1 - c.x) * 2 - 1;
    const ny = -(c.y * 2 - 1);

    const scale = dist2d(lm[WRIST], lm[MIDDLE_MCP]);
    if (hand.baselineScale === null) hand.baselineScale = scale;
    hand.baselineScale = hand.baselineScale * 0.995 + scale * 0.005;
    const depth = THREE.MathUtils.clamp(
      (scale / Math.max(hand.baselineScale, 1e-4) - 1) * CONFIG.handDepthRange,
      -CONFIG.handDepthRange,
      CONFIG.handDepthRange,
    );

    const [fx, fy, fz] = hand.filter.filter(nx, ny, depth, now);
    const world = this.unproject(fx, fy, fz);

    const instSpeed = wasStale ? 0 : world.distanceTo(hand.position) / dt;
    hand.speed = hand.speed * 0.85 + Math.min(instSpeed, 4) * 0.15;
    hand.position.copy(world);

    const wrist = lm[WRIST];
    let curlSum = 0;
    for (const f of FINGERS) {
      const ratio = dist2d(lm[f.tip], wrist) / Math.max(dist2d(lm[f.pip], wrist), 1e-4);
      const curl =
        1 -
        THREE.MathUtils.clamp(
          (ratio - CONFIG.fingerCurledRatio) /
            (CONFIG.fingerExtendedRatio - CONFIG.fingerCurledRatio),
          0,
          1,
        );
      curlSum += curl;
    }
    const rawClosed = curlSum / FINGERS.length;
    hand.closedness += (rawClosed - hand.closedness) * CONFIG.closednessSmoothing;

    let spreadSum = 0;
    for (let i = 0; i < FINGERS.length - 1; i++) {
      spreadSum += dist2d(lm[FINGERS[i].tip], lm[FINGERS[i + 1].tip]);
    }
    const normalizedSpread = spreadSum /
      Math.max(scale * (FINGERS.length - 1), 1e-4);
    const rawSpread = THREE.MathUtils.clamp(
      (normalizedSpread - 0.32) / 0.82,
      0,
      1,
    );
    hand.spread += (rawSpread - hand.spread) * CONFIG.closednessSmoothing;

    const rawPinch = 1 - THREE.MathUtils.clamp(
      (dist2d(lm[4], lm[8]) / Math.max(scale, 1e-4) - 0.25) / 0.55,
      0,
      1,
    );
    hand.pinch += (rawPinch - hand.pinch) * 0.35;
    const indexRatio = dist2d(lm[8], wrist) / Math.max(dist2d(lm[6], wrist), 1e-4);
    hand.indexExtended = indexRatio >= CONFIG.fingerExtendedRatio;
  }

  private unproject(ndcX: number, ndcY: number, depth: number): THREE.Vector3 {
    const normal = new THREE.Vector3();
    this.camera.getWorldDirection(normal);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal.clone().negate(),
      new THREE.Vector3(0, 0.4, 0),
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = new THREE.Vector3(0, 0.4, 0);
    raycaster.ray.intersectPlane(plane, hit);
    hit.addScaledVector(normal, depth);
    return hit;
  }

  poll(): { left: HandState | null; right: HandState | null } {
    const leftLabel: Handedness = CONFIG.mirrorHandedness ? 'Right' : 'Left';
    const rightLabel: Handedness = CONFIG.mirrorHandedness ? 'Left' : 'Right';
    return {
      left: this.toState(this.hands[leftLabel]),
      right: this.toState(this.hands[rightLabel]),
    };
  }

  updateFilterParams(): void {
    const { minCutoff, beta, dCutoff } = CONFIG.oneEuro;
    this.hands.Left.filter.setParams(minCutoff, beta, dCutoff);
    this.hands.Right.filter.setParams(minCutoff, beta, dCutoff);
  }

  private toState(hand: TrackedHand): HandState | null {
    if (hand.lastSeen === 0) return null;
    const age = performance.now() - hand.lastSeen;
    if (age > CONFIG.trackingLostNeutralMs) return null;
    return {
      position: hand.position.clone(),
      closedness: age < 250 ? hand.closedness : 0,
      spread: age < 250 ? hand.spread : 0,
      pinch: age < 250 ? hand.pinch : 0,
      confidence: hand.confidence * Math.max(1 - age / CONFIG.trackingLostNeutralMs, 0),
      indexExtended: age < 250 && hand.indexExtended,
      speed: hand.speed,
      opacity: age < 60 ? 1 : Math.max(1 - (age - 60) / CONFIG.trackingLostFadeMs, 0),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.landmarker?.close();
    this.landmarker = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.video.remove();
  }
}

function centroid(lm: NormalizedLandmark[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const idx of PALM_POINTS) {
    x += lm[idx].x;
    y += lm[idx].y;
  }
  return { x: x / PALM_POINTS.length, y: y / PALM_POINTS.length };
}

function dist2d(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
