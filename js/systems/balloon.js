import * as C from '../constants/rules.js';

const BURNER_COOLDOWN = 0.7; // 1/s, how fast the burner glow fades after letting go
const STORM_GUST_RATE = 0.12; // gusts per second: the storm's turning swells and fades every ~8 s
const LIFT_RESPONSE = 0.8; // 1/s, sandbag lift is eased in over a few seconds (CLAUDE.md §9)

// Balloon state + physics. Positions in metres, x = east, z = south (Three.js convention).
export class Balloon {
  constructor({ heading = 0, altitude = 500, speed = 60, x = 0, z = 0, sandbags = 3 } = {}) {
    this.heading = heading; // degrees, 0 = north, clockwise
    this.altitude = altitude; // true altitude, never shown directly
    this.speed = speed; // km/h ground speed
    this.x = x;
    this.z = z;
    this.sandbags = sandbags;
    this.referencePressure = C.REFERENCE_PRESSURE;

    // Control inputs, set by the flight system every frame
    this.rudder = 0; // -1 full left … 0 centre … +1 full right; partial values turn slower
    this.burner = 0; // 0 off … 1 fully pulled
    this.vent = 0; // 0 closed … 1 fully pulled
    this.throttle = 0; // -1 slowing down … 0 neutral (hold speed) … +1 speeding up

    this.pendingLift = 0; // sandbag metres still to be applied
    this.burnerHeat = 0; // 0..1 visual intensity of the burner glow
    this.storm = 0; // 0..1 how deep in a storm the balloon is (set by the flight system)
    this.stormTime = 0; // drives the gusts
  }

  get pressure() {
    return C.pressureFromHeight(this.altitude, this.referencePressure);
  }

  dropSandbag() {
    if (this.sandbags <= 0) return false;
    this.sandbags--;
    this.pendingLift += C.SANDBAG_LIFT;
    return true;
  }

  // At a limit, sandbag lift still waiting in that direction is lost
  clampAltitude() {
    if (this.altitude >= C.MAX_ALTITUDE) {
      this.altitude = C.MAX_ALTITUDE;
      this.pendingLift = Math.min(this.pendingLift, 0);
    } else if (this.altitude <= C.MIN_ALTITUDE) {
      this.altitude = C.MIN_ALTITUDE;
      this.pendingLift = Math.max(this.pendingLift, 0);
    }
  }

  update(dt) {
    this.burnerHeat = Math.max(this.burner, this.burnerHeat - dt * BURNER_COOLDOWN);

    // Turning: the rudder, plus a storm that keeps swinging the balloon round in gusts
    this.stormTime += dt;
    const gust = 0.6 + 0.4 * Math.sin(this.stormTime * STORM_GUST_RATE * Math.PI * 2);
    const spin = this.storm * C.STORM_SPIN_RATE * gust;
    this.heading = (this.heading + (this.rudder * C.TURN_RATE + spin) * dt + 360) % 360;

    // Vertical: burner and vent work at a rate while held; constant sink, more in a storm
    const sink = C.SINK_RATE + this.storm * C.STORM_SINK_RATE;
    const climbRate = this.burner * C.BURNER_RATE - this.vent * C.VENT_RATE - sink;
    const liftStep = this.pendingLift * Math.min(1, dt * LIFT_RESPONSE);
    this.pendingLift -= liftStep;
    this.altitude += climbRate * dt + liftStep;
    this.clampAltitude();

    // Speed handle: speeds up or slows down while pushed; at neutral the speed settles on the nearest
    // multiple of SPEED_SNAP (at the same gentle rate) and holds it
    const change = C.SPEED_ACCEL * dt;
    if (this.throttle !== 0) {
      this.speed += this.throttle * change;
    } else {
      const snapped = Math.round(this.speed / C.SPEED_SNAP) * C.SPEED_SNAP;
      this.speed += Math.max(-change, Math.min(change, snapped - this.speed));
    }
    this.speed = Math.min(C.SPEED_MAX, Math.max(C.SPEED_MIN, this.speed));

    // Horizontal movement
    const metresPerSecond = (this.speed * 1000) / 3600;
    const rad = (this.heading * Math.PI) / 180;
    this.x += Math.sin(rad) * metresPerSecond * dt;
    this.z -= Math.cos(rad) * metresPerSecond * dt;
  }
}
