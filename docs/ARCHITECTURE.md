# Architecture — StarSea（智控星海）

How the simulator is structured, how data flows through it, and where to look when extending or debugging it.
Corresponds to the code state of 2026-11-13 (commit 67).

## High-level overview

StarSea is a **browser-only** real-time app with three layers plus a presentation shell:

1. **Input** — webcam hand tracking (MediaPipe HandLandmarker) or a full mouse/keyboard fallback
2. **Simulation** — GPGPU particle physics on the GPU (Three.js + custom GLSL), driven by a state machine
3. **Presentation** — point-sprite rendering with bloom post-processing
4. **UI shell** (`src/ui/*`) — HUD, lesson panel, knowledge card, assistant, settings, export

There is no backend. All video processing happens on-device; nothing is uploaded.

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  Webcam /    │     │  InputManager    │     │  StateMachine        │
│  Mouse       │────▶│  (gestures,      │────▶│  (dial, scene,       │
│              │     │   trackball)     │     │   palette, forces)   │
└──────────────┘     └──────────────────┘     └──────────┬───────────┘
                                                         │ ~90 uniforms
                                                         ▼
┌──────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  Screen      │◀────│  THREE.Points +  │◀────│  ParticleSystem      │
│  (bloom)     │     │  CenterStar      │     │  (GPGPU ping-pong)   │
└──────────────┘     └──────────────────┘     └──────────────────────┘
```

## Directory layout

| Path | Role |
|------|------|
| `src/main.ts` | App bootstrap: renderer, post-processing, main loop, keyboard shortcuts, FPS sampling |
| `src/config.ts` | **Single source of truth** for every tunable, plus the six-scene scale axis data |
| `src/input/HandTracker.ts` | MediaPipe wrapper: video stream, 30 Hz timer detection, landmarks → hand state, One Euro filter |
| `src/input/InputManager.ts` | Unifies hand + mouse into one `GestureFrame`; owns the `dials` / `collider` mode switch |
| `src/input/MouseInput.ts` | Mouse/keyboard fallback: left = fist, right-drag = rotate, wheel = fine dial, `1`/`2`/`0` = latch |
| `src/input/GestureClassifier.ts` | Discrete pose labels (fist / open / pinch) derived from continuous values |
| `src/sim/ParticleSystem.ts` | GPGPU double-buffer, texture seeding, point material, quality tiers |
| `src/sim/StateMachine.ts` | Gesture → uniform targets, scene force lerps, palette cross-fade, threshold events |
| `src/sim/CenterStar.ts` | Galaxy core mesh (sun ↔ black hole) |
| `src/sim/shaders/*.glsl` | Velocity, position, point sprite and star shaders (+ shared `common.glsl`) |
| `src/ui/*` | Start screen, HUD, settings, lesson panel, knowledge card, scale axis, teaching mode, assistant, export |
| `src/data/*` | Lesson texts, 28 high-school knowledge points, 78 assistant Q&A entries, 18 scene prompts |
| `src/utils/OneEuroFilter.ts` | Adaptive jitter reduction on hand positions |
| `scripts/check-contract.mjs` | CI guard: GLSL uniform/varying declarations must match the TypeScript side |
| `scripts/check-claims.mjs` | CI guard: every performance number in the docs must have a source |
| `scripts/copy-mediapipe-assets.mjs` | Copies MediaPipe WASM from `node_modules` into `public/` before dev/build |

## Render loop (`main.ts`)

Each frame (once per display refresh):

1. **Poll input** — `InputManager.poll()` returns dial value, rotation delta, colliders, energy
2. **Colliders to local space** — world positions are converted with `worldToLocal` so force balls follow the rotating point cloud
3. **Update state** — `StateMachine.update()` eases dial/palette toward targets and writes sim uniforms
4. **Sim step** — `ParticleSystem.update(dt)` runs two GPU passes (velocity → position)
5. **Trackball inertia** — angular velocity damping, clamping, auto-spin restore
6. **Visuals** — `CenterStar` collapse/energy state
7. **Post + HUD** — `EffectComposer` with UnrealBloom + OutputPass, then overlay refresh

Hand detection is scheduled by a **30 Hz timer** inside `HandTracker`, but `detectForVideo()` is synchronous and runs on the main thread; the timer limits detection frequency but does not isolate MediaPipe from rendering.

## GPGPU simulation

`ParticleSystem` uses Three.js `GPUComputationRenderer`:

- Simulation grid: `size × size` texels → 65k / 262k / 1M particles (quality tiers `low` / `med` / `high`)
- Two float textures ping-pong: **velocity** and **position**
- Each texel = one particle; `THREE.Points` draws one vertex per texel
- The 4th channel of both textures stores a per-particle **seed**, used for burst grouping, aurora selection and noise offsets — it is written once at seeding and never changes
- Falls back to `HalfFloatType` when `EXT_color_buffer_float` is unavailable

### Velocity pass (`velocity.frag.glsl`)

Per particle, the shader:

- Spring-pulls toward a **formation target** (cloud shell, galaxy disc, ring plane, heart surface…)
- Adds **curl noise** for turbulent flow
- Applies a scene-specific force: `nebulaForce` / `galaxyForce` / `oceanForce` / `saturnForce` / `heartForce` / `pulseForce`
- Modifiers: `forgeForce` (galaxy fist → solid star), `auroraForce` (ocean fist → polar curtains)
- Optional hand **collider** repulsion (`capsuleForce`), plus shared fields `radialField` / `blackHoleForce` / `gravityField`
- Damps and clamps speed (`uDamping = 0.965`, `uMaxSpeed = 4.2`)

### Position pass (`position.frag.glsl`)

Integrates velocity into position with a clamped delta time (`maxDelta = 1/30`), so dropped frames slow the animation down instead of destabilising the physics.

### Rendering (`points.vert/frag.glsl`)

- Point size attenuates with depth; additive blending, depth write off
- Colour comes from a 3-stop gradient keyed by particle speed; the stops themselves cross-fade along the dial
- Dials mode adds a depth-fog term (`uFx`-gated): far particles dim to 0.70×, near ones lift to 1.12×
- `uFx` is a shared uniform (dials = 1, collider = 0), so collider rendering stays pixel-identical
- Runtime errors (JS exceptions and shader compile failures) surface as a bottom bar, not a black screen

## Interaction model

Inspired by continuous dial controls rather than gesture classification — a half-closed hand is simply `0.5`, not a failed classification:

| Input | Effect |
|-------|--------|
| Left hand openness | Continuous 0→1 dial (cloud ↔ ball, galaxy ↔ star forge, calm ↔ aurora…) |
| Right hand movement | Trackball rotation with inertia |
| Hand speed | Energy → brightens fastest particles |
| Two hands | Burst / gravity field between palms |
| Mouse | Full fallback: hold left = fist, right-drag = rotate, `B` = both fists, wheel = fine dial |
| `C` | Switch `dials` ↔ `collider` (hand as repelling force ball) |

`StateMachine` smooths dial and palette changes (~1 s morph) so scene switches and gesture changes feel fluid rather than snapping.

## Scenes

Six scenes share one engine; switching **re-seeds** formation targets without rebuilding render targets, so the transition reads as the same particles flowing to a new shape:

| Scene | Scale (order of magnitude) | Dial 0 → 1 |
|-------|---------------------------|------------|
| `heart` | ~10⁻¹ m | 62 BPM slow beat → 128 BPM contracted dark core |
| `pulse` | ~10⁰ m | Ballistic firework groups → converging ion ring |
| `ocean` | ~10⁷ m | Rotating particle Earth → polar aurora storm |
| `saturn` | ~10⁸ m | Keplerian ring system → raised, turbulent collapse |
| `nebula` | ~10¹⁶ m | Turbulent molecular cloud → dense glowing ball |
| `galaxy` | ~10²¹ m | Spiral disc → **star forge**: arms spiral in and fuse into a solid sphere |

Scene-specific parameters live under `CONFIG.galaxy`, `CONFIG.ocean`, …; the scale-axis copy (names, questions, answers) lives in `SCALE_AXIS` in the same file.

## Teaching shell

The UI layer is what turns the simulator into a classroom tool. It only reads state and emits callbacks — it never writes uniforms:

| Component | Key | Notes |
|-----------|-----|-------|
| `LessonPanel` | `K` | Per-scene lesson: hook, 4–5 points, gesture→quantity, plus the matching textbook points with subject/chapter tags |
| `KnowledgeCard` | `I` | Concept / quantity you are changing / scale & dominant force / real-world analogue / one classroom question (answer collapsed); `show()` must add the `.visible` class or the card stays at `opacity: 0` |
| `TeachingMode` | `T` | 90 s auto tour, 6 × 15 s along the scale axis, subtitle bar synced |
| `Assistant` | `A` | Retrieval Q&A over 124 built-in entries (78 hand-written + 28 knowledge points + 18 scene prompts); shows the retrieval trace; teacher-added entries persist in `localStorage` |
| `ScaleAxis` | `[` `]` | Logarithmic station bar, 22 orders of magnitude end to end |
| `Export` | `E` | PNG + JSON parameter snapshot, sampled right after `composer.render()` because `preserveDrawingBuffer` is false |

## Hand tracking details

MediaPipe `HandLandmarker` returns 21 landmarks per hand. Key design choices:

1. **Handedness keys** — tracks Left/Right labels, not detection index (avoids teleporting when index swaps)
2. **One Euro filter** — reduces jitter on 3D projected positions; cutoff adapts to speed (`fc = minCutoff + beta·|dx/dt|`)
3. **Continuous curl** — finger tip/PIP ratios map to 0..1 closedness (no discrete classifier in the control path)
4. **Phantom rejection** — duplicate detections of one hand filtered by minimum separation (0.09 in normalised space)
5. **`mirrorHandedness`** — corrects for selfie-mirror camera labelling
6. **Tiered loss handling** — brief hold (`age < 60` in `HandTracker.toState`), then 300 ms opacity fade
   (`trackingLostFadeMs`), then 1000 ms back to neutral (`trackingLostNeutralMs`)

## Performance

| Tier | Grid | Particles |
|------|------|-----------|
| low | 256² | ~65k |
| med | 512² | ~262k |
| high | 1024² | ~1M |

Auto-quality drops one tier if FPS stays below 45 for the first 3 seconds (`CONFIG.autoQuality`).

## CI guards

Two scripts run in CI (`.github/workflows/ci.yml`) and fail the build:

- **`check-contract.mjs`** — every `uniform` declared in GLSL must be assigned in TypeScript (110/110 today); a `varying` used but not declared in one half of a vertex/fragment pair fails too. This exists because a missing `vCrest` declaration on 2026-10-19 made the shared particle material fail to compile — every scene's particles vanished while `npm run build` stayed green.
- **`check-claims.mjs`** — every performance number (fps / ms / % / success rate) in `README.md` and `docs/*.md` must trace to `config.ts` or the measurement table, otherwise the script exits 1.

## Build & deploy

- **Dev**: Vite dev server (`npm run dev`)
- **GitHub Pages**: `npm run build` → `dist/` with relative base `./`
- **Portfolio embed**: `npm run build:embed` → base `/games/gesture-particles/`

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds and publishes to Pages on push to `main`.

## Extending the project

- **New scene** — add to `SCENES` in `config.ts`, add a `*Force()` branch in `velocity.frag.glsl`, add a seeding case in `ParticleSystem.seedTextures`, add a `case` in `StateMachine.update`, then run `npm run check:contract`
- **New gesture** — extend the `GestureFrame` struct in `InputManager`; keep the work off the render loop
- **Visual tweak** — start in `config.ts`; only touch shaders if behaviour (not just numbers) needs to change
- **New UI panel** — put it in `src/ui/`, read state, emit callbacks; do not import from `src/sim/`

## Dependencies

| Package | Use |
|---------|-----|
| `three` | WebGL renderer, GPGPU, post-processing |
| `@mediapipe/tasks-vision` | Hand landmark detection (WASM copied locally, model committed to the repo) |
| `vite` | Dev server and production bundler (inlines GLSL via `?raw`) |

## License notes

Simulation GLSL includes public-domain simplex noise from [webgl-noise](https://github.com/ashima/webgl-noise). The project is based on `gesture-particles` (William Larskog, MIT); see `LICENSE` and `ORIGINALITY.md`.
