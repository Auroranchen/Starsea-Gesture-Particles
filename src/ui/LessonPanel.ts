import type { SceneId } from '../config';
import { SCALE_AXIS } from '../config';
import { LESSONS } from '../data/lessons';

/**
 * LessonPanel — 左侧常驻的教学说明。
 *
 * 与 K 知识卡（右下角悬浮、按 I 开合）分工不同：
 * 这块是老师讲课时的"讲义"，默认展开、跟着场景走；收起后留一个竖排小标签，
 * 点它或按 K 能重新拉出来，不用记第二个键。
 */
export class LessonPanel {
  readonly element: HTMLElement;
  private collapsed = false;
  private scene: SceneId;

  constructor(scene: SceneId) {
    this.scene = scene;
    this.element = document.createElement('aside');
    this.element.className = 'lesson-panel';
    this.element.setAttribute('role', 'complementary');
    this.element.setAttribute('aria-label', '教学说明');
    this.render();
  }

  setScene(scene: SceneId): void {
    this.scene = scene;
    this.render();
  }

  /** K 键：展开 / 收起。 */
  toggle(): void {
    this.collapsed = !this.collapsed;
    this.element.classList.toggle('collapsed', this.collapsed);
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  show(): void {
    this.element.classList.remove('hidden');
  }

  private render(): void {
    const lesson = LESSONS[this.scene];
    const station = SCALE_AXIS.find((a) => a.scene === this.scene);

    this.element.innerHTML = `
      <button class="lesson-tab" type="button" aria-label="展开教学说明">教学说明</button>
      <div class="lesson-inner">
        <div class="lesson-head">
          <div class="lesson-meta">
            <span class="lesson-scene">${this.scene}</span>
            <span class="lesson-scale">${station ? station.scaleLabel : ''}</span>
          </div>
          <button class="lesson-collapse" type="button" aria-label="收起教学说明" title="收起（K）">✕</button>
        </div>
        <h3 class="lesson-title">${lesson.title}</h3>
        <p class="lesson-hook">${lesson.hook}</p>
        <div class="lesson-points-label">知识点</div>
        <ul class="lesson-points">
          ${lesson.points.map((p) => `<li>${p}</li>`).join('')}
        </ul>
        <p class="lesson-gesture">${lesson.gesture}</p>
      </div>
    `;

    this.element.querySelector<HTMLButtonElement>('.lesson-collapse')
      ?.addEventListener('click', () => {
        this.collapsed = true;
        this.element.classList.add('collapsed');
      });
    this.element.querySelector<HTMLButtonElement>('.lesson-tab')
      ?.addEventListener('click', () => {
        this.collapsed = false;
        this.element.classList.remove('collapsed');
      });
  }
}
