/**
 * KnowledgeCard.ts — 六张知识卡（P0）
 *
 * 每个场景：概念、你正在改变的物理量、尺度与主导力、现实对照、课堂一问（答案默认折叠）。
 * 交互：K 键**固定显示 / 再按收起**（不会自动消失）；未固定时切场景会自动淡入 3 秒后淡出。
 * 不遮挡 HUD（左下角）。
 *
 * 文案纪律：卡里出现的所有数值均来自 config.ts 的实际值，核对注释写在每条旁边。
 */
import type { SceneId } from '../config';
import { SCALE_AXIS } from '../config';

export class KnowledgeCard {
  readonly element: HTMLElement;
  /** 是否由 K 键固定。固定后不自动消失，切场景只换内容。 */
  private pinned = false;
  private autoHideTimer: number | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'knowledge-card hidden';
    this.element.setAttribute('role', 'complementary');
    this.element.setAttribute('aria-label', '知识卡');
  }

  show(scene: SceneId): void {
    const data = SCALE_AXIS.find(a => a.scene === scene);
    if (!data) return;
    this.element.innerHTML = this.buildCard(scene, data);
    this.element.classList.remove('hidden');

    // 绑定折叠/展开答案
    const btn = this.element.querySelector<HTMLButtonElement>('.kc-reveal-btn');
    const ans = this.element.querySelector<HTMLElement>('.kc-answer');
    btn?.addEventListener('click', () => {
      const expanded = ans?.classList.toggle('visible');
      if (btn) btn.textContent = expanded ? '收起答案 ▲' : '揭晓答案 ▼';
      btn?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  /** 切场景时由 main.ts 调用：已固定则只更新内容；未固定则自动显示 3 秒后淡出。 */
  setScene(scene: SceneId): void {
    if (this.pinned) {
      this.show(scene);
      return;
    }
    this.showWithAutoHide(scene);
  }

  /** K 键：按一下固定显示，再按一下收起。 */
  toggle(scene: SceneId): void {
    if (this.pinned) {
      this.unpin();
    } else {
      this.pin(scene);
    }
  }

  /** 固定显示：不自动消失；此后切场景只换内容。 */
  pin(scene: SceneId): void {
    this.clearTimer();
    this.element.classList.remove('fading');
    this.show(scene);
    this.pinned = true;
  }

  hide(): void {
    this.pinned = false;
    this.element.classList.add('hidden');
    this.element.classList.remove('fading');
    this.clearTimer();
  }

  private unpin(): void {
    this.hide();
  }

  private clearTimer(): void {
    if (this.autoHideTimer !== null) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }

  /** 未固定时：显示 3 秒后淡出。 */
  showWithAutoHide(scene: SceneId): void {
    if (this.pinned) {
      this.show(scene);
      return;
    }
    this.show(scene);
    this.clearTimer();
    this.autoHideTimer = window.setTimeout(() => {
      this.element.classList.add('fading');
      this.autoHideTimer = window.setTimeout(() => {
        this.hide();
      }, 600);
    }, 3000);
  }

  private buildCard(
    scene: SceneId,
    data: typeof SCALE_AXIS[number],
  ): string {
    const rows = this.getCardData(scene);
    return `
      <div class="kc-inner">
        <div class="kc-header">
          <span class="kc-scene">${scene}</span>
          <span class="kc-scale">${data.scaleLabel}</span>
        </div>
        <table class="kc-table">
          <tr><th>概念</th><td>${rows.concept}</td></tr>
          <tr><th>你改变的物理量</th><td>${rows.gestureMap}</td></tr>
          <tr><th>尺度 · 主导力</th><td>${data.scaleLabel} · ${data.force}</td></tr>
          <tr><th>现实对照</th><td>${rows.realWorld}</td></tr>
        </table>
        <div class="kc-question">
          <span class="kc-q-label">课堂一问</span>
          <p class="kc-q-text">${rows.question}</p>
          <button class="kc-reveal-btn" aria-expanded="false">揭晓答案 ▼</button>
          <p class="kc-answer">${rows.answer}</p>
        </div>
      </div>
    `;
  }

  private getCardData(scene: SceneId): {
    concept: string;
    gestureMap: string;
    realWorld: string;
    question: string;
    answer: string;
  } {
    // 所有数值来自 config.ts 实际值，注释标注出处
    const cards: Record<SceneId, ReturnType<KnowledgeCard['getCardData']>> = {
      heart: {
        // CONFIG.heart.bpmCalm = 62, bpmIntense = 128
        concept: '心脏以 62–128 BPM 节律收缩，搏动波从心尖向外传播。',
        gestureMap: '握拳程度 → BPM（62 到 128）及收缩幅度（contract = 0.86）',
        realWorld: '人体心跳，心肌节律收缩与舒张',
        question: '为什么心率加快时，每次搏动输出的血量反而可能减少？',
        answer: '心率加快时心舒期缩短，心室充盈时间不足，每搏输出量下降；心输出量 = 每搏量 × 心率，两者相互制衡。',
      },
      pulse: {
        // CONFIG.pulse.groups = 6, period = 3.0
        concept: '6 组粒子弹道点火（period = 3.0s），拨打形成汇聚的离子环冲击波。',
        gestureMap: '握拳程度 → 粒子从弹道礼花收束为离子环',
        realWorld: '等离子体炮、粒子加速器束团聚焦',
        question: '现实中的等离子体环为什么能在空气中短暂稳定传播？',
        answer: '等离子体环靠自身磁场约束带电粒子，洛伦兹力与粒子热压力动态平衡，使其短暂自持。',
      },
      ocean: {
        // CONFIG.ocean.auroraFraction = 0.22
        concept: '粒子地球自转，22% 的极区粒子（auroraFraction = 0.22）在握拳时被抬升为极光幕。',
        gestureMap: '握拳程度 → 极光风暴强度，极光粒子比例最大为 22%',
        realWorld: '地球极光，太阳风粒子沿磁力线进入极区',
        question: '极光为什么只出现在极区附近，而不是全球均匀分布？',
        answer: '地磁场是偶极场，极区磁力线近乎垂直进入大气，太阳风高能粒子沿磁力线被引导至极区与大气分子碰撞激发发光。',
      },
      saturn: {
        // CONFIG.saturn.keplerExponent = 0.5, cassiniGapStart = 1.72, cassiniGapEnd = 1.9
        concept: '土星环粒子轨道角速度随半径按 r⁻¹·⁵ 衰减（keplerExponent = 0.5）。',
        gestureMap: '握拳程度 → 环面隆起与湍流增强；卡西尼缝 1.72–1.90 单位半径',
        realWorld: '土星卡西尼缝，土卫一的轨道共振在环上刻出空隙',
        question: '卡西尼缝是真空的吗？为什么那里粒子少？',
        answer: '卡西尼缝并非完全空旷，只是粒子密度低。土卫一与该区域粒子存在 2:1 轨道共振，粒子每绕两圈就受一次周期性引力扰动而被清扫出去。',
      },
      nebula: {
        // CONFIG.ballRadiusTight = 0.45, cloudRadius = 2.3
        concept: '稀疏分子云（半径约 2.3）在引力作用下收束为致密球体（半径约 0.45）。',
        gestureMap: '握拳程度 → 从湍流星云（r≈2.3）收束为致密球（r≈0.45）',
        realWorld: '猎户座大星云，恒星形成区的分子云坍缩',
        question: '分子云坍缩时为什么会变热，而不是越缩越冷？',
        answer: '引力势能转化为动能，粒子相互碰撞加剧，温度升高；这就是开尔文-亥姆霍兹收缩机制，原恒星在辐射降温前会先经历剧烈加热。',
      },
      galaxy: {
        // CONFIG.galaxy.forgeRadius = 0.85
        concept: '旋臂是密度波而非固定结构，握拳触发星锻：旋臂向内螺旋熔铸为致密星球（forgeRadius = 0.85）。',
        gestureMap: '握拳程度 → 从旋涡星系收束为星锻球（forgeRadius = 0.85）',
        realWorld: '银河系旋臂，密度波触发的恒星形成带',
        question: '如果旋臂是密度波，旋臂上的恒星和旋臂本身是否以同样的速度转动？',
        answer: '不是。旋臂（密度波）的角速度（模式速度）远低于旋臂上各恒星的公转速度，恒星会穿越旋臂，就像车辆穿越堵车路段一样。',
      },
    };
    return cards[scene];
  }
}
