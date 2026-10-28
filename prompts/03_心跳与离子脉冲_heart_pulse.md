# 迭代 03 · 心跳与离子脉冲（heart / pulse）

| 项目 | 内容 |
|---|---|
| 迭代周期 | 2026-10-26 |
| 目标 | 一次新增两个场景：`heart`（搏动的心脏 + 暗物质环）与 `pulse`（分组点火的离子礼花） |
| 涉及文件 | `src/sim/shaders/velocity.frag.glsl`、`points.frag.glsl`、`src/sim/StateMachine.ts`、`src/main.ts`、`src/config.ts` |
| 最终 commit | `feat: add heart and pulse scenes with beat envelope and ion rings` |

---

## ① 迭代目标

前四个场景都是"天文"。这两个是刻意做的**对照实验**：证明同一套粒子引擎能表达
**非天文题材**，从而说明"智控星海"不是一个只能放烟花的特效播放器，而是一个**可复用的
粒子场引擎 + 场景插件**。

- `heart`：**有机体**——生理节律。教的是"收缩期/舒张期""心率与节律"。
- `pulse`：**能量释放**——抛体运动与冲击波。教的是"初速 → 轨迹""引力回落""环状波前"。

**验收标准：**

1. 心跳必须是 **lub-dub 双峰**（一次强收缩 + 一次弱回声），不是单个正弦；
2. 改变 BPM 时**相位不能跳变**（从 62 BPM 切到 128 BPM 时，心跳不能"卡一下"）；
3. 心脏必须有**可辨认的心形轮廓**，不能是"心形贴图"式的平面剪影；
4. 礼花必须**分组错峰点火**，不能所有粒子同时炸；
5. 两次脉冲之间，核心**不能过曝成一团白斑**；
6. 不同画质档位（65k / 262k / 1M 粒子）下，**整体亮度必须一致**。

---

## ② 上下文投喂

| 投喂内容 | 为什么给 |
|---|---|
| `StateMachine.ts` 的 `update()` 结构（switch 分支 + 事件系统） | 新场景要接进同一套插值/事件框架 |
| `velocity.frag.glsl` 的 `main()` | 让它看到场景分发的写法 |
| `points.frag.glsl` 的 `uDensityNorm` 用法 | 提示它已有亮度归一化机制，不要重复造 |
| `main.ts` 中 bloom 相关 3 行 | 心跳要接泛光脉冲 |
| 6 条验收标准 | 判据 |

**额外硬约束**：

> 不许新增 `.ts` 文件。所有逻辑进现有文件的 switch 分支，新增常量进 `config.ts`。

理由：新增文件会让 `ARCHITECTURE.md` 的目录表失真，也会让评审在 30 页文档里找不到落点。
把改动限制在既有结构内，是"可被人接管"的前提。

---

## ③ Prompt 链

### Round 1 — 心形几何：先问"用什么数学表示"

> **我**：
> 我需要一个三维的心形点云。先说三种候选方案的优缺点，不要写代码：
> （a）心形参数方程 `x = 16sin³t` 那种，径向缩放成体积；
> （b）隐式函数 `(x²+y²−1)³ − x²y³ ≤ 0` 做拒绝采样；
> （c）建模软件导出的顶点网格。

**AI 回答**：推荐（b），因为（a）径向缩放会在**心尖和凹口处产生接缝**——同一个 (x,y)
对应多个半径，缩放后粒子密度不均，视觉上出现一条硬边；（c）引入外部资源、违背"无后端
纯代码"的取向。

**我的判断**：采纳（b）。但这正是关键难点——隐式函数只能判"在不在内部"，
要在**表面**铺点还需要体积到壳的映射。

### Round 2 — 实现心形点云

> **我**：
> 用隐式函数拒绝采样。要求：
> 1. 面积均匀（不是体积均匀），大部分粒子落在前后表皮上，这样轮廓清晰；
> 2. 填充一部分内部粒子做体积感；
> 3. 深度方向做一个"枕头"剖面——中间厚、边缘薄，避免看起来像被压扁的片。

**AI 输出**：拒绝了采样 + 用 `cube root` 做软枕剖面的写法，注释也写清了原因：

```glsl
// Point on a puffy 3D heart. Area-uniform rejection sampling of the implicit
// heart (x²+y²-1)³ - x²y³ ≤ 0 (no seam, unlike radially scaling the parametric
// curve), then a pillow profile for depth. Most particles sit on the front/back
// skin so the silhouette reads from every angle; the rest fill the interior.
// -f is 1 at the center and 0 on the outline: cube root gives a soft pillow.
```

**结果**：轮廓清晰，无接缝。✅

### Round 3 — 心跳包络：这是本次最容易翻车的地方

> **我**：
> 心率要能随 dial 从 62 BPM 变到 128 BPM。心跳波形要 lub-dub：
> 主峰在相位 0.04 附近（强、窄），回声在 0.30 附近（弱 55%、稍宽）。
> 写成关于相位的两个高斯，取 max。

**AI 首版**：

```ts
const ph = (performance.now() / 1000) * (bpm / 60);
const lub = Math.exp(-Math.pow((ph - 0.04) * 16, 2));
```

**症状**：dial 拉动时（62→128 BPM）心跳会**突然卡一下**，像丢帧。

### Round 4 — 用"物理量"描述问题，而不是"感觉"

> **我**：
> 你用的是 `t * bpm`。bpm 是**变量**，所以相位 = 时间 × 变量，bpm 一变大，
> 相位立刻跳一大截——心跳就卡了。
> 相位必须是**积分**出来的状态量：`ph += dt * bpm/60`，再取模。
> 这样 bpm 变化只影响相位的**增长速度**，不影响当前值。

**AI 修正**：

```ts
// Integrate phase so a changing BPM never makes the beat jump.
this.beatPhase = (this.beatPhase + dt * (lerp(h.bpmCalm, h.bpmIntense, d) / 60)) % 1;
const ph = this.beatPhase;
// "lub-dub": a strong contraction followed by a softer echo.
const lub = Math.exp(-(((ph - 0.04) * 16) ** 2));
const dub = 0.55 * Math.exp(-(((ph - 0.3) * 18) ** 2));
this.beat = Math.max(lub, dub);
```

**结果**：拉动 dial 全程心跳平滑加速，无跳变。✅

### Round 5 — 让泛光和心跳同步

> **我**：
> 心跳的时候整个画面应该亮一下。`main.ts` 里已有 `bloomPass.strength`，
> 用 `stateMachine.beat` 调制它，幅度 0.6 左右。注意别每帧重算基础值，要用
> `overlay.bloomStrength` 作为基数，否则用户在设置里调完会失效。

**AI 输出**：

```ts
// Heart scene: kick the bloom on every beat so the glow pulses with the shape.
bloomPass.strength = overlay.bloomStrength * (1 + 0.6 * stateMachine.beat);
```

**结果**：一次通过，且与设置面板的泛光滑块兼容。✅

---

### Round 6 — pulse：礼花的分组点火

> **我**：
> 新场景 `pulse`，弹道礼花。要求：
> 1. 分成 `groups = 6` 组，周期 3 秒，**每组错峰点火**；
> 2. 每个粒子点火后做纯弹道运动：初速方向随机、大小按 88% 落在球壳上、其余做慢速余烬；
> 3. 有重力，会回落；
> 4. dial → 1 时变成"离子环"：所有爆发向心汇聚，压成环状冲击波。

**AI 首版**：能用，但（4）实现后出现新问题——见下一轮。

### Round 7 — 过曝：这是视觉上最刺眼的问题

**症状**：离子环模式下，两次脉冲之间所有粒子被召回核心，堆成**一团刺眼的白斑**，
细节全丢。

> **我**：
> 核心过曝。原因很明确：你把召回目标设成了一个**点**。上千粒子挤在一点，
> 加性混合必然爆白。请召回到一个**小壳层**（半径 0.1 量级），让粒子有空间分布。
> 另外在着色里把近核区域的亮度压一下，否则环状结构还是看不见。

**AI 修正**：

```glsl
// Recall onto a small shell (not a point) so the core never collapses
// into one overexposed blob between pulses.
```

着色侧同步：

```glsl
// Ion mode stacks every burst at the core, so damp the launch flash
// and the near-core glow there to keep the ring structure visible.
```

**结果**：环状结构清晰，核心不再是死白。✅

### Round 8 — 环"全是侧视"的问题

> **我**：
> 现在所有离子环看起来都是**同一个朝向**，像一摞平放的呼啦圈，缺乏立体感。
> 给每个爆发组分配一个**随机但固定**的法线方向，让环有不同倾角；朝向必须在一次
> 爆发内保持不变，不能每帧抖动。

**AI 修正**：

```glsl
// Each ion ring gets its own orientation (gyroscope look) so rings are
// never all edge-on to the camera.
```

**结果**：多个环呈陀螺状交错，立体感明显。✅

### Round 9 — 亮度随画质漂移（跨场景的通用问题）

**症状**：`low`（65k 粒子）画面偏暗，`high`（1M）偏亮，同一个场景换档后观感不一致。

> **我**：
> 加性混合的亮度正比于粒子数量，所以档位一换亮度就漂。你已经有 `uDensityNorm`，
> 把它接到所有场景的输出亮度上，基准取 65536（`low` 档），让各档位的总亮度对齐。

**AI 修正**：

```glsl
// Additive blending stacks thousands of points, so keep each one dim.
// uDensityNorm = 65536 / particle count keeps total brightness equal
// across quality tiers.
```

并在 `ParticleSystem.ts` 中初始化：`uDensityNorm: { value: 65536 / this.count }`。

**结果**：三档画质视觉亮度一致。✅

---

## ④ 踩坑与修正 汇总

| # | 症状 | 根因 | 修法 |
|---|---|---|---|
| 1 | 心形有接缝、密度不均 | 参数方程径向缩放，同 (x,y) 多值 | 隐式函数面积均匀拒绝采样 |
| 2 | 心形像压扁的片 | 深度没有剖面 | `cube root` 软枕剖面 |
| 3 | 改 BPM 时心跳卡顿 | 相位 = 时间 × 变量 | 相位改为积分状态量 |
| 4 | 离子环核心过曝成白斑 | 召回目标是一个点 | 召回到小壳层 + 着色压暗近核 |
| 5 | 所有离子环朝向相同 | 环法线固定 | 每组随机固定倾角 |
| 6 | 换画质档亮度漂移 | 加性混合亮度 ∝ 粒子数 | `uDensityNorm = 65536/count` |

---

## ⑤ 落地证据

| 层 | 文件 | 改动 |
|---|---|---|
| 常量 | `config.ts` | 新增 `CONFIG.heart`（13 项）、`CONFIG.pulse`（7 项）、两套 palette / dialNames / accents；`SCENES` 扩展为 6 |
| 几何 | `velocity.frag.glsl` | 新增 `heartPoint()`（隐式拒绝采样 + 枕剖面）、`heartForce()`（暗物质环 + 搏动冲击波）、`pulseLaunch()`、`pulseForce()` |
| 状态 | `StateMachine.ts` | `beatPhase` 积分、`beat` 公共字段、`case 'heart'`、`case 'pulse'` |
| 泛光 | `main.ts` | `bloomPass.strength = overlay.bloomStrength * (1 + 0.6 * beat)` |
| 着色 | `points.frag.glsl` | heart 三段色（暗红核 → 朱红面 → 亮粉边）+ 边缘高光 + 搏动闪白；pulse 逐组着色 + 彩虹模式 |
| 归一化 | `ParticleSystem.ts` | `uDensityNorm` 接入所有场景 |

**验证**：`tsc --noEmit` 零错误；六条验收标准逐条通过；六场景连续切换 5 分钟无内存增长
（`dispose()` 正确释放 GPGPU 资源）。

---

## 复盘：这次学到了什么

1. **"变量参与乘法 → 一定跳变"是个通用陷阱。** 相位、角度、累计量，凡是要随时间增长的量，
   都必须用 `+= dt * rate` 积分，绝不能用 `t * rate()`。这一条我现在会给每个新场景默认套用。
2. **过曝的根因几乎总是"把粒子召回一个点"。** 加性混合下，密度是亮度的平方级放大器。
   给召回目标一个半径，是性价比最高的一行修复。
3. **跨场景的通用问题，要在最后一次统一治理。** 亮度归一化这种问题，前四个场景都存在，
   但我在第五、六个场景才意识到——早发现能省一轮全场景回归。
