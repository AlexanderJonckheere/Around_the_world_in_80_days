import * as R from '../constants/rules.js';
import { LANDMARKS } from '../constants/landmarks.js';

// The printed rules, generated from the constants, with examples calculated by the game's own
// formulas, so the rules shown and the rules used can never differ (CLAUDE.md §4).
// Shared by the rules panel (HTML), the rule sheets on the table (canvas texture) and the
// fill-in formulas in the notebook.
const EXAMPLE = { pressure: 950, distanceKm: 3, speedKmh: 60, startHeight: 800, burnSeconds: 5 };

const metres = (m) => `${Math.round(m).toLocaleString('en-GB')} m`;
const fraction = (top, bottom) => `<span class="frac"><span>${top}</span><span>${bottom}</span></span>`;

export const RULES_TITLE = 'Rules of the air';

const flightTime = R.travelTime(EXAMPLE.distanceKm, EXAMPLE.speedKmh);

// Formulas as printed (HTML), shared by the rule sheets and the notebook
const FORMULAS = {
  height: `h = ${R.BAROMETRIC_SCALE} × (1 − (${fraction('P', 'P<sub>0</sub>')})<sup>${R.BAROMETRIC_EXPONENT}</sup>)`,
  pressure: `P = P<sub>0</sub> × (1 − ${fraction('h', String(R.BAROMETRIC_SCALE))})<sup>1 ÷ ${R.BAROMETRIC_EXPONENT}</sup>`,
  travel: `time (s) = ${fraction('distance (km)', 'speed (km/h)')} × 3600`,
  arrival: `height on arrival = height − time (s) × ${R.SINK_RATE}`,
  fallOff: `height lost (m) = time (s) × ${R.SINK_RATE}`,
  burner: 'height change = rate × seconds held',
  heading: `angle = tan<sup>−1</sup>(${fraction('east (km)', 'north (km)')})`,
};

// formula and lines are HTML; plainText() turns them into canvas text
export const RULE_SECTIONS = [
  {
    title: 'Height from pressure',
    formula: FORMULAS.height,
    lines: [
      `P = barometer reading, P<sub>0</sub> = reference pressure (${R.REFERENCE_PRESSURE} hPa unless the ground crew says otherwise).`,
      `<em>Example:</em> barometer ${EXAMPLE.pressure} hPa → h = ${metres(R.heightFromPressure(EXAMPLE.pressure))}`,
    ],
  },
  {
    title: 'Travel time',
    formula: FORMULAS.travel,
    lines: [
      `<em>Example:</em> ${EXAMPLE.distanceKm} km at ${EXAMPLE.speedKmh} km/h → ${flightTime} s`,
      `Push the speed handle forward to speed up, back to slow down (at most ${R.SPEED_ACCEL} km/h per second, ${R.SPEED_MIN}–${R.SPEED_MAX} km/h). Let go and it springs back: the speed snaps to the nearest ${R.SPEED_SNAP} km/h and holds. Read it on the speedometer.`,
    ],
  },
  {
    title: 'Sinking',
    formula: FORMULAS.arrival,
    lines: [
      `The balloon loses ${R.SINK_RATE} m every second, constantly. Sinking into the cloud deck (${metres(R.CRASH_ALTITUDE)}) is a crash.`,
      `<em>Example:</em> ${metres(EXAMPLE.startHeight)} and ${flightTime} s of flight → ${metres(R.heightAfter(EXAMPLE.startHeight, flightTime))}`,
    ],
  },
  {
    title: 'Storms',
    formula: '',
    lines: [
      `Storms are marked on the chart: fly around them.`,
      `Inside one you sink up to ${R.STORM_SINK_RATE} m/s faster and the wind keeps turning the balloon (up to ${R.STORM_SPIN_RATE}° per second), so you must steer against it.`,
    ],
  },
  {
    title: 'Burner and vent',
    formula: FORMULAS.burner,
    lines: [
      `Burner fully open: +${R.BURNER_RATE} m per second &nbsp;·&nbsp; Vent fully open: −${R.VENT_RATE} m per second.`,
      `Half open gives half the rate. The balloon keeps sinking ${R.SINK_RATE} m/s meanwhile.`,
      `<em>Example:</em> burner fully open for ${EXAMPLE.burnSeconds} s → +${EXAMPLE.burnSeconds * R.BURNER_RATE} m (net +${EXAMPLE.burnSeconds * (R.BURNER_RATE - R.SINK_RATE)} m)`,
    ],
  },
];

// Notebook fill-in formulas. parts: fixed text (strings) and blanks ({ name, label, value? }).
// compute() uses the game's own formulas, so a correctly filled-in formula gives the true answer.
const seconds = (s) => `${Math.round(s * 10) / 10} s`;

export const CALCULATORS = [
  {
    title: 'Height from pressure',
    formula: FORMULAS.height,
    parts: [
      `h = ${R.BAROMETRIC_SCALE} × (1 − (`,
      { name: 'p', label: 'P (hPa)' },
      ' ÷ ',
      { name: 'p0', label: 'P₀ (hPa)', value: R.REFERENCE_PRESSURE },
      `)<sup>${R.BAROMETRIC_EXPONENT}</sup>)`,
    ],
    compute: ({ p, p0 }) => `h = ${metres(R.heightFromPressure(p, p0))}`,
  },
  {
    // The other way round: the barometer reading to expect at a planned arrival height
    title: 'Arrival pressure',
    formula: FORMULAS.pressure,
    parts: [
      'P = ',
      { name: 'p0', label: 'P₀ (hPa)', value: R.REFERENCE_PRESSURE },
      ' × (1 − ',
      { name: 'h', label: 'h (m)' },
      ` ÷ ${R.BAROMETRIC_SCALE})<sup>1 ÷ ${R.BAROMETRIC_EXPONENT}</sup>`,
    ],
    compute: ({ p0, h }) => `P = ${(Math.round(R.pressureFromHeight(h, p0) * 10) / 10).toLocaleString('en-GB')} hPa`,
  },
  {
    title: 'Travel time',
    formula: FORMULAS.travel,
    parts: ['time = ', { name: 'km', label: 'km' }, ' ÷ ', { name: 'kmh', label: 'km/h' }, ' × 3600'],
    compute: ({ km, kmh }) => `time = ${seconds(R.travelTime(km, kmh))}`,
  },
  {
    // How much the constant sink costs over the flight time from Travel time
    title: 'Height fall-off',
    formula: FORMULAS.fallOff,
    note: `The balloon sinks ${R.SINK_RATE} m every second, all the time.`,
    parts: ['height lost = ', { name: 'time', label: 'time (s)' }, ` × ${R.SINK_RATE}`],
    compute: ({ time }) => `height lost = ${metres(R.heightLost(time))}`,
  },
  {
    // Read east and north from the triangle under a map circle drawn from start to end point
    title: 'Compass heading',
    formula: FORMULAS.heading,
    note: 'East and north from the map circle; west and south count as negative.',
    parts: ['angle = tan<sup>−1</sup>(', { name: 'east', label: 'east km' }, ' ÷ ', { name: 'north', label: 'north km' }, ')'],
    compute: ({ east, north }) => `heading = ${String(Math.round(R.headingFromOffset(east, north)) % 360).padStart(3, '0')}°`,
  },
];

export const LANDMARK_RULE = `Pass at or above the landmark, but no more than ${metres(R.TARGET_WINDOW)} above it.`;
export const LANDMARK_HEADERS = ['Landmark', 'Height', 'Target window'];
export const LANDMARK_ROWS = Object.values(LANDMARKS).map((l) => [
  l.name,
  metres(l.height),
  `${metres(l.height)} – ${metres(l.height + R.TARGET_WINDOW)}`,
]);

// HTML → canvas text: P<sub>0</sub> becomes P₀, a fraction becomes "a ÷ b", tags are dropped
export function plainText(html) {
  return html
    .replace(/<sub>0<\/sub>/g, '₀')
    .replace(/<sup>(.*?)<\/sup>/g, '^$1')
    .replace(/<span class="frac"><span>(.*?)<\/span><span>(.*?)<\/span><\/span>/g, '$1 ÷ $2')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ');
}
