import * as THREE from 'three';

function place(object, spec) {
  object.position.fromArray(spec.position ?? [0, 0, 0]);
  object.rotation.set(...(spec.rotation ?? [0, 0, 0]));
  object.scale.fromArray(spec.scale ?? [1, 1, 1]);
}

/** Ambos motores leen las mismas mallas indexadas y componen matriz de grupo × matriz local. */
export function buildReef(data, sand = null) {
  const reef = new THREE.Group();
  const groups = new Map();
  const solids = [];
  for (const [id, spec] of Object.entries(data.groups)) {
    const object = new THREE.Group();
    object.name = id;
    place(object, spec);
    reef.add(object);
    groups.set(id, { object, spec });
  }

  const geometries = new Map();
  for (const [id, mesh] of Object.entries(data.meshes)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3));
    if (mesh.colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(mesh.colors, 3));
    if (mesh.uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uvs, 2));
    geometry.setIndex(mesh.indices);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    geometries.set(id, geometry);
  }

  const materials = new Map();
  for (const node of data.nodes) {
    const spec = data.materials[node.material];
    const geometry = geometries.get(node.mesh);
    const vertexColors = geometry.hasAttribute('color');
    const key = `${node.material}-${vertexColors}`;
    if (!materials.has(key)) {
      const opacity = spec.opacity ?? 1;
      const material = new THREE.MeshStandardMaterial({
        color: spec.color, emissive: spec.emissive ?? 0,
        roughness: spec.roughness ?? 0.82, metalness: spec.metalness ?? 0,
        transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
        map: spec.texture === 'sand' ? sand : null, side: THREE.DoubleSide, vertexColors,
      });
      materials.set(key, material);
    }
    const object = new THREE.Mesh(geometry, materials.get(key));
    place(object, node);
    const group = groups.get(node.group);
    (group?.object ?? reef).add(object);
    if (group?.spec.type === 'treasure') object.userData.treasure = node.group;
    if (node.solid !== false) solids.push(object);
  }
  reef.updateMatrixWorld(true);
  return { reef, groups, solids };
}

/** Una roca delante del tesoro gana la prueba de distancia igual que en el búfer de profundidad. */
export function pickTreasure(raycaster, world) {
  const hits = raycaster.intersectObjects(world.solids, false);
  for (const { object } of hits) {
    if (!object.visible || !object.parent.visible) continue;
    return object.userData.treasure ?? null;
  }
  return null;
}
