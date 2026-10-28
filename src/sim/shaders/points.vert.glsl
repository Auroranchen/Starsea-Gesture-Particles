uniform sampler2D uPositions;
uniform sampler2D uVelocities;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uShapeMode;
uniform float uBlackHoleVisual;
uniform float uTime;
uniform float uScene;
uniform float uPulseStrength;
uniform float uBeat;
uniform float uHaloFraction;

attribute vec2 ref;

varying float vSpeed;
varying float vSeed;
varying float vDist;
varying float vStar;
varying float vShape;
varying float vHole;
varying float vDepth;
varying float vTwinkle;
varying float vCrest;
varying vec3 vNormal;
varying float vLat;
varying float vFacing;
varying float vAge;
varying float vBurst;
varying float vHalo;

void main() {
  vec4 pos = texture2D(uPositions, ref);
  vec4 vel = texture2D(uVelocities, ref);

  vSpeed = length(vel.xyz);
  vSeed = fract(pos.w * 13.7);
  vDist = length(pos.xyz);
  vStar = step(0.985, fract(pos.w * 91.7));
  vShape = clamp(uShapeMode, 0.0, 1.0);
  vHole = clamp(uBlackHoleVisual, 0.0, 1.0);

  vec4 mv = modelViewMatrix * vec4(pos.xyz, 1.0);
  vDepth = clamp(1.0 - (-mv.z - 2.0) / 8.0, 0.0, 1.0);
  vTwinkle = 0.5 + 0.5 * sin(uTime * (1.1 + vSeed * 1.7) + pos.w * 91.3);
  vCrest = 0.0;
  vNormal = vec3(0.0);
  vLat = 0.0;
  vFacing = 0.0;
  if (uScene > 1.5 && uScene < 2.5) {
    vNormal = normalize(pos.xyz);
    vLat = abs(vNormal.y);
    vFacing = dot(normalize(normalMatrix * vNormal), normalize(-mv.xyz));
    float cloudBand = 0.5 + 0.5 * sin(vNormal.y * 11.0 + vSeed * 8.0 - uTime * 0.12);
    vCrest = smoothstep(0.68, 0.98, vLat) * 0.72 + cloudBand * 0.18;
  }
  float size = uPointSize * uPixelRatio * (0.7 + 0.6 * vSeed) * (4.0 / max(-mv.z, 0.1));

  // Heart (4) / pulse (5): own sizing, independent of the four original scenes.
  vAge = 0.0;
  vBurst = 0.0;
  vHalo = 0.0;
  if (uScene > 3.5) {
    float sizeMul = 1.0;
    if (uScene > 4.5) {
      float g = pulseGroup(pos.w);
      vAge = pulseAge(uTime, g);
      vBurst = hash11(g * 7.31 + pulseCycle(uTime, g) * 1.97);
      // Sparks start fat and shrink as they burn out.
      sizeMul = mix(1.7, 0.55, vAge);
    } else {
      vHalo = step(hash11(pos.w * 3.17), uHaloFraction);
      sizeMul = mix(1.0 + 0.35 * uBeat, 0.7, vHalo);
    }
    gl_PointSize = max(size * (1.0 + vStar * 1.4) * sizeMul, 1.0);
    gl_Position = projectionMatrix * mv;
    return;
  }

  bool legacyScene = uScene < 0.5 || (uScene > 1.5 && uScene < 2.5);
  if (legacyScene) {
    size *= 1.0 + vStar * 1.4;
    size *= 1.0 + vCrest * 0.45;
  } else {
    float speedBoost = smoothstep(0.25, 1.6, vSpeed);
    float pulseBoost = smoothstep(0.02, 1.0, uPulseStrength);
    float shapeBoost = mix(1.0, 1.18, vShape);
    float holeBoost = mix(1.0, 1.32, vHole);
    size *= shapeBoost * holeBoost;
    size *= 1.0 + speedBoost * 0.12 + pulseBoost * 0.10;
    size *= 1.0 + vStar * (1.4 + 0.8 * vShape);
  }

  gl_PointSize = max(size, 1.0);
  gl_Position = projectionMatrix * mv;
}
