import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CONFIG, QUALITY_SIZES, SCENES, type Quality, type SceneId } from './config';
import { ParticleSystem } from './sim/ParticleSystem';
import { CenterStar } from './sim/CenterStar';
import { StateMachine } from './sim/StateMachine';
import { InputManager } from './input/InputManager';
import { HandTracker } from './input/HandTracker';
import { Overlay } from './ui/Overlay';
import { StartScreen } from './ui/StartScreen';
import { WebcamPanel } from './ui/WebcamPanel';
import { ScaleAxis } from './ui/ScaleAxis';
import { KnowledgeCard } from './ui/KnowledgeCard';
import { ShareLink } from './ui/ShareLink';
import { TeachingMode } from './ui/TeachingMode';
import { Export } from './ui/Export';

// 运行期错误可视化：JS 异常与着色器编译/链接错误直接在页面底部显示，
// 避免"黑屏但没有线索"。正常运行时完全不可见。
function installErrorReporter(): void {
  let bar: HTMLDivElement | null = null;
  const show = (msg: string) => {
    if (!bar) {
      bar = document.createElement('div');
      bar.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:99999',
        'max-height:42vh', 'overflow:auto', 'padding:8px 12px',
        'background:rgba(38,10,10,.96)', 'color:#ffb4b4',
        'font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace',
        'border-top:1px solid #ff5c5c', 'white-space:pre-wrap',
      ].join(';');
      document.body.appendChild(bar);
    }
    bar.textContent += (bar.textContent ? '\n' : '') + msg;
  };
  window.addEventListener('error', (e) => show('Error: ' + (e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string } | undefined;
    show('Rejection: ' + (r?.message ?? String(e.reason)));
  });
  const original = console.error;
  console.error = (...args: unknown[]) => {
    show(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    original.apply(console, args as unknown as []);
  };
}
installErrorReporter();

const app = document.getElementById('app')!;
const canvas = document.getElementById('scene') as HTMLCanvasElement;

if (!document.createElement('canvas').getContext('webgl2')) {
  const fatal = document.createElement('div');
  fatal.className = 'fatal';
  fatal.innerHTML =
    '<p>This experience needs WebGL2, which your browser or GPU doesn&rsquo;t provide.<br>' +
    'Try a recent version of Chrome, Firefox, Edge, or Safari.</p>';
  document.body.appendChild(fatal);
  throw new Error('WebGL2 unavailable');
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.background);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.set(0, 1.9, 5.2);
camera.lookAt(0, 0.2, 0);

function makeBallMesh(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
  );
  m.visible = false;
  scene.add(m);
  return m;
}
const ballMeshes = [makeBallMesh(), makeBallMesh()];

const centerStar = new CenterStar();
scene.add(centerStar.mesh);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  CONFIG.bloom.strength,
  CONFIG.bloom.radius,
  CONFIG.bloom.threshold,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

let particles: ParticleSystem;
let currentScene: SceneId = CONFIG.defaultScene;

function buildParticles(quality: Quality): void {
  if (particles) {
    scene.remove(particles.points);
    particles.dispose();
  }
  particles = new ParticleSystem(renderer, QUALITY_SIZES[quality], currentScene);
  particles.points.rotation.set(0, 0, 0);
  scene.add(particles.points);
  applyCameraForScene(currentScene);
}

function applyCameraForScene(id: SceneId): void {
  if (id === 'galaxy') camera.position.set(0, 3.4, 4.6);
  else if (id === 'ocean') camera.position.set(0, 1.0, 5.6);
  else if (id === 'saturn') camera.position.set(0, 1.25, 6.15);
  else if (id === 'heart') camera.position.set(0, 0.9, 5.4);
  else if (id === 'pulse') camera.position.set(0, 1.2, 6.2);
  else camera.position.set(0, 1.9, 5.2);
  camera.lookAt(0, 0.2, 0);
}

function switchScene(id: SceneId): void {
  if (id === currentScene) return;
  currentScene = id;
  stateMachine.setScene(id);
  particles.reseed(id);
  particles.points.rotation.set(0, 0, 0);
  angularVel.set(0, CONFIG.autoSpin);
  applyCameraForScene(id);
  overlay.setScene(id);
  overlay.toast(`场景：${id}`);
  scaleAxis.setScene(id);
  knowledgeCard.showWithAutoHide(id);
}

const angularVel = new THREE.Vector2(0, CONFIG.autoSpin);

const stateMachine = new StateMachine();

const overlay = new Overlay();
app.appendChild(overlay.element);
currentScene = overlay.scene;
stateMachine.setScene(currentScene);
buildParticles(overlay.quality);
bloomPass.enabled = overlay.bloom;
bloomPass.strength = overlay.bloomStrength;
bloomPass.radius = CONFIG.bloom.radius;
bloomPass.threshold = CONFIG.bloom.threshold;

// ── 新增 UI 组件 ──────────────────────────────────────────────────────────
const scaleAxis = new ScaleAxis();
app.appendChild(scaleAxis.element);
scaleAxis.setScene(currentScene);
scaleAxis.onNavigate = (id: SceneId) => switchScene(id);

const knowledgeCard = new KnowledgeCard();
app.appendChild(knowledgeCard.element);

const shareLink = new ShareLink();
app.appendChild(shareLink.element);
shareLink.bindCopyButtons();

const teachingMode = new TeachingMode();
app.appendChild(teachingMode.subtitleEl);
teachingMode.onStart = (firstScene) => {
  switchScene(firstScene);
  overlay.toggleHud(); // 隐藏 HUD
};
teachingMode.onSceneChange = (id) => {
  switchScene(id);
};
teachingMode.onStop = () => {
  overlay.toggleHud(); // 恢复 HUD
};

const exporter = new Export();
exporter.init(canvas);

// 解析 URL hash（扫码同屏入场）
const hashState = ShareLink.parseHash();
if (hashState) {
  if (hashState.scene) currentScene = hashState.scene;
  if (hashState.quality) overlay.quality = hashState.quality;
}

const input = new InputManager(canvas, camera);
const webcamPanel = new WebcamPanel(() => activeTracker);
app.appendChild(webcamPanel.element);

let activeTracker: HandTracker | null = null;

const startScreen = new StartScreen(
  async () => {
    const tracker = await HandTracker.create(camera);
    activeTracker = tracker;
    input.attachHands(tracker);
    overlay.toast(
      startScreen.interactionMode === 'collider'
        ? 'Collider mode — your hands are force balls. Press C to switch back.'
        : 'Dial mode — left hand is the dial, right hand rotates. Press C for collider.',
    );
  },
  () => {
    overlay.toast(
      startScreen.interactionMode === 'collider'
        ? 'Collider mode — move the mouse to create a force field. Press C to switch back.'
        : 'Mouse mode — hold left to gather the ball, right-drag to spin',
    );
  },
  (mode) => input.setInteractionMode(mode),
);
app.appendChild(startScreen.element);

overlay.onQualityChange = (q) => buildParticles(q);
overlay.onBloomChange = (on) => {
  bloomPass.enabled = on;
};
overlay.onBloomStrengthChange = (v) => {
  bloomPass.strength = v;
};
overlay.onParticleSizeChange = (v) => {
  particles.setPointSize(v);
};
overlay.onParamChange = (path, value) => {
  if (path === 'bloom.radius') bloomPass.radius = value;
  else if (path === 'bloom.threshold') bloomPass.threshold = value;
  else if (path === 'oneEuro.minCutoff' || path === 'oneEuro.beta') activeTracker?.updateFilterParams();
  particles.updateRuntimeParams();
};
overlay.onFullscreen = () => {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen().catch(() => overlay.toast('当前浏览器不支持全屏'));
  }
};
overlay.onExitToMenu = () => {
  input.detachHands();
  activeTracker = null;
  if (webcamPanel.visible) webcamPanel.toggle();
  overlay.closePanels();
  startScreen.show();
};
overlay.onSceneChange = (id) => switchScene(id);
overlay.onRebuild = () => buildParticles(overlay.quality);

window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'h':
      overlay.toggleHud();
      break;
    case '?':
    case '/':
      overlay.toggleHelp();
      break;
    case 's':
      overlay.toggleSettings();
      break;
    case 'p':
      webcamPanel.toggle();
      break;
    case 'r':
      buildParticles(overlay.quality);
      break;
    case 'g': {
      const i = SCENES.indexOf(currentScene);
      switchScene(SCENES[(i + 1) % SCENES.length]);
      break;
    }
    case 'c':
      input.toggleInteractionMode();
      break;
    case '[':
      scaleAxis.prev();
      break;
    case ']':
      scaleAxis.next();
      break;
    case 'k':
      knowledgeCard.toggle(currentScene);
      break;    case 't':
      teachingMode.toggle({ scene: currentScene, dial: stateMachine.dial });
      break;
    case 'q':
      shareLink.toggle({
        scene: currentScene,
        quality: overlay.quality,
        dial: stateMachine.dial,
        energy: stateMachine.energy,
      });
      break;
    case 'e':
      exporter.requestCapture({
        scene: currentScene,
        quality: overlay.quality,
        dial: stateMachine.dial,
        energy: stateMachine.energy,
        bloomEnabled: overlay.bloom,
        bloomStrength: overlay.bloomStrength,
        pointSize: CONFIG.pointSize,
      });
      overlay.toast('已请求导出画面与参数快照');
      break;
    case 'escape':
      if (teachingMode.isActive) {
        teachingMode.stop();
        break;
      }
      input.detachHands();
      activeTracker = null;
      overlay.closePanels();
      shareLink.hide();
      startScreen.show();
      break;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  particles.onResize();
});

let fps = 60;
let fpsSampleStart = performance.now();
let fpsFrames = 0;
let qualityLowSince = 0;
let autoChecked = false;
let manualRotateCooldown = 0;
let previousHandsActive = false;

function sampleFps(now: number): void {
  fpsFrames++;
  const elapsed = now - fpsSampleStart;
  if (elapsed >= CONFIG.fpsSampleIntervalMs) {
    fps = (fpsFrames / elapsed) * 1000;
    fpsFrames = 0;
    fpsSampleStart = now;
    if (fps < CONFIG.fpsDowngradeBelow) {
      if (qualityLowSince === 0) qualityLowSince = now;
    } else if (fps > CONFIG.fpsDowngradeBelow + 8) {
      qualityLowSince = 0;
    }
  }
  if (
    CONFIG.autoQuality &&
    !autoChecked &&
    qualityLowSince > 0 &&
    now - qualityLowSince >= CONFIG.fpsSampleSeconds * 1000 &&
    fps > 0
  ) {
    autoChecked = true;
    const order: Quality[] = ['high', 'med', 'low'];
    const idx = order.indexOf(overlay.quality);
    if (idx < order.length - 1) {
      overlay.quality = order[idx + 1];
      buildParticles(overlay.quality);
      overlay.toast(`已降至 ${overlay.quality} 画质以保持流畅`);
    }
  }
}

const clock = new THREE.Clock();

function frame(): void {
  requestAnimationFrame(frame);
  const dt = clock.getDelta();
  const now = performance.now();

  // 课案模式：tick 返回合成帧，跳过真实输入
  let gestures: ReturnType<typeof input.poll>['frame'];
  let usingHands: boolean;
  const teachingTick = teachingMode.tick(dt);
  if (teachingTick) {
    if (teachingTick.scene !== currentScene) switchScene(teachingTick.scene);
    // 合成一个最小 GestureFrame：仅设置 gather/dial
    const { frame: realFrame } = input.poll();
    gestures = {
      ...realFrame,
      gather: teachingTick.dial,
      bothFists: teachingTick.dial,
    };
    usingHands = false;
  } else {
    const polled = input.poll();
    gestures = polled.frame;
    usingHands = polled.usingHands;
  }

  if (usingHands !== previousHandsActive && input.mode === 'hand') {
    overlay.toast(usingHands ? '手部追踪已恢复' : '手部追踪丢失');
  }
  previousHandsActive = usingHands;

  if (gestures.modeToggled) {
    overlay.toast(
      gestures.mode === 'collider'
        ? '力场碰撞模式 —— 手掌作为力场球推动粒子。按 C 切回调节盘模式。'
        : '调节盘模式 —— 左手握拳驱动拨盘，右手旋转。按 C 切换碰撞模式。',
    );
  }

  particles.points.updateMatrixWorld();
  const localColliders = gestures.colliders.map((c) => ({
    ...c,
    position: particles.points.worldToLocal(c.position.clone()),
  }));

  const velUniforms = particles.velocityUniforms;
  stateMachine.update(dt, gestures, localColliders, velUniforms, particles.colorUniforms);
  for (const event of stateMachine.consumeEvents()) {
    const messages: Record<string, string> = {
      burst: '冲击波已释放',
      'collapse-start': '星锻已启动',
      'gravity-start': '双手引力已激活',
    };
    overlay.toast(messages[event]);
  }

  for (let i = 0; i < ballMeshes.length; i++) {
    const c = gestures.colliders[i];
    const mesh = ballMeshes[i];
    if (gestures.mode === 'collider' && c) {
      mesh.visible = true;
      mesh.position.copy(c.position);
      (mesh.material as THREE.MeshBasicMaterial).opacity = c.opacity;
      const pulse = 1 + Math.sin(now * 0.004 + i * 2.1) * 0.08 + stateMachine.energy * 0.3;
      mesh.scale.setScalar(pulse);
    } else {
      mesh.visible = false;
    }
  }

  angularVel.y += -gestures.rotate.dx * CONFIG.rotateSensitivity;
  angularVel.x += gestures.rotate.dy * CONFIG.rotateSensitivity;
  if (Math.abs(gestures.rotate.dx) + Math.abs(gestures.rotate.dy) > 0.0001) {
    manualRotateCooldown = 0.9;
  }
  manualRotateCooldown = Math.max(0, manualRotateCooldown - dt);
  angularVel.clampLength(0, CONFIG.rotateMaxSpeed);
  const decay = Math.exp(-CONFIG.rotateDamping * dt);
  angularVel.multiplyScalar(decay);
  if (manualRotateCooldown <= 0 && angularVel.length() < CONFIG.autoSpin) angularVel.y = CONFIG.autoSpin;
  particles.points.rotation.y += angularVel.y * dt;
  particles.points.rotation.x = THREE.MathUtils.clamp(
    particles.points.rotation.x + angularVel.x * dt,
    -1.1,
    1.1,
  );

  // Heart scene: kick the bloom on every beat so the glow pulses with the shape.
  bloomPass.strength = overlay.bloomStrength * (1 + 0.6 * stateMachine.beat);

  particles.updateRuntimeParams();
  particles.update(dt);
  // While the galaxy is forging a solid star, keep the core a bright sun
  // instead of letting it turn into the black hole.
  centerStar.update(
    dt,
    stateMachine.dial * (1 - stateMachine.forge),
    stateMachine.energy,
    currentScene === 'galaxy',
  );
  webcamPanel.update();
  sampleFps(now);
  const baseMode = usingHands ? 'hand' : input.mode === 'hand' ? 'hand·lost' : 'mouse';
  overlay.update(
    fps,
    gestures.mode === 'collider' ? `${baseMode}·collide` : baseMode,
    currentScene,
    stateMachine.label,
    stateMachine.accent,
    stateMachine.dial,
    stateMachine.energy,
    gestures.leftPose,
    gestures.rightPose,
    gestures.leftActive,
    gestures.rightActive,
  );

  composer.render();

  // 渲染后同一 microtask 里采样 canvas，导出 PNG（preserveDrawingBuffer=false 的约束）
  exporter.onAfterRender({
    scene: currentScene,
    quality: overlay.quality,
    dial: stateMachine.dial,
    energy: stateMachine.energy,
    bloomEnabled: overlay.bloom,
    bloomStrength: overlay.bloomStrength,
    pointSize: CONFIG.pointSize,
  });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) clock.getDelta();
});

frame();
