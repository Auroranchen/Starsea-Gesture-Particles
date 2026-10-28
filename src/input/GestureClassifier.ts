import * as THREE from 'three';
import type { HandState } from './InputManager';

export type HandPose = 'neutral' | 'open' | 'fist' | 'pinch' | 'point';

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
    this.stableFrames = options.stableFrames ?? 4;
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

function classify(hand: HandState): HandPose {
  if (hand.pinch >= 0.72) return 'pinch';
  if (hand.closedness >= 0.72 && hand.spread < 0.58) return 'fist';
  if (hand.closedness <= 0.28 && hand.spread >= 0.42) return 'open';
  if (hand.indexExtended && hand.closedness >= 0.28 && hand.closedness <= 0.68) return 'point';
  return 'neutral';
}

export function midpoint(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  return a.clone().add(b).multiplyScalar(0.5);
}

export function normalizedDistance(a: THREE.Vector3, b: THREE.Vector3, min: number, max: number): number {
  return THREE.MathUtils.clamp((a.distanceTo(b) - min) / Math.max(max - min, 1e-4), 0, 1);
}
