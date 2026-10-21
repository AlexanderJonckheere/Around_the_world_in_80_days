import { createToggle } from './toggle.js';
import { createDial, drawBezel, drawScale, drawLabel, drawNeedle, angleOf } from './dial.js';
import { BAROMETER_RANGE } from '../constants/rules.js';

// Barometer widget (top-left). Shows pressure only; the player converts it to height in the notebook.
const SCALE = { min: BAROMETER_RANGE[0], max: BAROMETER_RANGE[1], from: 135, to: 405, fine: 2, minor: 10, major: 20 };

const { el, open, close, toggle, isOpen } = createToggle('.widget--barometer');
export { open, close, toggle, isOpen };

const dial = createDial(el.querySelector('canvas'), (ctx, size) => {
  drawBezel(ctx, size);
  drawScale(ctx, size, SCALE);
  drawLabel(ctx, size, 'hPa', size * 0.66);
  drawLabel(ctx, size, 'Barometer', size * 0.78, 0.05);
});

export function update(readings) {
  dial.draw((ctx, size) => drawNeedle(ctx, size / 2, size / 2, angleOf(readings.pressure, SCALE), size * 0.36));
}
