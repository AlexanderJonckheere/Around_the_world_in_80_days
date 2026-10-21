// Keyboard + pointer state. Pointer is normalised to [-1, 1] (NDC).
export class Input {
  constructor(dom) {
    this.keys = new Set();
    this.pointer = { x: 0, y: 0 };
    this.listeners = {};

    // Typing in a text field (the notebook blanks) must not steer, burn or toggle anything
    const typing = (e) => e.target instanceof HTMLInputElement;

    window.addEventListener('keydown', (e) => {
      if (e.repeat || typing(e)) return;
      this.keys.add(e.code);
      this.emit('keydown', e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    dom.addEventListener('pointermove', (e) => {
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    dom.addEventListener('pointerdown', (e) => this.emit('pointerdown', e));
    // On window, so a drag keeps working (and ends) when the pointer leaves the canvas
    window.addEventListener('pointermove', (e) => this.emit('pointermove', e));
    window.addEventListener('pointerup', (e) => this.emit('pointerup', e));
  }

  isDown(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  on(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }

  emit(type, e) {
    this.listeners[type]?.forEach((fn) => fn(e));
  }
}
