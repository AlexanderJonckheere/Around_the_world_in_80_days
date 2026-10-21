import { createToggle } from './toggle.js';
import { createDial, drawBezel, drawScale, drawNeedle, angleOf, deg } from './dial.js';
import { DIAL } from '../constants/colors.js';
import { flight } from '../systems/flight.js';

// Stopwatch widget (top-right). Keeps running while closed, because the flight's stopwatch does.
const SECONDS = { min: 0, max: 60, from: -90, to: 270, fine: 1, minor: 5, major: 5, skipLast: true, label: (v) => String(v || 60) };
const MINUTES_ON_DIAL = 30;
const SUBDIAL = { y: 0.66, radius: 0.12 }; // fractions of the dial size

const { el, open, close, toggle, isOpen } = createToggle('.widget--stopwatch');
export { open, close, toggle, isOpen };

const startButton = el.querySelector('.js-start');
const readout = el.querySelector('.js-readout');
startButton.addEventListener('click', () => flight.toggleStopwatch());
el.querySelector('.js-reset').addEventListener('click', () => flight.resetStopwatch());

function drawSubdial(ctx, size) {
  const cx = size / 2;
  const cy = size * SUBDIAL.y;
  const r = size * SUBDIAL.radius;
  ctx.strokeStyle = DIAL.ink;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let m = 0; m < MINUTES_ON_DIAL; m += 5) {
    const a = deg(-90 + (m / MINUTES_ON_DIAL) * 360);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75);
    ctx.stroke();
  }
}

const dial = createDial(el.querySelector('canvas'), (ctx, size) => {
  drawBezel(ctx, size);
  drawScale(ctx, size, SECONDS);
  drawSubdial(ctx, size);
});

export function update(_readings, stopwatch) {
  const t = stopwatch.elapsed;
  dial.draw((ctx, size) => {
    const minutes = (t / 60) % MINUTES_ON_DIAL;
    drawNeedle(ctx, size / 2, size * SUBDIAL.y, deg(-90 + (minutes / MINUTES_ON_DIAL) * 360), size * SUBDIAL.radius * 0.85, { width: 1.5, color: DIAL.hub });
    drawNeedle(ctx, size / 2, size / 2, angleOf(t % 60, SECONDS), size * 0.38, { width: 2 });
  });
  readout.textContent = stopwatch.format();
  startButton.textContent = stopwatch.running ? 'Stop' : 'Start';
}
