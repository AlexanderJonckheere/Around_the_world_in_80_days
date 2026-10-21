import { flight } from '../systems/flight.js';
import { progress } from '../systems/progress.js';
import { LANDMARKS } from '../constants/landmarks.js';

// Dev panel (start screen "Dev mode", or ?debug=1): the true values the player never sees, a
// teleport button per landmark and a speed boost. Keys: PageUp / PageDown ±50 m, T teleport to the
// current target, F jump 1 km forward, H hide the cabin. The × closes it: speed back to 1×, keys off,
// cabin visible again. "Dev mode" on the start screen opens it again.
const ALTITUDE_STEP = 50;
const TELEPORT_DISTANCE = 400; // m in front of the landmark, flying towards it
const TELEPORT_CLEARANCE = 50; // m above its top: inside the target window
const JUMP_DISTANCE = 1000;
const SPEED_RANGE = [1, 5];

const el = document.querySelector('.dev');

const forward = (heading) => [Math.sin((heading * Math.PI) / 180), -Math.cos((heading * Math.PI) / 180)];

// Place the balloon in front of route landmark `index` and make it the target
function teleportTo(level, index) {
  const lm = level.route[index];
  const state = flight.state;
  const [fx, fz] = forward(state.heading);
  state.x = lm.x - fx * TELEPORT_DISTANCE;
  state.z = lm.z - fz * TELEPORT_DISTANCE;
  state.altitude = LANDMARKS[lm.type].height + TELEPORT_CLEARANCE;
  progress.setTarget(index);
}

function jumpForward() {
  const state = flight.state;
  const [fx, fz] = forward(state.heading);
  state.x += fx * JUMP_DISTANCE;
  state.z += fz * JUMP_DISTANCE;
}

export function createDevPanel(level, cabin) {
  el.innerHTML = `
    <header class="dev__header">
      <h3 class="dev__title">Dev</h3>
      <button class="dev__close" aria-label="Close dev tools">×</button>
    </header>
    <pre class="dev__readout"></pre>
    <p class="dev__label">Teleport to</p>
    <div class="dev__buttons">
      ${level.route.map((lm, i) => `<button class="dev__button" data-teleport="${i}">${i + 1}. ${LANDMARKS[lm.type].name}</button>`).join('')}
    </div>
    <label class="dev__label">Speed <output class="dev__speed">1×</output>
      <input class="dev__slider" type="range" min="${SPEED_RANGE[0]}" max="${SPEED_RANGE[1]}" step="1" value="1" />
    </label>`;
  const readout = el.querySelector('.dev__readout');
  const speedLabel = el.querySelector('.dev__speed');
  const slider = el.querySelector('.dev__slider');

  const setSpeed = (scale) => {
    flight.setTimeScale(scale);
    slider.value = scale;
    speedLabel.textContent = `${scale}×`;
  };
  const open = () => {
    el.hidden = false;
  };
  // Closing undoes everything dev mode can leave behind, so the game plays normally again
  const close = () => {
    el.hidden = true;
    setSpeed(1);
    cabin.model.visible = true;
  };
  el.querySelector('.dev__close').addEventListener('click', close);
  el.querySelectorAll('[data-teleport]').forEach((b) => b.addEventListener('click', () => teleportTo(level, Number(b.dataset.teleport))));
  slider.addEventListener('input', () => setSpeed(Number(slider.value)));

  window.addEventListener('keydown', (e) => {
    if (el.hidden || e.target instanceof HTMLInputElement) return;
    const state = flight.state;
    if (e.code === 'PageUp') state.altitude += ALTITUDE_STEP;
    if (e.code === 'PageDown') state.altitude -= ALTITUDE_STEP;
    if (e.code === 'KeyH') cabin.model.visible = !cabin.model.visible;
    if (e.code === 'KeyF') jumpForward();
    if (e.code === 'KeyT') teleportTo(level, level.route.indexOf(progress.target));
  });

  open();
  return {
    open,
    update() {
      if (el.hidden) return;
      const s = flight.state;
      const target = progress.target;
      readout.textContent =
        `alt      ${s.altitude.toFixed(1)} m\n` +
        `pressure ${s.pressure.toFixed(1)} hPa\n` +
        `heading  ${s.heading.toFixed(1)}°\n` +
        `speed    ${s.speed.toFixed(1)} km/h\n` +
        `pos      ${s.x.toFixed(0)}, ${s.z.toFixed(0)}\n` +
        `target   ${target ? LANDMARKS[target.type].name : '–'}`;
    },
  };
}
