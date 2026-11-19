import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildReef, pickTreasure } from '../world.js';
import { ReefCamera } from '../camera.js';
import { SearchGame } from '../game.js';
import { animateGroups } from '../animation.js';

function loadShared(name) {
  return JSON.parse(readFileSync(new URL(`../../../shared/${name}.json`, import.meta.url)));
}

// Centros y puntos interiores de triángulos dan candidatos reales para clics cerca de los bordes.
function samples(group) {
  const points = [];
  const vertex = new THREE.Vector3();
  for (const mesh of group.children) {
    const geometry = mesh.geometry;
    points.push(geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
    const index = geometry.index, attribute = geometry.getAttribute('position');
    const stride = 3 * Math.max(1, Math.floor(index.count / (3 * 12)));
    for (let i = 0; i < index.count; i += stride) {
      const point = new THREE.Vector3();
      for (let j = i; j < i + 3; j++) point.add(vertex.fromBufferAttribute(attribute, index.getX(j)));
      points.push(point.divideScalar(3).applyMatrix4(mesh.matrixWorld));
    }
  }
  return points;
}

function findAccessibleClick(id, world, rig) {
  const ray = new THREE.Raycaster();
  const group = world.groups.get(id).object;
  const points = samples(group);
  const camera = rig.camera;
  function findClick() {
    for (const point of points) {
      const projected = point.clone().project(camera);
      if (Math.max(Math.abs(projected.x), Math.abs(projected.y), Math.abs(projected.z)) >= 1) continue;
      ray.setFromCamera(projected, camera);
      if (pickTreasure(ray, world) === id) return true;
    }
    return false;
  }
  rig.reset();
  if (findClick()) return true;
  // Los puntos de observación se obtienen usando sólo los mismos movimientos que en el juego.
  rig.pan(group.position.x - rig.target.x, rig.target.z - group.position.z);
  rig.dolly(0.5);
  for (const pitch of [0.25, 0.65, 1]) {
    rig.rotate(0, (pitch - rig.pitch) / rig.config.rotateSpeed);
    for (let n = 0; n < 8; n++) {
      if (findClick()) return true;
      rig.rotate(Math.PI / 4 / rig.config.rotateSpeed, 0);
    }
  }
  return false;
}

test('cinco clics sin obstrucción desde cámaras alcanzables en el arrecife real', (t) => {
  const config = loadShared('settings');
  const world = buildReef(loadShared('reef'));
  const rig = new ReefCamera(config.camera);
  rig.camera.aspect = 16 / 9;
  rig.camera.updateProjectionMatrix();
  const game = new SearchGame(config.treasures, config.animation.discoverySeconds);
  for (const { id } of config.treasures) {
    animateGroups(world.groups, game, config.animation);
    world.reef.updateMatrixWorld(true);
    assert.ok(findAccessibleClick(id, world, rig), `Tesoro inaccesible: ${id}`);
    assert.ok(game.discover(id));
    t.diagnostic(`Clic en ${id} desde (${rig.camera.position.toArray().map(v => v.toFixed(1)).join(', ')}).`);
    game.advance(game.duration);
  }
  assert.ok(game.takeVictory());
});
