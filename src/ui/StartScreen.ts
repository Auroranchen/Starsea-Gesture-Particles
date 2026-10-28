import type { InteractionMode } from '../input/InputManager';

export class StartScreen {
  readonly element: HTMLDivElement;

  private readonly cameraButton: HTMLButtonElement;
  private readonly mouseButton: HTMLButtonElement;
  private readonly status: HTMLParagraphElement;
  private readonly modeButtons: NodeListOf<HTMLButtonElement>;
  private selectedMode: InteractionMode = 'dials';

  constructor(
    onCamera: () => Promise<void>,
    onMouse: () => void,
    onModeChange: (mode: InteractionMode) => void,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'start-screen';
    this.element.setAttribute('aria-label', 'Gesture particles welcome screen');
    this.element.innerHTML = `
      <div class="start-shell">
        <header class="start-header">
          <div class="start-brand">
            <span class="start-brand-mark" aria-hidden="true"><i></i></span>
            <span>GESTURE PARTICLES</span>
          </div>
          <div class="start-meta">WEBGL2 / REALTIME / 2026</div>
        </header>

        <main class="start-main">
          <section class="start-copy" aria-labelledby="start-title">
            <p class="start-kicker"><span aria-hidden="true"></span> REALTIME SPATIAL EXPERIMENT</p>
            <h1 id="start-title">传智杯：<br><span>智控星海</span></h1>
            <p class="start-description">
              用手势或鼠标塑造 GPU 粒子场。张开手掌让星云舒展，握拳让能量聚拢，在 Nebula、Galaxy、Ocean、Saturn、Heart 与 Pulse 六种实时场景之间切换。
            </p>
            <div class="start-tags" aria-label="核心技术">
              <span>MediaPipe HandLandmarker</span>
              <span>Three.js / WebGL2</span>
              <span>GPGPU Simulation</span>
              <span>Bloom Pipeline</span>
            </div>
            <div class="start-mode" aria-labelledby="start-mode-title">
              <div class="start-mode-heading">
                <span id="start-mode-title">选择交互模式</span>
                <span class="start-mode-key"><kbd>C</kbd> 游戏中可切换</span>
              </div>
              <div class="mode-options" role="group" aria-label="交互模式">
                <button class="mode-option active" data-mode="dials" type="button" aria-pressed="true">
                  <span class="mode-option-mark" aria-hidden="true">◌</span>
                  <span><strong>双手控制</strong><small>左手聚拢 · 右手旋转</small></span>
                </button>
                <button class="mode-option" data-mode="collider" type="button" aria-pressed="false">
                  <span class="mode-option-mark" aria-hidden="true">✦</span>
                  <span><strong>力场碰撞</strong><small>手掌成为粒子力场</small></span>
                </button>
              </div>
            </div>
            <div class="start-actions" aria-label="开始体验">
              <button class="btn-primary start-action" data-action="camera" type="button">
                <span class="action-icon" aria-hidden="true">◎</span>
                <span><strong>进入手势粒子场</strong><small>允许摄像头，获得完整交互</small></span>
                <span class="action-arrow" aria-hidden="true">↗</span>
              </button>
              <button class="btn-ghost start-action" data-action="mouse" type="button">
                <span class="action-icon" aria-hidden="true">⌁</span>
                <span><strong>使用鼠标探索</strong><small>无需摄像头，立即开始</small></span>
                <span class="action-arrow" aria-hidden="true">→</span>
              </button>
            </div>
            <p class="start-note" data-role="status" role="status" aria-live="polite"></p>
          </section>

          <aside class="start-visual" aria-label="实时实验信息">
            <div class="visual-orbit" aria-hidden="true">
              <div class="visual-ring visual-ring-one"></div>
              <div class="visual-ring visual-ring-two"></div>
              <div class="visual-core"></div>
              <div class="visual-cross visual-cross-x"></div>
              <div class="visual-cross visual-cross-y"></div>
            </div>
            <div class="visual-label visual-label-top">FIELD / 01</div>
            <div class="visual-label visual-label-bottom">LIVE PARTICLE RESPONSE</div>
            <div class="visual-readout">
              <span class="readout-dot" aria-hidden="true"></span>
              <span>SIMULATION READY</span>
            </div>
            <div class="scene-index" aria-label="可用场景">
              <span class="scene-index-title">SCENE INDEX</span>
              <span class="scene-index-item active"><b>01</b> NEBULA <em>cloud / ball</em></span>
              <span class="scene-index-item"><b>02</b> GALAXY <em>orbit / star forge</em></span>
              <span class="scene-index-item"><b>03</b> OCEAN <em>calm / aurora</em></span>
              <span class="scene-index-item"><b>04</b> SATURN <em>orbit / rings</em></span>
              <span class="scene-index-item"><b>05</b> HEART <em>heartbeat / dark core</em></span>
              <span class="scene-index-item"><b>06</b> PULSE <em>fireworks / ion pulse</em></span>
            </div>
          </aside>
        </main>

        <footer class="start-footer">
          <span>LOCAL PROCESSING · CAMERA DATA STAYS IN YOUR BROWSER</span>
          <span class="start-footer-key"><kbd>ESC</kbd> return to menu <span aria-hidden="true">·</span> <kbd>G</kbd> switch scene</span>
        </footer>
      </div>
    `;

    this.status = this.element.querySelector<HTMLParagraphElement>('[data-role="status"]')!;
    this.cameraButton = this.element.querySelector<HTMLButtonElement>('[data-action="camera"]')!;
    this.mouseButton = this.element.querySelector<HTMLButtonElement>('[data-action="mouse"]')!;
    this.modeButtons = this.element.querySelectorAll<HTMLButtonElement>('[data-mode]');

    for (const button of this.modeButtons) {
      button.addEventListener('click', () => {
        const mode = button.dataset.mode as InteractionMode;
        this.selectedMode = mode;
        this.syncModeUi();
        onModeChange(mode);
      });
    }

    this.cameraButton.addEventListener('click', async () => {
      this.cameraButton.disabled = true;
      this.mouseButton.disabled = true;
      this.cameraButton.setAttribute('aria-busy', 'true');
      this.setStatus('正在加载手势识别模块，请稍候…', 'loading');
      try {
        await onCamera();
        this.setStatus('手势模式已连接。', 'success');
        this.hide();
      } catch (err) {
        this.cameraButton.disabled = false;
        this.mouseButton.disabled = false;
        this.cameraButton.removeAttribute('aria-busy');
        this.setStatus(cameraErrorMessage(err), 'error');
        this.mouseButton.focus();
      }
    });

    this.mouseButton.addEventListener('click', () => {
      onMouse();
      this.hide();
    });
  }

  show(): void {
    this.element.classList.remove('hidden');
    this.cameraButton.disabled = false;
    this.mouseButton.disabled = false;
    this.cameraButton.removeAttribute('aria-busy');
    this.cameraButton.focus({ preventScroll: true });
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  get interactionMode(): InteractionMode {
    return this.selectedMode;
  }

  private syncModeUi(): void {
    for (const button of this.modeButtons) {
      const active = button.dataset.mode === this.selectedMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  private setStatus(message: string, kind: 'loading' | 'error' | 'success'): void {
    this.status.textContent = message;
    this.status.dataset.state = kind;
  }
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return '摄像头权限未开启。你仍可以使用鼠标模式进入作品。';
    }
    if (error.name === 'NotFoundError') {
      return '没有找到可用摄像头。你仍可以使用鼠标模式进入作品。';
    }
    if (error.name === 'NotReadableError') {
      return '摄像头可能正在被其他应用使用。你仍可以使用鼠标模式进入作品。';
    }
  }
  return '手势识别模块加载失败。你仍可以使用鼠标模式进入作品。';
}
