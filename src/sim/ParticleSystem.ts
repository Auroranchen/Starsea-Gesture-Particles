import * as THREE from 'three';
import { GPUComputationRenderer, type Variable } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import velocityFrag from './shaders/velocity.frag.glsl?raw';
import positionFrag from './shaders/position.frag.glsl?raw';
import pointsVert from './shaders/points.vert.glsl?raw';
import pointsFrag from './shaders/points.frag.glsl?raw';
import { CONFIG, type SceneId } from '../config';

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

export class ParticleSystem {
  readonly points: THREE.Points;
  readonly count: number;

  private gpu: GPUComputationRenderer;
  private posVar: Variable;
  private velVar: Variable;
  private pointsMaterial: THREE.ShaderMaterial;
  private geometry: THREE.BufferGeometry;
  private time = 0;

  constructor(renderer: THREE.WebGLRenderer, size: number, scene: SceneId) {
    this.count = size * size;
    this.gpu = new GPUComputationRenderer(size, size, renderer);
    if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has('EXT_color_buffer_float')) {
      this.gpu.setDataType(THREE.HalfFloatType);
    }

    const posTex = this.gpu.createTexture();
    const velTex = this.gpu.createTexture();
    this.seedTextures(posTex, velTex, scene);

    this.velVar = this.gpu.addVariable('textureVelocity', velocityFrag, velTex);
    this.posVar = this.gpu.addVariable('texturePosition', positionFrag, posTex);
    this.gpu.setVariableDependencies(this.velVar, [this.velVar, this.posVar]);
    this.gpu.setVariableDependencies(this.posVar, [this.velVar, this.posVar]);

    Object.assign(this.velVar.material.uniforms, {
      uTime: { value: 0 },
      uDelta: { value: 0 },
      uScene: { value: 0 },
      uCenter: { value: new THREE.Vector3(0, 0, 0) },
      uTargetRadius: { value: CONFIG.cloudRadius },
      uNebulaAxis: { value: new THREE.Vector3(CONFIG.nebula.axisX, CONFIG.nebula.axisY, CONFIG.nebula.axisZ) },
      uFilamentStrength: { value: CONFIG.nebula.filamentStrength },
      uNebulaFlow: { value: CONFIG.nebula.flowStrength },
      uOceanFlow: { value: CONFIG.ocean.horizontalFlow },
      uOceanTurbulence: { value: CONFIG.ocean.verticalTurbulenceScale },
      uStiffness: { value: CONFIG.stiffnessCloud },
      uTurbulence: { value: CONFIG.turbulenceCloud },
      uDiscRadius: { value: CONFIG.galaxy.discRadius },
      uOrbitSpeed: { value: CONFIG.galaxy.orbitSpeed },
      uOrbitGain: { value: CONFIG.galaxy.orbitGain },
      uFlatten: { value: CONFIG.galaxy.flatten },
      uBulge: { value: CONFIG.galaxy.bulge },
      uArmTwist: { value: CONFIG.galaxy.armTwist },
      uArmStrength: { value: CONFIG.galaxy.armStrength },
      uInnerEdge: { value: 0.06 },
      uKepler: { value: 0 },
      uDiscEdgeSoft: { value: CONFIG.galaxy.discEdgeSoften },
      uWaveAmp: { value: CONFIG.ocean.waveAmpCalm },
      uWaveFreq: { value: CONFIG.ocean.waveFreqCalm },
      uContainRadius: { value: CONFIG.ocean.containRadius },
      uPlanetRadius: { value: CONFIG.saturn.planetRadius },
      uPlanetFlatten: { value: CONFIG.saturn.planetFlatten },
      uInnerRingRadius: { value: CONFIG.saturn.innerRingRadius },
      uOuterRingRadius: { value: CONFIG.saturn.outerRingRadius },
      uRingThickness: { value: CONFIG.saturn.ringThickness },
      uCassiniGapStart: { value: CONFIG.saturn.cassiniGapStart },
      uCassiniGapEnd: { value: CONFIG.saturn.cassiniGapEnd },
      uRingPlaneStrength: { value: CONFIG.saturn.ringPlaneStrength },
      uRingStiffness: { value: CONFIG.saturn.ringStiffness },
      uSaturnOrbitSpeed: { value: CONFIG.saturn.orbitSpeed },
      uSaturnOrbitGain: { value: CONFIG.saturn.orbitSpeedGain },
      uSaturnKepler: { value: CONFIG.saturn.keplerExponent },
      uCoreStiffness: { value: CONFIG.saturn.coreStiffness },
      uRingTurbulence: { value: CONFIG.saturn.ringTurbulence },
      uRingVerticalSpread: { value: CONFIG.saturn.ringVerticalSpread },
      uSaturnCollapse: { value: CONFIG.saturn.collapse },
      uSaturnTilt: { value: CONFIG.saturn.tilt },
      uBall: { value: new THREE.Vector3(0, 0, 0) },
      uBallPrev: { value: new THREE.Vector3(0, 0, 0) },
      uBallStrength: { value: 0 },
      uBallRadius: { value: CONFIG.ballRadius },
      uBallPush: { value: new THREE.Vector3() },
      uBall2: { value: new THREE.Vector3(0, 0, 0) },
      uBall2Prev: { value: new THREE.Vector3(0, 0, 0) },
      uBall2Strength: { value: 0 },
      uBall2Push: { value: new THREE.Vector3() },
      uBall2Active: { value: 0 },
      uExpansionCenter: { value: new THREE.Vector3() },
      uExpansionStrength: { value: 0 },
      uExpansionRadius: { value: 2.4 },
      uBlackHoleCenter: { value: new THREE.Vector3() },
      uBlackHoleStrength: { value: 0 },
      uBlackHoleRadius: { value: 0.6 },
      uGravityCenter: { value: new THREE.Vector3() },
      uGravityAxis: { value: new THREE.Vector3(1, 0, 0) },
      uGravityStrength: { value: 0 },
      uGravityRadius: { value: 2.6 },
      uPulseCenter: { value: new THREE.Vector3() },
      uPulseStrength: { value: 0 },
      uGalaxyScale: { value: 0.5 },
      uDamping: { value: CONFIG.damping },
      uMaxSpeed: { value: CONFIG.maxSpeed },
    });
    Object.assign(this.posVar.material.uniforms, {
      uDelta: { value: 0 },
    });

    const error = this.gpu.init();
    if (error !== null) {
      throw new Error(`GPUComputationRenderer failed: ${error}`);
    }

    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    const refs = new Float32Array(this.count * 2);
    for (let i = 0; i < this.count; i++) {
      refs[i * 2] = ((i % size) + 0.5) / size;
      refs[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size;
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('ref', new THREE.BufferAttribute(refs, 2));

    this.pointsMaterial = new THREE.ShaderMaterial({
      vertexShader: pointsVert,
      fragmentShader: pointsFrag,
      uniforms: {
        uPositions: { value: null },
        uVelocities: { value: null },
        uPointSize: { value: CONFIG.pointSize },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uColorA: { value: new THREE.Color(CONFIG.scenePalettes.nebula.calm[0]) },
        uColorB: { value: new THREE.Color(CONFIG.scenePalettes.nebula.calm[1]) },
        uColorC: { value: new THREE.Color(CONFIG.scenePalettes.nebula.calm[2]) },
        uEnergy: { value: 0 },
        uCoreGlow: { value: 0 },
        uCoreColor: { value: new THREE.Color(CONFIG.galaxy.coreColor) },
        uSpeedNorm: { value: 1 },
        uRadialColor: { value: 0 },
        uRadialRange: { value: 2.4 },
        uOceanWaveAmp: { value: CONFIG.ocean.waveAmpCalm },
        uOceanFoam: { value: CONFIG.ocean.foamThreshold },
        uShapeMode: { value: 0 },
        uBlackHoleVisual: { value: 0 },
        uTime: { value: 0 },
        uScene: { value: 0 },
        uPulseStrength: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.pointsMaterial);
    this.points.frustumCulled = false;
    const cc = CONFIG.cloudCenter;
    this.points.position.set(cc.x, cc.y, cc.z);
  }

  private seedTextures(posTex: THREE.DataTexture, velTex: THREE.DataTexture, scene: SceneId): void {
    const pos = posTex.image.data as unknown as Float32Array;
    const vel = velTex.image.data as unknown as Float32Array;
    for (let i = 0; i < pos.length; i += 4) {
      const seed = Math.random();
      if (scene === 'galaxy') {
        const u1 = Math.max((seed * 7.31) % 1, 0.001);
        const rawR = -Math.log(1 - 0.985 * u1) / 3.2;
        const edgeScatter = ((seed * 51.3) % 1) * smoothstep(0.7, 1, rawR);
        const rFrac = Math.min(
          Math.max(rawR - CONFIG.galaxy.discEdgeSoften * edgeScatter * 0.6, 0.006),
          1,
        );
        const r = CONFIG.galaxy.discRadius * rFrac;
        const centralPuff = CONFIG.galaxy.bulge * smoothstep(0.5, 0, rFrac / 0.25);
        const thick = 0.05 + 0.09 * rFrac + centralPuff;
        const a = Math.random() * Math.PI * 2;
        pos[i] = Math.cos(a) * r;
        pos[i + 1] = (Math.random() - 0.5) * thick * 2;
        pos[i + 2] = Math.sin(a) * r;
        const v = (CONFIG.galaxy.orbitSpeed * r) / (r + 0.5);
        vel[i] = Math.sin(a) * v;
        vel[i + 1] = 0;
        vel[i + 2] = -Math.cos(a) * v;
      } else if (scene === 'ocean') {
        // Earth: uniform sampling on a sphere shell (thin, like Saturn's planet core)
        const a = Math.random() * Math.PI * 2;
        const cosT = Math.random() * 2 - 1;
        const sinT = Math.sqrt(1 - cosT * cosT);
        const r = CONFIG.ocean.containRadius * (0.96 + Math.random() * 0.04);
        pos[i] = Math.cos(a) * sinT * r;
        pos[i + 1] = cosT * r;
        pos[i + 2] = Math.sin(a) * sinT * r;
        // slow eastward drift around Y so the globe self-rotates
        const spin = CONFIG.ocean.horizontalFlow * 0.9;
        vel[i] = Math.sin(a) * spin;
        vel[i + 1] = 0;
        vel[i + 2] = -Math.cos(a) * spin;
      } else if (scene === 'saturn') {
        const isRing = seed > CONFIG.saturn.particleRoleThreshold;
        const tilt = CONFIG.saturn.tilt;
        if (isRing) {
          const span = CONFIG.saturn.outerRingRadius - CONFIG.saturn.innerRingRadius;
          let r = CONFIG.saturn.innerRingRadius + Math.sqrt(Math.random()) * span;
          if (r > CONFIG.saturn.cassiniGapStart && r < CONFIG.saturn.cassiniGapEnd) {
            r = Math.random() < 0.5
              ? CONFIG.saturn.cassiniGapStart - Math.random() * 0.12
              : CONFIG.saturn.cassiniGapEnd + Math.random() * 0.12;
          }
          const a = Math.random() * Math.PI * 2;
          const y = (Math.random() - 0.5) * CONFIG.saturn.ringThickness;
          const localY = y;
          pos[i] = Math.cos(a) * r;
          pos[i + 1] = localY * Math.cos(tilt) - Math.sin(a) * r * Math.sin(tilt) * 0.035;
          pos[i + 2] = Math.sin(a) * r * Math.cos(tilt) + localY * Math.sin(tilt);
          const v = CONFIG.saturn.orbitSpeed * Math.pow(Math.max(r, 0.2), -CONFIG.saturn.keplerExponent);
          vel[i] = -Math.sin(a) * v;
          vel[i + 1] = 0;
          vel[i + 2] = Math.cos(a) * v;
        } else {
          const a = Math.random() * Math.PI * 2;
          const cosT = Math.random() * 2 - 1;
          const sinT = Math.sqrt(1 - cosT * cosT);
          const r = CONFIG.saturn.planetRadius * (0.78 + Math.random() * 0.22);
          const localX = Math.cos(a) * sinT * r;
          const localY = cosT * r * CONFIG.saturn.planetFlatten;
          const localZ = Math.sin(a) * sinT * r;
          pos[i] = localX;
          pos[i + 1] = localY * Math.cos(tilt) - localZ * Math.sin(tilt);
          pos[i + 2] = localZ * Math.cos(tilt) + localY * Math.sin(tilt);
          vel[i] = (Math.random() - 0.5) * 0.04;
          vel[i + 1] = (Math.random() - 0.5) * 0.04;
          vel[i + 2] = (Math.random() - 0.5) * 0.04;
        }
      } else {
        const a = Math.random() * Math.PI * 2;
        const cosT = Math.random() * 2 - 1;
        const sinT = Math.sqrt(1 - cosT * cosT);
        const r = Math.cbrt(Math.random()) * CONFIG.cloudRadius;
        pos[i] = Math.cos(a) * sinT * r;
        pos[i + 1] = cosT * r;
        pos[i + 2] = Math.sin(a) * sinT * r;
        vel[i] = (Math.random() - 0.5) * 0.05;
        vel[i + 1] = (Math.random() - 0.5) * 0.05;
        vel[i + 2] = (Math.random() - 0.5) * 0.05;
      }
      pos[i + 3] = seed;
      vel[i + 3] = Math.random();
    }
  }

  reseed(scene: SceneId): void {
    const posTex = this.gpu.createTexture();
    const velTex = this.gpu.createTexture();
    this.seedTextures(posTex, velTex, scene);
    const write = (variable: Variable, tex: THREE.DataTexture) => {
      const targets = (variable as unknown as {
        renderTargets: THREE.WebGLRenderTarget[];
      }).renderTargets;
      for (const rt of targets) {
        this.gpu.renderTexture(tex, rt);
      }
    };
    write(this.posVar, posTex);
    write(this.velVar, velTex);
    posTex.dispose();
    velTex.dispose();
  }

  get velocityUniforms(): Record<string, THREE.IUniform> {
    return this.velVar.material.uniforms;
  }

  get colorUniforms(): Record<string, THREE.IUniform> {
    return this.pointsMaterial.uniforms;
  }

  setPointSize(value: number): void {
    this.pointsMaterial.uniforms.uPointSize.value = THREE.MathUtils.clamp(value, 0.5, 5);
  }

  updateRuntimeParams(): void {
    this.velVar.material.uniforms.uDamping.value = CONFIG.damping;
    this.velVar.material.uniforms.uMaxSpeed.value = CONFIG.maxSpeed;
    this.velVar.material.uniforms.uBallRadius.value = CONFIG.ballRadius;
    this.pointsMaterial.uniforms.uPointSize.value = CONFIG.pointSize;
  }

  update(delta: number): void {
    const dt = Math.min(delta, CONFIG.maxDelta);
    this.time += dt;

    this.velVar.material.uniforms.uTime.value = this.time;
    this.pointsMaterial.uniforms.uTime.value = this.time;
    this.velVar.material.uniforms.uDelta.value = dt;
    this.posVar.material.uniforms.uDelta.value = dt;

    this.gpu.compute();
    this.pointsMaterial.uniforms.uPositions.value =
      this.gpu.getCurrentRenderTarget(this.posVar).texture;
    this.pointsMaterial.uniforms.uVelocities.value =
      this.gpu.getCurrentRenderTarget(this.velVar).texture;
  }

  onResize(): void {
    this.pointsMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  }

  dispose(): void {
    this.gpu.dispose();
    this.geometry.dispose();
    this.pointsMaterial.dispose();
  }
}
