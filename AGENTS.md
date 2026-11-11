# AGENTS.md · 智控星海 StarSea

> 给 AI 的约束文件。每次修改代码前先读这里，每次完成后按自检清单核对。

## 一、项目铁律（违反任一条即失败）

1. **不编造数字**：FPS、延迟、识别率、物理量精确值一律不许凭空写。尺度数字必须标「约 / 量级示意」，未测就写「未测」。
2. **纯前端无后端**：禁止引入后端、数据库、密钥、付费 API、运行时大模型。视频帧不上传，全部本地处理。
3. **视觉参数不动产**：不修改 `src/sim/shaders/*.glsl` 的调色板、力场系数、视觉参数。界面观感是唯一被明夸的东西。
4. **禁止改写 Git 历史**：不许 rebase 改时间戳、force-push、伪造 commit date。
5. **不删除上游声明**：`LICENSE`、`ORIGINALITY.md` 里的开源披露必须保留。

## 二、模块边界

| 模块 | 允许 import | 禁止 import |
|------|------------|------------|
| `src/ui/*` | `src/config.ts`，DOM API | `src/sim/shaders/*`，直接操作 uniforms |
| `src/sim/*` | `src/config.ts`，`three` | `src/ui/*`，DOM API |
| `src/input/*` | `src/config.ts`，`three` | `src/sim/*`，`src/ui/*` |
| `src/main.ts` | 所有模块 | — |

跨层操作（ui 层改物理参数）必须通过 `config.ts` 常量或 `StateMachine` / `Overlay` 的公开方法进行。

## 三、提交信息规范

格式：`<type>: <一句中文说明>`

类型：`feat` / `fix` / `docs` / `chore` / `test` / `refactor`

示例：
- `feat: 新增尺度轴 ScaleAxis，底部六站点对数轴`
- `fix: 修正帮助面板键位与代码不一致`
- `docs: 新增复现验证记录`

每个工作项一个独立提交，不要把多个改动塞进一个提交。

## 四、每次修改后的自检清单

- [ ] `npm run build`（即 `tsc && vite build`）成功，零错误
- [ ] `node scripts/check-contract.mjs` 通过（无 uniform 名字对不上）
- [ ] 新增的键盘快捷键已在帮助面板中更新
- [ ] 新增的数值来源已核实（`config.ts` 或着色器），不许凭空写
- [ ] 没有引入新的 `@ts-ignore`、`as any`、注释掉的功能
- [ ] 新增 UI 元素：静置 5 秒后淡出，`prefers-reduced-motion` 下直接显隐

## 五、uniform 契约

着色器声明的 `uniform <type> <name>` 必须在 `ParticleSystem.ts` 里有对应的赋值。
用 `node scripts/check-contract.mjs` 检查，CI 也会跑这个脚本。
