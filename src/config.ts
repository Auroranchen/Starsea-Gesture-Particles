export const QUALITY_SIZES = { low: 256, med: 512, high: 1024 } as const;
export type Quality = keyof typeof QUALITY_SIZES;

export const SCENES = ['nebula', 'galaxy', 'ocean', 'saturn', 'heart', 'pulse'] as const;
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
  fpsSampleSeconds: 3,
  fpsDowngradeBelow: 45,
};
