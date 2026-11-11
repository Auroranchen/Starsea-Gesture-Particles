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
            <span class="hud-label">能量</span>
            <span class="hud-energy-val" data-role="energy">0%</span>
          </div>
          <div class="hud-bar"><span class="hud-bar-fill" data-role="energy-fill"></span></div>
        </div>
        <div class="hud-grid">
          <span class="hud-label">帧率</span><span class="hud-val" data-role="fps">--</span>
          <span class="hud-label">粒子数</span><span class="hud-val" data-role="count">--</span>
          <span class="hud-label">输入</span><span class="hud-val" data-role="mode">鼠标</span>
          <span class="hud-label" data-role="gather-label">拨盘</span><span class="hud-val" data-role="gather">0%</span>
        </div>
        <div class="hud-divider"></div>
        <div class="hud-hands-row">
          <span class="hud-hand" data-role="hand-l"><span class="hud-hand-dot" data-hand="l"></span>左</span>
          <span class="hud-hand-sep"></span>
          <span class="hud-hand" data-role="hand-r"><span class="hud-hand-dot" data-hand="r"></span>右</span>
        </div>
        <div class="hud-grid">
          <span class="hud-label">姿态</span><span class="hud-val hud-val-small" data-role="poses">中性 / 中性</span>
          <span class="hud-label">追踪</span><span class="hud-val" data-role="tracking">鼠标</span>
        </div>
        <div class="hud-keys">? 帮助 &middot; s 设置 &middot; p 摄像头预览</div>
      </div>
      <div class="panel help hidden" data-role="help">
        <h2>帮助</h2>
        <table>
          <tr><td>&#128400; 展开手掌 / 移动</td><td>碰撞模式：手掌作为力场球推动粒子</td></tr>
          <tr><td>&#9994; 握拳 / 按住左键</td><td>调节盘：0→1 连续驱动场景形态变化</td></tr>
          <tr><td>&#128406; 右手拖动 / 右键拖动</td><td>旋转粒子场（带惯性）</td></tr>
          <tr><td>&#128400;&#128400; 双手张开 / 松开左键</td><td>冲击波：把粒子推开</td></tr>
          <tr><td>手速 / 鼠标移动速度</td><td>能量：加亮最快的粒子，放大湍流</td></tr>
          <tr><td>空格 + 拖拽</td><td>鼠标模式：按住空格再拖左键，等效于右键拖拽旋转</td></tr>
          <tr><td>1 &nbsp;/&nbsp; 2</td><td>鼠标模式：把形态轴锁在 0（张开）/ 1（握拳），便于定住演示</td></tr>
          <tr><td>0</td><td>鼠标模式：解除锁定，交回给手势或左键</td></tr>
          <tr><td>滚轮</td><td>鼠标模式：连续微调形态轴，比 1 / 2 锁存更细</td></tr>
          <tr><td>G</td><td>循环切换场景（nebula→galaxy→ocean→saturn→heart→pulse）</td></tr>
          <tr><td>[ &nbsp;/&nbsp; ]</td><td>尺度轴跳站（按物理尺度从小到大切换场景）</td></tr>
          <tr><td>K</td><td>知识卡开合 / 揭晓课堂一问答案</td></tr>
          <tr><td>T</td><td>课案模式：90 秒按尺度轴顺序自动巡演</td></tr>
          <tr><td>Q</td><td>生成分享链接（扫码同屏）</td></tr>
          <tr><td>E</td><td>导出当前画面 PNG + 参数快照 JSON</td></tr>
          <tr><td>C</td><td>切换 调节盘 / 力场碰撞 交互模式</td></tr>
          <tr><td>S</td><td>打开 / 关闭设置面板</td></tr>
          <tr><td>H</td><td>隐藏 / 显示 HUD</td></tr>
          <tr><td>P</td><td>显示 / 隐藏摄像头预览</td></tr>
          <tr><td>R</td><td>重置粒子（重新播种）</td></tr>
          <tr><td>Esc</td><td>断开摄像头，返回启动页</td></tr>
          <tr><td>? &nbsp;/&nbsp; /</td><td>本帮助面板</td></tr>
        </table>
      </div>
      <div class="panel settings hidden" data-role="settings">
        <h2>设置</h2>
        <div class="setting-row">
          <span>场景</span>
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
          <span>画质</span>
          <div class="seg" data-role="quality">
            <button data-q="low">低</button>
            <button data-q="med">中</button>
            <button data-q="high">高</button>
          </div>
        </div>
        <div class="setting-row">
          <span>泛光</span>
          <button class="toggle" data-role="bloom"></button>
        </div>
        <div class="setting-row">
          <span>泛光强度 <em data-role="bloom-strength-value"></em></span>
          <input type="range" data-role="bloom-strength" min="0" max="2" step="0.05" />
        </div>
        <div class="setting-row">
          <span>粒子大小 <em data-role="point-size-value"></em></span>
          <input type="range" data-role="point-size" min="0.5" max="5" step="0.1" />
        </div>
        <div class="setting-actions">
          <button class="btn-ghost" data-role="fullscreen" title="切换全屏">全屏</button>
          <button class="btn-ghost" data-role="exit-menu" title="回到交互模式选择页">返回启动页</button>
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
