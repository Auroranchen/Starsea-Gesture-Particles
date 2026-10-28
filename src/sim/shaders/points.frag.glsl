uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uEnergy;
uniform float uCoreGlow;
uniform vec3  uCoreColor;
uniform float uSpeedNorm;
uniform float uRadialColor;
uniform float uRadialRange;
uniform float uScene;
uniform float uTime;
uniform float uBeat;
uniform float uRainbow;

varying float vSpeed;
varying float vSeed;
varying float vDist;
varying float vStar;
varying float vAge;
varying float vBurst;
varying float vHalo;

vec3 ramp(float t) {
  return t < 0.5
    ? mix(uColorA, uColorB, t * 2.0)
    : mix(uColorB, uColorC, (t - 0.5) * 2.0);
}

vec3 hue2rgb(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float alpha = 1.0 - smoothstep(0.05, 0.5, d);

  vec3 col;
  float gain = 1.0;
  if (uScene > 3.5) {
    // Each burst picks one colour; calm mode mixes in a full-spectrum hue.
    vec3 burst = ramp(0.45 + 0.55 * vBurst);
    col = mix(burst, hue2rgb(vBurst + vSeed * 0.08), uRainbow);
    col = mix(col, vec3(1.0), smoothstep(0.1, 0.0, vAge) * 0.85);
    float twinkle = 0.55 + 0.45 * step(0.45, hash11(vSeed * 71.3 + floor(uTime * 18.0)));
    float life = pow(1.0 - vAge, 1.6) * mix(1.0, twinkle, smoothstep(0.35, 0.7, vAge));
    // Ion mode stacks every burst at the core, so damp the launch flash
    // and the near-core glow there to keep the ring structure visible.
    float flash = 2.2 * smoothstep(0.06, 0.0, vAge) * (1.0 - 0.8 * (1.0 - uRainbow));
    float coreDim = mix(1.0, smoothstep(0.0, 0.9, vDist) * 0.75 + 0.25, 1.0 - uRainbow);
    gain = life * (1.0 + flash) * coreDim * (1.0 + uEnergy * 0.6);
  } else if (uScene > 2.5) {
    float t = clamp(0.32 + vSpeed * 0.5 * (1.0 + uEnergy) + uBeat * 0.4, 0.0, 1.0);
    col = mix(ramp(t), uColorC * 0.55, vHalo);
    // Heart body dims slightly toward its dense center so it reads as a shell.
    float shell = 0.7 + 0.3 * smoothstep(0.3, 1.1, vDist);
    gain = mix((1.0 + 0.7 * uBeat) * shell, 0.75 + 0.25 * vSeed, vHalo);
  } else {
    float tSpeed = clamp(vSpeed * uSpeedNorm * (0.9 + uEnergy * 0.8), 0.0, 1.0);
    float tRadial = 1.0 - clamp(vDist / uRadialRange, 0.0, 1.0);
    float t = mix(tSpeed, tRadial * tRadial, uRadialColor);
    col = ramp(t);
    col = mix(col, vec3(1.0), smoothstep(0.85, 1.35, vSpeed * uSpeedNorm * (1.0 + uEnergy)));
    col = mix(col, uCoreColor, uCoreGlow * (1.0 - smoothstep(0.0, 1.1, vDist)));
  }

  col *= (1.0 + vStar * 1.1) * gain;

  gl_FragColor = vec4(col, alpha * 0.5);
}
