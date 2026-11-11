import * as THREE from 'three';
import type { HandState } from './InputManager';

export type HandPose = 'neutral' | 'open' | 'fist' | 'pinch' | 'point';

/**
 * 姿态判定的阈值。**唯一事实源**：
 * `classify()` 用它做判定，`WebcamPanel` 用它画阈值刻度和解释文案。
 * 两者共用同一份常量，避免「面板上显示的阈值」与「实际生效的判定」漂移。
 */
export const POSE_THRESHOLDS = {
  pinch: 0.72,
  fistClosedness: 0.72,
  fistSpreadMax: 0.58,
  openClosednessMax: 0.28,
  openSpreadMin: 0.42,
  pointClosednessMin: 0.28,
  pointClosednessMax: 0.68,
} as const;

/** 判定需要连续保持的帧数（在 30Hz 检测频率下约 4 帧 ≈ 130ms）。 */
export const POSE_STABLE_FRAMES = 4;

export interface GestureClassifierOptions {
  stableFrames?: number;
  minConfidence?: number;
  cooldownMs?: number;
}

/** Classifies normalized hand features with hysteresis and stable-frame gating. */
export class GestureClassifier {
  pose: HandPose = 'neutral';
  private candidate: HandPose = 'neutral';
  private candidateFrames = 0;
  private lastChange = -Infinity;
  private readonly stableFrames: number;
  private readonly minConfidence: number;
  private readonly cooldownMs: number;

  constructor(options: GestureClassifierOptions = {}) {
    this.stableFrames = options.stableFrames ?? POSE_STABLE_FRAMES;
    this.minConfidence = options.minConfidence ?? 0.45;
    this.cooldownMs = options.cooldownMs ?? 120;
  }

  update(hand: HandState | null, now = performance.now()): HandPose {
    const next = hand && hand.opacity > 0.05 && hand.confidence >= this.minConfidence
      ? classify(hand)
      : 'neutral';

    if (next !== this.candidate) {
      this.candidate = next;
      this.candidateFrames = 1;
    } else {
      this.candidateFrames++;
    }

    if (
      this.candidateFrames >= this.stableFrames &&
      this.pose !== this.candidate &&
      now - this.lastChange >= this.cooldownMs
    ) {
      this.pose = this.candidate;
      this.lastChange = now;
    }
    return this.pose;
  }

  reset(): void {
    this.pose = 'neutral';
    this.candidate = 'neutral';
    this.candidateFrames = 0;
    this.lastChange = -Infinity;
  }
}

/**
 * 单帧瞬时判定（不做防抖）。面板的「实时读数」直接展示这个结果，
 * 而真正驱动场景的是外层经过 stableFrames 防抖后的 pose。
 */
export function classify(hand: HandState): HandPose {
  const t = POSE_THRESHOLDS;
  if (hand.pinch >= t.pinch) return 'pinch';
  if (hand.closedness >= t.fistClosedness && hand.spread < t.fistSpreadMax) return 'fist';
  if (hand.closedness <= t.openClosednessMax && hand.spread >= t.openSpreadMin) return 'open';
  if (
    hand.indexExtended &&
    hand.closedness >= t.pointClosednessMin &&
    hand.closedness <= t.pointClosednessMax
  ) {
    return 'point';
  }
  return 'neutral';
}

export function midpoint(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  return a.clone().add(b).multiplyScalar(0.5);
}

export function normalizedDistance(a: THREE.Vector3, b: THREE.Vector3, min: number, max: number): number {
  return THREE.MathUtils.clamp((a.distanceTo(b) - min) / Math.max(max - min, 1e-4), 0, 1);
}
