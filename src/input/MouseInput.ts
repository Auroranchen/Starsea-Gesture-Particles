import * as THREE from 'three';
import type { GestureFrame } from './InputManager';

type MouseFrame = Pick<
  GestureFrame,
  'gather' | 'bothFists' | 'rotate' | 'speed' | 'leftActive' | 'rightActive'
>;

interface PointerPosition {
  x: number;
  y: number;
}

export class MouseInput {
  private gather = 0;
  private wheelGather = 0;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private ndc = new THREE.Vector2();
  private worldPos = new THREE.Vector3(0, 0.4, 0);
  private locked: 'cloud' | 'ball' | null = null;
  private leftDown = false;
  private rotateDown = false;
  private spaceDown = false;
  private fistDown = false;
  private lastPoll = performance.now();
  private dragDelta = new THREE.Vector2();
  private speed = 0;
  private lastMove = performance.now();
  private lastMidpoint: PointerPosition | null = null;
  private pointers = new Map<number, PointerPosition>();

  constructor(
    canvas: HTMLCanvasElement,
    private camera: THREE.PerspectiveCamera,
  ) {
    canvas.addEventListener('pointermove', (e) => {
      const previous = this.pointers.get(e.pointerId);
      const current = { x: e.clientX, y: e.clientY };
      this.pointers.set(e.pointerId, current);

      if (!previous) {
        this.updateWorldPosition(e.clientX, e.clientY);
        this.lastMove = performance.now();
        return;
      }

      const now = performance.now();
      const dx = e.clientX - previous.x;
      const dy = e.clientY - previous.y;
      this.updateWorldPosition(e.clientX, e.clientY);

      const dt = Math.max((now - this.lastMove) / 1000, 1e-3);
      const instSpeed = Math.hypot(dx, dy) / window.innerHeight / dt;
      this.speed = this.speed * 0.85 + Math.min(instSpeed * 2.5, 4) * 0.15;
      this.lastMove = now;

      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const midpoint = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
        if (this.lastMidpoint) {
          this.dragDelta.x += ((midpoint.x - this.lastMidpoint.x) / window.innerHeight) * 5;
          this.dragDelta.y += (-(midpoint.y - this.lastMidpoint.y) / window.innerHeight) * 5;
        }
        this.lastMidpoint = midpoint;
      } else {
        this.lastMidpoint = null;
        if (this.rotateDown || this.spaceDown) {
          this.dragDelta.x += (dx / window.innerHeight) * 5;
          this.dragDelta.y += (-dy / window.innerHeight) * 5;
        }
      }
    });

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.lastMove = performance.now();
      this.updateWorldPosition(e.clientX, e.clientY);

      if (e.pointerType === 'touch' || e.button === 0) this.leftDown = true;
      else if (e.button === 2) this.rotateDown = true;
      if (this.pointers.size >= 2) this.leftDown = false;
    });

    const releasePointer = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        this.leftDown = false;
        this.rotateDown = false;
        this.lastMidpoint = null;
      } else if (this.pointers.size === 1) {
        this.leftDown = false;
        this.lastMidpoint = null;
      }
      if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);
    canvas.addEventListener('lostpointercapture', (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        this.leftDown = false;
        this.rotateDown = false;
        this.lastMidpoint = null;
      }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.wheelGather = THREE.MathUtils.clamp(
          this.wheelGather - Math.sign(e.deltaY) * 0.08,
          0,
          1,
        );
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') this.spaceDown = true;
      if (e.code === 'KeyB') this.fistDown = true;
      if (e.key === '1') this.locked = 'cloud';
      if (e.key === '2') this.locked = 'ball';
      if (e.key === '0') this.locked = null;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceDown = false;
      if (e.code === 'KeyB') this.fistDown = false;
    });
    window.addEventListener('blur', () => {
      this.pointers.clear();
      this.leftDown = false;
      this.rotateDown = false;
      this.spaceDown = false;
      this.fistDown = false;
      this.lastMidpoint = null;
    });
  }

  private updateWorldPosition(clientX: number, clientY: number): void {
    this.ndc.set(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    const planeNormal = new THREE.Vector3();
    this.camera.getWorldDirection(planeNormal).negate();
    this.plane.setFromNormalAndCoplanarPoint(planeNormal, new THREE.Vector3(0, 0.4, 0));
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.worldPos);
  }

  poll(): { frame: MouseFrame; pointerWorld: THREE.Vector3 } {
    const now = performance.now();
    const dt = Math.min((now - this.lastPoll) / 1000, 0.1);
    this.lastPoll = now;
    if (now - this.lastMove > 90) this.speed *= 0.9;

    const target =
      this.locked === 'ball' ? 1 : this.locked === 'cloud' ? 0 : this.leftDown ? 1 : this.wheelGather;
    const ramp = dt / 0.35;
    if (this.gather < target) this.gather = Math.min(this.gather + ramp, target);
    else if (this.gather > target) this.gather = Math.max(this.gather - ramp, target);

    const rotate = { dx: this.dragDelta.x, dy: this.dragDelta.y };
    this.dragDelta.set(0, 0);

    return {
      frame: {
        gather: this.gather,
        bothFists: this.fistDown ? 1 : 0,
        rotate,
        speed: this.speed,
        leftActive: this.pointers.size > 0,
        rightActive: this.pointers.size > 0,
      },
      pointerWorld: this.worldPos,
    };
  }
}
