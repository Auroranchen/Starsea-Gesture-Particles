import QRCode from 'qrcode';
import type { SceneId, Quality } from '../config';

export interface ShareState {
  scene: SceneId;
  quality: Quality;
  dial: number;
  energy: number;
}

/**
 * ShareLink — Q 键弹出二维码 + URL 快照面板。
 * 零后端：把 scene/quality/dial/energy 编码进 URL hash。
 */
export class ShareLink {
  readonly element: HTMLElement;
  private visible = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'share-panel hidden';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-label', '分享链接');
  }

  /** 解析 URL hash 中的共享状态，启动时调用一次。 */
  static parseHash(): Partial<ShareState> | null {
    const hash = location.hash.slice(1);
    if (!hash) return null;
    try {
      const params = new URLSearchParams(hash);
      const result: Partial<ShareState> = {};
      const s = params.get('s');
      if (s) result.scene = s as SceneId;
      const q = params.get('q');
      if (q === 'low' || q === 'med' || q === 'high') result.quality = q;
      const d = params.get('d');
      if (d !== null) result.dial = Math.max(0, Math.min(100, parseInt(d))) / 100;
      const e = params.get('e');
      if (e !== null) result.energy = Math.max(0, Math.min(100, parseInt(e))) / 100;
      return result;
    } catch {
      return null;
    }
  }

  private static buildHash(state: ShareState): string {
    const params = new URLSearchParams({
      v: '1',
      s: state.scene,
      q: state.quality,
      d: String(Math.round(state.dial * 100)),
      e: String(Math.round(state.energy * 100)),
    });
    return '#' + params.toString();
  }

  toggle(state: ShareState): void {
    if (this.visible) {
      this.hide();
    } else {
      void this.show(state);
    }
  }

  async show(state: ShareState): Promise<void> {
    const hash = ShareLink.buildHash(state);
    const url = location.origin + location.pathname + hash;
    const warning = ShareLink.buildWarning();

    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(url, {
        width: 180,
        margin: 2,
        color: { dark: '#f6f0ff', light: '#120b1e' },
      });
    } catch {
      qrDataUrl = '';
    }

    this.element.innerHTML = `
      <div class="share-inner">
        <div class="share-header">
          <span class="share-title">扫码同屏</span>
          <button class="share-close" aria-label="关闭">✕</button>
        </div>
        ${qrDataUrl ? `<img class="share-qr" src="${qrDataUrl}" alt="扫码进入同一场景" />` : ''}
        <div class="share-params">
          <span>场景：<b>${state.scene}</b></span>
          <span>画质：<b>${state.quality}</b></span>
          <span>拨盘：<b>${Math.round(state.dial * 100)}%</b></span>
        </div>
        <div class="share-url-row">
          <input class="share-url-input" readonly value="${url}" aria-label="分享链接" />
          <button class="share-copy-btn">复制</button>
        </div>
        <p class="share-hint">学生扫码后进入同一场景，可用触屏自己操控</p>
        ${warning}
      </div>
    `;

    this.element.querySelector<HTMLButtonElement>('.share-close')
      ?.addEventListener('click', () => this.hide());
    this.element.querySelector<HTMLButtonElement>('.share-copy-btn')
      ?.addEventListener('click', () => {
        void navigator.clipboard.writeText(url).catch(() => {});
        const btn = this.element.querySelector<HTMLButtonElement>('.share-copy-btn');
        if (btn) { btn.textContent = '已复制'; setTimeout(() => { btn.textContent = '复制'; }, 2000); }
      });

    this.element.classList.remove('hidden');
    this.visible = true;
  }

  hide(): void {
    this.element.classList.add('hidden');
    this.visible = false;
  }

  /**
   * 在面板里如实说明「这个链接手机能不能扫开」。
   * 这里是本项目最容易踩的坑：localhost 只指向设备自己，手机扫了必然打不开；
   * 而在局域网 http 下浏览器又不允许调用摄像头。与其让人现场懵，不如直接写在面板上。
   */
  private static buildWarning(): string {
    const host = location.hostname;
    const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    const tips: string[] = [];

    if (isLoopback) {
      tips.push(
        '当前链接是本机地址（localhost），手机扫了会连到手机自己，打不开。' +
          '请用启动终端里 <b>Network</b> 那一条（形如 <code>http://10.x.x.x:5173</code>）在浏览器打开本页，再按 Q 生成新的码。',
      );
    }
    if (location.protocol === 'http:' && !isLoopback) {
      tips.push('局域网 http 下浏览器不允许调用摄像头，学生用触屏操控即可；摄像头仍需 localhost 或 HTTPS。');
    }

    if (tips.length === 0) return '';
    return `<p class="share-warn">${tips.join('<br>')}</p>`;
  }

  /** 给 Overlay 的复制按钮绑定事件（占位，兼容 main.ts 调用）。 */
  bindCopyButtons(): void { /* handled inside show() */ }
}
