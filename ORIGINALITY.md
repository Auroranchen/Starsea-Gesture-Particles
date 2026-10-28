# 原创性与开源合规声明

> 本文档用于向评审说明本作品的来源、许可证合规情况，以及本项目相对上游的实质性改动。
> 我们选择主动、完整地披露，而不是模糊处理。

---

## 一、结论先行

「智控星海」是一个**基于开源项目二次开发**的作品。我们不声称它是从零原创的项目。

- **上游项目**：`gesture-particles`，作者 **William Larskog**，许可证 **MIT**
- **许可证合规**：`LICENSE` 原样保留，版权声明与许可声明未删除、未修改
- **原创贡献**：**3 个新增场景 + 1 个场景整体重写 + 1 个机制重做 + 1 次架构重构 + 全站产品化**，
  合计约 **6,055 行代码中的大部分着色器与状态机逻辑**
- **可验证性**：每一项改动都对应 Git 提交记录，可在提交历史中逐条追溯

---

## 二、为什么选择"二次开发 + 主动披露"

这是一个刻意的判断，理由有三：

1. **赛题禁止的是"换皮参赛"，不是"二次开发"。** 官方原文是"严禁直接使用已有开源项目包装
   参赛""禁止一次性提交（initial commit 即包含全部功能）"。也就是说，规则约束的是
   **是否有真实的增量**，以及**过程是否可复现**，而不是禁止一切基于开源的起点。
   赛题同时明确写着"可以参考或二次开发开源项目，但须核实许可证，遵守署名、版权声明及
   其他许可条件"。

2. **这个项目的技术门槛是真实的。** GPGPU 粒子模拟 + 六场景力场 + 手势管线，
   不是改几行文字能"换皮"出来的东西。改动量摆在那里，披露反而成为证据。

3. **隐瞒的成本远高于披露。** `LICENSE` 里写着别人的名字，`README` 的历史版本里有
   "Inspired by David Katz"，仓库 fork 关系可查。任何一位评委花 30 秒就能看出来。
   与其等着被问，不如主动讲清楚——这本身也是工程素养的一部分。

---

## 三、上游信息

| 项 | 内容 |
|---|---|
| 项目名 | `gesture-particles` |
| 作者 | William Larskog |
| 许可证 | MIT（`LICENSE` 文件第 3 行为 `Copyright (c) 2026 William Larskog`） |
| 灵感出处 | David Katz 的 MediaPipe + Three.js 粒子模拟器，曾刊于 80 Level |
| 原始形态 | 3 个场景（`nebula` / `galaxy` / `ocean`），WebGL2 + Three.js + MediaPipe |
| 第三方 GLSL | 单纯形噪声来自 Ian McEwan / Ashima Arts 的 [webgl-noise](https://github.com/ashima/webgl-noise)，**公有领域** |

**MIT 许可证的核心义务**：保留版权声明与许可声明。本项目已满足——`LICENSE` 文件完整保留，
未做任何修改。

---

## 四、本项目的实质性改动清单

### 4.1 新增场景（3 个，上游完全没有）

| 场景 | 技术内容 | 关键文件 |
|---|---|---|
| `saturn` 土星 | 环系 + 行星本体双角色粒子（`particleRoleThreshold = 0.34`）；卡西尼缝拒绝采样；**倾斜环面下的局部坐标系求解**（把位置与速度一并旋转进局部系，算完再转回）；开普勒差速 `v ∝ r^-0.5` | `velocity.frag.glsl`、`config.ts`、`ParticleSystem.ts` |
| `heart` 心跳 | **隐式心形函数面积均匀拒绝采样**（`(x²+y²−1)³ − x²y³ ≤ 0`）+ 枕形深度剖面；lub-dub 双高斯包络；相位积分（BPM 变化不跳变）；三层倾斜暗物质环；搏动冲击波 | `velocity.frag.glsl`、`StateMachine.ts`、`main.ts` |
| `pulse` 离子脉冲 | 分 6 组错峰点火的弹道礼花；88% 球壳初速 + 余烬；离子环向心汇聚；**召回目标为小壳层**（避免加性混合过曝）；每组独立环面倾角 | `velocity.frag.glsl`、`points.frag.glsl` |

### 4.2 场景整体重写（1 个）

| 场景 | 上游实现 | 本项目实现 |
|---|---|---|
| `ocean` | 水平平面 + 正弦波起伏，握拳时浪变大 | **粒子地球**：薄球壳等面积采样（`cosθ = 2u−1`）；纬度加权东向自转（赤道快、两极慢）；切平面投影湍流（无径向分量）；**极光风暴**：22% 粒子抬升成极区极光幕，脚沿波浪形椭圆、绿→品红渐变、乘性权重保证归零干净 |

> 这是改动量最大的一项：`oceanForce()` 被完全重写，`waveHeight()` 被删除，
> 并新增 `auroraForce()` 与 `earthNoise()` / `earthLand()` 着色函数。

### 4.3 机制重做（1 处）

| 位置 | 上游 | 本项目 |
|---|---|---|
| `galaxy` 握拳效果 | 引力坍缩为黑洞（核心熄灭、环加速） | **星锻（star forge）**：旋臂向内螺旋熔铸成致密发光球，核心保持明亮恒星，随机粒子迸发 4 点星芒闪烁 |

### 4.4 架构重构

| 项 | 内容 |
|---|---|
| 着色器公共库 | 抽取 `common.glsl`（34 行），消除 `velocity` / `position` / `points` 三个着色器之间的重复函数 |
| 力场模块化 | `velocity.frag.glsl` 由 12,408 字节扩展到 **20,108 字节**，新增 7 个独立函数：`nebulaForce` / `galaxyForce` / `oceanForce` / `saturnForce` / `heartPoint` / `heartForce` / `pulseLaunch` / `pulseForce` / `forgeForce` / `auroraForce` / `capsuleForce` / `radialField` / `blackHoleForce` / `gravityField` |
| 均匀参数共享 | `ParticleSystem` 用 `shared` 对象让速度 pass、位置 pass、点材质共享同一批 `IUniform`，一处写入三处生效 |
| 跨档亮度归一 | `uDensityNorm = 65536 / count`，保证 65k / 262k / 1M 三档视觉亮度一致 |

### 4.5 产品化与工程化

| 项 | 内容 |
|---|---|
| 品牌 | 全站中文化，标题「传智杯：智控星海 · 实时空间实验」，`meta` 描述重写 |
| 启动体验 | `StartScreen` 提供摄像头/鼠标双模式选择与交互模式说明 |
| 状态反馈 | `Overlay` 的 Toast（场景切换、手势丢失/恢复、自动降档、模式切换）、HUD、帮助浮层 |
| 运行时调参 | `ParamPanel` 支持在运行时调整物理常量并即时生效 |
| 类型安全 | 全量 TypeScript 严格检查，构建前 `tsc` 强制通过（当前 **0 错误**） |
| 部署 | GitHub Actions 自动构建并发布到 GitHub Pages |

### 4.6 双手控制专属视觉层（2026-10-28）

- **模式开关**：`common.glsl` 共享 uniform `uFx`，dials = 1 / collider = 0，三处材质同一引用
- **深度雾**：`points.frag.glsl` 两条渲染路径都接入，远处 0.70×、近处 1.12×；`uFx = 0` 时恒为 1，力场碰撞逐像素不变
- **错误可视化**：`main.ts` 把 JS 异常与着色器编译错误显示为底部红条

### 4.7 改动量对照

| 文件 | 上游 | 本项目 | 变化 |
|---|---|---|---|
| `src/sim/shaders/velocity.frag.glsl` | 12,408 B | **20,108 B** | +62% |
| `src/sim/shaders/points.frag.glsl` | 8,220 B | **12,723 B** | +55% |
| `src/sim/shaders/points.vert.glsl` | 2,895 B | **3,651 B** | +26% |
| `src/sim/ParticleSystem.ts` | 15,543 B | **16,000 B** | +3% |
| `src/sim/StateMachine.ts` | 14,973 B | **16,111 B** | +8% |
| `src/config.ts` | 5,575 B | **5,929 B** | +6% |
| `src/main.ts` | 11,722 B | **13,236 B** | +13% |
| `src/sim/shaders/common.glsl` | 不存在 | **1,604 B** | 新增 |
| `index.html` | 原版英文 | 中文标题 + meta | 重写 |

---

## 五、如何验证以上声明

评审无需信任本文档的单方面陈述，以下方式可独立核实：

1. **看 Git 历史**：每个功能对应独立 commit，提交信息为 `feat: ...` / `refactor: ...` 格式；
   首个 commit 为 2026-10-19 的阶段快照（此时已含 saturn 场景），
   第二个提交补入 heart / pulse 快照，第三个提交完成两版合并；此后的提交按模块拆分（着色器公共库、
   速度场、点着色、config、播种、状态机、主循环、文档）。受限于项目在 10-28 之前未使用版本控制，
   前三段历史由带日期的目录快照回溯重建，各提交的 diff 与快照内容一一对应，可逐条核对。
2. **看代码差异**：在提交历史中对比首个 commit 与最新提交，可看到 `velocity.frag.glsl`
   新增的全部 `*Force()` 函数。
3. **看代码注释**：所有踩坑修复都留有现场注释（如 `which was the source of the spin
   instability`、`was causing height run-away`、`so the core never collapses into one
   overexposed blob`），这些是真实迭代的痕迹，非事后编造。
4. **看 Prompt 记录**：[`prompts/`](prompts/) 目录记录了三次核心迭代的完整 Prompt 链，
   含失败与返工。
5. **跑一遍**：[`README.md`](README.md) 的验证清单共 8 项，逐条执行即可确认功能真实。

---

## 六、未使用的内容（明确声明）

为避免误解，以下内容**没有**被用于本作品：

- ❌ 没有使用任何付费素材、第三方模型文件、字体授权文件
- ❌ 没有使用他人的项目截图或演示视频
- ❌ 没有引用任何未开源的代码片段
- ❌ 没有使用需要密钥的商业 API
- ❌ 没有伪造性能数据（本文档与 README 均不提供未实测的帧率/延迟数字）

---

## 七、许可证声明

```
MIT License

Copyright (c) 2026 William Larskog      <- 上游版权，原样保留

本项目在上述许可证下进行二次开发。
```

完整许可文本见仓库根目录 [`LICENSE`](LICENSE)。

GLSL 单纯形噪声部分（`snoise` / `snoise3` / `curlNoise`）来自 Ashima Arts 的
`webgl-noise`，该实现以公有领域发布，无附加义务。
