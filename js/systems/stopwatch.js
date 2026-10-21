export class Stopwatch {
  constructor() {
    this.elapsed = 0;
    this.running = false;
  }

  start() { this.running = true; }
  stop() { this.running = false; }
  toggle() { this.running = !this.running; }
  reset() { this.elapsed = 0; }

  update(dt) {
    if (this.running) this.elapsed += dt;
  }

  format() {
    const m = Math.floor(this.elapsed / 60);
    const s = Math.floor(this.elapsed % 60);
    const t = Math.floor((this.elapsed % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${t}`;
  }
}
