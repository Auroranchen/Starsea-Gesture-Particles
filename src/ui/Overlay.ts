import type { Quality, SceneId } from '../config';
import { ParamPanel } from './ParamPanel';
import { CONFIG, QUALITY_SIZES, SCENES } from '../config';

interface OverlaySettings {
  quality: Quality;
  bloom: boolean;
  bloomStrength: number;
  pointSize: number;
  scene: SceneId;
}

export class Overlay {
  readonly element: HTMLDivElement;
  onQualityChange: ((q: Quality) => void) | null = null;
  onBloomChange: ((on: boolean) => void) | null = null;
  onBloomStrengthChange: ((v: number) => void) | null = null;
  onParticleSizeChange: ((v: number) => void) | null = null;
  onParamChange: ((path: string, value: number) => void) | null = null;
  onFullscreen: (() => void) | null = null;
  onExitToMenu: (() => void) | null = null;
  onSceneChange: ((s: SceneId) => void) | null = null;
  onRebuild: (() => void) | null = null;

  private fpsEl: HTMLElement;
  private countEl: HTMLElement;
  private modeEl: HTMLElement;
  private stateEl: HTMLElement;
  private sceneEl: HTMLElement;
  private energyEl: HTMLElement;
  private energyFillEl: HTMLElement;
  private gatherEl: HTMLElement;
  private gatherLabelEl: HTMLElement;
  private handLDotEl: HTMLElement;
  private handRDotEl: HTMLElement;
  private posesEl: HTMLElement;
  private trackingEl: HTMLElement;
  private helpEl: HTMLElement;
  private settingsEl: HTMLElement;
  private toastEl: HTMLElement;
  private pointSizeEl: HTMLInputElement;
  private pointSizeValueEl: HTMLElement;
  private toastTimer: number | null = null;
  private settings: OverlaySettings;

  constructor() {
    this.settings = this.loadSettings();

    this.element = document.createElement('div');
    this.element.className = 'overlay';
    this.element.innerHTML = `
      <div class="hud" data-role="hud">
        <div class="hud-head">
          <span class="hud-scene-badge" data-role="scene">NEBULA</span>
          <span class="hud-state-chip" data-role="state">drift</span>
        </div>
        <div class="hud-energy-block">
          <div class="hud-energy-row">
            <span class="hud-label">ENERGY</span>
            <span class="hud-energy-val" data-role="energy">0%</span>
          </div>
          <div class="hud-bar"><span class="hud-bar-fill" data-role="energy-fill"></span></div>
        </div>
        <div class="hud-grid">
          <span class="hud-label">FPS</span><span class="hud-val" data-role="fps">--</span>
          <span class="hud-label">PARTICLES</span><span class="hud-val" data-role="count">--</span>
          <span class="hud-label">INPUT</span><span class="hud-val" data-role="mode">mouse</span>
          <span class="hud-label" data-role="gather-label">DIAL</span><span class="hud-val" data-role="gather">0%</span>
        </div>
        <div class="hud-divider"></div>
        <div class="hud-hands-row">
          <span class="hud-hand" data-role="hand-l"><span class="hud-hand-dot" data-hand="l"></span>L</span>
          <span class="hud-hand-sep"></span>
          <span class="hud-hand" data-role="hand-r"><span class="hud-hand-dot" data-hand="r"></span>R</span>
        </div>
        <div class="hud-grid">
          <span class="hud-label">POSE</span><span class="hud-val hud-val-small" data-role="poses">neutral / neutral</span>
          <span class="hud-label">TRACKING</span><span class="hud-val" data-role="tracking">mouse</span>
        </div>
        <div class="hud-keys">? help &middot; s settings &middot; p camera view</div>
      </div>
      <div class="panel help hidden" data-role="help">
        <h2>Help</h2>
        <table>
          <tr><td>&#128400; open hand / move</td><td>collide &amp; shove waves — the field calms as you open</td></tr>
          <tr><td>&#9994; close your hand / hold left</td><td>a smooth dial: the field gathers, heats, and rises into fire</td></tr>
          <tr><td>&#128406;&#128406; two open hands / hold right or space</td><td>gather a sphere between them; distance = size</td></tr>
          <tr><td>&#128400;&#128400; fling hands apart / release</td><td>burst the sphere</td></tr>
          <tr><td>finger spread</td><td>turbulence</td></tr>
          <tr><td>hand speed</td><td>energy, heat &amp; brightness</td></tr>
          <tr><td>1 / 2 / 3 &middot; 0</td><td>lock waves / sphere / fire &middot; unlock</td></tr>
          <tr><td>scroll wheel</td><td>ball radius</td></tr>
          <tr><td>h &middot; p &middot; r &middot; esc</td><td>hud &middot; camera view &middot; reset &middot; menu</td></tr>
        </table>
      </div>
      <div class="panel settings hidden" data-role="settings">
        <h2>Settings</h2>
        <div class="setting-row">
          <span>scene</span>
          <div class="seg" data-role="scene">
            <button data-scene="nebula">nebula</button>
            <button data-scene="galaxy">galaxy</button>
            <button data-scene="ocean">ocean</button>
            <button data-scene="saturn">saturn</button>
            <button data-scene="heart">heart</button>
            <button data-scene="pulse">pulse</button>
          </div>
        </div>
        <div class="setting-row">
          <span>quality</span>
          <div class="seg" data-role="quality">
            <button data-q="low">low</button>
            <button data-q="med">med</button>
            <button data-q="high">high</button>
          </div>
        </div>
        <div class="setting-row">
          <span>bloom</span>
          <button class="toggle" data-role="bloom"></button>
        </div>
        <div class="setting-row">
          <span>bloom amount <em data-role="bloom-strength-value"></em></span>
          <input type="range" data-role="bloom-strength" min="0" max="2" step="0.05" />
        </div>
        <div class="setting-row">
          <span>particle size <em data-role="point-size-value"></em></span>
          <input type="range" data-role="point-size" min="0.5" max="5" step="0.1" />
        </div>
        <div class="setting-actions">
          <button class="btn-ghost" data-role="fullscreen" title="Toggle fullscreen">fullscreen</button>
          <button class="btn-ghost" data-role="exit-menu" title="Return to the mode selection screen">back to menu</button>
        </div>
      </div>
      <div class="toast hidden" data-role="toast"></div>
    `;

    this.fpsEl = this.q('[data-role="fps"]');
    this.countEl = this.q('[data-role="count"]');
    this.modeEl = this.q('[data-role="mode"]');
    this.sceneEl = this.q('[data-role="scene"]');
    this.stateEl = this.q('[data-role="state"]');
    this.energyEl = this.q('[data-role="energy"]');
    this.energyFillEl = this.q('[data-role="energy-fill"]');
    this.gatherEl = this.q('[data-role="gather"]');
    this.gatherLabelEl = this.q('[data-role="gather-label"]');
    this.handLDotEl = this.q('[data-hand="l"]');
    this.handRDotEl = this.q('[data-hand="r"]');
    this.posesEl = this.q('[data-role="poses"]');
    this.trackingEl = this.q('[data-role="tracking"]');
    this.helpEl = this.q('[data-role="help"]');
    this.settingsEl = this.q('[data-role="settings"]');
    this.toastEl = this.q('[data-role="toast"]');
    this.pointSizeEl = this.q<HTMLInputElement>('[data-role="point-size"]');
    this.pointSizeValueEl = this.q('[data-role="point-size-value"]');

    for (const btn of this.element.querySelectorAll<HTMLButtonElement>('[data-q]')) {
      btn.addEventListener('click', () => {
        this.settings.quality = btn.dataset.q as Quality;
        this.saveSettings();
        this.syncSettingsUi();
        this.onQualityChange?.(this.settings.quality);
      });
    }
    this.q('[data-role="bloom"]').addEventListener('click', () => {
      this.settings.bloom = !this.settings.bloom;
      this.saveSettings();
      this.syncSettingsUi();
      this.onBloomChange?.(this.settings.bloom);
    });
    for (const btn of this.element.querySelectorAll<HTMLButtonElement>('[data-scene]')) {
      btn.addEventListener('click', () => {
        this.settings.scene = btn.dataset.scene as SceneId;
        this.saveSettings();
        this.syncSettingsUi();
        this.onSceneChange?.(this.settings.scene);
      });
    }
    this.q<HTMLInputElement>('[data-role="bloom-strength"]').addEventListener('input', (e) => {
      this.settings.bloomStrength = parseFloat((e.target as HTMLInputElement).value);
      this.saveSettings();
      this.syncSettingsUi();
      this.onBloomStrengthChange?.(this.settings.bloomStrength);
    });
    this.pointSizeEl.addEventListener('input', () => {
      const value = parseFloat(this.pointSizeEl.value);
      this.settings.pointSize = value;
      CONFIG.pointSize = value;
      this.saveSettings();
      this.syncSettingsUi();
      this.onParticleSizeChange?.(value);
    });
    this.q<HTMLButtonElement>('[data-role="fullscreen"]').addEventListener('click', () => {
      this.onFullscreen?.();
    });
    this.q<HTMLButtonElement>('[data-role="exit-menu"]').addEventListener('click', () => {
      this.onExitToMenu?.();
    });
    const paramPanel = new ParamPanel(() => this.onRebuild?.(), (path, value) => {
      this.onParamChange?.(path, value);
    });
    this.settingsEl.appendChild(paramPanel.element);
    this.syncSettingsUi();
  }

  private q<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.element.querySelector<T>(sel)!;
  }

  private loadSettings(): OverlaySettings {
    const defaults: OverlaySettings = {
      quality: CONFIG.defaultQuality,
      bloom: true,
      bloomStrength: CONFIG.bloom.strength,
      pointSize: CONFIG.pointSize,
      scene: CONFIG.defaultScene,
    };
    try {
      const raw = localStorage.getItem('gesture-particles.settings');
      if (!raw) return defaults;
      const stored = JSON.parse(raw) as Partial<OverlaySettings>;
      return {
        ...defaults,
        quality: stored.quality === 'low' || stored.quality === 'med' || stored.quality === 'high'
          ? stored.quality
          : defaults.quality,
        bloom: typeof stored.bloom === 'boolean' ? stored.bloom : defaults.bloom,
        bloomStrength: finiteInRange(stored.bloomStrength, 0, 2, defaults.bloomStrength),
        pointSize: finiteInRange(stored.pointSize, 0.5, 5, defaults.pointSize),
        scene: stored.scene && (SCENES as readonly string[]).includes(stored.scene)
          ? stored.scene
          : defaults.scene,
      };
    } catch {
      return defaults;
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('gesture-particles.settings', JSON.stringify(this.settings));
    } catch {}
  }

  private syncSettingsUi(): void {
    for (const btn of this.element.querySelectorAll<HTMLButtonElement>('[data-q]')) {
      btn.classList.toggle('active', btn.dataset.q === this.settings.quality);
    }
    this.q('[data-role="bloom"]').classList.toggle('on', this.settings.bloom);
    for (const btn of this.element.querySelectorAll<HTMLButtonElement>('[data-scene]')) {
      btn.classList.toggle('active', btn.dataset.scene === this.settings.scene);
    }
    const [, intense] = CONFIG.sceneDialNames[this.settings.scene];
    this.gatherLabelEl.textContent = intense;
    const slider = this.q<HTMLInputElement>('[data-role="bloom-strength"]');
    slider.value = String(this.settings.bloomStrength);
    slider.disabled = !this.settings.bloom;
    this.q('[data-role="bloom-strength-value"]').textContent =
      this.settings.bloomStrength.toFixed(2);
    this.pointSizeEl.value = String(this.settings.pointSize);
    CONFIG.pointSize = this.settings.pointSize;
    this.pointSizeValueEl.textContent = this.settings.pointSize.toFixed(1);
  }

  get bloomStrength(): number {
    return this.settings.bloomStrength;
  }

  get scene(): SceneId {
    return this.settings.scene;
  }

  setScene(id: SceneId): void {
    this.settings.scene = id;
    this.saveSettings();
    this.syncSettingsUi();
  }

  get quality(): Quality {
    return this.settings.quality;
  }

  set quality(q: Quality) {
    this.settings.quality = q;
    this.saveSettings();
    this.syncSettingsUi();
  }

  get bloom(): boolean {
    return this.settings.bloom;
  }

  update(
    fps: number,
    mode: string,
    scene: SceneId,
    stateLabel: string,
    accent: string,
    gather: number,
    energy: number,
    leftPose: string,
    rightPose: string,
    leftActive: boolean,
    rightActive: boolean,
  ): void {
    this.fpsEl.textContent = fps.toFixed(0);
    this.modeEl.textContent = mode;
    this.sceneEl.textContent = scene;
    this.stateEl.textContent = stateLabel;
    this.stateEl.style.color = accent;
    const energyValue = clamp01(energy);
    this.energyEl.textContent = `${Math.round(energyValue * 100)}%`;
    (this.energyFillEl as HTMLElement).style.width = `${energyValue * 100}%`;
    this.energyFillEl.style.background = accent;
    this.gatherEl.textContent = `${Math.round(clamp01(gather) * 100)}%`;
    this.handLDotEl.classList.toggle('active', leftActive);
    this.handRDotEl.classList.toggle('active', rightActive);
    if (leftActive) this.handLDotEl.style.background = accent;
    else this.handLDotEl.style.background = '';
    if (rightActive) this.handRDotEl.style.background = accent;
    else this.handRDotEl.style.background = '';
    this.posesEl.textContent = `${leftPose} / ${rightPose}`;
    this.trackingEl.textContent = leftActive || rightActive ? 'locked' : mode.includes('hand') ? 'lost' : 'mouse';
    this.trackingEl.style.color = leftActive || rightActive ? accent : '';
    this.countEl.textContent = formatCount(QUALITY_SIZES[this.settings.quality] ** 2);
  }

  toggleHud(): void {
    this.q('[data-role="hud"]').classList.toggle('hidden');
  }

  toggleHelp(): void {
    this.helpEl.classList.toggle('hidden');
    this.settingsEl.classList.add('hidden');
  }

  toggleSettings(): void {
    this.settingsEl.classList.toggle('hidden');
    this.helpEl.classList.add('hidden');
  }

  closePanels(): void {
    this.helpEl.classList.add('hidden');
    this.settingsEl.classList.add('hidden');
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('hidden');
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), 4200);
  }
}

function finiteInRange(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, min), max)
    : fallback;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function formatCount(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}m` : `${Math.round(n / 1000)}k`;
}
