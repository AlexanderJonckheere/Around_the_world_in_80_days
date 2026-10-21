import { createToggle } from './toggle.js';
import { RULES_TITLE, RULE_SECTIONS, LANDMARK_RULE, LANDMARK_HEADERS, LANDMARK_ROWS } from './rules-content.js';

// Rules panel, slides in from the left: a readable version of the rule sheets on the table.
const { el, open, close, toggle, isOpen } = createToggle('.panel--rules');
export { el, open, close, toggle, isOpen };

const section = ({ title, formula, lines }) => `
  <section class="rule">
    <h4 class="rule__title">${title}</h4>
    ${formula ? `<p class="rule__formula">${formula}</p>` : ''}
    ${lines.map((l) => `<p class="rule__text">${l}</p>`).join('')}
  </section>`;

const row = (cells, tag) => `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`;

el.querySelector('.panel__body').innerHTML = `
  <article>
    <h3 class="rules__heading">${RULES_TITLE}</h3>
    ${RULE_SECTIONS.map(section).join('')}
    <section class="rule">
      <h4 class="rule__title">Landmarks</h4>
      <p class="rule__text">${LANDMARK_RULE}</p>
      <table class="rule__table">
        <thead>${row(LANDMARK_HEADERS, 'th')}</thead>
        <tbody>${LANDMARK_ROWS.map((r) => row(r, 'td')).join('')}</tbody>
      </table>
    </section>
  </article>`;
