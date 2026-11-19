import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { SearchGame, FrameMeter } from '../game.js';
import { ReefCamera } from '../camera.js';
import { animateGroups } from '../animation.js';
import { pickTreasure } from '../world.js';
import { readBenchmark } from '../benchmark.js';

const config = JSON.parse(readFileSync(new URL('../../../shared/settings.json', import.meta.url)));
const newGame = () => new SearchGame(config.treasures, config.animation.discoverySeconds);

test('medición de 1 s tras 5 s visibles, sin mezclar un intervalo interrumpido', () => {
  for (const value of ['', '?benchmark=0', '?benchmark=301', '?benchmark=x']) assert.equal(readBenchmark(value), null);
  const run = readBenchmark('?benchmark=1');
  run.frame(0); run.frame(5); run.frame(5.9); run.restart();
  for (const t of [10, 14.9, 15, 15.25, 15.5, 15.75]) assert.equal(run.frame(t), null);
  assert.deepEqual(run.frame(16), { frames: 4, seconds: 1, fps: 4 });
  assert.equal(run.frame(16.1), null);
});

test('la roca más cercana oculta el tesoro, incluso si aparece después en la lista', () => {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  const rock = new THREE.Mesh(box, material), treasure = new THREE.Mesh(box, material);
  treasure.userData.treasure = 'compass';
  rock.position.z = 2;
  const group = new THREE.Group();
  group.add(rock, treasure);
  group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 4), new THREE.Vector3(0, 0, -1));
  const world = { solids: [treasure, rock] };
  assert.equal(pickTreasure(ray, world), null);
  rock.position.x = 3;
  group.updateMatrixWorld(true);
  assert.equal(pickTreasure(ray, world), 'compass');
});

test('hallazgos únicos, victoria única tras la animación, reinicio completo', () => {
  const game = newGame();
  assert.equal(game.discover('roca'), false);
  for (const { id } of config.treasures) {
    assert.equal(game.discover(id), true);
    assert.equal(game.discover(id), false);
  }
  game.paused = true;
  game.light = 1;
  assert.equal(game.takeVictory(), false);
  game.advance(config.animation.discoverySeconds);
  assert.equal(game.time, 0);
  assert.equal(game.takeVictory(), true);
  assert.equal(game.takeVictory(), false);
  game.reset();
  assert.deepEqual([game.found.size, game.discoveries.size, game.paused, game.light], [0, 0, false, 0]);
  assert.equal(game.discover('compass'), true);
});

test('desplazamiento, órbita y zoom respetan los límites', () => {
  const rig = new ReefCamera(config.camera);
  rig.pan(1e4, 1e4);
  assert.equal(rig.target.x, config.camera.targetXRange[1]);
  assert.equal(rig.target.z, config.camera.targetZRange[0]);
  rig.rotate(200, -1e4);
  rig.dolly(.0001);
  assert.equal(rig.distance, config.camera.distanceRange[0]);
  assert.equal(rig.pitch, config.camera.pitchRange[0]);
  assert.ok(rig.camera.position.y > rig.target.y);
  rig.reset();
  assert.deepEqual(rig.target.toArray(), config.camera.target);
});

test('el promedio FPS usa cuadros y segundos reales', () => {
  const meter = new FrameMeter();
  for (let i = 0; i < 30; i++) meter.sample(1 / 30);
  for (let i = 0; i < 10; i++) meter.sample(.1);
  meter.sample(.5);
  assert.ok(Math.abs(meter.average - 41 / 2.5) < .00001);
  meter.reset();
  assert.equal(meter.average, 0);
});

test('un tesoro crece, gira, se oculta y reaparece al reiniciar', () => {
  const game = newGame();
  const object = new THREE.Group();
  const groups = new Map([['coin', { object, spec: { type: 'treasure', position: [0, 0, 0] } }]]);
  game.discover('coin');
  game.advance(game.duration / 2);
  animateGroups(groups, game, config.animation);
  assert.equal(object.scale.x, 1.35);
  assert.equal(object.rotation.y, Math.PI);
  game.advance(game.duration / 2);
  animateGroups(groups, game, config.animation);
  assert.equal(object.visible, false);
  game.reset();
  animateGroups(groups, game, config.animation);
  assert.equal(object.visible, true);
  assert.equal(object.rotation.y, 0);
});
