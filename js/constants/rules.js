// Game values (CLAUDE.md §9). The notebook's rules page is generated from this file,
// so the rules shown and the rules used can never differ.

export const REFERENCE_PRESSURE = 1013; // hPa

// Barometric formula: h = 44330 × (1 − (P / P₀)^0.1903)
export const BAROMETRIC_SCALE = 44330; // m
export const BAROMETRIC_EXPONENT = 0.1903;

export const TURN_RATE = 3; // degrees per second while rudder is held
export const SINK_RATE = 2; // metres per second, constant

export const BURNER_RATE = 20; // m per second while the burner is fully held
export const SANDBAG_LIFT = 150; // m per bag
export const VENT_RATE = 10; // m per second while the vent is fully held

// Speed handle: push it forward to speed up, pull it back to slow down. Let go and it springs back
// to neutral; the balloon settles on the nearest multiple of SPEED_SNAP and holds it, so travel
// times stay easy to work out. The speedometer shows the speed.
export const SPEED_MIN = 30; // km/h
export const SPEED_MAX = 90; // km/h
export const SPEED_ACCEL = 2; // km/h per second at full push (less for a partial push)
export const SPEED_SNAP = 5; // km/h: at neutral the speed settles on a multiple of this

export const TARGET_WINDOW = 100; // m above landmark height

// The cloud deck stays at this height, so it works as a visual height reference.
// Below the lowest landmark top (windmill, 90 m), so every landmark pokes through.
export const CLOUD_TOP_ALTITUDE = 60; // m

// Altitude limits. Sinking into the cloud deck is a crash (hidden terrain below); the balloon can't
// climb past the ceiling.
export const MIN_ALTITUDE = CLOUD_TOP_ALTITUDE; // m
export const CRASH_ALTITUDE = CLOUD_TOP_ALTITUDE; // m
export const LOW_WARNING = 100; // m above the crash altitude where the red warning light starts
export const MAX_ALTITUDE = 1500; // m

// Passing a landmark (CLAUDE.md §10): within PASS_RADIUS horizontally, inside its target window.
// Below the window is a crash; above it, or flying past further away, is a miss.
export const PASS_RADIUS = 250; // m
export const FLOWN_PAST = 300; // m further away than the closest approach: you went past it
export const APPROACH_RADIUS = 1500; // m, "flown past" only counts once you were this close
export const COLLISION_RADIUS = 40; // m, hitting any other landmark below its top

// Storms (CLAUDE.md §10 levels): areas on the map to fly around. Their effect grows smoothly over
// the outer STORM_EDGE metres, so entering one is never a sudden jolt.
export const STORM_EDGE = 350; // m
export const STORM_SINK_RATE = 8; // m/s extra sinking at the heart of a storm
export const STORM_SPIN_RATE = 1.2; // °/s the storm turns the balloon at most (in gusts); well below TURN_RATE, so you can always steer against it

// Values at the start and end of the needle sweep in cabin.glb. Match these to the printed dials.
export const BAROMETER_RANGE = [830, 1030]; // hPa
export const SPEEDOMETER_RANGE = [0, 120]; // km/h

const SECONDS_PER_HOUR = 3600;

// Formulas (§9). pressureFromHeight is the exact inverse of heightFromPressure, so a player who
// reads the barometer and uses the notebook formula gets the true altitude.
export const heightFromPressure = (pressure, ref = REFERENCE_PRESSURE) =>
  BAROMETRIC_SCALE * (1 - (pressure / ref) ** BAROMETRIC_EXPONENT);
export const pressureFromHeight = (height, ref = REFERENCE_PRESSURE) =>
  ref * (1 - height / BAROMETRIC_SCALE) ** (1 / BAROMETRIC_EXPONENT);
export const travelTime = (distanceKm, speedKmh) => (distanceKm / speedKmh) * SECONDS_PER_HOUR;
export const heightLost = (seconds) => seconds * SINK_RATE;
export const heightAfter = (height, seconds) => height - heightLost(seconds);
// Compass heading (0–360°, clockwise from north) for an offset east and north (west/south negative).
// tan(angle) = east ÷ north; atan2 picks the right quadrant.
export const headingFromOffset = (east, north) => ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
