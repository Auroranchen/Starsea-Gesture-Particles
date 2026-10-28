// Shared by velocity / position / points shaders so every pass agrees on
// each particle's firework burst cycle without any CPU bookkeeping.
uniform float uPulsePeriod;
uniform float uPulseGroups;
uniform float uPulseFocus;
// Galaxy fist: 0..1 fusion into the solid star. Ocean fist: 0..1 aurora.
uniform float uForge;
uniform float uForgeRadius;
uniform float uAurora;
uniform float uAuroraFraction;
uniform float uAuroraHeight;
uniform float uOceanRadius;

// 1 in 双手控制 (dials), 0 in 力场碰撞 (collider). Every dial-only visual
// effect multiplies by this, so the collider view stays pixel-identical.
uniform float uFx;

// 1 for the share of ocean particles that become aurora, else 0.
float auroraSel(float seed) { return step(fract(sin(seed * 5.71) * 43758.5453123), uAuroraFraction); }

float hash11(float n) { return fract(sin(n) * 43758.5453123); }

// Burst group a particle belongs to; groups fire staggered across one period.
float pulseGroup(float seed) { return floor(hash11(seed * 51.37) * uPulseGroups); }
float pulseCycle(float t, float g) { return floor(t / uPulsePeriod + g / uPulseGroups); }
float pulseAge(float t, float g) { return fract(t / uPulsePeriod + g / uPulseGroups); }

// Launch point of group g in a given cycle. Focus (the dial) pulls every
// burst into the core so the fireworks become one rhythmic ion pulse.
vec3 pulseOrigin(float g, float cycle) {
  float k = g * 17.13 + cycle * 3.71;
  vec3 o = vec3(
    (hash11(k) - 0.5) * 3.4,
    -0.1 + hash11(k + 1.31) * 1.1,
    (hash11(k + 2.97) - 0.5) * 1.6
  );
  return mix(o, vec3(0.0), uPulseFocus);
}
