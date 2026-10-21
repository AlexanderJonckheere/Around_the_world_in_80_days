import { Balloon } from './balloon.js';
import { Stopwatch } from './stopwatch.js';
import { stormStrength } from './storms.js';

// The single source of truth for the flight (CLAUDE.md §4). UI and controls only change it through
// these functions; instruments and widgets only read `flight.state` and `flight.stopwatch`.
let balloon = new Balloon();
const stopwatch = new Stopwatch();
let timeScale = 1;
let storms = [];

// Each control can be driven by the keyboard and by dragging the 3D object; the inputs add up
const inputs = {
  rudder: { keys: 0, drag: 0 },
  burner: { keys: 0, drag: 0 },
  vent: { keys: 0, drag: 0 },
  throttle: { keys: 0, drag: 0 },
};
const LIMITS = { rudder: [-1, 1], burner: [0, 1], vent: [0, 1], throttle: [-1, 1] };

const combined = (control) => {
  const [min, max] = LIMITS[control];
  const sum = inputs[control].keys + inputs[control].drag;
  return Math.max(min, Math.min(max, sum));
};

export const flight = {
  get state() {
    return balloon;
  },
  get stopwatch() {
    return stopwatch;
  },

  load(level) {
    storms = level.storms ?? [];
    balloon = new Balloon(level.start);
    balloon.referencePressure = level.referencePressure;
    stopwatch.stop();
    stopwatch.reset();
  },

  // control: 'rudder' | 'burner' | 'vent' | 'throttle';  source: 'keys' | 'drag'
  setInput(control, source, value) {
    inputs[control][source] = value;
  },
  startStopwatch() {
    stopwatch.start();
  },
  // Dev: run the whole flight faster (movement, turning, sink, burner, vent and the stopwatch alike,
  // so every notebook calculation still holds)
  setTimeScale(scale) {
    timeScale = scale;
  },
  get timeScale() {
    return timeScale;
  },
  toggleStopwatch() {
    stopwatch.toggle();
  },
  resetStopwatch() {
    stopwatch.reset();
  },

  update(realDt) {
    const dt = realDt * timeScale;
    balloon.rudder = combined('rudder');
    balloon.burner = combined('burner');
    balloon.vent = combined('vent');
    balloon.throttle = combined('throttle');
    balloon.storm = stormStrength(storms, balloon.x, balloon.z);
    balloon.update(dt);
    stopwatch.update(dt);
  },
};
