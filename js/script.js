import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { createRenderer } from './systems/renderer.js';
import { Input } from './systems/input.js';
import { CameraRig } from './systems/camera-rig.js';
import { createInteractions } from './systems/interactions.js';
import { flight } from './systems/flight.js';
import { progress } from './systems/progress.js';
import { readings, updateReadings } from './systems/instruments.js';
import { sound } from './systems/sound.js';
import { createSoundToggles } from './ui/sound-toggles.js';
import { World } from './objects/world.js';
import { createLantern } from './objects/lantern.js';
import { createSpeedHandle } from './objects/speed-handle.js';
import { initPhysics, physics } from './systems/physics.js';
import { Cabin } from './objects/cabin.js';
import { panels, closePanels, updateWidgets } from './ui/overlay.js';
import { createDevPanel } from './ui/dev.js';
import { createStartScreen } from './ui/start-screen.js';
import { showToast, showDialog, isDialogOpen } from './ui/messages.js';
import { updateWarningLight } from './ui/warning-light.js';
import { updateStormCue } from './ui/storm-cue.js';
import { LEVEL } from './constants/routes.js';
import { TURN_RATE, STORM_SPIN_RATE } from './constants/rules.js';
import { skyUniforms, createCloudPass } from './shaders/clouds/clouds.js';

const MAX_DELTA = 0.1; // s, so a background tab doesn't make the balloon jump
const SWAY = { base: 1, turning: 0.6, burner: 0.5, storm: 2 };

if (!navigator.gpu) {
  document.querySelector('.unsupported').hidden = false;
  throw new Error('WebGPU not supported');
}

const renderer = await createRenderer(document.getElementById('app'));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 20000);

// Render the scene, then draw the cloud volume over it, stopping at the nearest object
const pipeline = new THREE.RenderPipeline(renderer);
pipeline.outputNode = createCloudPass(pass(scene, camera), camera, renderer);

const input = new Input(renderer.domElement);
const world = new World(scene);
const interactions = createInteractions();
const cabin = await Cabin.load(scene, interactions.hoverFor);
await initPhysics();
const lantern = createLantern(cabin.model);
const speedHandle = createSpeedHandle(cabin.model, interactions.hoverFor); // before attach: it's clickable
const flingables = { lantern };
interactions.attach(cabin.model, camera, input, renderer.domElement, (id, point, direction) => {
  flingables[id].fling(point, direction);
  sound.play('tink');
});
createSoundToggles();
const rig = new CameraRig(camera, cabin.seat, cabin.restLookAt);

const params = new URLSearchParams(location.search);
let dev = null;

// The chart and landmarks never change: there is one route
world.loadLandmarks(LEVEL.route);
world.loadStorms(LEVEL.storms);
world.setDeparture(LEVEL.start);
panels.map.load(LEVEL);
cabin.showChart(LEVEL);

function startFlight() {
  closePanels();
  lantern.reset();
  panels.map.load(LEVEL); // clears the circles of the last attempt
  progress.start(LEVEL);
}

const startScreen = createStartScreen(({ dev: withDev }) => {
  sound.unlock();
  if (withDev) (dev ??= createDevPanel(LEVEL, cabin)).open();
  startFlight();
});

function backToStart() {
  progress.stop();
  closePanels();
  startScreen.open();
}

const restartButton = { label: 'Restart level', action: startFlight };
const startButton = { label: 'Start screen', action: backToStart };

progress.on('passed', ({ name, next, number }) => {
  sound.play('chime');
  showToast(`${name} passed!`, `Next: ${number}. ${next}`);
});
progress.on('missed', () => sound.play('miss'));
progress.on('crashed', () => sound.play('thud'));
progress.on('complete', () => sound.play('chime'));
progress.on('missed', ({ name, reason }) =>
  showDialog({ title: `You missed the ${name}`, text: reason, tone: 'bad', buttons: [restartButton, startButton] }),
);
progress.on('crashed', ({ reason }) => showDialog({ title: 'Crash!', text: reason, tone: 'bad', buttons: [restartButton, startButton] }));
progress.on('complete', ({ name }) =>
  showDialog({
    title: 'Route complete!',
    text: `${name} passed: you flew the whole route in ${flight.stopwatch.format()}.`,
    tone: 'good',
    buttons: [{ label: 'Fly again', action: startFlight }, startButton],
  }),
);

// ?debug=1 skips the start screen and starts in dev mode (testing)
if (params.has('debug')) {
  startScreen.close();
  dev = createDevPanel(LEVEL, cabin);
  startFlight();
} else {
  startScreen.open();
}

// Global shortcuts (CLAUDE.md §7.4). Held controls are read every frame below.
const HELD_KEYS = {
  rudderLeft: ['KeyA', 'ArrowLeft'],
  rudderRight: ['KeyD', 'ArrowRight'],
  burner: ['Space', 'ArrowUp'],
  vent: ['KeyV', 'ArrowDown'],
  speedUp: ['KeyW'],
  slowDown: ['KeyQ'],
};
const HELD_CODES = new Set(Object.values(HELD_KEYS).flat());

const SHORTCUTS = {
  KeyS: () => flight.toggleStopwatch(),
  KeyM: () => panels.map.toggle(),
  KeyN: () => panels.notebook.toggle(),
  Escape: closePanels,
};

// The start screen and the flight messages take over the keyboard while they're up
const menuOpen = () => startScreen.isOpen() || isDialogOpen();

input.on('keydown', (e) => {
  sound.unlock();
  if (menuOpen()) return;
  const action = SHORTCUTS[e.code];
  // e.g. Space must not also press a focused button or scroll the page
  if (action || HELD_CODES.has(e.code)) e.preventDefault();
  action?.();
});
input.on('pointerdown', () => sound.unlock());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// How fast the balloon turns (°/s), from the heading change, the short way round (350° → 10°).
// Capped at the fastest real turn: a heading that jumps (a new flight, a restart) isn't a turn.
const MAX_TURN_RATE = TURN_RATE + STORM_SPIN_RATE;
let lastHeading = null;
function turnRate(heading, dt) {
  const change = lastHeading === null || dt === 0 ? 0 : ((heading - lastHeading + 540) % 360) - 180;
  lastHeading = heading;
  const rate = dt > 0 ? change / dt : 0;
  return Math.max(-MAX_TURN_RATE, Math.min(MAX_TURN_RATE, rate));
}

const timer = new THREE.Timer();
timer.connect(document);

renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), MAX_DELTA);

  const held = (name) => (input.isDown(...HELD_KEYS[name]) ? 1 : 0);
  flight.setInput('rudder', 'keys', held('rudderRight') - held('rudderLeft'));
  flight.setInput('burner', 'keys', held('burner'));
  flight.setInput('vent', 'keys', held('vent'));
  flight.setInput('throttle', 'keys', held('speedUp') - held('slowDown'));
  // The world only moves while a leg is being flown (not on the start screen or in a message)
  if (progress.flying) flight.update(dt);

  const state = flight.state;
  progress.update(state);
  const warning = progress.flying ? progress.lowWarning(state) : 0;
  updateWarningLight(warning);
  sound.update(dt, state, flight.stopwatch, { flying: progress.flying, warning });
  updateStormCue(progress.flying ? state.storm : 0);
  updateReadings(dt, state);
  world.update(dt, state);
  cabin.animate(dt, readings, state, flight.stopwatch);
  lantern.applyCabinMotion(dt, turnRate(state.heading, dt), progress.flying ? state.storm : 0);
  physics.step(dt);
  lantern.animate();
  speedHandle.animate(dt, state.throttle);
  interactions.update(dt);

  rig.swayStrength = SWAY.base + (state.rudder !== 0 ? SWAY.turning : 0) + state.burnerHeat * SWAY.burner + state.storm * SWAY.storm;
  rig.update(dt, input.pointer);
  skyUniforms.burnerGlow.value = state.burnerHeat;

  updateWidgets(readings, flight.stopwatch);
  dev?.update();
  pipeline.render();
});
