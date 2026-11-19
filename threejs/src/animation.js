/** Las trayectorias y fases se expresan en segundos y se comparten con la versión de escritorio. */
export function animateGroups(groups, game, cfg) {
  for (const [id, { object, spec }] of groups) {
    const [x, y, z] = spec.position;
    const phase = spec.phase ?? 0;
    const rotation = spec.rotation ?? [0, 0, 0];
    const scale = spec.scale ?? [1, 1, 1];
    switch (spec.type) {
      case 'fish': {
        const angle = phase + game.time * cfg.fishSpeed;
        const sin = Math.sin(angle), cos = Math.cos(angle);
        object.position.set(x + cfg.fishX * sin, y + cfg.fishY * Math.sin(2 * angle), z + cfg.fishZ * cos);
        object.rotation.y = rotation[1] + Math.atan2(cfg.fishZ * sin, cfg.fishX * cos);
        break;
      }
      case 'bubble': {
        const u = ((phase + game.time * cfg.bubbleSpeed) % cfg.bubbleHeight) / cfg.bubbleHeight;
        object.position.y = y + u * cfg.bubbleHeight;
        object.scale.fromArray(scale).multiplyScalar(1 + cfg.bubbleGrowth * u);
        break;
      }
      case 'plant':
        object.rotation.z = rotation[2] + cfg.plantAngle * Math.sin(phase + game.time * cfg.plantSpeed);
        break;
      case 'treasure': {
        const elapsed = game.discoveries.get(id);
        const u = elapsed === undefined ? 0 : elapsed / cfg.discoverySeconds;
        object.visible = !game.found.has(id) || elapsed !== undefined;
        object.rotation.y = rotation[1] + Math.PI * 2 * u;
        object.scale.fromArray(scale).multiplyScalar(1 + .35 * Math.sin(Math.PI * u));
        break;
      }
    }
  }
}
