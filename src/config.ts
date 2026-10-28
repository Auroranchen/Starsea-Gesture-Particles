export const QUALITY_SIZES = { low: 256, med: 512, high: 1024 } as const;
export type Quality = keyof typeof QUALITY_SIZES;

export const SCENES = ['nebula', 'galaxy', 'ocean', 'saturn'] as const;
export type SceneId = (typeof SCENES)[number];

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
  },
  sceneDialNames: {
    nebula: ['cloud', 'ball'] as [string, string],
    galaxy: ['galaxy', 'collapse'] as [string, string],
    ocean: ['calm', 'storm'] as [string, string],
    saturn: ['orbit', 'rings'] as [string, string],
  },
  sceneAccents: {
    nebula: ['#8d4dff', '#ff9d43'] as [string, string],
    galaxy: ['#9c58ff', '#ffad4d'] as [string, string],
    ocean: ['#39b9ee', '#8ce5b4'] as [string, string],
    saturn: ['#a970ff', '#ffd36b'] as [string, string],
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
  fpsSampleSeconds: 3,
  fpsDowngradeBelow: 45,
};
