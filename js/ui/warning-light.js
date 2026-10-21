// Red warning light for flying close to the cloud deck: a lamp on the screen and a red glow at the
// edges, pulsing faster and brighter the closer the balloon gets. It warns, but shows no height.
const lamp = document.querySelector('.warning');
const PULSE = { slow: 1.2, fast: 0.35 }; // s per flash

export function updateWarningLight(level) {
  lamp.classList.toggle('is-on', level > 0);
  lamp.style.setProperty('--warning', level.toFixed(2));
  lamp.style.setProperty('--pulse', `${PULSE.slow + (PULSE.fast - PULSE.slow) * level}s`);
}
