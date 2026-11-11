import { SCALE_AXIS } from '../config';
import type { SceneId } from '../config';

interface TeachingSnapshot {
  scene: SceneId;
  dial: number;
}

interface TeachingTick {
  scene: SceneId;
  dial: number;
}

/**
 * TeachingMode — T 键 90 秒按尺度轴顺序自动巡演。
 * 每个场景 15 秒（6 × 15 = 90），dial 用缓动 0→1→0；底部字幕条显示知识点。
 * Esc 或再按 T 退出，退出后恢复启动前的场景与 dial。
 */
export class TeachingMode {
  readonly subtitleEl: HTMLElement;

  onStart: ((firstScene: SceneId) => void) | null = null;
  onSceneChange: ((id: SceneId) => void) | null = null;
  onStop: (() => void) | null = null;

  private active = false;
  private elapsed = 0;
  private snapshot: TeachingSnapshot | null = null;
  private readonly PER_SCENE = 15; // seconds per scene
  private readonly TOTAL = SCALE_AXIS.length * this.PER_SCENE; // 6 × 15 = 90s

  constructor() {
    this.subtitleEl = document.createElement('div');
    this.subtitleEl.className = 'teaching-subtitle hidden';
    this.subtitleEl.setAttribute('role', 'status');
    this.subtitleEl.setAttribute('aria-live', 'polite');
  }

  get isActive(): boolean { return this.active; }

  toggle(current: TeachingSnapshot): void {
    if (this.active) {
      this.stop();
    } else {
      this.start(current);
    }
  }

  private start(current: TeachingSnapshot): void {
    this.snapshot = { ...current };
    this.elapsed = 0;
    this.active = true;
    const first = SCALE_AXIS[0].scene;
    this.subtitleEl.classList.remove('hidden');
    this.onStart?.(first);
    this.updateSubtitle(SCALE_AXIS[0].scene);
  }

  stop(): void {
    this.active = false;
    this.subtitleEl.classList.add('hidden');
    this.subtitleEl.textContent = '';
    if (this.snapshot) {
      this.onStop?.();
    }
    this.snapshot = null;
  }

  /**
   * 每帧调用。返回当前巡演帧（scene + dial），巡演未激活则返回 null。
   * main.ts 判断非 null 时跳过真实输入，使用合成帧。
   */
  tick(dt: number): TeachingTick | null {
    if (!this.active) return null;
    this.elapsed += dt;

    if (this.elapsed >= this.TOTAL) {
      this.stop();
      return null;
    }

    const stationIndex = Math.min(
      Math.floor(this.elapsed / this.PER_SCENE),
      SCALE_AXIS.length - 1,
    );
    const entry = SCALE_AXIS[stationIndex];
    const withinStation = (this.elapsed % this.PER_SCENE) / this.PER_SCENE;
    // dial: ease 0→1→0 within each station (sine arch)
    const dial = Math.sin(withinStation * Math.PI);

    // scene change detection
    if (entry.scene !== this._lastScene) {
      this._lastScene = entry.scene;
      this.onSceneChange?.(entry.scene);
      this.updateSubtitle(entry.scene);
    }

    return { scene: entry.scene, dial };
  }

  private _lastScene: SceneId = SCALE_AXIS[0].scene;

  private updateSubtitle(scene: SceneId): void {
    const entry = SCALE_AXIS.find(e => e.scene === scene);
    if (!entry) return;
    this.subtitleEl.textContent = `${entry.scaleLabel} · ${entry.sceneName} · ${entry.force}`;
  }
}
