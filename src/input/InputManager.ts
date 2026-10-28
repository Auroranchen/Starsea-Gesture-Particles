import * as THREE from 'three';
import { MouseInput } from './MouseInput';
import type { HandTracker } from './HandTracker';
import type { HandPose } from './GestureClassifier';
import { GestureClassifier, midpoint, normalizedDistance } from './GestureClassifier';

export interface HandState {
  position: THREE.Vector3;
  closedness: number;
  spread: number;
  pinch: number;
  confidence: number;
  indexExtended: boolean;
  speed: number;
  opacity: number;
}

export interface GestureFrame {
  mode: InteractionMode;
  modeToggled: boolean;
  gather: number;
  bothFists: number;
  expansion: number;
  blackHole: number;
  galaxyScale: number;
  gravityCenter: THREE.Vector3;
  gravityAxis: THREE.Vector3;
  gravityStrength: number;
  separation: number;
  separationVelocity: number;
  burst: number;
  primaryPose: HandPose;
  secondaryPose: HandPose;
  leftPose: HandPose;
  rightPose: HandPose;
  left: HandState | null;
  right: HandState | null;
  rotate: { dx: number; dy: number };
  colliders: ColliderState[];
  speed: number;
  leftActive: boolean;
  rightActive: boolean;
}

export interface ColliderState {
  position: THREE.Vector3;
  speed: number;
  opacity: number;
}

export type InteractionMode = 'dials' | 'collider';

export type InputMode = 'mouse' | 'hand';

export class InputManager {
  mode: InputMode = 'mouse';
  interactionMode: InteractionMode = 'dials';
  readonly mouse: MouseInput;
  private hands: HandTracker | null = null;
  private prevRight: THREE.Vector3 | null = null;
  private prevSeparation = 0;
  private prevSeparationAt = performance.now();
  private gravityCenter = new THREE.Vector3();
  private gravityAxis = new THREE.Vector3(1, 0, 0);
  private heldGather = 0;
  private pendingToggle = false;
  private readonly leftClassifier = new GestureClassifier();
  private readonly rightClassifier = new GestureClassifier();

  constructor(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    this.mouse = new MouseInput(canvas, camera);
  }

  attachHands(tracker: HandTracker): void {
    this.hands = tracker;
    this.mode = 'hand';
  }

  detachHands(): void {
    this.hands?.dispose();
    this.hands = null;
    this.mode = 'mouse';
  }

  setInteractionMode(mode: InteractionMode): void {
    if (mode === this.interactionMode) return;
    this.interactionMode = mode;
    this.pendingToggle = false;
    this.prevRight = null;
  }

  toggleInteractionMode(): void {
    this.pendingToggle = true;
  }

  poll(): { frame: GestureFrame; usingHands: boolean } {
    const modeToggled = this.consumeToggles();

    if (this.hands) {
      const { left, right } = this.hands.poll();
      if (left || right) {
        return { frame: this.handFrame(left, right, modeToggled), usingHands: true };
      }
      this.prevRight = null;
      this.leftClassifier.reset();
      this.rightClassifier.reset();
    }
    return { frame: this.mouseFrame(modeToggled), usingHands: false };
  }

  private consumeToggles(): boolean {
    if (!this.pendingToggle) return false;
    this.pendingToggle = false;
    this.interactionMode = this.interactionMode === 'dials' ? 'collider' : 'dials';
    return true;
  }

  private handFrame(
    left: HandState | null,
    right: HandState | null,
    externalToggle: boolean,
  ): GestureFrame {
    const now = performance.now();
    const modeToggled = externalToggle;
    const leftPose = this.leftClassifier.update(left, now);
    const rightPose = this.rightClassifier.update(right, now);
    const speed = Math.max(left?.speed ?? 0, right?.speed ?? 0);
    const twoHands = !!left && !!right;
    const primary = right ?? left;
    const secondary = right ? left : null;
    const expansion = primary ? primary.spread * primary.opacity : 0;
    const blackHole = Math.max(leftPose === 'fist' ? left?.closedness ?? 0 : 0, rightPose === 'fist' ? right?.closedness ?? 0 : 0);
    const bothFists = twoHands && leftPose === 'fist' && rightPose === 'fist'
      ? Math.min(left.closedness, right.closedness) * Math.min(left.opacity, right.opacity)
      : 0;
    const burst = twoHands && (leftPose === 'open' || rightPose === 'open')
      ? Math.max(left?.speed ?? 0, right?.speed ?? 0) * 0.25
      : 0;

    let separation = 0;
    let separationVelocity = 0;
    if (twoHands) {
      separation = normalizedDistance(left.position, right.position, 0.35, 3.2);
      const dt = Math.max((now - this.prevSeparationAt) / 1000, 1e-3);
      separationVelocity = (separation - this.prevSeparation) / dt;
      this.prevSeparation = separation;
      this.prevSeparationAt = now;
      this.gravityCenter.copy(midpoint(left.position, right.position));
      this.gravityAxis.copy(right.position).sub(left.position).normalize();
    } else {
      this.prevSeparation = separation;
      this.prevSeparationAt = now;
    }

    const colliders: ColliderState[] = [];
    if (this.interactionMode === 'collider') {
      for (const hand of [left, right]) {
        if (hand) colliders.push({ position: hand.position.clone(), speed: hand.speed, opacity: hand.opacity });
      }
      this.prevRight = null;
      this.heldGather *= 0.95;
    }

    let gather = this.heldGather;
    if (left) {
      gather = left.closedness * left.opacity;
      this.heldGather = gather;
    } else {
      this.heldGather *= 0.97;
      gather = this.heldGather;
    }

    const rotate = { dx: 0, dy: 0 };
    if (right && this.interactionMode === 'dials') {
      if (this.prevRight) {
        rotate.dx = right.position.x - this.prevRight.x;
        rotate.dy = right.position.y - this.prevRight.y;
      }
      this.prevRight = (this.prevRight ?? new THREE.Vector3()).copy(right.position);
    } else {
      this.prevRight = null;
    }

    return {
      mode: this.interactionMode,
      modeToggled,
      gather,
      bothFists,
      expansion,
      blackHole,
      galaxyScale: separation,
      gravityCenter: this.gravityCenter.clone(),
      gravityAxis: this.gravityAxis.clone(),
      gravityStrength: twoHands ? Math.min(1, 0.35 + Math.abs(separationVelocity) * 0.08) : 0,
      separation,
      separationVelocity,
      burst: Math.min(burst, 1),
      primaryPose: primary === right ? rightPose : leftPose,
      secondaryPose: secondary === left ? leftPose : 'neutral',
      leftPose,
      rightPose,
      left,
      right,
      rotate,
      colliders,
      speed,
      leftActive: !!left,
      rightActive: !!right,
    };
  }

  private mouseFrame(modeToggled: boolean): GestureFrame {
    const { frame, pointerWorld } = this.mouse.poll();
    const base = {
      bothFists: frame.bothFists,
      expansion: 0,
      blackHole: frame.gather,
      galaxyScale: frame.gather,
      gravityCenter: pointerWorld.clone(),
      gravityAxis: new THREE.Vector3(1, 0, 0),
      gravityStrength: 0,
      separation: frame.gather,
      separationVelocity: 0,
      burst: 0,
      primaryPose: 'neutral' as HandPose,
      secondaryPose: 'neutral' as HandPose,
      leftPose: 'neutral' as HandPose,
      rightPose: 'neutral' as HandPose,
      left: null,
      right: null,
    };
    if (this.interactionMode === 'collider') {
      return {
        ...base,
        mode: 'collider',
        modeToggled,
        gather: 0,
        rotate: { dx: 0, dy: 0 },
        colliders: [{ position: pointerWorld.clone(), speed: frame.speed, opacity: 1 }],
        speed: frame.speed,
        leftActive: true,
        rightActive: true,
      };
    }
    return {
      ...base,
      ...frame,
      mode: 'dials',
      modeToggled,
      colliders: [],
      leftActive: false,
      rightActive: false,
    };
  }
}
