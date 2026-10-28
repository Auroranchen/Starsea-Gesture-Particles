uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uEnergy;
uniform float uCoreGlow;
uniform vec3  uCoreColor;
uniform float uSpeedNorm;
uniform float uRadialColor;
uniform float uRadialRange;
uniform float uShapeMode;
uniform float uBlackHoleVisual;
uniform float uTime;
uniform float uScene;
uniform float uPulseStrength;
uniform float uOceanWaveAmp;
uniform float uOceanFoam;

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
varying float vAurora;
varying float vGlint;

uniform float uRainbow;
uniform float uBeat;
uniform float uDensityNorm;

vec3 ramp(float t) {
  return t < 0.5
    ? mix(uColorA, uColorB, t * 2.0)
    : mix(uColorB, uColorC, (t - 0.5) * 2.0);
}

vec3 hue2rgb(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

float earthNoise(vec3 p) {
  vec3 cell = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  float n100 = fract(sin(dot(cell + vec3(1.0, 0.0, 0.0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
  float n010 = fract(sin(dot(cell + vec3(0.0, 1.0, 0.0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
  float n110 = fract(sin(dot(cell + vec3(1.0, 1.0, 0.0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
  float n001 = fract(sin(dot(cell + vec3(0.0, 0.0, 1.0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
  float n101 = fract(sin(dot(cell + vec3(1.0, 0.0, 1.0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
  float n011 = fract(sin(dot(cell + vec3(0.0, 1.0, 1.0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
  float n111 = fract(sin(dot(cell + vec3(1.0, 1.0, 1.0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z) * 2.0 - 1.0;
}

float earthLand(vec2 p, vec2 center, vec2 scale) {
  vec2 delta = vec2(mod(p.x - center.x + 180.0, 360.0) - 180.0, p.y - center.y);
  return 1.0 - smoothstep(0.84, 1.04, length(delta / scale));
}

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;

  float circle = 1.0 - smoothstep(0.05, 0.5, d);

  // Heart (4) / pulse (5) shading, kept separate from the original scenes.
  if (uScene > 3.5) {
    vec3 hc;
    float gain;
    if (uScene > 4.5) {
      // Each burst picks one colour; calm mode mixes in a full-spectrum hue.
      vec3 burst = ramp(0.45 + 0.55 * vBurst);
      hc = mix(burst, hue2rgb(vBurst + vSeed * 0.08), uRainbow);
      hc = mix(hc, vec3(1.0), smoothstep(0.1, 0.0, vAge) * 0.85);
      float sparkle = 0.55 + 0.45 * step(0.45, hash11(vSeed * 71.3 + floor(uTime * 18.0)));
      float life = pow(1.0 - vAge, 1.6) * mix(1.0, sparkle, smoothstep(0.35, 0.7, vAge));
      // Ion mode stacks every burst at the core, so damp the launch flash
      // and the near-core glow there to keep the ring structure visible.
      float flash = 2.2 * smoothstep(0.06, 0.0, vAge) * (1.0 - 0.8 * (1.0 - uRainbow));
      float coreDim = mix(1.0, smoothstep(0.0, 0.9, vDist) * 0.75 + 0.25, 1.0 - uRainbow);
      gain = life * (1.0 + flash) * coreDim * (1.0 + uEnergy * 0.6);
    } else {
      // Heart: deep crimson core → bright carmine surface → hot-pink rim on beat.
      // shell = 0 at center, 1 at the outer surface of the heart.
      float shell = smoothstep(0.0, 1.45, vDist);
      float rim   = smoothstep(0.55, 1.15, shell);
      float beat  = uBeat;

      // Color: cool dark red core → vivid red mid → bright pink at rim.
      // ramp maps A(dark bg) → B(vivid red) → C(bright pink) — palette in config.
      float tBase = clamp(0.18 + shell * 0.62 + beat * 0.22 + vSpeed * 0.12, 0.0, 1.0);
      hc = ramp(tBase);

      // Rim highlight: hot pink/white glow along the heart silhouette.
      hc = mix(hc, uColorC * 1.15, rim * (0.45 + 0.55 * beat));

      // Beat flash: whole heart surges toward bright carmine at peak lub.
      float beatFlash = beat * beat;
      hc = mix(hc, mix(uColorB * 1.4, vec3(1.0, 0.38, 0.48), 0.55), beatFlash * 0.5);

      // Dark hollow core: center stays dim between beats for depth.
      float coreDark = (1.0 - shell) * (1.0 - shell) * (1.0 - beat * 0.65);
      hc *= 1.0 - coreDark * 0.55;

      // Halo (dark-matter rings): cool violet-purple, always subtle.
      vec3 haloCol = mix(uColorC * 0.38, vec3(0.22, 0.04, 0.55), 0.45);
      hc = mix(hc, haloCol, vHalo * 0.88);

      gain = mix(
        (0.82 + 1.05 * beat + 0.35 * rim) * (0.55 + 0.45 * shell),
        0.52 + 0.28 * vSeed,
        vHalo
      );
    }
    hc *= (1.0 + vStar * 1.1) * gain;
    gl_FragColor = vec4(hc, circle * 0.5);
    return;
  }
  float crossX = exp(-abs(c.x) * 18.0) * (1.0 - smoothstep(0.0, 0.52, abs(c.y)));
  float crossY = exp(-abs(c.y) * 18.0) * (1.0 - smoothstep(0.0, 0.52, abs(c.x)));
  float cross = max(crossX, crossY);
  float ring = 1.0 - smoothstep(0.03, 0.12, abs(d - 0.34));
  float ringMode = smoothstep(0.62, 1.0, vShape);
  float flashMode = smoothstep(0.25, 0.72, vShape);
  float alpha = mix(circle, max(circle * 0.35, cross), flashMode);
  alpha = mix(alpha, max(alpha * 0.45, ring), ringMode);
  alpha *= 1.0 - 0.35 * vHole * smoothstep(0.18, 0.48, d);

  float tSpeed = clamp(vSpeed * uSpeedNorm * (0.9 + uEnergy * 0.8), 0.0, 1.0);
  float tRadial = 1.0 - clamp(vDist / uRadialRange, 0.0, 1.0);
  float t = mix(tSpeed, tRadial * tRadial, uRadialColor);
  float sceneBand = uScene > 2.5
    ? sin(vDist * 3.6 + vSeed * 11.0)
    : sin(vDist * (uScene < 0.5 ? 4.2 : 2.7) + vSeed * 14.0);
  float density = 0.88 + 0.12 * smoothstep(-0.35, 0.8, sceneBand);
  float twinkle = mix(0.92, 1.08, vTwinkle) * (0.94 + 0.06 * vSeed);
  float depthLight = 0.82 + 0.18 * vDepth;
  vec3 col = t < 0.5
    ? mix(uColorA, uColorB, t * 2.0)
    : mix(uColorB, uColorC, (t - 0.5) * 2.0);

  if (uScene < 0.5) {
    float filament = 0.5 + 0.5 * sceneBand;
    float cloudDepth = 1.0 - smoothstep(0.25, 2.8, vDist);
    float wisps = smoothstep(0.22, 0.92, filament) * (0.55 + 0.45 * vSeed);

    // Dual-tone filaments: warm amber strands vs cool ice-blue wisps.
    // High-filament threads glow amber-violet; sparse regions are cold blue.
    vec3 warmStrand = mix(vec3(0.68, 0.22, 1.0), vec3(1.0, 0.55, 0.18), wisps * wisps);
    vec3 coolVoid   = mix(vec3(0.04, 0.22, 0.72), vec3(0.12, 0.55, 0.95), cloudDepth);
    col = mix(col, warmStrand, wisps * 0.46);
    col = mix(col, coolVoid,  (1.0 - wisps) * cloudDepth * 0.22);

    // Dense inner shell: slight teal tint for depth illusion.
    col = mix(col, vec3(0.08, 0.38, 0.88), cloudDepth * (1.0 - wisps) * 0.14);

    // Star sparkles: warm white-gold flares on top of filaments.
    col += vec3(1.0, 0.88, 0.62) * smoothstep(0.86, 1.0, vTwinkle) * vStar * 0.52;
    // Faint blue micro-sparkles in void regions.
    col += vec3(0.42, 0.78, 1.0) * smoothstep(0.90, 1.0, vTwinkle) * vStar * (1.0 - wisps) * 0.28;
  } else if (uScene > 1.5 && uScene < 2.5) {
    float longitude = atan(vNormal.z, vNormal.x) * 57.2958;
    float latitude = asin(clamp(vNormal.y, -1.0, 1.0)) * 57.2958;
    vec2 mapPoint = vec2(longitude, latitude);
    float land = max(
      max(earthLand(mapPoint, vec2(-105.0, 42.0), vec2(42.0, 29.0)),
          earthLand(mapPoint, vec2(-62.0, -15.0), vec2(20.0, 43.0))),
      max(earthLand(mapPoint, vec2(18.0, 5.0), vec2(27.0, 39.0)),
          earthLand(mapPoint, vec2(78.0, 45.0), vec2(68.0, 27.0))));
    land = max(land, earthLand(mapPoint, vec2(135.0, -25.0), vec2(18.0, 11.0)));
    float detail = earthNoise(vNormal * 13.0 + vec3(3.1, 0.0, 4.7));
    float coast = smoothstep(0.30, 0.68, land + detail * 0.16);
    float oceanDepth = 0.5 + 0.5 * earthNoise(vNormal * 5.0);
    vec3 ocean = mix(vec3(0.008, 0.055, 0.19), vec3(0.025, 0.28, 0.53), oceanDepth * 0.72);
    vec3 terrain = mix(vec3(0.32, 0.24, 0.12), vec3(0.16, 0.48, 0.25), smoothstep(-0.2, 0.42, detail));
    terrain = mix(terrain, vec3(0.64, 0.56, 0.38), smoothstep(0.42, 0.78, detail) * 0.55);
    col = mix(ocean, terrain, coast);

    float polar = smoothstep(0.82, 0.96, vLat);
    col = mix(col, vec3(0.78, 0.91, 1.0), polar * 0.9);
    float cloudNoise = earthNoise(vNormal * 8.5 + vec3(0.0, uTime * 0.012, 2.0));
    float cloudBands = 0.5 + 0.5 * sin(latitude * 0.34 + cloudNoise * 2.8 + longitude * 0.045 + uTime * 0.035);
    float cloudMask = smoothstep(0.62, 0.88, cloudBands + cloudNoise * 0.13 + vSeed * 0.08);
    col = mix(col, vec3(0.78, 0.91, 1.0), cloudMask * 0.62);
    float atmosphere = pow(1.0 - clamp(vFacing, 0.0, 1.0), 2.2);
    col += vec3(0.08, 0.38, 0.85) * atmosphere * 0.9;
  } else if (uScene > 2.5) {
    // Saturn: ring particles get a warm gold-amber gradient, planet core is cooler blue-violet.
    float goldMix = smoothstep(0.2, 0.85, 0.5 + 0.5 * sceneBand);
    float ringPart = smoothstep(0.88, 1.1, vDist); // ring particles are farther from center
    // Ring: bright gold → amber; planet: violet-lavender base.
    vec3 ringCol = mix(vec3(0.96, 0.74, 0.28), vec3(1.0, 0.55, 0.18), goldMix);
    col = mix(col, ringCol, ringPart * 0.68);
    col = mix(col, vec3(0.98, 0.72, 0.36), goldMix * (1.0 - ringPart) * 0.38);
    // Ring glint: random bright gold sparkles on fast-moving ring particles.
    col += vec3(1.0, 0.88, 0.46) * smoothstep(0.75, 1.0, vTwinkle) * ringPart * 0.22;
    col += vec3(1.0, 0.78, 0.42) * smoothstep(0.72, 1.0, vTwinkle) * 0.12;
  }

  float speedFlash = smoothstep(0.8, 1.8, vSpeed * uSpeedNorm * (1.0 + uEnergy));
  col = mix(col, vec3(1.0), speedFlash * 0.32);
  col *= density * twinkle * depthLight;

  col = mix(col, uCoreColor, uCoreGlow * (1.0 - smoothstep(0.0, 1.1, vDist)));

  vec3 holeColor = mix(vec3(0.45, 0.08, 0.95), vec3(1.0, 0.32, 0.06),
    smoothstep(0.25, 0.9, tRadial));
  col = mix(col, holeColor, vHole * (0.28 + 0.46 * tSpeed));
  col += holeColor * ring * vHole * 0.7;
  float pulseTint = uScene > 1.5 && uScene < 2.5 ? 0.0 : 1.0;
  col += vec3(1.0, 0.55, 0.18) * speedFlash * uPulseStrength * 0.18 * pulseTint;
  if (uScene < 0.5 || (uScene > 1.5 && uScene < 2.5)) {
    col += vec3(1.0, 0.82, 0.45) * speedFlash * 0.14;
  }

  col *= 1.0 + vStar * 1.1;

  // Galaxy fist: the fused star. Hot white core fading to gold at the rim,
  // a slow shimmer, and random glints that flare as 4-point sparkles.
  if (uForge > 0.001 && uScene > 0.5 && uScene < 1.5) {
    float rim = smoothstep(0.0, uForgeRadius * 1.05, vDist);
    vec3 star = mix(vec3(1.0, 0.97, 0.9), vec3(1.0, 0.62, 0.22), rim * rim);
    float shimmer = 0.85 + 0.15 * sin(uTime * 3.0 + vSeed * 40.0);
    // Additive blending stacks thousands of points, so keep each one dim.
    // uDensityNorm = 65536 / particle count keeps total brightness equal
    // across quality tiers.
    star *= 0.16 * uDensityNorm * shimmer * (1.0 - 0.45 * rim);
    float spark = max(crossX, crossY) * 2.6 + circle;
    star = mix(star, vec3(1.0, 0.95, 0.8) * spark * 0.9, vGlint);
    col = mix(col, star, uForge);
    // Galaxy draws ring-shaped sprites; a solid body needs round dots,
    // and glints use a cross so they read as sparkles.
    alpha = mix(alpha, mix(circle, max(circle, max(crossX, crossY)), vGlint), uForge);
  }

  // Ocean fist: aurora curtains, green at the foot rising into magenta tips.
  if (vAurora > 0.001) {
    float h = clamp((vDist / uOceanRadius - 1.04) / max(uAuroraHeight, 0.05), 0.0, 1.0);
    vec3 aur = mix(vec3(0.15, 1.0, 0.45), vec3(0.75, 0.25, 1.0), smoothstep(0.35, 1.0, h));
    float flicker = 0.7 + 0.3 * sin(uTime * 6.0 + vSeed * 31.0);
    aur *= flicker * (1.0 - 0.55 * h) * 0.9;
    col = mix(col, aur, vAurora);
  }

  float alphaBoost = mix(0.88, 1.0, vDepth) * (1.0 + speedFlash * 0.12);
  gl_FragColor = vec4(col, alpha * 0.5 * alphaBoost);
}
