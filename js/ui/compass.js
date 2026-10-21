import { createToggle } from './toggle.js';
import { createDial, drawBezel, drawScale, deg } from './dial.js';
import { DIAL } from '../constants/colors.js';

// Compass widget (bottom-left). Like the 3D compass, the card itself points north and swings
// before it settles; the heading is read at the fixed red mark at the top.
const CARDINALS = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
const SCALE = {
  min: 0, max: 360, from: -90, to: 270, fine: 5, minor: 10, major: 30,
  skipLast: true, radial: true, label: (v) => CARDINALS[v] ?? String(v),
};

const { el, open, close, toggle, isOpen } = createToggle('.widget--compass');
export { open, close, toggle, isOpen };

const dial = createDial(el.querySelector('canvas'), (ctx, size) => {
  drawBezel(ctx, size);
  drawScale(ctx, size, SCALE);
});

function drawLubberMark(ctx, size) {
  const c = size / 2;
  ctx.fillStyle = DIAL.needle;
  ctx.beginPath();
  ctx.moveTo(c, size * 0.13);
  ctx.lineTo(c - size * 0.03, size * 0.02);
  ctx.lineTo(c + size * 0.03, size * 0.02);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = DIAL.hub;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.025, 0, Math.PI * 2);
  ctx.fill();
}

export function update(readings) {
  // Card turns the opposite way to the balloon, so the heading ends up under the top mark
  dial.draw(drawLubberMark, deg(-readings.heading));
}
