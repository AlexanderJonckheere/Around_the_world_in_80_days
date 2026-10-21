import * as R from '../constants/rules.js';
import { LEVEL } from '../constants/routes.js';

// Start screen: what the game is, how to play and the controls. onStart({ dev }) starts the flight;
// "Dev mode" starts it with the dev panel (teleport, speed boost).
const CONTROLS = [
  ['Steer left / right', 'Hold A / D, or drag the rudder'],
  ['Burner (climb)', 'Hold Space / ↑, or pull the burner lever down'],
  ['Vent (descend)', 'Hold V / ↓, or pull the vent rope down'],
  ['Speed', 'Hold W / Q, or push the speed handle forward / back; let go and it snaps to the nearest 5 km/h'],
  ['Stopwatch start / stop', 'S, or the stopwatch buttons'],
  ['Map / notebook', 'M / N, or click them on the table'],
  ['Instruments', 'Click the barometer, speedometer, compass or stopwatch'],
  ['Close panels', 'Esc'],
];

const el = document.querySelector('.start');

export function createStartScreen(onStart) {
  el.innerHTML = `
    <div class="start__card">
      <h1 class="start__title">Around the World in 80 Days</h1>
      <p class="start__subtitle">A navigator's flight above the clouds</p>

      <section class="start__section">
        <h2>Your task</h2>
        <p>You are the navigator of a small hot air balloon, high above an endless sea of clouds.
          There is no altitude display and no position marker: only a map, a compass, a barometer,
          a speedometer, a stopwatch and a notebook. Fly from landmark to landmark and pass each one
          at the right height.</p>
        <ul class="start__list">
          <li><strong>Plan</strong> on the map: measure the distance and heading to the next landmark.</li>
          <li><strong>Calculate</strong> in the notebook: your height from the barometer, the travel time and how much height you will lose.</li>
          <li><strong>Fly</strong>: turn onto the heading, time the leg with the stopwatch, use the burner and vent.</li>
          <li><strong>Pass</strong> within ${R.PASS_RADIUS} m of the landmark, between its height and ${R.TARGET_WINDOW} m above it.
            Too low and you crash, too high and it stays hidden under the clouds.</li>
          <li>The speed handle changes your speed gently (${R.SPEED_MIN}–${R.SPEED_MAX} km/h). When you let go, the speed
            snaps to the nearest ${R.SPEED_SNAP} km/h and holds there, so it's easy to read and calculate with.</li>
          <li>The balloon sinks ${R.SINK_RATE} m every second. Sinking into the clouds is a crash;
            a red warning light comes on when you get close.</li>
        </ul>
      </section>

      <section class="start__section">
        <h2>Controls</h2>
        <table class="start__controls">
          ${CONTROLS.map(([what, how]) => `<tr><td>${what}</td><td>${how}</td></tr>`).join('')}
        </table>
      </section>

      <section class="start__section">
        <h2>${LEVEL.name}</h2>
        <p>${LEVEL.route.length} landmarks to pass in order. The stopwatch starts running as soon as you take off.</p>
        <div class="start__actions">
          <button class="start__play js-start-flight">Start flight</button>
          <button class="start__dev js-start-dev">Dev mode</button>
        </div>
      </section>
    </div>`;

  const start = (dev) => {
    close();
    onStart({ dev });
  };
  el.querySelector('.js-start-flight').addEventListener('click', () => start(false));
  el.querySelector('.js-start-dev').addEventListener('click', () => start(true));

  const open = () => el.classList.add('is-open');
  const close = () => el.classList.remove('is-open');
  return { open, close, isOpen: () => el.classList.contains('is-open') };
}
