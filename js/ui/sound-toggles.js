import { sound } from '../systems/sound.js';

// Always-available sound and music switches (CLAUDE.md §11), top left of the screen
export function createSoundToggles() {
  for (const button of document.querySelectorAll('.js-sound-toggle')) {
    const kind = button.dataset.kind;
    button.addEventListener('click', () => {
      sound.unlock();
      const on = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('is-off', !on);
      sound.setEnabled(kind, on);
    });
  }
}
