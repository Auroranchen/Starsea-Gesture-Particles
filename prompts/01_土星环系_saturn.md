# 迭代 01 · 土星环系（saturn）

| 项目 | 内容 |
|---|---|
| 迭代周期 | 2026-10-20 → 2026-10-22 |
| 目标 | 新增第 4 个场景：可交互的土星（行星本体 + 环系 + 卡西尼缝），握拳时环系向内坍缩 |
| 涉及文件 | `src/config.ts`、`src/sim/shaders/velocity.frag.glsl`、`src/sim/ParticleSystem.ts`、`src/sim/StateMachine.ts`、`src/main.ts` |
| 最终 commit | `feat: add saturn scene with keplerian rings and cassini gap` |

---

## ① 迭代目标

已有三个场景（星云、星系、海面）都是"自由形态"，缺少一个**有刚性结构**的对象。
土星环是极好的教学载体：它的外观完全由物理规律决定——开普勒第三定律让内环转得快、
外环转得慢，环缝来自轨道共振。学生能直观看到"距离决定速度"。

**验收标准（我事先写死的）：**

1. 环内缘角速度 > 外缘，比值约 1.5（开普勒 `v ∝ r^-0.5`）；
2. 环面倾角 `0.42 rad` 时，环**不能**出现上下翻涌或整体倾覆；
3. 卡西尼缝是一条真实存在的空隙，粒子密度在 `r ∈ [1.72, 1.90]` 内显著下降；
4. 握拳（dial → 1）时环面收窄、隆起、湍流增强，形成"坍缩"效果；
5. **不许影响** nebula / galaxy / ocean 三个场景的任何现有表现。

---

## ② 上下文投喂

这一轮我只给了 AI **三样东西**，刻意没给全文：

| 投喂内容 | 为什么给 |
|---|---|
| `src/sim/shaders/velocity.frag.glsl` 的 `main()` + `galaxyForce()` 片段 | 让它模仿已有的"力场函数"写法，保持风格一致 |
| `src/config.ts` 的 `galaxy` 段（约 25 行） | 示范"所有常量外置"的约定 |
| 上面那 5 条验收标准 | 判据 |
| `src/sim/ParticleSystem.ts` 的 `seedTextures()` 签名 | 让它知道播种函数在哪里接 |

**没给**：`StateMachine.ts` 全文、UI 文件、`points.frag.glsl`。
原因：这一轮只做"力场 + 播种"，给它看 UI 只会诱导它顺手改 HUD，扩大改动面。

---

## ③ Prompt 链

### Round 1 — 先要方案，不许写代码

> **我**：
> 我要给一个 Three.js GPGPU 粒子系统加第 4 个场景 `saturn`。粒子同时扮演两个角色：
> 约 2/3 是环系粒子，1/3 是行星本体粒子。先说方案，不要写代码，重点回答两个问题——
> （a）环面倾斜 0.42 rad 的情况下，你打算怎么保证环粒子绕的是**倾斜后的**法线轴，
> 而不是世界 Y 轴？
> （b）卡西尼缝在播种阶段怎么实现，还是留给力场处理？

**AI 给的方案**：建议把整个环系当"局部平面"处理，用 `tilt` 构造旋转矩阵；
卡西尼缝在 `seedTextures()` 里用拒绝采样直接把缝隙内粒子挤到缝边缘。

**我的判断**：方向对。但（a）它只说了"旋转位置"，没提速度——这正是后面翻车的伏笔。

### Round 2 — 放行写力场（单文件）

> **我**：
> 方案可以，只改 `velocity.frag.glsl`。新增：
> 1. `saturnForce(p, v, seed)`，内部区分"环粒子"和"行星粒子"两种走法；
> 2. 环粒子：径向弹性回位 + 切向轨道驱动 + 垂直回正 + 湍流；
> 3. 行星粒子：向扁球面收拢，**显式阻尼垂直方向**；
> 4. 所有系数走 uniform，不许在 GLSL 里写死数字。
> 别动 `main()` 以外的任何现有函数。

**AI 输出**：给了约 60 行。结构合理，但只把 `p` 旋转进局部系，`v` 仍是世界系直接参与切向速度比较。

**结果**：环在倾角 0.42 下确实转了，但转 20 秒左右开始**整体倾斜、环面上下翻涌、越转越歪**。

---

## ④ 踩坑与修正（这是本次迭代最关键的一段）

### 症状

环面初看正常，长时间运行后姿态失稳，像"呼啦圈被甩歪了"。

### 我的定位过程

我没有直接问 AI"为什么不稳"——那样它只会给一堆猜测。我先自己缩小范围：

1. 把 `tilt` 改成 0 → 稳了。**说明问题与倾斜强相关**。
2. 把湍流 `uRingTurbulence` 设 0 → 仍然歪，只是慢一点。**排除湍流是主因**。
3. 把切向轨道驱动 `uSaturnOrbitSpeed` 设 0 → 完全不歪。**锁定在轨道驱动这一项**。

### Round 3 — 带着证据去问

> **我**：
> 定位到了：`tilt != 0` 且 `orbitSpeed != 0` 时，环长时间运行会整体倾斜失稳。
> 单独关掉湍流无效，关掉轨道驱动则正常。
> 我怀疑是你用**世界坐标系的 v** 去和**局部坐标系的切向**做比较，导致倾斜环面上
> 速度分量被判错方向、持续注入错误的离面速度。请先确认这个怀疑成立不成立，
> 再给修法；如果成立，修法必须是"p 和 v 一起旋转进局部系，算完再转回世界系"。

**AI 确认**：怀疑成立。给出了完整的局部系解法：

```glsl
// Work entirely in the tilted-ring local frame: rotate p AND v into local space,
// compute forces there, then rotate the result back. This prevents the orbit
// velocity component from drifting into the wrong plane when the ring is tilted,
// which was the source of the spin instability.
vec3 saturnForce(vec3 p, vec3 v, float seed) {
  vec3 lp = rotateSaturn(p, -uSaturnTilt);
  vec3 lv = rotateSaturn(v, -uSaturnTilt);
  // … 全部在局部系里算 …
  return rotateSaturn(force, uSaturnTilt);
}
```

**结果**：倾斜 0.42 下连续运行 10 分钟，环面姿态稳定。

### 修完又冒出的两个问题

**问题 A：环内缘比外缘转得慢**（违反开普勒）

原因是切向驱动用了常数角速度。修正为按 `v ∝ r^-kepler` 计算，`keplerExponent = 0.5`：

```glsl
float v = CONFIG.saturn.orbitSpeed * pow(max(r, 0.2), -CONFIG.saturn.keplerExponent);
```

**问题 B：行星本体在高转速下出现"高度失控"**

行星粒子被压向扁球面时，垂直方向只有弹性回复、没有阻尼，能量不断累积后弹出球面。
修正为显式阻尼 + 把垂直纹理扰动压到极小：

```glsl
// Damp vertical oscillation explicitly so the core stays stable under rotation
// Tiny vertical texture, much gentler than before (was causing height run-away)
```

> 这两条注释就是当时留下的现场记录，原样保留在代码里。

---

## ⑤ 落地证据

| 层 | 文件 | 改动 |
|---|---|---|
| 常量 | `src/config.ts` | 新增 `CONFIG.saturn`（22 个参数）、`scenePalettes.saturn`、`sceneDialNames.saturn`、`sceneAccents.saturn`，`SCENES` 增加 `'saturn'` |
| 着色器 | `velocity.frag.glsl` | 新增 `rotateSaturn()`、`saturnForce()`，约 50 行；`main()` 增加场景分支 |
| 播种 | `ParticleSystem.ts` | `seedTextures()` 增加 `saturn` 分支：环粒子（√ 均匀采样 + 卡西尼缝拒绝采样）与行星粒子（扁球面）按 `particleRoleThreshold = 0.34` 分配 |
| 状态 | `StateMachine.ts` | 新增 `case 'saturn'`：环半径/厚度/湍流/坍缩随 dial 插值 |
| 相机 | `main.ts` | `applyCameraForScene()` 增加 `saturn` 机位 |
| 着色 | `points.frag.glsl` | 环粒子暖金渐层 + 随机金色星芒，行星本体冷紫基色 |

**验证方式**：`npx tsc --noEmit` 零错误；连续运行 10 分钟无姿态失稳；
与 nebula / galaxy / ocean 逐场景对比，前三个场景视觉无变化。

---

## 复盘：这次学到了什么

1. **"旋转位置"和"旋转速度"是两件事**——AI 很容易只做一半。凡是涉及坐标系变换的
   需求，Prompt 里必须点名"位置和速度都要变换"。
2. **失稳类 Bug 不要直接问 AI，先自己做变量隔离**。我用三步（tilt / turbulence /
   orbitSpeed 分别归零）把范围从"整个场景"缩到"一行切向驱动"，再问 AI 时它一次就答对了。
   直接问"为什么不稳"大概率得到 5 条猜测。
3. **把诊断结论写进 Prompt**。上面 Round 3 那段话里，"我怀疑是……"比"帮我看看"有效得多。
