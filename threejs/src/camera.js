import * as THREE from 'three';

const bound = (value, range) => Math.max(range[0], Math.min(range[1], value));

export class ReefCamera {
  constructor(config) {
    this.config = config;
    this.camera = new THREE.PerspectiveCamera(config.fov, 1, config.near, config.far);
    this.target = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.target.fromArray(this.config.target);
    this.distance = this.config.distance;
    this.yaw = this.config.yaw;
    this.pitch = this.config.pitch;
    this.apply();
  }

  rotate(dx, dy) {
    this.yaw -= dx * this.config.rotateSpeed;
    this.pitch = bound(this.pitch + dy * this.config.rotateSpeed, this.config.pitchRange);
    this.apply();
  }

  dolly(factor) {
    this.distance = bound(this.distance * factor, this.config.distanceRange);
    this.apply();
  }

  pan(right, forward) {
    const x = right * Math.cos(this.yaw) - forward * Math.sin(this.yaw);
    const z = -right * Math.sin(this.yaw) - forward * Math.cos(this.yaw);
    this.target.x = bound(this.target.x + x, this.config.targetXRange);
    this.target.z = bound(this.target.z + z, this.config.targetZRange);
    this.apply();
  }

  apply() {
    const horizontal = this.distance * Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + horizontal * Math.sin(this.yaw),
      this.target.y + this.distance * Math.sin(this.pitch),
      this.target.z + horizontal * Math.cos(this.yaw),
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld(true);
  }
}

/** Umbral en píxeles CSS: una órbita o una pinza nunca recoge el tesoro al soltar. */
export function bindControls(canvas, rig, actions) {
  const held = new Set();
  const pointers = new Map();
  const moves = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  let pinch;

  function clear() {
    held.clear();
    pointers.clear();
    pinch = null;
  }

  function pair() {
    const [a, b] = pointers.values();
    return { gap: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || actions.blocked()) return;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragged: false });
    if (pointers.size >= 2) {
      for (const p of pointers.values()) p.dragged = true;
      pinch = pair();
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    const p = pointers.get(event.pointerId);
    if (!p || actions.blocked()) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    p.x = event.clientX;
    p.y = event.clientY;
    p.dragged ||= Math.hypot(p.x - p.startX, p.y - p.startY) >= 5;
    if (pointers.size >= 2) {
      const next = pair();
      rig.dolly(pinch.gap / next.gap);
      const units = 2 * rig.distance * Math.tan(THREE.MathUtils.degToRad(rig.config.fov / 2)) / canvas.clientHeight;
      rig.pan((pinch.x - next.x) * units, (next.y - pinch.y) * units);
      pinch = next;
    } else if (p.dragged) {
      rig.rotate(dx, dy);
    }
  });

  canvas.addEventListener('pointerup', (event) => {
    const p = pointers.get(event.pointerId);
    if (p && !p.dragged && !actions.blocked()) actions.pick(event.clientX, event.clientY);
    pointers.delete(event.pointerId);
    pinch = pointers.size >= 2 ? pair() : null;
  });
  function cancelPointer(event) {
    pointers.delete(event.pointerId);
    pinch = pointers.size >= 2 ? pair() : null;
  }
  canvas.addEventListener('pointercancel', cancelPointer);
  canvas.addEventListener('lostpointercapture', cancelPointer);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (actions.blocked()) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    const step = THREE.MathUtils.clamp(event.deltaY * unit / 100, -5, 5);
    rig.dolly(Math.exp(step * rig.config.zoomFactor));
  }, { passive: false });

  const shortcuts = { KeyP: actions.pause, KeyL: actions.light };
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.code === 'Escape' && !event.repeat) {
      event.preventDefault();
      actions.escape();
    } else if (event.code === 'KeyR' && !event.repeat) {
      event.preventDefault();
      actions.reset();
    } else if (!actions.blocked()) {
      if (moves.includes(event.code)) {
        event.preventDefault();
        held.add(event.code);
      } else if (Object.hasOwn(shortcuts, event.code) && !event.repeat) {
        event.preventDefault();
        shortcuts[event.code]();
      }
    }
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);

  return (delta) => {
    if (!held.size || actions.blocked()) return;
    const right = Number(held.has('KeyD')) - Number(held.has('KeyA'));
    const forward = Number(held.has('KeyW')) - Number(held.has('KeyS'));
    const step = rig.config.panSpeed * delta / Math.max(1, Math.hypot(right, forward));
    rig.pan(right * step, forward * step);
  };
}
