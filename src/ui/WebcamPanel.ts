import type { HandTracker } from '../input/HandTracker';
import { classify, POSE_STABLE_FRAMES, POSE_THRESHOLDS, type HandPose } from '../input/GestureClassifier';

const CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

type HandSnapshot = ReturnType<HandTracker['poll']>['left'];

const POSE_LABEL: Record<HandPose | 'lost', string> = {
  neutral: '中性',
  open: '张开',
  fist: '握拳',
  pinch: '捏合',
  point: '指向',
  lost: '未检测到',
};

/**
 * 摄像头预览窗。除了画面与 21 点骨架，它还承担一件事：
 * **把模型的判定过程摊开给用户看**——握拳度、张开度、阈值线、瞬时判定，
 * 让人能看出「手势 → 数值 → 形态」这条因果链，而不是面对一个黑箱。
 */
export class WebcamPanel {
  readonly element: HTMLDivElement;
  visible = false;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bars: Record<'l' | 'r', { closed: HTMLElement; spread: HTMLElement }>;
  private values: Record<'l' | 'r', { closed: HTMLElement; spread: HTMLElement; pinch: HTMLElement; pose: HTMLElement }>;
  private lastReadout = 0;

  constructor(private tracker: () => HandTracker | null) {
    this.element = document.createElement('div');
    this.element.className = 'webcam-panel hidden';
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.element.appendChild(this.canvas);

    const label = document.createElement('div');
    label.className = 'webcam-label';
    label.textContent = '手势识别';
    this.element.appendChild(label);

    this.ctx = this.canvas.getContext('2d')!;

    this.element.appendChild(this.buildReadout());

    const q = (sel: string) => this.element.querySelector(sel) as HTMLElement;
    this.bars = {
      l: { closed: q('[data-role="l-closed-bar"]'), spread: q('[data-role="l-spread-bar"]') },
      r: { closed: q('[data-role="r-closed-bar"]'), spread: q('[data-role="r-spread-bar"]') },
    };
    this.values = {
      l: {
        closed: q('[data-role="l-closed"]'),
        spread: q('[data-role="l-spread"]'),
        pinch: q('[data-role="l-pinch"]'),
        pose: q('[data-role="l-pose"]'),
      },
      r: {
        closed: q('[data-role="r-closed"]'),
        spread: q('[data-role="r-spread"]'),
        pinch: q('[data-role="r-pinch"]'),
        pose: q('[data-role="r-pose"]'),
      },
    };
  }

  /** 判定读数的面板：每只手一行，含阈值刻度。 */
  private buildReadout(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'webcam-readout';
    const fist = Math.round(POSE_THRESHOLDS.fistClosedness * 100);
    wrap.innerHTML = `
      <div class="wr-head">
        <span class="wr-title">实时判定</span>
        <span class="wr-note">阈值 ${POSE_THRESHOLDS.fistClosedness.toFixed(2)}</span>
      </div>
      <div class="wr-row">
        <span class="wr-hand">左</span>
        <span class="wr-metric">
          <span class="wr-name">握拳度</span>
          <span class="wr-bar" style="--tick:${fist}%"><i data-role="l-closed-bar"></i></span>
          <b data-role="l-closed">0.00</b>
        </span>
        <span class="wr-metric">
          <span class="wr-name">张开度</span>
          <span class="wr-bar"><i data-role="l-spread-bar"></i></span>
          <b data-role="l-spread">0.00</b>
        </span>
        <span class="wr-pose" data-role="l-pose">未检测到</span>
      </div>
      <div class="wr-row">
        <span class="wr-hand">右</span>
        <span class="wr-metric">
          <span class="wr-name">握拳度</span>
          <span class="wr-bar" style="--tick:${fist}%"><i data-role="r-closed-bar"></i></span>
          <b data-role="r-closed">0.00</b>
        </span>
        <span class="wr-metric">
          <span class="wr-name">张开度</span>
          <span class="wr-bar"><i data-role="r-spread-bar"></i></span>
          <b data-role="r-spread">0.00</b>
        </span>
        <span class="wr-pose" data-role="r-pose">未检测到</span>
      </div>
      <p class="wr-foot">捏合 左 <b data-role="l-pinch">0.00</b> · 右 <b data-role="r-pinch">0.00</b>　连续 ${POSE_STABLE_FRAMES} 帧稳定才切换姿态</p>
    `;
    return wrap;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.element.classList.toggle('hidden', !this.visible);
  }

  update(): void {
    if (!this.visible) return;
    const tracker = this.tracker();
    const ctx = this.ctx;
    const { width: w, height: h } = this.canvas;

    ctx.fillStyle = '#0a0a0e';
    ctx.fillRect(0, 0, w, h);

    if (!tracker) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '16px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('摄像头未开启 · 鼠标模式', w / 2, h / 2);
      this.renderReadout(null, null);
      return;
    }

    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    if (tracker.video.readyState >= 2) ctx.drawImage(tracker.video, 0, 0, w, h);
    ctx.restore();

    const { left, right } = tracker.poll();
    const visibleHands = [left, right].some((hand) => hand && hand.opacity > 0.05);

    if (visibleHands) {
      for (const lm of tracker.landmarks) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const [a, b] of CONNECTIONS) {
          ctx.moveTo((1 - lm[a].x) * w, lm[a].y * h);
          ctx.lineTo((1 - lm[b].x) * w, lm[b].y * h);
        }
        ctx.stroke();
        ctx.fillStyle = '#17c3ff';
        for (const p of lm) {
          ctx.beginPath();
          ctx.arc((1 - p.x) * w, p.y * h, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '13px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`识别 ${tracker.detectionFps.toFixed(0)} Hz`, 12, h - 12);
    if (!visibleHands) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.48)';
      ctx.fillText('未检测到手', w / 2, h / 2);
    }

    // 读数每 100ms 更新一次即可，避免每帧都触发 DOM 写入
    const now = performance.now();
    if (now - this.lastReadout >= 100) {
      this.lastReadout = now;
      this.renderReadout(left, right);
    }
  }

  private renderReadout(left: HandSnapshot, right: HandSnapshot): void {
    this.renderHand('l', left);
    this.renderHand('r', right);
  }

  private renderHand(side: 'l' | 'r', hand: HandSnapshot): void {
    const bars = this.bars[side];
    const vals = this.values[side];
    // 收窄成非空对象，后续读写与判定都基于它
    const live = hand && hand.opacity > 0.05 ? hand : null;

    const closed = live ? live.closedness : 0;
    const spread = live ? live.spread : 0;
    const pinch = live ? live.pinch : 0;

    bars.closed.style.width = `${(closed * 100).toFixed(1)}%`;
    bars.spread.style.width = `${(spread * 100).toFixed(1)}%`;
    vals.closed.textContent = closed.toFixed(2);
    vals.spread.textContent = spread.toFixed(2);
    vals.pinch.textContent = pinch.toFixed(2);

    const pose = live ? classify(live) : 'lost';
    vals.pose.textContent = POSE_LABEL[pose];
    vals.pose.dataset.pose = pose;
  }
}
