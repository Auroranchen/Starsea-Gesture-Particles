#!/usr/bin/env node
/**
 * copy-mediapipe-assets.mjs
 *
 * 把 MediaPipe 的 WASM 运行时从 node_modules 复制到 public/mediapipe/wasm/，
 * 让构建产物自带运行时，不依赖 CDN。
 *
 * 为什么不在仓库里直接提交这 32 MB 的 wasm：
 * 它已经是 `@mediapipe/tasks-vision` 这个依赖的一部分，`npm ci` 之后必然存在，
 * 再提交一份纯属重复。模型文件 hand_landmarker.task 不在依赖里，那个确实要提交。
 *
 * 由 package.json 的 predev / prebuild 自动触发，也可以手动 `npm run assets`。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function resolveWasmSource() {
  const candidates = [
    // 标准 npm 布局，最直接
    path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'),
  ];
  // 后备：从模块入口向上找（兼容 pnpm / hoisting 的布局）
  try {
    let dir = path.dirname(require.resolve('@mediapipe/tasks-vision'));
    for (let i = 0; i < 6; i++) {
      candidates.push(path.join(dir, 'wasm'));
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // 解析不到入口就只用上面的标准路径
  }
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

const srcDir = resolveWasmSource();
if (!srcDir) {
  console.error('[assets] 找不到 @mediapipe/tasks-vision/wasm —— 请先运行 npm ci');
  process.exit(1);
}

const destDir = path.join(root, 'public', 'mediapipe', 'wasm');
fs.mkdirSync(destDir, { recursive: true });

const files = fs.readdirSync(srcDir);
let copied = 0;
let skipped = 0;
let bytes = 0;

for (const name of files) {
  const from = path.join(srcDir, name);
  const to = path.join(destDir, name);
  const srcStat = fs.statSync(from);
  if (!srcStat.isFile()) continue;

  let same = false;
  if (fs.existsSync(to)) {
    const dstStat = fs.statSync(to);
    same = dstStat.size === srcStat.size && dstStat.mtimeMs >= srcStat.mtimeMs;
  }
  if (same) {
    skipped++;
  } else {
    fs.copyFileSync(from, to);
    copied++;
  }
  bytes += srcStat.size;
}

const mb = (bytes / 1024 / 1024).toFixed(1);
console.log(
  `[assets] MediaPipe WASM 就绪：${files.length} 个文件 / ${mb} MB` +
    `（复制 ${copied}，已是最新 ${skipped}）→ public/mediapipe/wasm/`,
);

// 模型文件不在依赖里，必须在仓库内；这里只做存在性提示，不自动下载。
const model = path.join(root, 'public', 'mediapipe', 'hand_landmarker.task');
if (fs.existsSync(model)) {
  const size = (fs.statSync(model).size / 1024 / 1024).toFixed(2);
  console.log(`[assets] 手势模型就绪：hand_landmarker.task（${size} MB）—— 可离线运行`);
} else {
  console.warn(
    '[assets] 缺少 public/mediapipe/hand_landmarker.task，将回落到 CDN，离线时摄像头模式不可用。',
  );
}
