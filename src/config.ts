export const QUALITY_SIZES = { low: 256, med: 512, high: 1024 } as const;
export type Quality = keyof typeof QUALITY_SIZES;

export const SCENES = ['nebula', 'galaxy', 'ocean', 'saturn', 'heart', 'pulse'] as const;
export type SceneId = (typeof SCENES)[number];

/**
 * 对数尺度轴 —— 六个场景按物理尺度从小到大排列。
 * 不要改 SCENES 的顺序（G 键循环依赖它）；尺度顺序单独定义在这里。
 * 所有尺度数字均标「约 / 量级示意」，不写精确值。
 * 知识卡文案中的每个数值均与下方 CONFIG 中对应字段核对过。
 */
export const SCALE_AXIS: ReadonlyArray<{
  scene: SceneId;
  sceneName: string;     // 中文场景名（尺度轴显示）
  scaleLabel: string;    // 量级标签，如 "约 10⁻¹ m"
  force: string;         // 主导物理量（尺度轴 tooltip 用）
  concept: string;       // 一句话概念（≤40字）
  gestureMap: string;    // 手势 ↔ 物理量映射
  realWorld: string;     // 现实对照
  question: string;      // 课堂一问
  answer: string;        // 答案（默认折叠）
}> = [
  {
    scene: 'heart',
    sceneName: '心跳',
    scaleLabel: '约 10⁻¹ m',
    force: '心肌收缩节律、搏动波',
    concept: '心脏以 62–128 BPM 节律收缩，搏动波从心尖向外传播。',
    gestureMap: '握拳程度 → BPM（62 到 128，config.heart.bpmCalm / bpmIntense）及收缩幅度',
    realWorld: '人体心跳，心肌节律收缩与舒张；心电图 P-QRS-T 对应每次 lub-dub。',
    question: '为什么心跳声是"lub-dub"两个音，而不是一个？',
    answer: '第一音（lub）来自房室瓣关闭，第二音（dub）来自动脉瓣关闭。粒子场双峰包络（相位 0.04 的 lub 峰 + 0.3 的 dub 峰）模拟了这两次关闭。',
  },
  {
    scene: 'pulse',
    sceneName: '离子脉冲',
    scaleLabel: '约 10⁰ m',
    force: '抛体运动、环形冲击波',
    concept: '6 组粒子弹道点火，受重力回落；握拳时汇聚成环形冲击波。',
    gestureMap: '握拳程度 → 粒子从弹道礼花收束为离子环（config.pulse.groups=6，period=3.0）',
    realWorld: '烟花弹道、粒子加速器中的离子束环、等离子体环形约束（托卡马克）。',
    question: '礼花各组为什么不同时点火，而是错开时间？',
    answer: '错开点火（相位差 = 周期 / 组数）让视觉上始终有粒子在空中，避免同时落地造成空白；这也对应真实烟花"连发"的编排逻辑。',
  },
  {
    scene: 'ocean',
    sceneName: '粒子地球',
    scaleLabel: '约 10⁷ m',
    force: '自转、磁层与太阳风',
    concept: '粒子地球自转，22% 的极区粒子在握拳时被抬升为极光幕。',
    gestureMap: '握拳程度 → 极光风暴强度（config.ocean.auroraFraction=0.22，auroraHeight=0.55）',
    realWorld: '地球极光，太阳风高能粒子沿磁力线进入极区大气，高度约 100–300 km。',
    question: '极光为什么只出现在极区附近，而不是全球均匀分布？',
    answer: '地磁场是偶极场，极区磁力线近乎垂直进入大气，太阳风高能粒子沿磁力线被引导至极圈附近（约纬度 65°–72°）与大气分子碰撞激发发光。',
  },
  {
    scene: 'saturn',
    sceneName: '土星环',
    scaleLabel: '约 10⁸ m',
    force: '开普勒差速、环缝共振',
    concept: '土星环粒子轨道角速度随半径按 r⁻¹·⁵ 衰减（开普勒第三定律）。',
    gestureMap: '握拳程度 → 环面隆起与湍流增强（config.saturn.keplerExponent=0.5）',
    realWorld: '土星卡西尼缝，由土卫一 2:1 轨道共振在环上刻出粒子稀疏区。',
    question: '卡西尼缝为什么是"空"的，而不是密集的？',
    answer: '处于缝中的粒子轨道周期恰好是土卫一的 1/2，每次合相都受同向引力扰动，摄动累积使轨道偏心率增大，粒子最终被踢出该区域。',
  },
  {
    scene: 'nebula',
    sceneName: '星云',
    scaleLabel: '约 10¹⁶ m',
    force: '分子云引力收束',
    concept: '稀疏分子云在引力作用下收束，最终坍缩为致密发光球体——恒星诞生前夜。',
    gestureMap: '握拳程度 → 从湍流星云（cloudRadius=2.3）收束为致密球（ballRadiusTight=0.45）',
    realWorld: '猎户座大星云，恒星形成区的分子云坍缩；哈勃"创生之柱"。',
    question: '分子云坍缩时为什么会加速旋转？',
    answer: '角动量守恒。云团原本缓慢自转，半径缩小后转动惯量减小，角速度必须增大以保持角动量不变——就像旋转的花样滑冰运动员收臂加速。',
  },
  {
    scene: 'galaxy',
    sceneName: '星系',
    scaleLabel: '约 10²¹ m',
    force: '密度波、旋臂熔铸',
    concept: '旋臂是密度波而非固定结构，握拳触发星锻：旋臂向内螺旋熔铸为致密星球。',
    gestureMap: '握拳程度 → 从旋涡星系收束为星锻（config.galaxy.armTwist=2.8，forgeRadius=0.85）',
    realWorld: '银河系直径约 10⁵ 光年（≈ 10²¹ m）；旋臂转速约 210 km/s。',
    question: '如果旋臂是密度波，太阳绕银心转动时是在穿越旋臂，还是随旋臂一起转？',
    answer: '穿越旋臂。旋臂的图案速度（约 20–25 km/s）远低于太阳的轨道速度（约 220 km/s），太阳每隔约 1.5–2 亿年穿越一次旋臂。',
  },
];

export const CONFIG = {
  defaultQuality: 'med' as Quality,
  maxDelta: 1 / 30,
  damping: 0.965,
  maxSpeed: 4.2,

  cloudCenter: { x: 0, y: 0.4, z: 0 },
  cloudRadius: 2.3,
  ballRadiusTight: 0.45,
  stiffnessCloud: 2.0,
  stiffnessBall: 4.8,
  turbulenceCloud: 1.15,
  turbulenceBall: 0.22,
  gatherSmoothing: 5.0,

  rotateSensitivity: 2.4,
  rotateDamping: 1.4,
  rotateMaxSpeed: 3.0,
  autoSpin: 0.05,

  ballRadius: 1.25,
  ballRadiusMin: 0.5,
  ballRadiusMax: 2.4,
  palmRepelBase: 8.0,
  palmRepelSpeedBoost: 12.0,
  collisionPush: 0.9,

  energySmoothing: 3.0,
  colorSmoothing: 3.0,

  pointSize: 2.1,
  bloom: { strength: 0.65, radius: 0.45, threshold: 0.72 },
  background: 0x050508,

  defaultScene: 'nebula' as SceneId,
  scenePalettes: {
    nebula: {
      calm: ['#090e31', '#6548dc', '#e2a9ff'] as [string, string, string],
      intense: ['#160923', '#ca48ea', '#ffb967'] as [string, string, string],
    },
    galaxy: {
      calm: ['#05091c', '#8a36d5', '#ff9d43'] as [string, string, string],
      intense: ['#16030d', '#ff4b19', '#ffd36b'] as [string, string, string],
    },
    ocean: {
      calm: ['#04152f', '#1487c1', '#b7f3ff'] as [string, string, string],
      intense: ['#062b3e', '#42b96b', '#ffffff'] as [string, string, string],
    },

    saturn: {
      calm: ['#160d30', '#8b5cf6', '#f5d18a'] as [string, string, string],
      intense: ['#24103b', '#c084fc', '#ffe4a3'] as [string, string, string],
    },
    heart: {
      calm: ['#1a0208', '#e8153a', '#ff8aaa'] as [string, string, string],
      intense: ['#1c0108', '#ff2020', '#ffb0c0'] as [string, string, string],
    },
    pulse: {
      calm: ['#1a0a02', '#ffb347', '#5ad8ff'] as [string, string, string],
      intense: ['#020a24', '#3a8bff', '#c6f4ff'] as [string, string, string],
    },
  },
  sceneDialNames: {
    nebula: ['cloud', 'ball'] as [string, string],
    galaxy: ['galaxy', 'star forge'] as [string, string],
    ocean: ['calm', 'aurora'] as [string, string],
    saturn: ['orbit', 'rings'] as [string, string],
    heart: ['heartbeat', 'dark core'] as [string, string],
    pulse: ['fireworks', 'ion pulse'] as [string, string],
  },
  sceneAccents: {
    nebula: ['#8d4dff', '#ff9d43'] as [string, string],
    galaxy: ['#9c58ff', '#ffad4d'] as [string, string],
    ocean: ['#39b9ee', '#8ce5b4'] as [string, string],
    saturn: ['#a970ff', '#ffd36b'] as [string, string],
    heart: ['#ff3355', '#ff8090'] as [string, string],
    pulse: ['#ffb347', '#6fb4ff'] as [string, string],
  },

  galaxy: {
    discRadius: 30.6,
    discRadiusCollapsed: 2.9,
    orbitSpeed: 0.8,
    orbitSpeedCollapsed: 2.6,
    orbitGain: 1.2,
    flatten: 4.6,
    flattenCollapsed: 8.5,
    bulge: 0.42,
    discEdgeSoften: 0.0,
    armTwist: 2.8,
    armStrength: 0.7,
    armStrengthCollapsed: 0.35,
    stiffness: 8.6,
    stiffnessCollapsed: 2.4,
    turbulence: 0.13,
    turbulenceCollapsed: 0.28,
    coreGlow: 0.72,
    coreGlowCollapsed: 1.0,
    coreColor: '#fff3e8',
    sunRadius: 0.30,
    holeRadius: 0.47,
    // Fist = "star forge": the disc spirals in and fuses into a solid,
    // glittering sphere of this radius.
    forgeRadius: 0.85,
  },

  nebula: {
    planetRadius: 0.8,
    axisX: 1.15,
    axisY: 0.86,
    axisZ: 0.96,
    filamentStrength: 0.3,
    flowStrength: 0.4,
  },

  ocean: {
    waveAmpCalm: 0.04,
    waveAmpStorm: 0.18,
    fistStormBoost: 0.65,
    waveFreqCalm: 0.7,
    waveFreqStorm: 1.5,
    turbulenceCalm: 0.08,
    turbulenceStorm: 0.42,
    stiffness: 5.8,
    containRadius: 1.28,
    horizontalFlow: 0.22,
    verticalTurbulenceScale: 0.28,
    foamThreshold: 0.53,
    // Fist = aurora storm: this share of surface particles lifts into polar
    // aurora curtains reaching auroraHeight above the globe.
    auroraFraction: 0.22,
    auroraHeight: 0.55,
    auroraSmoothing: 2.5,
  },

  saturn: {
    planetRadius: 1.02,
    planetFlatten: 0.9,
    innerRingRadius: 1.24,
    outerRingRadius: 2.72,
    ringThickness: 0.075,
    cassiniGapStart: 1.72,
    cassiniGapEnd: 1.9,
    ringPlaneStrength: 7.5,
    ringStiffness: 5.8,
    orbitSpeed: 0.42,
    orbitSpeedGain: 1.35,
    keplerExponent: 0.5,
    coreStiffness: 5.4,
    ringTurbulence: 0.16,
    ringVerticalSpread: 0.1,
    collapse: 0.22,
    orbitSpeedGainIntense: 1.9,
    particleRoleThreshold: 0.34,
    tilt: 0.42,
  },

  // Beating 3D heart wrapped in an orbiting dark-matter halo.
  // Dial 0 = slow heartbeat, dial 1 = contracted "dark core": faster, harder beats,
  // stronger shockwaves, and the halo is pulled inward and spun up.
  heart: {
    scale: 1.3,
    bpmCalm: 62,
    bpmIntense: 128,
    beatAmp: 0.10,
    beatAmpIntense: 0.22,
    contract: 0.86,
    waveForce: 1.6,
    waveForceIntense: 5.5,
    waveSpeed: 3.4,
    haloFraction: 0.2,
    haloSpin: 1.6,
    stiffness: 5.0,
    stiffnessIntense: 8.0,
    turbulence: 0.32,
    turbulenceIntense: 0.18,
  },

  // Ballistic fireworks. Each burst group fires once per period, staggered.
  // Dial 1 = "ion pulse": bursts converge to the center, flatten into ring
  // shockwaves, lose gravity and get recalled to the core.
  pulse: {
    period: 3.0,
    groups: 6,
    burstSpeed: 3.3,
    burstSpeedIon: 4.0,
    gravity: 0.9,
    recall: 2.6,
    turbulence: 0.12,
    turbulenceIon: 0.55,
  },

  detectHz: 30,
  mirrorHandedness: true,
  fingerExtendedRatio: 1.15,
  fingerCurledRatio: 0.85,
  closednessSmoothing: 0.25,
  phantomMinSeparation: 0.09,
  oneEuro: { minCutoff: 1.0, beta: 0.02, dCutoff: 1.0 },
  handDepthRange: 1.2,
  trackingLostFadeMs: 300,
  trackingLostNeutralMs: 1000,

  autoQuality: true,
  /** 帧率采样窗口（毫秒）。README 里写的「每 500ms 统计一次」即此值。 */
  fpsSampleIntervalMs: 500,
  fpsSampleSeconds: 3,
  fpsDowngradeBelow: 45,
};
