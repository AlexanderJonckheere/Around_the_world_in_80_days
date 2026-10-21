import { createToggle } from './toggle.js';
import { createDial, drawBezel, drawScale, drawLabel, drawNeedle, angleOf } from './dial.js';
import { SPEEDOMETER_RANGE } from '../constants/rules.js';

// Speedometer widget (right edge, below the stopwatch): ground speed for the travel-time formula.
const SCALE = { min: SPEEDOMETER_RANGE[0], max: SPEEDOMETER_RANGE[1], from: 135, to: 405, fine: 2, minor: 10, major: 20 };

const { el, open, close, toggle, isOpen } = createToggle('.widget--speedometer');
export { open, close, toggle, isOpen };

const dial = createDial(el.querySelector('canvas'), (ctx, size) => {
  drawBezel(ctx, size);
  drawScale(ctx, size, SCALE);
  drawLabel(ctx, size, 'km/h', size * 0.66);
  drawLabel(ctx, size, 'Ground speed', size * 0.78, 0.05);
});

export function update(readings) {
  dial.draw((ctx, size) => drawNeedle(ctx, size / 2, size / 2, angleOf(readings.speed, SCALE), size * 0.36));
}
