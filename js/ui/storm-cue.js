// Storm cue: a "STORM" lamp that glows brighter the deeper in a storm the balloon is (the same
// smooth 0..1 as the flight model). The rain itself runs down the windows (shaders/rain).
const cue = document.querySelector('.storm-cue');

export function updateStormCue(strength) {
  cue.classList.toggle('is-on', strength > 0.01);
  cue.style.setProperty('--storm', strength.toFixed(2));
}
