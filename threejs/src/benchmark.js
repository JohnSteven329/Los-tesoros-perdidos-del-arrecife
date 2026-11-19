/** Los tiempos proceden del reloj monotónico del navegador y se expresan en segundos. */
export class Benchmark {
  constructor(seconds) {
    this.duration = seconds;
    this.complete = false;
    this.restart();
  }

  restart() {
    this.warmup = null;
    this.start = null;
    this.frames = 0;
  }

  frame(time) {
    if (this.complete) return null;
    this.warmup ??= time;
    if (time - this.warmup < 5) return null;
    if (this.start === null) {
      this.start = time;
      return null;
    }
    this.frames++;
    const seconds = time - this.start;
    if (seconds < this.duration) return null;
    this.complete = true;
    return { frames: this.frames, seconds, fps: this.frames / seconds };
  }
}

export function readBenchmark(query) {
  const seconds = Number(new URLSearchParams(query).get('benchmark'));
  return seconds >= 1 && seconds <= 300 ? new Benchmark(seconds) : null;
}
