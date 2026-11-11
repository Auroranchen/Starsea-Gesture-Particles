#!/usr/bin/env node
/**
 * check-contract.mjs — 着色器声明契约检查
 *
 * 检查两件事：
 *   1. uniform：GLSL 里声明的 uniform，TS 侧是否都赋了值（反之仅警告）；
 *   2. varying：同一对着色器里，用了但没声明的 varying —— 这类问题不会让构建失败，
 *      却会在浏览器里让**整条共享着色器编译失败**，表现为所有场景的粒子一起消失。
 *
 * 背景：第 2 项不是假想。2026-10-19 就发生过一次：在 points.frag.glsl 里新增了
 * vCrest 的读取，却没有补声明，导致 GPU 粒子材质的片元着色器编译失败，
 * galaxy / saturn 等未被改动的场景也一并消失，而 `npm run build` 依然是绿的。
 * 原始记录见 prompts/original/04_Bug修复与验证.md 第 4 轮。
 *
 * 结论：构建通过 ≠ 运行正常。这个脚本的作用就是把"肉眼看不出来"的约定变成 CI 能拦住的检查。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const shaderDir = path.join(root, 'src', 'sim', 'shaders');

let failed = false;

/** 去掉 // 行注释与 /* *\/ 块注释，避免把注释里的词当成代码 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

const glslFiles = fs.readdirSync(shaderDir).filter(f => f.endsWith('.glsl'));
const sources = new Map();
for (const file of glslFiles) {
  sources.set(file, stripComments(fs.readFileSync(path.join(shaderDir, file), 'utf8')));
}

// ── 1. uniform 契约 ────────────────────────────────────────────────────────
const glslUniforms = new Set();
for (const [, src] of sources) {
  for (const m of src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)) {
    glslUniforms.add(m[1]);
  }
}

const tsFiles = [
  path.join(root, 'src', 'sim', 'ParticleSystem.ts'),
  path.join(root, 'src', 'sim', 'StateMachine.ts'),
  path.join(root, 'src', 'sim', 'CenterStar.ts'),
];

const tsUniforms = new Set();
for (const file of tsFiles) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  // velUniforms.uXxx / colorUniforms.uXxx / uniforms.uXxx
  for (const m of src.matchAll(/uniforms\s*[\[.][\s'"]*(\w+)/g)) {
    if (m[1].startsWith('u')) tsUniforms.add(m[1]);
  }
  // 对象字面量里的 uXxx: {
  for (const m of src.matchAll(/\b(u[A-Z]\w+)\s*:\s*\{/g)) {
    tsUniforms.add(m[1]);
  }
}

// Three.js / GPGPU 运行时自带的，不属于本项目契约
const threeBuiltins = new Set([
  'resolution', 'texture', 'textureVelocity', 'texturePosition',
]);

const glslOnly = [...glslUniforms].filter(u => !tsUniforms.has(u) && !threeBuiltins.has(u));
const tsOnly = [...tsUniforms].filter(u => !glslUniforms.has(u) && !threeBuiltins.has(u));

if (glslOnly.length > 0) {
  console.error('❌ GLSL 中声明但 TS 侧未赋值的 uniform：');
  glslOnly.forEach(u => console.error('   ' + u));
  failed = true;
}
if (tsOnly.length > 0) {
  // TS 侧多出来的通常是安全的（GLSL 没用到），降级为警告
  console.warn('⚠️  TS 侧有但 GLSL 中未声明的 uniform（警告，不阻断 CI）：');
  tsOnly.forEach(u => console.warn('   ' + u));
}

// ── 2. varying 声明契约 ────────────────────────────────────────────────────
// 按 basename 配对：points.vert.glsl ↔ points.frag.glsl
const pairs = new Map();
for (const file of glslFiles) {
  const m = file.match(/^(.+)\.(vert|frag)\.glsl$/);
  if (!m) continue;
  const key = m[1];
  if (!pairs.has(key)) pairs.set(key, {});
  pairs.get(key)[m[2]] = file;
}

const declaredVaryings = new Map(); // file -> Set(name)
for (const [file, src] of sources) {
  const set = new Set();
  for (const m of src.matchAll(/^\s*varying\s+\w+\s+(\w+)\s*;/gm)) set.add(m[1]);
  declaredVaryings.set(file, set);
}

let varyingProblems = 0;
for (const [key, pair] of pairs) {
  const files = Object.values(pair);
  // 这一对着色器里出现过的全部 varying 名字
  const union = new Set();
  for (const f of files) for (const n of declaredVaryings.get(f) ?? []) union.add(n);

  for (const f of files) {
    const declared = declaredVaryings.get(f) ?? new Set();
    const src = sources.get(f) ?? '';
    for (const name of union) {
      if (declared.has(name)) continue;
      // 只需要判断"用到了没声明"：先剔除声明语句本身，再按词边界找
      const used = new RegExp(`\\b${name}\\b`).test(src);
      if (used) {
        console.error(`❌ ${f} 使用了 varying \`${name}\`，但没有在本文件里声明。`);
        console.error(`   同一对着色器（${key}）的另一个文件声明了它——这类不一致会让整条着色器编译失败。`);
        varyingProblems++;
        failed = true;
      }
    }
  }

  // 片元着色器声明了、顶点着色器却没有 → 链接期必然失败
  if (pair.vert && pair.frag) {
    const vertDecl = declaredVaryings.get(pair.vert) ?? new Set();
    for (const name of declaredVaryings.get(pair.frag) ?? []) {
      if (!vertDecl.has(name)) {
        console.error(`❌ ${pair.frag} 声明了 varying \`${name}\`，但 ${pair.vert} 没有声明。`);
        varyingProblems++;
        failed = true;
      }
    }
  }
}

if (!failed) {
  const totalVaryings = new Set([...declaredVaryings.values()].flatMap(s => [...s])).size;
  console.log(
    `✅ 着色器契约检查通过（uniform：GLSL ${glslUniforms.size} 个 / TS ${tsUniforms.size} 个匹配；` +
    `varying：${totalVaryings} 个声明，${pairs.size} 对顶点/片元着色器一致）`,
  );
} else if (varyingProblems > 0) {
  console.error('\n提示：varying 不一致不会让构建失败，只会在运行时让共享着色器编译失败。');
}

process.exit(failed ? 1 : 0);
