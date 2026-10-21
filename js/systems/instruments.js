// What the instruments *show*. Real gauges lag behind the truth, and both the 3D needles and the
// 2D widgets read these values, so they always agree.
const PRESSURE_RESPONSE = 2; // 1/s, how fast the barometer needle follows the real pressure
const COMPASS_STIFFNESS = 6; // spring towards the true heading
const COMPASS_DAMPING = 1.5; // lower = more swinging before it settles
const SPEED_WOBBLE = 0.4; // km/h
const SPEED_WOBBLE_RATE = 3; // rad/s

export const readings = {
  pressure: null,
  speed: 0,
  heading: 0,
  headingVelocity: 0,
};

let time = 0;

export function updateReadings(dt, state) {
  time += dt;

  readings.pressure ??= state.pressure;
  readings.pressure += (state.pressure - readings.pressure) * Math.min(1, dt * PRESSURE_RESPONSE);

  readings.speed = state.speed + Math.sin(time * SPEED_WOBBLE_RATE) * SPEED_WOBBLE;

  // Damped spring, taking the short way round (e.g. 350° → 10°)
  const diff = ((state.heading - readings.heading + 540) % 360) - 180;
  readings.headingVelocity += diff * COMPASS_STIFFNESS * dt;
  readings.headingVelocity *= Math.exp(-COMPASS_DAMPING * dt);
  readings.heading = (readings.heading + readings.headingVelocity * dt + 360) % 360;
}
