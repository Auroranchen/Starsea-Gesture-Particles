uniform float uDelta;
uniform float uTime;
uniform float uScene;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 posData = texture2D(texturePosition, uv);
  vec4 velData = texture2D(textureVelocity, uv);
  float seed = posData.w;

  // Pulse scene: when this particle's group starts a new cycle, teleport it
  // to the burst origin. The velocity pass sets the launch velocity in the same frame.
  if (uScene > 3.5) {
    float g = pulseGroup(seed);
    float cycle = pulseCycle(uTime, g);
    if (cycle != pulseCycle(uTime - uDelta, g)) {
      gl_FragColor = vec4(pulseOrigin(g, cycle), seed);
      return;
    }
  }

  gl_FragColor = vec4(posData.xyz + velData.xyz * uDelta, seed);
}
