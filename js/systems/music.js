// Calm generated lo-fi music: slow warm chords, a music-box melody, a soft beat and vinyl crackle.
// Notes are scheduled a little ahead on the audio clock (the usual Web Audio pattern), so the timing
// stays exact however the frames fall. Swap for a recorded track later if you like.
const BPM = 68;
const BEAT = 60 / BPM; // s
const BEATS_PER_CHORD = 8;
const LOOKAHEAD = 0.6; // s of music scheduled ahead

// Am9 – Fmaj7 – Cmaj7 – G6, as MIDI notes (a soft, wistful lo-fi turn)
const CHORDS = [
  [57, 60, 64, 67, 71],
  [53, 57, 60, 64, 69],
  [48, 55, 59, 64, 67],
  [55, 59, 62, 64, 67],
];
// Melody notes per chord (one octave up): A minor pentatonic, coloured by the chord
const MELODY = [
  [76, 79, 81, 84, 83],
  [76, 77, 81, 84, 79],
  [76, 79, 83, 84, 74],
  [74, 79, 81, 83, 86],
];
// Which eighth notes of a chord get a melody note (1) — a sparse, music-box rhythm
const MELODY_RHYTHM = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0];

const LEVEL = { pad: 0.07, melody: 0.09, kick: 0.25, hat: 0.03, crackle: 0.015 };
const PAD_CUTOFF = 900; // Hz, keeps the chords warm and dull, like an old record

const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);

let ctx = null;
let bus = null;
let noise = null;
let nextBeat = 0;
let beat = 0;
let seed = 1;

// A tiny repeatable random, so the melody varies but loops the same way every time
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function note(frequency, at, duration, { type = 'sine', level, attack = 0.01, filter } = {}) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(level, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  let out = osc;
  if (filter) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filter;
    osc.connect(lp);
    out = lp;
  }
  out.connect(env).connect(bus);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

function pad(chord, at) {
  const length = BEATS_PER_CHORD * BEAT;
  for (const midi of chord) {
    // Two slightly detuned voices per note give the warm, wobbly lo-fi chord
    for (const detune of [-0.5, 0.5]) {
      note(freq(midi) * 2 ** (detune / 120), at, length, { type: 'triangle', level: LEVEL.pad, attack: 1.2, filter: PAD_CUTOFF });
    }
  }
}

// Music box: a pure tone plus a quiet octave, fast attack, long ring
function musicBox(midi, at) {
  note(freq(midi), at, 1.6, { level: LEVEL.melody });
  note(freq(midi) * 2, at, 0.8, { level: LEVEL.melody * 0.3 });
}

function kick(at) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.frequency.setValueAtTime(110, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.25);
  env.gain.setValueAtTime(LEVEL.kick, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
  osc.connect(env).connect(bus);
  osc.start(at);
  osc.stop(at + 0.4);
}

function hat(at) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const env = ctx.createGain();
  env.gain.setValueAtTime(LEVEL.hat, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  src.connect(hp).connect(env).connect(bus);
  src.start(at, Math.random());
  src.stop(at + 0.08);
}

function crackle() {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  src.playbackRate.value = 0.25; // slowed-down noise sounds like the hiss of an old record
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1500;
  const gain = ctx.createGain();
  gain.gain.value = LEVEL.crackle;
  src.connect(hp).connect(gain).connect(bus);
  src.start();
}

function scheduleBeat(at) {
  const chordIndex = Math.floor(beat / BEATS_PER_CHORD) % CHORDS.length;
  const inChord = beat % BEATS_PER_CHORD;
  if (inChord === 0) pad(CHORDS[chordIndex], at);
  if (inChord % 2 === 0) kick(at); // on beats 1 and 3
  hat(at + BEAT / 2);

  // Two eighth notes per beat
  for (const half of [0, 1]) {
    if (MELODY_RHYTHM[(inChord * 2 + half) % MELODY_RHYTHM.length] && random() < 0.8) {
      const choices = MELODY[chordIndex];
      musicBox(choices[Math.floor(random() * choices.length)], at + half * (BEAT / 2));
    }
  }
  beat++;
}

export const music = {
  start(audioContext, musicBus, noiseBuffer) {
    ctx = audioContext;
    bus = musicBus;
    noise = noiseBuffer;
    nextBeat = ctx.currentTime + 0.2;
    crackle();
  },

  // now: the audio clock (ctx.currentTime)
  update(now) {
    if (!ctx) return;
    // After a background tab, don't catch up on every missed note at once: just carry on from now
    if (nextBeat < now) nextBeat = now + 0.05;
    while (nextBeat < now + LOOKAHEAD) {
      scheduleBeat(nextBeat);
      nextBeat += BEAT;
    }
  },
};
