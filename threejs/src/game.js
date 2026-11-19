/** Estado independiente del motor gráfico. El reloj ambiental se puede detener. */
export class SearchGame {
  constructor(treasures, duration) {
    this.names = new Map(treasures.map(({ id, name }) => [id, name]));
    this.duration = duration;
    this.reset();
  }

  reset() {
    this.found = new Set();
    this.discoveries = new Map();
    this.paused = false;
    this.light = 0;
    this.time = 0;
    this.victoryShown = false;
  }

  discover(id) {
    if (!this.names.has(id) || this.found.has(id)) return false;
    this.found.add(id);
    this.discoveries.set(id, 0);
    return true;
  }

  advance(delta) {
    if (!this.paused) this.time += delta;
    for (const [id, seconds] of this.discoveries) {
      const next = seconds + delta;
      if (next >= this.duration) this.discoveries.delete(id);
      else this.discoveries.set(id, next);
    }
  }

  takeVictory() {
    if (this.victoryShown || this.found.size !== this.names.size || this.discoveries.size) {
      return false;
    }
    this.victoryShown = true;
    return true;
  }
}

/** FPS de presentación: cuadros / tiempo real, independientemente del delta de simulación. */
export class FrameMeter {
  constructor() { this.reset(); }

  reset() {
    this.frames = 0;
    this.seconds = 0;
    this.windowFrames = 0;
    this.windowTime = 0;
    this.fps = 0;
    this.average = 0;
  }

  sample(seconds) {
    if (seconds <= 0) return false;
    this.frames++;
    this.seconds += seconds;
    this.windowFrames++;
    this.windowTime += seconds;
    if (this.windowTime < 0.5) return false;
    this.fps = this.windowFrames / this.windowTime;
    this.average = this.frames / this.seconds;
    this.windowFrames = 0;
    this.windowTime = 0;
    return true;
  }
}
