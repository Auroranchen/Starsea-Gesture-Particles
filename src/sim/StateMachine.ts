import * as THREE from 'three';
import { CONFIG, type SceneId } from '../config';
import type { ColliderState, GestureFrame } from '../input/InputManager';

const SCENE_INDEX: Record<SceneId, number> = {
  nebula: 0, galaxy: 1, ocean: 2, saturn: 3, heart: 4, pulse: 5,
};
const lerp = THREE.MathUtils.lerp;

export type StateEvent =
  | 'burst'
  | 'collapse-start'
  | 'gravity-start';

export class StateMachine {
  scene: SceneId = CONFIG.defaultScene;
  energy = 0;
  dial = 0;
  /** Heart scene: 0..1 pulse envelope, also read by main for bloom kicks. */
  beat = 0;
  private beatPhase = 0;

  private colorA = new THREE.Color();
  private colorB = new THREE.Color();
  private colorC = new THREE.Color();
  private target = new THREE.Color();
  private tmp = new THREE.Color();
  private coreGlow = 0;
  private fist = 0;
  private pulse = 0;
  private ballInit = false;
  private ball2Init = false;
  private vel = new THREE.Vector3();
  private previousBurst = 0;
  private previousCollapse = 0;
  private previousGravity = 0;
  private events: StateEvent[] = [];

  constructor() {
    const calm = CONFIG.scenePalettes[this.scene].calm;
    this.colorA.set(calm[0]);
    this.colorB.set(calm[1]);
    this.colorC.set(calm[2]);
  }

  setScene(scene: SceneId): void {
    this.scene = scene;
    this.fist = 0;
    this.previousCollapse = 0;
    this.previousGravity = 0;
  }

  consumeEvents(): StateEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  get label(): string {
    const [calm, intense] = CONFIG.sceneDialNames[this.scene];
    return this.dial > 0.5 ? intense : calm;
  }

  get accent(): string {
    const [calm, intense] = CONFIG.sceneAccents[this.scene];
    return this.dial > 0.5 ? intense : calm;
  }

  update(
    dt: number,
    frame: GestureFrame,
    colliders: ColliderState[],
    velUniforms: Record<string, THREE.IUniform>,
    colorUniforms: Record<string, THREE.IUniform>,
  ): void {
    const gk = Math.min(dt * CONFIG.gatherSmoothing, 1);
    const handInput = !!frame.left || !!frame.right;
    const fistTarget = THREE.MathUtils.clamp(frame.bothFists / 0.72, 0, 1);
    const fistRate = fistTarget > this.fist ? 10 : 3;
    this.fist += (fistTarget - this.fist) * Math.min(dt * fistRate, 1);
    if (Math.abs(this.fist - fistTarget) < 0.001) this.fist = fistTarget;
    const expansion = frame.expansion;
    const blackHole = frame.blackHole;
    const targetGather = this.scene === 'nebula' || this.scene === 'ocean'
      ? Math.max(handInput ? 0 : frame.gather, fistTarget)
      : frame.gather;
    const targetDial = Math.max(targetGather, this.scene === 'galaxy' ? blackHole : 0);
    this.dial += (targetDial - this.dial) * gk;
    const d = this.dial;

    velUniforms.uScene.value = SCENE_INDEX[this.scene];
    if (this.scene !== 'heart') this.beat = 0;

    const ek = Math.min(dt * CONFIG.energySmoothing, 1);
    this.energy += (Math.min(frame.speed * 1.6, 1) - this.energy) * ek;
    const gravityStrength = frame.gravityStrength;
    const expansionCenter = frame.left?.position ?? frame.right?.position ?? new THREE.Vector3();
    (velUniforms.uExpansionCenter.value as THREE.Vector3).lerp(expansionCenter, Math.min(dt * 8, 1));
    const fieldIsolation = (this.scene === 'nebula' || this.scene === 'ocean')
      ? 1 - this.fist
      : 1;
    velUniforms.uExpansionStrength.value = expansion * (1.5 + this.energy * 1.2) * fieldIsolation;
    velUniforms.uExpansionRadius.value = lerp(1.4, 3.6, expansion);
    const blackHoleCenter = frame.right?.position ?? frame.left?.position ?? new THREE.Vector3();
    (velUniforms.uBlackHoleCenter.value as THREE.Vector3).lerp(blackHoleCenter, Math.min(dt * 8, 1));
    velUniforms.uBlackHoleStrength.value = (this.scene === 'galaxy' ? blackHole : 0) * (2.2 + this.energy * 2.8);
    velUniforms.uBlackHoleRadius.value = lerp(0.28, 0.85, blackHole);
    (velUniforms.uGravityCenter.value as THREE.Vector3).lerp(frame.gravityCenter, Math.min(dt * 7, 1));
    (velUniforms.uGravityAxis.value as THREE.Vector3).lerp(frame.gravityAxis, Math.min(dt * 7, 1)).normalize();
    velUniforms.uGravityStrength.value = gravityStrength * 2.4 * fieldIsolation;
    velUniforms.uGalaxyScale.value = frame.galaxyScale;
    (velUniforms.uPulseCenter.value as THREE.Vector3).lerp(frame.gravityCenter, Math.min(dt * 10, 1));
    this.pulse = Math.max(frame.burst, this.pulse * Math.exp(-dt * 8));
    velUniforms.uPulseStrength.value = this.pulse * 3.5;
    this.emitThreshold('burst', frame.burst, this.previousBurst, 0.72);
    this.previousBurst = frame.burst;
    const collapse = this.scene === 'galaxy' ? d : 0;
    this.emitThreshold('collapse-start', collapse, this.previousCollapse, 0.62);
    this.previousCollapse = collapse;
    this.emitThreshold('gravity-start', gravityStrength, this.previousGravity, 0.72);
    this.previousGravity = gravityStrength;
    let coreGlowTarget = 0;
    let speedNorm = 1;
    let radialColor = 0;
    let oceanWaveAmp = 0;
    let oceanFoam = 0;

    switch (this.scene) {
      case 'nebula': {
        velUniforms.uTargetRadius.value = lerp(
          lerp(CONFIG.cloudRadius, CONFIG.ballRadiusTight, d),
          CONFIG.nebula.planetRadius,
          this.fist,
        );
        (velUniforms.uNebulaAxis.value as THREE.Vector3).set(
          lerp(lerp(CONFIG.nebula.axisX, 1, d), 1, this.fist),
          lerp(lerp(CONFIG.nebula.axisY, 1, d), 1, this.fist),
          lerp(lerp(CONFIG.nebula.axisZ, 1, d), 1, this.fist),
        );
        velUniforms.uFilamentStrength.value = CONFIG.nebula.filamentStrength * (1 - d) * (1 - this.fist);
        velUniforms.uNebulaFlow.value = (CONFIG.nebula.flowStrength * (1 - d) + this.energy * 0.06) * (1 - this.fist);
        velUniforms.uStiffness.value = lerp(CONFIG.stiffnessCloud, CONFIG.stiffnessBall, Math.max(d, this.fist));
        velUniforms.uTurbulence.value = lerp(
          lerp(CONFIG.turbulenceCloud, CONFIG.turbulenceBall, d) + 0.25 * this.energy,
          0.1,
          this.fist,
        );
        coreGlowTarget = this.fist * 0.8;
        break;
      }
      case 'galaxy': {
        const g = CONFIG.galaxy;
        velUniforms.uDiscRadius.value = lerp(g.discRadius, g.discRadiusCollapsed, d);
        velUniforms.uOrbitSpeed.value = lerp(g.orbitSpeed, g.orbitSpeedCollapsed, d);
        velUniforms.uStiffness.value = lerp(g.stiffness, g.stiffnessCollapsed, d);
        velUniforms.uFlatten.value = lerp(g.flatten, g.flattenCollapsed, d);
        velUniforms.uArmStrength.value = lerp(g.armStrength, g.armStrengthCollapsed, d);
        velUniforms.uTurbulence.value =
          lerp(g.turbulence, g.turbulenceCollapsed, d) + 0.15 * this.energy;
        velUniforms.uInnerEdge.value = lerp(0.004, g.holeRadius * 0.98, d);
        velUniforms.uKepler.value = d;
        velUniforms.uArmTwist.value = g.armTwist;
        velUniforms.uOrbitGain.value = g.orbitGain;
        velUniforms.uBulge.value = g.bulge;
        velUniforms.uDiscEdgeSoft.value = g.discEdgeSoften;
        speedNorm = lerp(1, 0.38, d);
        radialColor = 1 - d;
        coreGlowTarget = lerp(g.coreGlow, g.coreGlowCollapsed, d);
        break;
      }
      case 'ocean': {
        const o = CONFIG.ocean;
        const storm = Math.max(d, this.fist);
        const waveAmp = lerp(o.waveAmpCalm, o.waveAmpStorm, storm)
          * (1 + 0.3 * this.energy)
          * (1 + o.fistStormBoost * this.fist);
        velUniforms.uWaveAmp.value = waveAmp;
        velUniforms.uWaveFreq.value = lerp(o.waveFreqCalm, o.waveFreqStorm, storm);
        velUniforms.uStiffness.value = o.stiffness;
        velUniforms.uTurbulence.value =
          lerp(o.turbulenceCalm, o.turbulenceStorm, storm) + 0.3 * this.energy;
        velUniforms.uOceanFlow.value = o.horizontalFlow * (0.55 + 0.45 * storm);
        velUniforms.uOceanTurbulence.value = o.verticalTurbulenceScale;
        oceanWaveAmp = waveAmp;
        oceanFoam = o.foamThreshold;
        break;
      }
      case 'saturn': {
        const s = CONFIG.saturn;
        velUniforms.uPlanetRadius.value = s.planetRadius;
        velUniforms.uPlanetFlatten.value = s.planetFlatten;
        velUniforms.uInnerRingRadius.value = lerp(s.innerRingRadius, s.innerRingRadius * 0.92, d);
        velUniforms.uOuterRingRadius.value = lerp(s.outerRingRadius, s.outerRingRadius * 0.78, d);
        velUniforms.uRingThickness.value = lerp(s.ringThickness, s.ringThickness * 1.7, d);
        velUniforms.uCassiniGapStart.value = s.cassiniGapStart;
        velUniforms.uCassiniGapEnd.value = s.cassiniGapEnd;
        velUniforms.uRingPlaneStrength.value = lerp(s.ringPlaneStrength, s.ringPlaneStrength * 0.7, d);
        velUniforms.uRingStiffness.value = lerp(s.ringStiffness, s.ringStiffness * 1.45, d);
        velUniforms.uSaturnOrbitSpeed.value = lerp(s.orbitSpeed, s.orbitSpeed * 1.45, d);
        velUniforms.uSaturnOrbitGain.value = lerp(s.orbitSpeedGain, s.orbitSpeedGainIntense, d);
        velUniforms.uSaturnKepler.value = s.keplerExponent;
        velUniforms.uCoreStiffness.value = lerp(s.coreStiffness, s.coreStiffness * 0.76, d);
        velUniforms.uRingTurbulence.value = lerp(s.ringTurbulence, s.ringTurbulence * 3.2, d) + this.energy * 0.12;
        velUniforms.uRingVerticalSpread.value = lerp(s.ringVerticalSpread, s.ringVerticalSpread * 2.3, d);
        velUniforms.uSaturnCollapse.value = lerp(s.collapse, 0.9, d);
        velUniforms.uSaturnTilt.value = s.tilt;
        velUniforms.uTurbulence.value = velUniforms.uRingTurbulence.value;
        speedNorm = lerp(1.1, 0.72, d);
        radialColor = 0.25 + d * 0.35;
        this.coreGlow = 0;
        break;
      }
      case 'heart': {
        const h = CONFIG.heart;
        // Integrate phase so a changing BPM never makes the beat jump.
        this.beatPhase = (this.beatPhase + dt * (lerp(h.bpmCalm, h.bpmIntense, d) / 60)) % 1;
        const ph = this.beatPhase;
        // "lub-dub": a strong contraction followed by a softer echo.
        const lub = Math.exp(-(((ph - 0.04) * 16) ** 2));
        const dub = 0.55 * Math.exp(-(((ph - 0.3) * 18) ** 2));
        this.beat = Math.max(lub, dub);
        velUniforms.uBeat.value = this.beat;
        velUniforms.uBeatPhase.value = ph;
        velUniforms.uHeartScale.value = h.scale;
        velUniforms.uHeartContract.value = lerp(1, h.contract, d);
        velUniforms.uBeatAmp.value = lerp(h.beatAmp, h.beatAmpIntense, d) * (1 + 0.5 * this.energy);
        velUniforms.uWaveForce.value = lerp(h.waveForce, h.waveForceIntense, d);
        velUniforms.uWaveSpeed.value = h.waveSpeed;
        velUniforms.uHaloFraction.value = h.haloFraction;
        velUniforms.uHaloRadius.value = lerp(2.05, 1.3, d);
        velUniforms.uHaloSpin.value = h.haloSpin * (1 + d * 1.5);
        velUniforms.uStiffness.value = lerp(h.stiffness, h.stiffnessIntense, d);
        velUniforms.uTurbulence.value =
          lerp(h.turbulence, h.turbulenceIntense, d) + 0.25 * this.energy;
        break;
      }
      case 'pulse': {
        const p = CONFIG.pulse;
        velUniforms.uPulsePeriod.value = p.period;
        velUniforms.uPulseGroups.value = p.groups;
        velUniforms.uPulseFocus.value = d;
        velUniforms.uBurstSpeed.value =
          lerp(p.burstSpeed, p.burstSpeedIon, d) * (1 + 0.35 * this.energy);
        velUniforms.uGravity.value = p.gravity;
        velUniforms.uRecall.value = p.recall;
        velUniforms.uTurbulence.value =
          lerp(p.turbulence, p.turbulenceIon, d) + 0.3 * this.energy;
        colorUniforms.uRainbow.value = 1 - d;
        break;
      }
    }

    this.driveCollider(dt, colliders[0], velUniforms, 'uBall', 'uBallPrev', 'uBallStrength', 'uBallPush', 'ballInit');
    this.driveCollider(dt, colliders[1], velUniforms, 'uBall2', 'uBall2Prev', 'uBall2Strength', 'uBall2Push', 'ball2Init');
    if (fieldIsolation < 1) {
      velUniforms.uBallStrength.value *= fieldIsolation;
      velUniforms.uBall2Strength.value *= fieldIsolation;
      (velUniforms.uBallPush.value as THREE.Vector3).multiplyScalar(fieldIsolation);
      (velUniforms.uBall2Push.value as THREE.Vector3).multiplyScalar(fieldIsolation);
    }
    velUniforms.uBall2Active.value = colliders[1] ? 1 : 0;

    const pal = CONFIG.scenePalettes[this.scene];
    const ck = Math.min(dt * CONFIG.colorSmoothing, 1);
    this.rampStop(this.colorA, pal.calm[0], pal.intense[0], d, ck);
    this.rampStop(this.colorB, pal.calm[1], pal.intense[1], d, ck);
    this.rampStop(this.colorC, pal.calm[2], pal.intense[2], d, ck);
    this.coreGlow += (coreGlowTarget - this.coreGlow) * ck;

    (colorUniforms.uColorA.value as THREE.Color).copy(this.colorA);
    (colorUniforms.uColorB.value as THREE.Color).copy(this.colorB);
    (colorUniforms.uColorC.value as THREE.Color).copy(this.colorC);
    colorUniforms.uEnergy.value = this.energy;
    colorUniforms.uCoreGlow.value = this.coreGlow;
    colorUniforms.uSpeedNorm.value = speedNorm;
    colorUniforms.uRadialColor.value = radialColor;
    colorUniforms.uOceanWaveAmp.value = oceanWaveAmp;
    colorUniforms.uOceanFoam.value = oceanFoam;
    colorUniforms.uScene.value = SCENE_INDEX[this.scene];
    colorUniforms.uPulseStrength.value = this.pulse;
    colorUniforms.uShapeMode.value = THREE.MathUtils.clamp(
      this.scene === 'galaxy' ? 0.72 + d * 0.28 : 0.18 + this.energy * 0.72,
      0,
      1,
    );
    colorUniforms.uBlackHoleVisual.value = this.scene === 'galaxy'
      ? THREE.MathUtils.clamp(Math.max(d, blackHole), 0, 1)
      : 0;
  }

  private emitThreshold(
    event: StateEvent,
    value: number,
    previous: number,
    threshold: number,
  ): void {
    if (value >= threshold && previous < threshold) this.events.push(event);
  }

  private rampStop(current: THREE.Color, calm: string, intense: string, d: number, k: number): void {
    this.target.set(calm).lerp(this.tmp.set(intense), d);
    current.lerp(this.target, k);
  }

  private driveCollider(
    dt: number,
    collider: ColliderState | undefined,
    vel: Record<string, THREE.IUniform>,
    posKey: string,
    prevKey: string,
    strengthKey: string,
    pushKey: string,
    initKey: 'ballInit' | 'ball2Init',
  ): void {
    const pos = vel[posKey].value as THREE.Vector3;
    const prev = vel[prevKey].value as THREE.Vector3;
    const push = vel[pushKey].value as THREE.Vector3;

    if (!collider) {
      vel[strengthKey].value = 0;
      push.set(0, 0, 0);
      prev.copy(pos);
      this[initKey] = false;
      return;
    }

    if (!this[initKey]) {
      pos.copy(collider.position);
      prev.copy(collider.position);
      this[initKey] = true;
    } else {
      prev.copy(pos);
      pos.lerp(collider.position, Math.min(dt * 18, 1));
    }

    vel[strengthKey].value =
      (CONFIG.palmRepelBase + CONFIG.palmRepelSpeedBoost * this.energy) * collider.opacity;

    this.vel.copy(pos).sub(prev).divideScalar(Math.max(dt, 1e-3));
    push.copy(this.vel).clampLength(0, 6).multiplyScalar(CONFIG.collisionPush * collider.opacity);
  }
}
