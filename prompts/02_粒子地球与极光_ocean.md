# 迭代 02 · 粒子地球与极光风暴（ocean 重写）

| 项目 | 内容 |
|---|---|
| 迭代周期 | 2026-10-23 → 2026-10-25 |
| 目标 | 把原来的"平面波浪"场景**重写**为"粒子地球 + 握拳触发极光风暴" |
| 涉及文件 | `src/sim/shaders/velocity.frag.glsl`、`src/sim/shaders/points.frag.glsl`、`src/sim/ParticleSystem.ts`、`src/config.ts`、`src/sim/StateMachine.ts` |
| 最终 commit | `feat: rewrite ocean as particle earth with aurora storm` |

---

## ① 迭代目标

上游的 `ocean` 是一个**平面波面**：粒子在一个水平面上按正弦波起伏，握拳时浪变大。
视觉上像"海面"，但从教学角度它几乎无意义——它不解释任何真实天体。

我想把它换成一个**能讲清楚三件事**的对象：

1. **地球自转**——球面粒子绕轴转动，学生能看出"这是球，不是盘子"；
2. **海陆分布**——不是均匀球壳，要有可辨认的大陆轮廓；
3. **极光成因**——握拳时极区粒子抬升成极光幕，说明"极区磁场汇聚带电粒子"。

这是本次迭代里**唯一一次大改**：不是新增场景，而是把已有场景整个替换掉。风险在于
`ocean` 的 `waveAmp` / `waveFreq` / `foamThreshold` 等参数被 `StateMachine` 和
`points.frag.glsl` 同时引用，改一侧必然连带另一侧。

**验收标准：**

1. 球面粒子**均匀分布**，不能两极堆积（这是球面采样的经典错误）；
2. 握拳时该球**不自转卡顿**，轮廓不塌陷、不出现"抖动"；
3. 极光幕只在极区出现，从绿渐变到品红，**不能整球发绿**；
4. 极光出现/消失是**渐变**的（约 1 秒），不能"啪"地亮起来；
5. 旧的平面波浪相关代码全部清理干净，不留死参数。

---

## ② 上下文投喂

这一轮投喂明显加量，因为要动三个文件：

| 投喂内容 | 为什么给 |
|---|---|
| `velocity.frag.glsl` 中 `waveHeight()` / `oceanForce()` 完整实现 | 它的**边界**是什么，我要它明确知道哪些要删 |
| `points.frag.glsl` 中 ocean 着色分支 | 颜色逻辑在新场景里要重写，先给原版 |
| `ParticleSystem.ts` 的 `seedTextures()` ocean 分支 | 播种要从"平面"改成"球壳" |
| `config.ts` 的 `CONFIG.ocean` 段 | 参数要保留/改造哪些 |
| 5 条验收标准 | 判据 |

**额外给了一条硬约束**：

> `uWaveAmp`、`uWaveFreq`、`uOceanFoam` 这三个 uniform 名称**必须保留**，
> 因为 `StateMachine.ts` 和 `points.frag.glsl` 已经引用它们；但它们的语义由你重新定义，
> 并在改动清单里说明新语义。

这条约束是刻意的：改名会引发跨文件连锁修改，而我这一轮不想碰到 `StateMachine.ts` 的
全部逻辑。

---

## ③ Prompt 链

### Round 1 — 要求先给"删除清单"

> **我**：
> 我要把 ocean 从平面波浪重写成粒子地球 + 极光。这次是重写不是新增，所以先回答我：
> 现有 ocean 相关的代码里，**哪些必须删、哪些必须留、哪些必须改语义**？列清单，
> 不要写代码。

**AI 输出**：列了一张表，但漏了 `points.frag.glsl` 里的 `uOceanWaveAmp` 用法。

**我的补充**：我手工把 `points.frag.glsl` 里所有引用 `uOcean*` 的行贴回去，让它在清单里补齐。

> 这个环节的价值：**删除清单比新增代码更重要**。上一次迭代（saturn）是纯新增，很安全；
> 这次是替换，漏删一处就会留下幽灵参数，运行时报 undefined uniform。

### Round 2 — 播种：先把球面采样做对

> **我**：
> 只改 `ParticleSystem.ts` 的 `seedTextures()` ocean 分支。
> 要求：在半径 `CONFIG.ocean.containRadius * [0.96, 1.00]` 的薄球壳上**均匀采样**。
> 注意：直接用两个随机角会**在两极堆积**，必须用 `cosθ = 2u - 1` 的等面积采样。
> 初速度给一个绕 Y 轴的缓慢东向漂移，让球看起来在自转。

**AI 输出**：

```ts
const a = Math.random() * Math.PI * 2;
const cosT = Math.random() * 2 - 1;
const sinT = Math.sqrt(1 - cosT * cosT);
const r = CONFIG.ocean.containRadius * (0.96 + Math.random() * 0.04);
pos[i] = Math.cos(a) * sinT * r;
pos[i + 1] = cosT * r;
pos[i + 2] = Math.sin(a) * sinT * r;
// slow eastward drift around Y so the globe self-rotates
```

**结果**：球面均匀，两极无堆积。✅

### Round 3 — 力场：球面自转 + 轮廓保持

> **我**：
> 现在改 `oceanForce()`。目标形态是"自转的球"，不是"有波浪的平面"。
> 三条要求：
> 1. 径向弹簧把粒子锁在球壳上（刚度要够，球不能像果冻）；
> 2. 切向速度按纬度加权——赤道快、两极慢，否则球会整体刚性旋转，看起来很假；
> 3. 湍流只能扰动**沿球面**的方向，绝不能有径向分量，否则轮廓会毛刺。

**AI 首版**：径向弹簧 + 切向驱动都给了，但湍流用了 `curlNoise(normal + time)` 直接加在
`force` 上——带了径向分量。

**症状**：球体轮廓"发毛"，边缘像沸腾的水面，30 秒后球体明显膨胀。

### Round 4 — 用现象定位

> **我**：
> 球在膨胀，边缘发毛。我关掉湍流就正常了，所以是 `uOceanTurbulence` 那一项的问题。
> 你的 `curlNoise(normal * 2.4 + uTime * 0.035)` 输出是三维向量，直接加到 force 上
> 就带了径向分量——这会把粒子往外推。请改成**先把湍流向量投影到切平面**，
> 再乘以一个随纬度衰减的系数。同时告诉我，为什么纬度衰减是必要的。

**AI 修正**：

```glsl
// Latitude-aware eastward spin keeps the spherical surface alive without breaking its silhouette.
vec3 tangentNoise = curlNoise(normal * 2.4 + uTime * 0.035);
tangentNoise -= normal * dot(tangentNoise, normal);  // 投影到切平面
```

并解释说纬度衰减是为了避免极区粒子被横向速度甩出去（极区半径小，同样的线速度对应
极大角速度）。

**结果**：球体稳定，轮廓干净，赤道明显比两极转得快。✅

### Round 5 — 极光（新增，最耗时的一轮）

> **我**：
> 加极光。不要用额外的粒子系统——复用现有粒子，把一部分"抬起来"。
> 要求：
> 1. 比例用 `auroraFraction = 0.22`，从 `seed` 里稳定选出**同一批**粒子（不能每帧换人）；
> 2. 抬升高度 `auroraHeight = 0.55`，幕布脚沿极区一个**波浪形椭圆**走，不是正圆；
> 3. 幕布要**竖直成片**，有从下到上的流动感；
> 4. 强度用 `uAurora` 控制，`0` 时这批粒子必须**完全回到球面**，不留残影。

**AI 首版**：抬起来了，但幕布是"散点云"，不成片；且 `uAurora = 0` 时残留一层雾。

**问题定位**：幕布的"脚"用了纯随机方位角，没有相关性，所以每个粒子各飞各的；
残留则是因为抬升用 `mix()` 而非乘性权重，`uAurora → 0` 时仍有偏置。

### Round 6 — 给形状定义，而不是给形容词

> **我**：
> 问题在"脚"上：你需要一个**连续的极区椭圆参数**，让相邻粒子的落点相关，
> 而不是 `random * 2π`。用 `atan(z, x)` 作为参数 t，脚的位置写成 `R(t)` 的极坐标，
> 幅度随 t 做低频谱波。另外把抬升改成乘性：`lift = uAurora * height * mask`，
> `uAurora = 0` 时 lift 严格为 0。

**AI 修正**：

```glsl
// Curtain foot follows a wavy oval around the pole.
```

**结果**：幕布成片、有波动、消失干净。✅

### Round 7 — 着色收尾

> **我**：
> 只改 `points.frag.glsl` 的 ocean 分支：
> 1. 用两层 value noise 生成大陆/海洋/云的三分色（`earthNoise` / `earthLand`）；
> 2. 极光颜色从脚部绿色过渡到顶端品红；
> 3. 白天半球和夜半球要有明暗差。
> 不要动 saturn / heart / pulse 的着色分支。

**AI 输出**：给了 `earthNoise()`、`earthLand()` 两个噪声函数 + 三分色 + 极光渐变。

**结果**：一次通过，无返工。

---

## ④ 踩坑与修正 汇总

| # | 症状 | 根因 | 修法 | 谁先发现 |
|---|---|---|---|---|
| 1 | 两极粒子堆积 | 用两个随机角采样球面，非等面积 | `cosθ = 2u − 1` 等面积采样 | 我在验收标准里就写死了，AI 首版即正确 |
| 2 | 球体膨胀、边缘发毛 | 湍流向量带径向分量 | 投影到切平面 + 纬度衰减 | 我关掉湍流做变量隔离 |
| 3 | 极光成散点、不成片 | 幕布脚用纯随机方位角，粒子间无相关性 | 用 `atan(z,x)` 做连续参数 + 低频谱波 | 我看画面判断 |
| 4 | `uAurora=0` 残留薄雾 | 抬升用 `mix`，存在常数偏置 | 改为乘性权重，保证 0 时严格归零 | 我逐帧对比截图 |
| 5 | 切场景后旧参数报 undefined | 重写时漏删 `points.frag.glsl` 中的 `uOcean*` 引用 | 按"删除清单"逐条核对 | 浏览器控制台 |

---

## ⑤ 落地证据

| 层 | 文件 | 改动 |
|---|---|---|
| 常量 | `config.ts` | `CONFIG.ocean` 重写：`containRadius` / `horizontalFlow` / `auroraFraction` / `auroraHeight` / `auroraSmoothing`；`sceneDialNames.ocean` 由 `['calm','storm']` 改为 `['calm','aurora']` |
| 播种 | `ParticleSystem.ts` | ocean 分支由平面网格改为薄球壳等面积采样 + 东向初速 |
| 力场 | `velocity.frag.glsl` | `oceanForce()` 重写（径向弹簧 + 纬度加权切向 + 切平面湍流）；新增 `auroraForce()`；`main()` 增加极光分支 |
| 状态 | `StateMachine.ts` | 新增 `aurora` 字段与 `uAurora` 平滑（`auroraSmoothing = 2.5`）；握拳或 dial 均可触发 |
| 着色 | `points.frag.glsl` | 新增 `earthNoise()` / `earthLand()`；海陆云三分色；极光绿→品红渐变；昼夜明暗 |

**验证**：`tsc --noEmit` 零错误；五条验收标准逐条对照通过；旧的 `waveHeight()` 已完全移除，
全仓库 `grep` 无残留引用。

---

## 复盘：这次学到了什么

1. **重写比重构危险，删除清单先行。** 新增场景是加法，出问题只影响新代码；重写是替换，
   漏删一处就是幽灵 uniform。此后我养成了"先让 AI 列删除清单，我再补漏"的习惯。
2. **形容词是无效需求。** "要真实""要成片""要有流动感"——AI 会给你一个它认为合理的东西，
   然后你们开始猜谜。把"成片"翻译成"相邻粒子落点必须相关，用连续参数而非随机数"，
   一次就对了。**能翻译成数学的形容词，才写进 Prompt。**
3. **杀 Bug 的顺序：现象 → 隔离变量 → 问原因。** 第 2、3 个坑都是先自己做归零实验，
   拿到"关掉 X 就正常"的结论，再让 AI 解释。这比我直接问"为什么会膨胀"快得多。
