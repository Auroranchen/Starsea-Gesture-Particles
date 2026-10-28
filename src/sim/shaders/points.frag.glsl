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
    col = mix(col, vec3(0.56, 0.3, 1.0), wisps * 0.34);
    col = mix(col, vec3(0.16, 0.52, 0.92), cloudDepth * (1.0 - wisps) * 0.16);
    col += vec3(1.0, 0.83, 0.66) * smoothstep(0.88, 1.0, vTwinkle) * vStar * 0.42;
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
    float goldMix = smoothstep(0.2, 0.85, 0.5 + 0.5 * sceneBand);
    col = mix(col, vec3(0.98, 0.72, 0.36), goldMix * 0.52);
    col += vec3(1.0, 0.78, 0.42) * smoothstep(0.72, 1.0, vTwinkle) * 0.16;
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

  float alphaBoost = mix(0.88, 1.0, vDepth) * (1.0 + speedFlash * 0.12);
  gl_FragColor = vec4(col, alpha * 0.5 * alphaBoost);
}
