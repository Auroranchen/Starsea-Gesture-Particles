import { SCALE_AXIS } from '../config';
import type { SceneId } from '../config';

/**
 * ScaleAxis — 底部对数尺度轴
 * 六个场景按尺度从小到大排列（heart → galaxy），当前场景高亮。
 * 静置 5 秒后淡出；鼠标移动或按键恢复。
 * prefers-reduced-motion 下直接显隐，不做过渡动画。
 */
export class ScaleAxis {
  readonly element: HTMLElement;
  /** 当场景变化时调用此回调（来自 main.ts 的 switchScene）。 */
  onNavigate: ((id: SceneId) => void) | null = null;
  /** 别名，兼容 main.ts 的 onSceneRequest 写法。 */
  get onSceneRequest(): ((id: SceneId) => void) | null { return this.onNavigate; }
  set onSceneRequest(fn: ((id: SceneId) => void) | null) { this.onNavigate = fn; }

  private currentScene: SceneId = SCALE_AXIS[0].scene;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FADE_DELAY = 5000;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'scale-axis';
    this.element.setAttribute('role', 'navigation');
    this.element.setAttribute('aria-label', '尺度轴场景导航');
    this.element.innerHTML = this.buildHTML();

    // 点击站点切换场景
    this.element.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-scale-scene]');
      if (!btn) return;
      const id = btn.dataset.scaleScene as SceneId;
      this.onSceneRequest?.(id);
    });

    // 任意交互都重置淡出计时器
    const resetFade = () => this.resetFade();
    document.addEventListener('mousemove', resetFade, { passive: true });
    document.addEventListener('keydown', resetFade, { passive: true });
    document.addEventListener('pointerdown', resetFade, { passive: true });

    this.startFadeTimer();
  }

  private buildHTML(): string {
    const items = SCALE_AXIS.map((entry) => `
      <button
        class="scale-axis-station"
        data-scale-scene="${entry.scene}"
        title="${entry.scaleLabel} · ${entry.force}"
        aria-label="${entry.scene}场景，${entry.scaleLabel}"
      >
        <span class="scale-axis-dot"></span>
        <span class="scale-axis-label">${entry.scene}</span>
        <span class="scale-axis-scale">${entry.scaleLabel}</span>
      </button>
    `).join('');

    return `
      <div class="scale-axis-track">
        <span class="scale-axis-line" aria-hidden="true"></span>
        ${items}
      </div>
      <div class="scale-axis-title" aria-hidden="true">跨越 22 个数量级 · 物理课堂</div>
    `;
  }

  /** 切换当前高亮站点（由 main.ts 在 switchScene 后调用）。 */
  setScene(id: SceneId): void {
    this.currentScene = id;
    for (const btn of this.element.querySelectorAll<HTMLButtonElement>('[data-scale-scene]')) {
      const active = btn.dataset.scaleScene === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-current', active ? 'true' : 'false');
    }
    this.resetFade();
  }

  /** [ 键：向尺度更小的站点跳（由 main.ts 调用）。 */
  prev(): void {
    const id = this.stepScene(-1);
    if (id !== this.currentScene) this.onNavigate?.(id);
  }

  /** ] 键：向尺度更大的站点跳（由 main.ts 调用）。 */
  next(): void {
    const id = this.stepScene(1);
    if (id !== this.currentScene) this.onNavigate?.(id);
  }

  /** 在尺度轴上向前/向后跳一站，返回目标场景 ID。 */
  private stepScene(direction: 1 | -1): SceneId {
    const idx = SCALE_AXIS.findIndex((e) => e.scene === this.currentScene);
    const next = SCALE_AXIS[Math.max(0, Math.min(SCALE_AXIS.length - 1, idx + direction))];
    return next.scene;
  }

  private startFadeTimer(): void {
    this.clearFadeTimer();
    this.fadeTimer = setTimeout(() => {
      this.element.classList.add('faded');
    }, this.FADE_DELAY);
  }

  private resetFade(): void {
    this.element.classList.remove('faded');
    this.startFadeTimer();
  }

  private clearFadeTimer(): void {
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }
}
