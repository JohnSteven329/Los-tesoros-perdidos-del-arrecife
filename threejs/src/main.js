import * as THREE from 'three';
import config from '../../shared/settings.json';
import reefUrl from '../../shared/reef.json?url';
import { createUI } from './ui.js';
import { SearchGame, FrameMeter } from './game.js';
import { ReefCamera, bindControls } from './camera.js';
import { buildReef, pickTreasure } from './world.js';
import { animateGroups } from './animation.js';
import { createWater } from './water.js';
import { readBenchmark } from './benchmark.js';

const canvas = document.querySelector('#reef');
const game = new SearchGame(config.treasures, config.animation.discoverySeconds);
const meter = new FrameMeter();
const rig = new ReefCamera(config.camera);
const benchmark = readBenchmark(window.location.search);
let water, world;
let lastFrame = null;

function refresh() {
  ui.update({ found: [...game.found], paused: game.paused, light: game.light, fps: Math.round(meter.fps), average: meter.average });
}

const actions = {
  pause() { game.paused = !game.paused; refresh(); },
  light() {
    game.light = (game.light + 1) % config.lights.length;
    water?.setLight(config.lights[game.light], game.light);
    refresh();
  },
  reset() {
    game.reset();
    rig.reset();
    meter.reset();
    lastFrame = null;
    water?.setLight(config.lights[0], 0);
    if (world) animateGroups(world.groups, game, config.animation);
    ui.reset();
    refresh();
  },
  home() { rig.reset(); },
};
const ui = createUI(actions);
refresh();

async function loadScene() {
  const response = await fetch(reefUrl);
  if (!response.ok) throw new Error(`No se pudo leer la geometría del arrecife (HTTP ${response.status}).`);
  return response.json();
}

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  const ratio = benchmark ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(ratio);
  const scene = new THREE.Scene();
  water = createWater(scene, ratio);
  water.setLight(config.lights[game.light], game.light);
  // El tamaño CSS del visor puede cambiar sin que cambie el de la ventana.
  function resize() {
    const viewport = canvas.parentElement;
    const w = benchmark ? 936 : Math.max(1, viewport.clientWidth);
    const h = benchmark ? 594 : Math.max(1, viewport.clientHeight);
    if (benchmark) {
      const fit = Math.min(viewport.clientWidth / w, viewport.clientHeight / h);
      Object.assign(canvas.style, { width: `${w * fit}px`, height: `${h * fit}px`, margin: 'auto' });
    }
    renderer.setSize(w, h, false);
    rig.camera.aspect = w / h;
    rig.camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();

  const [data, sand] = await Promise.all([
    loadScene(),
    new THREE.TextureLoader().loadAsync(new URL('../../assets/sand.png', import.meta.url).href),
  ]);
  sand.wrapS = sand.wrapT = THREE.RepeatWrapping;
  sand.colorSpace = THREE.SRGBColorSpace;
  sand.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  world = buildReef(data, sand);
  scene.add(world.reef);
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  function pick(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    mouse.set(2 * (clientX - bounds.left) / bounds.width - 1, 1 - 2 * (clientY - bounds.top) / bounds.height);
    raycaster.setFromCamera(mouse, rig.camera);
    const cameraFactor = -raycaster.ray.direction.clone().transformDirection(rig.camera.matrixWorldInverse).z;
    raycaster.near = rig.camera.near / cameraFactor;
    raycaster.far = rig.camera.far / cameraFactor;
    world.reef.updateMatrixWorld(true);
    const id = pickTreasure(raycaster, world);
    if (game.discover(id)) {
      ui.notify(`Has encontrado un tesoro: ${game.names.get(id)}.`);
      refresh();
    }
  }
  const enableControls = () => bindControls(canvas, rig, { ...actions, pick, escape: () => ui.escape(), blocked: () => ui.blocked() });
  let moveCamera = benchmark ? null : enableControls();
  const buttons = document.querySelectorAll('.scene-actions button,.reset-btn');
  if (benchmark) buttons.forEach(button => { button.disabled = true; });
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    ui.error('El navegador ha perdido el contexto gráfico. Recarga la página para volver a la expedición.');
  });
  document.addEventListener('visibilitychange', () => {
    lastFrame = null;
    if (benchmark && !benchmark.complete) {
      benchmark.restart();
      game.time = 0;
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || contextLost) return;
    const seconds = lastFrame === null ? 0 : Math.max(0, (now - lastFrame) / 1000);
    lastFrame = now;
    // El desplazamiento manual se acota tras una interrupción; el arrecife sigue su reloj real.
    moveCamera?.(Math.min(seconds, .1));
    game.advance(seconds);
    animateGroups(world.groups, game, config.animation);
    water.update(game.time, rig.camera);
    renderer.render(scene, rig.camera);
    if (meter.sample(seconds)) refresh();
    if (game.takeVictory()) ui.victory();
    if (benchmark && !benchmark.complete) {
      const result = benchmark.frame(performance.now() / 1000);
      if (result) {
        result.width = canvas.width;
        result.height = canvas.height;
        canvas.dataset.benchmarkResult = JSON.stringify(result);
        console.info('[Medición]', result);
        ui.notify(`Medición completada. ${result.fps.toFixed(1)} FPS de media en ${result.seconds.toFixed(2)} s (${result.frames} cuadros).`);
        buttons.forEach(button => { button.disabled = false; });
        moveCamera = enableControls();
      }
    }
  }
  requestAnimationFrame(frame);
  ui.notify(benchmark ? `Medición automática de ${benchmark.duration} s tras 5 s de precalentamiento. Mantén la pestaña visible.` : config.welcome);
}

start().catch((error) => {
  console.error(error);
  ui.error('No se pudo abrir el arrecife. Comprueba que el navegador admita WebGL 2 y que los archivos de la escena estén disponibles.');
});
