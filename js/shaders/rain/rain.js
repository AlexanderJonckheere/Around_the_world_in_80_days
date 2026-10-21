import { wgslFn, vec2, time, atan, length } from 'three/tsl';
import rainCode from './fragment.wgsl?raw';

// Heartfelt's drops (fragment.wgsl), placed on the window glass. The glass position comes from the
// viewing direction in the cabin (angle around the seat, and height), not from the screen, so the
// drops stay put on the glass when you look around or the cabin sways, like the clouds do.
const rainDrops = wgslFn(rainCode);
const TIME_SCALE = 0.2; // Heartfelt: t = iTime * .2
const GLASS_SCALE = 1 / 1.27; // ≈ 1 unit per screen height at the 65° field of view, like Shadertoy's uv
const DROP_SCALE = 2.5; // > 1: smaller drops than Heartfelt (all drops)
const FALL_SCALE = 2.2; // extra for the running drops, which are much bigger in Heartfelt

// cabinDir: the pixel's viewing direction in the cabin (scene) frame; the cabin faces -Z
export function windowRain(cabinDir, amount) {
  const around = atan(cabinDir.x, cabinDir.z.negate());
  const up = cabinDir.y.div(length(vec2(cabinDir.x, cabinDir.z)));
  const uv = vec2(around, up).mul(GLASS_SCALE * DROP_SCALE);
  return rainDrops({ uv, t: time.mul(TIME_SCALE), amount, fallScale: FALL_SCALE });
}
