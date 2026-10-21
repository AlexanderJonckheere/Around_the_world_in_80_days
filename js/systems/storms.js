import { STORM_EDGE } from '../constants/rules.js';

// How strongly the storms act at a spot: 0 outside, rising smoothly to 1 across the outer
// STORM_EDGE metres (smoothstep, so the flight model and the visuals ease in together).
export function stormStrength(storms, x, z) {
  let strength = 0;
  for (const s of storms) {
    const inside = (s.radius - Math.hypot(x - s.x, z - s.z)) / STORM_EDGE;
    const t = Math.min(Math.max(inside, 0), 1);
    strength = Math.max(strength, t * t * (3 - 2 * t));
  }
  return strength;
}
