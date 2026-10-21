import * as THREE from 'three/webgpu';
import { RULES_TITLE, RULE_SECTIONS, LANDMARK_RULE, LANDMARK_HEADERS, LANDMARK_ROWS, plainText } from '../ui/rules-content.js';

// The two rule sheets left of the map form one printed two-page spread: the left half of this
// canvas goes on the left sheet, the right half on the right sheet.
const PAGE = { width: 620, height: 1024, margin: 46 }; // px per sheet, same shape as the sheets (16 × 26.5 cm)
const INK = '#2b2118';
const PAPER = '#e9ddbd';
const FONT = 'Georgia, "Times New Roman", serif';
const SIZE = { title: 42, heading: 26, formula: 24, text: 20, table: 19 };
const LINE = 1.35;

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  return [...lines, line];
}

export function createRulesTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE.width * 2;
  canvas.height = PAGE.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'top';

  const columnWidth = PAGE.width - PAGE.margin * 2;
  let page = 0;
  let y = PAGE.margin;
  const x = () => page * PAGE.width + PAGE.margin;

  // Continue on the right page when the left one is full
  const write = (text, size, style = '') => {
    ctx.font = `${style} ${size}px ${FONT}`;
    for (const line of wrap(ctx, text, columnWidth)) {
      if (y + size > PAGE.height - PAGE.margin && page === 0) {
        page = 1;
        y = PAGE.margin;
      }
      ctx.fillText(line, x(), y);
      y += size * LINE;
    }
  };
  const gap = (size) => (y += size * 0.6);

  write(RULES_TITLE.toUpperCase(), SIZE.title);
  gap(SIZE.title);
  for (const { title, formula, lines } of RULE_SECTIONS) {
    write(title, SIZE.heading, 'bold');
    if (formula) write(plainText(formula), SIZE.formula, 'italic');
    lines.forEach((l) => write(plainText(l), SIZE.text));
    gap(SIZE.heading);
  }

  write('Landmarks', SIZE.heading, 'bold');
  write(LANDMARK_RULE, SIZE.text);
  ctx.font = `${SIZE.table}px ${FONT}`;
  const columns = [0, 0.38, 0.62].map((f) => f * columnWidth);
  for (const [i, cells] of [LANDMARK_HEADERS, ...LANDMARK_ROWS].entries()) {
    ctx.font = `${i === 0 ? 'bold ' : ''}${SIZE.table}px ${FONT}`;
    cells.forEach((cell, c) => ctx.fillText(cell, x() + columns[c], y));
    y += SIZE.table * LINE;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
