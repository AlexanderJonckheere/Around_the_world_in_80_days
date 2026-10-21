// Messages about the flight: a short toast that fades by itself (landmark passed), and a dialog
// that pauses the game until a button is chosen (missed, crashed, route complete).
const TOAST_TIME = 4000; // ms

const toast = document.querySelector('.toast');
const dialog = document.querySelector('.dialog');
let toastTimer = null;

export function showToast(title, text) {
  toast.innerHTML = `<strong class="toast__title">${title}</strong><span>${text}</span>`;
  toast.classList.add('is-open');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-open'), TOAST_TIME);
}

// tone: 'good' | 'bad'; buttons: [{ label, action }]
export function showDialog({ title, text, tone, buttons }) {
  dialog.innerHTML = `
    <div class="dialog__card dialog__card--${tone}">
      <h2 class="dialog__title">${title}</h2>
      <p class="dialog__text">${text}</p>
      <div class="dialog__buttons">
        ${buttons.map((b, i) => `<button class="dialog__button" data-index="${i}">${b.label}</button>`).join('')}
      </div>
    </div>`;
  dialog.querySelectorAll('.dialog__button').forEach((el) =>
    el.addEventListener('click', () => {
      hideDialog();
      buttons[Number(el.dataset.index)].action();
    }),
  );
  dialog.classList.add('is-open');
}

export function hideDialog() {
  dialog.classList.remove('is-open');
}

export const isDialogOpen = () => dialog.classList.contains('is-open');
