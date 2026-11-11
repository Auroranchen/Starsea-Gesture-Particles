import type { SceneId, Quality } from '../config';

export interface ExportState {
  scene: SceneId;
  quality: Quality;
  dial: number;
  energy: number;
  bloomEnabled: boolean;
  bloomStrength: number;
  pointSize: number;
}

/**
 * Export — E 键导出当前画面 PNG + 参数快照 JSON。
 *
 * WebGL 注意：renderer 默认 preserveDrawingBuffer=false，
 * 必须在 composer.render() 之后同一个任务里立刻 toBlob()。
 * 做法：每帧 composer.render() 后调用 onAfterRender()，
 * 若有待导出请求则在此立刻采样 canvas。
 */
export class Export {
  private canvas: HTMLCanvasElement | null = null;
  private pendingCapture: ExportState | null = null;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /** E 键：登记一次导出请求，实际采样在下一帧 onAfterRender 里执行。 */
  requestCapture(state: ExportState): void {
    this.pendingCapture = state;
  }

  /**
   * 每帧 composer.render() 完成后立刻调用。
   * preserveDrawingBuffer=false 意味着只有这一帧还活着。
   */
  onAfterRender(state: ExportState): void {
    if (!this.pendingCapture || !this.canvas) return;
    const captureState = this.pendingCapture;
    this.pendingCapture = null;
    void state; // consumed via captureState

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, (c) => (c === 'T' ? '-' : c === ':' ? '' : c))
      .slice(0, 13);
    const baseName = `starsea-${captureState.scene}-${timestamp}`;

    // PNG
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${baseName}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }, 'image/png');

    // JSON
    const json = JSON.stringify(
      {
        version: 1,
        timestamp: new Date().toISOString(),
        ...captureState,
        // also include void state reference to avoid unused-var lint
        _captureState: captureState,
      },
      null,
      2,
    );
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
}
