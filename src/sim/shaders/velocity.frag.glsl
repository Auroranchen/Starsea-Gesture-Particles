uniform float uTime;
uniform float uDelta;
uniform float uScene;

uniform vec3  uCenter;
uniform float uTargetRadius;
uniform float uStiffness;
uniform float uTurbulence;

uniform float uDiscRadius;
uniform float uOrbitSpeed;
uniform float uOrbitGain;
uniform float uFlatten;
uniform float uBulge;
uniform float uArmTwist;
uniform float uArmStrength;
uniform float uInnerEdge;
uniform float uKepler;

uniform float uDiscEdgeSoft;

uniform float uWaveAmp;
uniform float uWaveFreq;
uniform float uContainRadius;

uniform vec3  uBall;
uniform vec3  uBallPrev;
uniform float uBallStrength;
uniform float uBallRadius;
uniform vec3  uBallPush;
uniform vec3  uBall2;
uniform vec3  uBall2Prev;
uniform float uBall2Strength;
uniform vec3  uBall2Push;
uniform float uBall2Active;

uniform float uDamping;
uniform float uMaxSpeed;

uniform float uHeartScale;
uniform float uHeartContract;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBeatAmp;
uniform float uWaveForce;
uniform float uWaveSpeed;
uniform float uHaloFraction;
uniform float uHaloRadius;
uniform float uHaloSpin;

uniform float uBurstSpeed;
uniform float uGravity;
uniform float uRecall;

vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

vec3 snoise3(vec3 p) {
  return vec3(
    snoise(p),
    snoise(p + vec3(123.4, 57.1, 91.2)),
    snoise(p + vec3(419.2, 371.9, 27.5))
  );
}

vec3 curlNoise(vec3 p) {
  const float e = 0.12;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);

  vec3 x0 = snoise3(p - dx); vec3 x1 = snoise3(p + dx);
  vec3 y0 = snoise3(p - dy); vec3 y1 = snoise3(p + dy);
  vec3 z0 = snoise3(p - dz); vec3 z1 = snoise3(p + dz);

  float x = (y1.z - y0.z) - (z1.y - z0.y);
  float y = (z1.x - z0.x) - (x1.z - x0.z);
  float z = (x1.y - x0.y) - (y1.x - y0.x);
  return normalize(vec3(x, y, z) / (2.0 * e) + 1e-6);
}

vec3 nebulaForce(vec3 p, float seed) {
  float radiusFrac = pow(max(fract(seed * 7.31), 0.02), 0.3333);
  vec3 d = p - uCenter;
  float len = max(length(d), 1e-4);
  vec3 target = uCenter + (d / len) * (uTargetRadius * radiusFrac);
  return (target - p) * uStiffness;
}

vec3 galaxyForce(vec3 p, vec3 v, float seed) {
  vec2 xz = p.xz;
  float r = max(length(xz), 1e-3);
  vec2 rHat = xz / r;
  vec2 tHat = vec2(-rHat.y, rHat.x);

  float u1 = max(fract(seed * 7.31), 0.001);

  float rawR = -log(1.0 - 0.985 * u1) / 3.2;
  float edgeScatter = fract(seed * 51.3) * smoothstep(0.7, 1.0, rawR);
  float rFrac = clamp(rawR - uDiscEdgeSoft * edgeScatter * 0.6, 0.006, 1.0);
  float targetR = uDiscRadius * rFrac;
  bool isBulge = rFrac < 0.14;
  float centralPuff = uBulge * smoothstep(0.5, 0.0, rFrac / 0.25);
  float thickness = 0.05 + 0.09 * rFrac + centralPuff;
  float ringTarget = uInnerEdge * (1.0 + 2.3 * u1);
  targetR = mix(targetR, ringTarget, uKepler);
  targetR = max(targetR, uInnerEdge);
  thickness = mix(thickness, 0.03, uKepler);

  vec2 fXZ = -rHat * (r - targetR) * uStiffness;

  float vTan = dot(v.xz, tHat);
  fXZ += -rHat * (vTan * vTan / max(r, 0.15)) * uKepler;

  fXZ += -rHat * uKepler * 1.5 / max(r, 0.4);

  float vFlat = uOrbitSpeed * r / (r + 0.5);
  float vKep = min(uOrbitSpeed * 1.35 / sqrt(max(r, 0.12)), uOrbitSpeed * 2.4);
  float vOrb = mix(vFlat, vKep, uKepler);
  fXZ += (tHat * vOrb - v.xz) * uOrbitGain;

  if (!isBulge) {
    float theta = atan(xz.y, xz.x);
    float phase = theta - uArmTwist * log(r + 0.3);
    float armWave = sin(2.0 * phase) + 0.55 * sin(4.0 * phase + 1.7);
    float armFade = smoothstep(0.4, 1.0, r);
    fXZ += tHat * armWave * uArmStrength * 0.8 * armFade;
  }

  float fY = -p.y * uFlatten / max(thickness, 0.03) * 0.25;
  return vec3(fXZ.x, fY, fXZ.y);
}

float waveHeight(vec2 xz) {
  float h = 0.0;
  h += sin(xz.x * 1.3 * uWaveFreq + uTime * 0.8) * 0.35;
  h += sin(xz.y * 1.7 * uWaveFreq - uTime * 0.6) * 0.30;
  h += snoise(vec3(xz * 0.5 * uWaveFreq, uTime * 0.15)) * 0.6;
  return h * uWaveAmp;
}

vec3 oceanForce(vec3 p) {
  vec3 target = vec3(p.x, waveHeight(p.xz), p.z);
  vec3 f = (target - p) * uStiffness;
  float r = length(p.xz);
  if (r > uContainRadius) {
    f.xz += (-p.xz / r) * (r - uContainRadius) * 2.5;
  }
  return f;
}

// Point on a puffy 3D heart. Area-uniform rejection sampling of the implicit
// heart (x²+y²-1)³ - x²y³ ≤ 0 (no seam, unlike radially scaling the parametric
// curve), then a pillow profile for depth. Most particles sit on the front/back
// skin so the silhouette reads from every angle; the rest fill the interior.
vec3 heartPoint(float seed) {
  vec2 xy = vec2(0.0);
  float f = -1.0;
  for (int i = 0; i < 10; i++) {
    float k = seed * 12.9898 + float(i) * 1.618;
    vec2 c = vec2(hash11(k) * 2.4 - 1.2, hash11(k + 78.233) * 2.35 - 1.05);
    float a = dot(c, c) - 1.0;
    float fc = a * a * a - c.x * c.x * c.y * c.y * c.y;
    if (fc <= 0.0) { xy = c; f = fc; break; }
  }
  float h3 = hash11(seed * 39.425);
  // -f is 1 at the center and 0 on the outline: cube root gives a soft pillow.
  float depth = 0.5 * sqrt(pow(clamp(-f, 0.0, 1.0), 0.3333));
  float z = h3 > 0.18
    ? (h3 > 0.59 ? depth : -depth)
    : (h3 / 0.18 * 2.0 - 1.0) * depth;
  return vec3(xy.x, xy.y - 0.1, z);
}

vec3 heartForce(vec3 p, vec3 v, float seed) {
  float h = hash11(seed * 3.17);

  // Dark-matter halo: three tilted orbital rings around the heart.
  if (h < uHaloFraction) {
    float ring = floor(hash11(seed * 9.71) * 3.0);
    float a = ring * 2.094;
    vec3 n = normalize(vec3(sin(a) * 0.55, 1.0, cos(a) * 0.55));
    float along = dot(p, n);
    vec3 pp = p - n * along;
    float r = max(length(pp), 1e-3);
    vec3 rHat = pp / r;
    vec3 tHat = cross(n, rHat);
    float R = uHaloRadius * (0.8 + 0.45 * hash11(seed * 4.33));
    vec3 f = -rHat * (r - R) * uStiffness - n * along * uStiffness * 1.5;
    float spin = uHaloSpin * (1.0 + 0.6 * hash11(seed * 6.1)) / sqrt(R);
    f += (tHat * spin - v) * 1.4;
    return f;
  }

  float pulse = 1.0 + uBeatAmp * uBeat;
  vec3 target = heartPoint(seed) * uHeartScale * uHeartContract * pulse;
  vec3 f = (target - p) * uStiffness;

  // Shockwave ring travelling outward from the center on every beat.
  float dist = max(length(p), 1e-3);
  float waveR = uBeatPhase * uWaveSpeed;
  float band = exp(-pow((dist - waveR) * 5.0, 2.0));
  f += (p / dist) * uWaveForce * band * (1.0 - smoothstep(0.2, 0.7, uBeatPhase));
  return f;
}

// Fireworks: launch on group cycle, then ballistic flight with gravity.
// With the dial (uPulseFocus) every burst is flattened into a ring
// shockwave around the core and recalled before the next pulse.
vec3 pulseLaunch(vec3 p, float seed, float g, float cycle) {
  float k = seed * 91.7 + cycle * 7.13;
  float u = hash11(k) * 2.0 - 1.0;
  float a = hash11(k + 3.1) * 6.2831853;
  vec3 dir = vec3(sqrt(1.0 - u * u) * cos(a), u, sqrt(1.0 - u * u) * sin(a));
  dir.y *= mix(1.0, 0.06, uPulseFocus);
  // Each ion ring gets its own orientation (gyroscope look) so rings are
  // never all edge-on to the camera.
  float tx = (hash11(g * 5.3 + cycle) - 0.5) * 2.6 * uPulseFocus;
  float tz = (hash11(g * 8.9 + cycle) - 0.5) * 2.6 * uPulseFocus;
  float cx = cos(tx), sx = sin(tx), cz = cos(tz), sz = sin(tz);
  dir = vec3(dir.x, dir.y * cx - dir.z * sx, dir.y * sx + dir.z * cx);
  dir = vec3(dir.x * cz - dir.y * sz, dir.x * sz + dir.y * cz, dir.z);
  // 88% on a crisp shell, the rest are slower embers inside the burst.
  float hs = hash11(k + 7.7);
  float sp = hs < 0.88 ? 0.94 + 0.06 * hash11(k + 5.3) : 0.3 + 0.5 * hash11(k + 9.1);
  return dir * uBurstSpeed * sp + vec3(0.0, 0.35 * (1.0 - uPulseFocus), 0.0);
}

vec3 pulseForce(vec3 p, vec3 v, float age) {
  vec3 f = vec3(0.0, -uGravity * (1.0 - uPulseFocus), 0.0);
  // Recall onto a small shell (not a point) so the core never collapses
  // into one overexposed blob between pulses.
  float recall = uRecall * uPulseFocus * smoothstep(0.45, 1.0, age);
  float r = max(length(p), 1e-3);
  f += -(p / r) * (r - 0.45) * recall;
  vec2 tHat = vec2(-p.z, p.x);
  f.xz += tHat * 0.9 * uPulseFocus * (1.0 - age);
  return f;
}

vec3 capsuleForce(vec3 p, vec3 a, vec3 b, float strength, vec3 push) {
  vec3 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  vec3 closest = a + ab * t;
  vec3 d = p - closest;
  float dist = length(d);
  if (dist >= uBallRadius) return vec3(0.0);
  float fall = 1.0 - smoothstep(0.0, uBallRadius, dist);
  return (d / max(dist, 1e-4)) * strength * fall + push * fall;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 posData = texture2D(texturePosition, uv);
  vec4 velData = texture2D(textureVelocity, uv);
  vec3 p = posData.xyz;
  vec3 v = velData.xyz;
  float seed = posData.w;

  vec3 f;
  if (uScene < 0.5) f = nebulaForce(p, seed);
  else if (uScene < 1.5) f = galaxyForce(p, v, seed);
  else if (uScene < 2.5) f = oceanForce(p);
  else if (uScene < 3.5) f = heartForce(p, v, seed);
  else {
    float g = pulseGroup(seed);
    float cycle = pulseCycle(uTime, g);
    if (cycle != pulseCycle(uTime - uDelta, g)) {
      gl_FragColor = vec4(pulseLaunch(p, seed, g, cycle), velData.w);
      return;
    }
    f = pulseForce(p, v, pulseAge(uTime, g));
  }

  float turb = uTurbulence * (0.7 + 0.6 * seed);
  f += curlNoise(p * 0.9 + uTime * 0.12) * turb;

  f += capsuleForce(p, uBallPrev, uBall, uBallStrength, uBallPush);
  if (uBall2Active > 0.5) {
    f += capsuleForce(p, uBall2Prev, uBall2, uBall2Strength, uBall2Push);
  }

  v += f * uDelta;
  v *= uDamping;
  float spd = length(v);
  if (spd > uMaxSpeed) v = (v / spd) * uMaxSpeed;

  gl_FragColor = vec4(v, velData.w);
}
