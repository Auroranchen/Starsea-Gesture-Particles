#!/usr/bin/env node
/**
 * check-claims.mjs — 文档里的数字声明校验
 *
 * 赛题原文要求「功能与测试结果应可验证；不得虚构准确率、帧率、响应延迟或用户效果等数据」。
 * 这条规则如果只写在文档里，靠的是自觉；写成脚本，靠的是 CI。
 *
 * 规则：
 *   1. 扫描 README.md 与 docs/*.md 中所有「性能类数字」（fps / 帧 / ms / 毫秒 / % / 成功率 / 延迟）。
 *   2. 该数字必须能在下列来源之一找到出处，否则判为「无出处声明」，脚本以退出码 1 结束：
 *      - src/config.ts 里的常量值（含其 ×100 的百分比形式）；
 *      - 实测记录表（docs/实测记录表.md 或 实测记录表.md，仅当该行标注了实测条件）；
 *      - 行内显式豁免标记 <!-- claim-ok: 原因 -->。
 *   3. 量级表述（如 10⁻¹ m）、日期、页码、文件体积、提交数不属于性能声明，天然放行。
 *
 * 设计取向：宁可误报让人加一行豁免说明，也不放过一个凭空写的帧率。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ── 1. 从 config.ts 收集允许出现的数字 ────────────────────────────────────
const configPath = path.join(root, 'src', 'config.ts');
const configSrc = fs.readFileSync(configPath, 'utf8');
const allowed = new Set();
for (const m of configSrc.matchAll(/-?\d+(?:\.\d+)?/g)) {
  const raw = m[0];
  allowed.add(raw);
  const n = Number(raw);
  if (Number.isFinite(n)) {
    // 0.22 这种比例，文档里通常写成 22%
    if (Math.abs(n) <= 1 && n !== 0) allowed.add(String(Math.round(n * 100)));
    // 整数与一位小数互通
    if (Number.isInteger(n)) allowed.add(n.toFixed(1));
  }
}

// ── 2. 实测记录表里的行（其数字有实测出处）──────────────────────────────
const measuredFiles = ['docs/实测记录表.md', '实测记录表.md']
  .map((p) => path.join(root, p))
  .filter((p) => fs.existsSync(p));
const measuredNumbers = new Set();
for (const file of measuredFiles) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    // 只认「已填写的实测行」：含数字且不含空白占位符 ______
    if (line.includes('______')) continue;
    for (const m of line.matchAll(/\d+(?:\.\d+)?/g)) measuredNumbers.add(m[0]);
  }
}

// ── 3. 扫描文档 ───────────────────────────────────────────────────────────
const targets = [path.join(root, 'README.md')];
const docsDir = path.join(root, 'docs');
if (fs.existsSync(docsDir)) {
  for (const f of fs.readdirSync(docsDir)) {
    if (f.endsWith('.md')) targets.push(path.join(docsDir, f));
  }
}

// 性能类单位：数字后面跟着这些才需要出处
const PERF_UNIT = /(\d+(?:\.\d+)?)\s*(fps|FPS|帧率|帧|ms|毫秒|%|％|成功率|延迟|hz|Hz|HZ)/g;
const EXEMPT = /<!--\s*claim-ok\b/;

let violations = 0;
let checked = 0;

for (const file of targets) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let inFence = false;

  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) return; // 代码块里的内容不是声明
    if (EXEMPT.test(line)) return;

    for (const m of line.matchAll(PERF_UNIT)) {
      checked++;
      const value = m[1];
      if (allowed.has(value) || measuredNumbers.has(value)) continue;
      violations++;
      console.error(`❌ ${rel}:${i + 1}  数字「${value}${m[2]}」找不到出处`);
      console.error(`   ${line.trim().slice(0, 110)}`);
    }
  });
}

// ── 4. 结论 ───────────────────────────────────────────────────────────────
if (violations > 0) {
  console.error('');
  console.error(`共 ${violations} 处无出处声明（已检查 ${checked} 处性能类数字）。`);
  console.error('处理方式二选一：');
  console.error('  · 数字应来自 src/config.ts —— 改成引用常量或补进 config；');
  console.error('  · 数字确实实测过 —— 填进实测记录表；');
  console.error('  · 该数字不是性能结论 —— 行尾加 <!-- claim-ok: 原因 -->。');
  process.exit(1);
}

console.log(
  `✅ 文档数字声明检查通过（${targets.length} 个文件，${checked} 处性能类数字均有出处）`,
);
