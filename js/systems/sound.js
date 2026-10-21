import { music } from './music.js';

// All game sound, synthesised live with the Web Audio API (no audio files): looping ambience that
// follows the flight state, and short one-shot effects. Browsers only allow audio after a user
// gesture, so nothing starts before unlock().
const VOLUME = {
  master: 0.8,
  effects: 1,
  music: 0.35,
  wind: 0.12,
  windStorm: 0.4,
  burner: 0.45,
  vent: 0.18,
  rain: 0.28,
  tick: 0.05,
};
const WIND = { cutoff: 380, stormCutoff: 900, gustRate: 0.13 }; // Hz, Hz, gusts per second
const THUNDER = { minStorm: 0.5, minGap: 7, maxGap: 18 }; // s between rolls of thunder
const WARNING_BEEP_GAP = 1; // s
const RAMP = 0.15; // s, how quickly looping sounds follow the controls (no clicks)

let ctx = null;
let effectsBus = null;
let musicBus = null;
const loops = {};
let lastTick = 0;
let nextThunder = 0;
let nextBeep = 0;
let time = 0;

// One shared buffer of white noise; every hiss, roar and rumble is this, filtered differently
let noise = null;
function makeNoise(seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function noiseSource(loop) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = loop;
  return src;
}

// A noise loop through a filter, silent until its volume is raised. Returns the two AudioParams to drive.
function noiseLoop(type, frequency, q = 0.7) {
  const src = noiseSource(true);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(effectsBus);
  src.start();
  return { cutoff: filter.frequency, volume: gain.gain };
}

const setLevel = (param, value) => param.setTargetAtTime(value, ctx.currentTime, RAMP);

// A short sound with an attack/decay envelope: a tone (frequency) or filtered noise
function blip({ frequency, type = 'sine', noiseFilter, attack = 0.005, decay = 0.3, gain = 0.3, at = 0, glideTo }) {
  const t = ctx.currentTime + at;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  env.connect(effectsBus);

  let src;
  if (noiseFilter) {
    src = noiseSource(false);
    const filter = ctx.createBiquadFilter();
    filter.type = noiseFilter.type;
    filter.frequency.value = noiseFilter.frequency;
    src.connect(filter).connect(env);
  } else {
    src = ctx.createOscillator();
    src.type = type;
    src.frequency.setValueAtTime(frequency, t);
    if (glideTo) src.frequency.exponentialRampToValueAtTime(glideTo, t + attack + decay);
    src.connect(env);
  }
  src.start(t);
  src.stop(t + attack + decay + 0.05);
}

const EFFECTS = {
  chime: () => {
    blip({ frequency: 659, decay: 1.4, gain: 0.22 });
    blip({ frequency: 988, decay: 1.6, gain: 0.18, at: 0.18 });
  },
  thud: () => {
    blip({ frequency: 90, glideTo: 35, decay: 0.9, gain: 0.7 });
    blip({ noiseFilter: { type: 'lowpass', frequency: 300 }, decay: 1.2, gain: 0.6 });
  },
  miss: () => {
    blip({ frequency: 392, type: 'triangle', decay: 0.6, gain: 0.2 });
    blip({ frequency: 311, type: 'triangle', decay: 0.9, gain: 0.2, at: 0.3 });
  },
  rustle: () => blip({ noiseFilter: { type: 'bandpass', frequency: 3200 }, attack: 0.03, decay: 0.25, gain: 0.25 }),
  click: () => blip({ frequency: 1800, type: 'square', attack: 0.001, decay: 0.04, gain: 0.04 }),
  tink: () => {
    blip({ frequency: 2350, decay: 0.5, gain: 0.12 });
    blip({ frequency: 3520, decay: 0.35, gain: 0.08 });
  },
  tick: () => blip({ noiseFilter: { type: 'highpass', frequency: 4000 }, attack: 0.001, decay: 0.03, gain: VOLUME.tick }),
  beep: () => blip({ frequency: 880, decay: 0.12, gain: 0.1 }),
  thunder: () => blip({ noiseFilter: { type: 'lowpass', frequency: 160 }, attack: 0.3, decay: 3.5, gain: 0.9 }),
};

function startAudio() {
  ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = VOLUME.master;
  master.connect(ctx.destination);
  effectsBus = ctx.createGain();
  effectsBus.gain.value = VOLUME.effects;
  effectsBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = VOLUME.music;
  musicBus.connect(master);

  noise = makeNoise(2);
  loops.wind = noiseLoop('lowpass', WIND.cutoff);
  loops.burner = noiseLoop('lowpass', 500, 2);
  loops.vent = noiseLoop('highpass', 2500);
  loops.rain = noiseLoop('highpass', 1800);
  music.start(ctx, musicBus, noise);
}

// Panels rustle like paper, widgets click
document.addEventListener('ui:change', ({ detail }) => {
  if (!ctx || !detail.opened) return;
  EFFECTS[detail.el.classList.contains('panel') ? 'rustle' : 'click']();
});

export const sound = {
  unlock() {
    if (!ctx) startAudio();
    if (ctx.state === 'suspended') ctx.resume();
  },

  play(name) {
    if (ctx) EFFECTS[name]();
  },

  // kind: 'effects' | 'music'
  setEnabled(kind, on) {
    if (!ctx) return;
    const bus = kind === 'music' ? musicBus : effectsBus;
    setLevel(bus.gain, on ? VOLUME[kind] : 0);
  },

  // flying: whether a flight is running; warning: the low-altitude warning, 0..1
  update(dt, state, stopwatch, { flying, warning }) {
    if (!ctx) return;
    time += dt;
    music.update(ctx.currentTime);

    const storm = flying ? state.storm : 0;
    const gust = 0.75 + 0.25 * Math.sin(time * WIND.gustRate * Math.PI * 2);
    setLevel(loops.wind.volume, (VOLUME.wind + (VOLUME.windStorm - VOLUME.wind) * storm) * gust);
    setLevel(loops.wind.cutoff, WIND.cutoff + (WIND.stormCutoff - WIND.cutoff) * storm);
    setLevel(loops.burner.volume, flying ? state.burner * VOLUME.burner : 0);
    setLevel(loops.vent.volume, flying ? state.vent * VOLUME.vent : 0);
    setLevel(loops.rain.volume, storm * VOLUME.rain);

    // A tick on every whole second of the stopwatch
    const second = Math.floor(stopwatch.elapsed);
    if (stopwatch.running && second !== lastTick) EFFECTS.tick();
    lastTick = second;

    if (storm > THUNDER.minStorm && time > nextThunder) {
      if (nextThunder > 0) EFFECTS.thunder();
      nextThunder = time + THUNDER.minGap + Math.random() * (THUNDER.maxGap - THUNDER.minGap);
    }
    if (flying && warning > 0 && time > nextBeep) {
      EFFECTS.beep();
      nextBeep = time + WARNING_BEEP_GAP * (1 - 0.6 * warning);
    }
  },
};
