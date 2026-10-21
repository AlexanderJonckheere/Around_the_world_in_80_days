import * as R from '../constants/rules.js';
import { LANDMARKS } from '../constants/landmarks.js';
import { flight } from './flight.js';

// The route through a level (CLAUDE.md §10): which landmark is the target, and whether it is
// passed, missed or crashed into. Listeners: 'passed', 'complete', 'missed', 'crashed'.
// After a miss or crash the level restarts from the beginning.
let level = null;
let landmarks = [];
let target = 0;
let closest = Infinity;
let flying = false;
const listeners = {};

const emit = (type, detail) => listeners[type]?.forEach((fn) => fn(detail));
const distanceTo = (lm, state) => Math.hypot(lm.x - state.x, lm.z - state.z);

function beginLeg() {
  closest = Infinity;
  flying = true;
}

function end(type, detail) {
  flying = false;
  emit(type, detail);
}

// Below a landmark's top close to it means hitting it
function hitAnyLandmark(state) {
  return landmarks.find((lm) => distanceTo(lm, state) < R.COLLISION_RADIUS && state.altitude < LANDMARKS[lm.type].height);
}

function checkTarget(state) {
  const lm = level.route[target];
  const { name, height } = LANDMARKS[lm.type];
  const d = distanceTo(lm, state);
  closest = Math.min(closest, d);

  if (d < R.PASS_RADIUS) {
    if (state.altitude < height) return end('crashed', { reason: `You flew into the ${name}: you were below its top (${height} m).` });
    if (state.altitude > height + R.TARGET_WINDOW) {
      return end('missed', { name, reason: `You passed over it too high: it stayed hidden under the clouds.` });
    }
    target++;
    if (target === level.route.length) return end('complete', { name });
    beginLeg();
    return emit('passed', { name, next: LANDMARKS[level.route[target].type].name, number: target + 1 });
  }

  if (closest < R.APPROACH_RADIUS && d > closest + R.FLOWN_PAST) {
    end('missed', { name, reason: `You flew past it ${(closest / 1000).toFixed(2)} km away: off course.` });
  }
}

export const progress = {
  on(type, fn) {
    (listeners[type] ??= []).push(fn);
  },

  get target() {
    return level?.route[target] ?? null;
  },
  get flying() {
    return flying;
  },

  // Starts (or restarts) the level from its departure, with the stopwatch already running
  start(newLevel) {
    level = newLevel;
    landmarks = level.route;
    target = 0;
    flight.load(level);
    flight.startStopwatch();
    beginLeg();
  },
  // Dev: make a landmark of the route the target (e.g. after teleporting to it)
  setTarget(index) {
    target = index;
    closest = Infinity;
  },
  stop() {
    flying = false;
  },

  update(state) {
    if (!flying) return;
    if (state.altitude <= R.CRASH_ALTITUDE) return end('crashed', { reason: 'You sank into the clouds and hit the hidden ground.' });
    const hit = hitAnyLandmark(state);
    if (hit) return end('crashed', { reason: `You flew into the ${LANDMARKS[hit.type].name}.` });
    checkTarget(state);
  },

  // 0 = safe, 1 = at the crash altitude
  lowWarning(state) {
    return Math.min(Math.max(1 - (state.altitude - R.CRASH_ALTITUDE) / R.LOW_WARNING, 0), 1);
  },
};
