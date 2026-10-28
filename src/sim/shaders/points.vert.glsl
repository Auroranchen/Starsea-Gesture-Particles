uniform sampler2D uPositions;
uniform sampler2D uVelocities;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uScene;
uniform float uTime;
uniform float uBeat;
uniform float uHaloFraction;

attribute vec2 ref;

varying float vSpeed;
varying float vSeed;
varying float vDist;
varying float vStar;
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
  vAge = 0.0;
  vBurst = 0.0;
  vHalo = 0.0;

  float sizeMul = 1.0;
  if (uScene > 3.5) {
    float g = pulseGroup(pos.w);
    vAge = pulseAge(uTime, g);
    vBurst = hash11(g * 7.31 + pulseCycle(uTime, g) * 1.97);
    // Sparks start fat and shrink as they burn out.
    sizeMul = mix(1.7, 0.55, vAge);
  } else if (uScene > 2.5) {
    vHalo = step(hash11(pos.w * 3.17), uHaloFraction);
    sizeMul = mix(1.0 + 0.35 * uBeat, 0.7, vHalo);
  }

  vec4 mv = modelViewMatrix * vec4(pos.xyz, 1.0);
  float size = uPointSize * uPixelRatio * (0.7 + 0.6 * vSeed) * (4.0 / max(-mv.z, 0.1));
  size *= (1.0 + vStar * 1.4) * sizeMul;
  gl_PointSize = max(size, 1.0);
  gl_Position = projectionMatrix * mv;
}
