import type { SceneId } from '../config';
import { SCALE_AXIS } from '../config';
import { LESSONS } from '../data/lessons';
import { hsPointsForScene } from '../data/hsPoints';
import { promptsForScene } from '../data/scenePrompts';

/**
 * LessonPanel — 左侧常驻的教学说明。
 *
 * 与 I 知识卡（左下角悬浮、按 I 开合）分工不同：
 * 这块是老师讲课时的"讲义"，默认展开、跟着场景走；收起后留一个竖排小标签，
 * 点它或按 K 能重新拉出来，不用记第二个键。
 *
 * 底部的「问问助手」小标签点一下会把这句话原样抛给课堂助手，
 * 标签与助手的知识库同源（scenePrompts.ts），保证点了必有答案。
 */
export class LessonPanel {
  readonly element: HTMLElement;
  /** 点提问标签时回调，由 main.ts 接到课堂助手上 */
  onAsk: ((question: string) => void) | null = null;
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
    const hs = hsPointsForScene(this.scene);
    const prompts = promptsForScene(this.scene);

    const promptHtml = prompts.length
      ? `
        <div class="lesson-prompt-label">问问助手</div>
        <div class="lesson-prompts">
          ${prompts
            .map((p) => `<button class="lesson-prompt" type="button">${p.q}</button>`)
            .join('')}
        </div>`
      : '';

    const hsHtml = hs.length
      ? `
        <div class="lesson-hs-label">对应高中知识点</div>
        <ul class="lesson-hs">
          ${hs
            .map(
              (p) => `<li>
                <span class="hs-sub" data-subject="${p.subject}">${p.subject}</span>
                <span class="hs-body"><b>${p.title}</b>${p.text}</span>
                <span class="hs-chapter">${p.chapter}</span>
              </li>`,
            )
            .join('')}
        </ul>`
      : '';

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
        <p class="lesson-curriculum">${lesson.curriculum}</p>
        <p class="lesson-hook">${lesson.hook}</p>
        <div class="lesson-points-label">知识点</div>
        <ul class="lesson-points">
          ${lesson.points.map((p) => `<li>${p}</li>`).join('')}
        </ul>
        <p class="lesson-gesture">${lesson.gesture}</p>
        ${promptHtml}
        ${hsHtml}
      </div>
    `;

    this.element.querySelectorAll<HTMLButtonElement>('.lesson-prompt')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          this.onAsk?.(btn.textContent ?? '');
        });
      });

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
