import { createToggle } from './toggle.js';
import { CALCULATORS } from './rules-content.js';

// Notebook panel (CLAUDE.md §8.1), slides in from the right: the formulas, each with a fill-in copy.
// Click a blank, type a number, press Space or Enter to go to the next blank; once every blank is
// filled the result appears. Blank writing pages come in step 12.
const CONFIRM_KEYS = new Set([' ', 'Enter']);

const { el, open, close, toggle, isOpen } = createToggle('.panel--notebook');
export { el, open, close, toggle, isOpen };

const blank = ({ name, label, value = '' }) =>
  `<input class="calc__blank" type="text" inputmode="decimal" data-name="${name}" placeholder="${label}"
     aria-label="${label}" value="${value}" size="${Math.max(label.length, 4)}" autocomplete="off" />`;

const calculator = ({ title, formula, note, parts }, i) => `
  <section class="rule calc" data-calc="${i}">
    <h4 class="rule__title">${title}</h4>
    <p class="rule__formula">${formula}</p>
    ${note ? `<p class="rule__text">${note}</p>` : ''}
    <p class="calc__fill">${parts.map((p) => (typeof p === 'string' ? p : blank(p))).join('')}</p>
    <p class="calc__result" hidden></p>
  </section>`;

const body = el.querySelector('.panel__body');
body.innerHTML = `
  <article>
    <h3 class="rules__heading">Calculations</h3>
    ${CALCULATORS.map(calculator).join('')}
  </article>`;

// Numbers only; a comma counts as a decimal point
const parse = (text) => Number(text.replace(',', '.'));
const isNumber = (text) => text.trim() !== '' && Number.isFinite(parse(text));

function showResult(section) {
  const blanks = [...section.querySelectorAll('.calc__blank')];
  const result = section.querySelector('.calc__result');
  if (!blanks.every((b) => isNumber(b.value))) {
    result.hidden = true;
    return;
  }
  const values = Object.fromEntries(blanks.map((b) => [b.dataset.name, parse(b.value)]));
  result.textContent = CALCULATORS[section.dataset.calc].compute(values);
  result.hidden = false;
}

body.addEventListener('input', (e) => {
  if (!e.target.matches('.calc__blank')) return;
  e.target.value = e.target.value.replace(/[^0-9.,-]/g, '');
  e.target.closest('.calc').querySelector('.calc__result').hidden = true; // stale until confirmed
});

body.addEventListener('keydown', (e) => {
  if (!e.target.matches('.calc__blank') || !CONFIRM_KEYS.has(e.key)) return;
  e.preventDefault();
  const section = e.target.closest('.calc');
  const blanks = [...section.querySelectorAll('.calc__blank')];
  const next = blanks.slice(blanks.indexOf(e.target) + 1).find((b) => !isNumber(b.value));
  if (next) next.focus();
  else e.target.blur();
  showResult(section);
});
