// Shared open/close for panels and widgets. The slide is a CSS transition on the `is-open` class;
// every change is announced (with which element, and whether it opened) so the overlay can apply
// the panel rules and update the layout.
export function createToggle(selector) {
  const el = document.querySelector(selector);
  const announce = (opened) => document.dispatchEvent(new CustomEvent('ui:change', { detail: { el, opened } }));

  const isOpen = () => el.classList.contains('is-open');
  const open = () => {
    el.classList.add('is-open');
    announce(true);
  };
  const close = () => {
    el.classList.remove('is-open');
    announce(false);
  };
  const toggle = () => (isOpen() ? close() : open());

  el.querySelector('.js-close')?.addEventListener('click', close);
  return { el, open, close, toggle, isOpen };
}
