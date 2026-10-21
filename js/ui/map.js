import { createToggle } from './toggle.js';
import { createView, drawChart } from './chart.js';

// Map panel (CLAUDE.md §8.1), slides in from the bottom.
// Dividers: the first click sets the centre; drag to the edge and let go, or move and click again.
// Each circle shows its radius in km, plus the east/west and north/south legs of its radius line,
// which the notebook's compass heading formula uses (tan⁻¹ east ÷ north).
// The next click adds another circle; "Clear circles" removes them all. With the eraser on, a click
// removes only the circle under the pointer (its outline, or else the smallest circle around it).
// The chart opens on this level's route. Trackpad: two-finger swipe pans, pinch zooms (the browser
// reports a pinch as a wheel event with ctrlKey). Mouse: right-drag pans, Ctrl + wheel zooms.
// + / − zoom around the centre, "Reset view" goes back. Circles are in world metres, so they stay put.
const MAX_PIXEL_RATIO = 2;
const DRAG_THRESHOLD = 6; // px; less than this between press and release counts as a click
const DIVIDER_COLOR = '#1d3a8a';
const LEG_COLOR = 'rgba(29, 58, 138, 0.75)';
const FONT = 'Georgia, "Times New Roman", serif';
const ZOOM_SPEED = 0.01; // per pinch / Ctrl + wheel delta unit
const ZOOM_STEP = 1.5; // per + / − button press
const ZOOM_LIMITS = [0.1, 6]; // × the fitted route view: far enough out for the whole voyage
const PAN_BUTTON = 2; // right mouse button
const CIRCLE_BUTTON = 0; // left mouse button
const ERASE_REACH = 10; // px from a circle's outline that still counts as clicking it

const { el, open, close, toggle, isOpen } = createToggle('.panel--map');
export { el, open, close, toggle, isOpen };

const body = el.querySelector('.panel__body');
const canvas = document.createElement('canvas');
canvas.className = 'map__canvas';
body.appendChild(canvas);
const ctx = canvas.getContext('2d');
const chart = document.createElement('canvas'); // cached chart, redrawn on resize, zoom, pan or a new level

let level = null;
let view = null;
let size = { width: 0, height: 0, ratio: 1 };
const camera = { zoom: 1, pan: [0, 0] };
let panFrom = null; // pointer position while panning
let erasing = false;
const eraserButton = el.querySelector('.js-eraser');

// Circles in world metres, so they survive resizing. `sizing` is the one still following the pointer.
let circles = [];
let sizing = null; // { center, edge, pressedAt, dragged }

function resize() {
  const ratio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
  const { width, height } = body.getBoundingClientRect();
  if (!level || width === 0 || height === 0) return;
  size = { width, height, ratio };
  for (const c of [canvas, chart]) {
    c.width = width * ratio;
    c.height = height * ratio;
  }
  redrawChart();
}

function redrawChart() {
  const { width, height, ratio } = size;
  view = createView(level, width, height, camera);
  const chartCtx = chart.getContext('2d');
  chartCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawChart(chartCtx, width, height, level, view);
  render();
}

function drawCircle(circle) {
  const [cx, cy] = view.toPx(...circle.center);
  const [ex, ey] = view.toPx(...circle.edge);
  const radiusPx = Math.hypot(ex - cx, ey - cy);
  const km = Math.hypot(circle.edge[0] - circle.center[0], circle.edge[1] - circle.center[1]) / 1000;

  ctx.strokeStyle = DIVIDER_COLOR;
  ctx.fillStyle = DIVIDER_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [x, y] of [[cx, cy], [ex, ey]]) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(`${km.toFixed(2)} km`, (cx + ex) / 2 + 8, (cy + ey) / 2 - 8);
  drawLegs(circle, cx, cy, ex, ey);
}

// The right-angled triangle under the radius line: east/west leg along the centre, then north/south
function drawLegs(circle, cx, cy, ex, ey) {
  const east = (circle.edge[0] - circle.center[0]) / 1000;
  const north = -(circle.edge[1] - circle.center[1]) / 1000; // world −z is north
  if (Math.abs(east) < 0.01 && Math.abs(north) < 0.01) return;

  ctx.strokeStyle = LEG_COLOR;
  ctx.fillStyle = LEG_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex, cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${east >= 0 ? 'E' : 'W'} ${Math.abs(east).toFixed(2)} km`, (cx + ex) / 2, cy + (ey < cy ? -6 : 16)); // inside the triangle, clear of the departure label
  ctx.textAlign = ex >= cx ? 'left' : 'right';
  ctx.fillText(`${north >= 0 ? 'N' : 'S'} ${Math.abs(north).toFixed(2)} km`, ex + (ex >= cx ? 6 : -6), (cy + ey) / 2);
  ctx.textAlign = 'left';
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(chart, 0, 0);
  ctx.setTransform(size.ratio, 0, 0, size.ratio, 0, 0);
  circles.forEach(drawCircle);
}

const pointerPx = (e) => {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
};
const pointerWorld = (e) => view.toWorld(...pointerPx(e));

// Zoom around a point on the chart: that spot stays where it is
function zoomAround(px, py, factor) {
  const zoom = Math.min(Math.max(camera.zoom * factor, ZOOM_LIMITS[0]), ZOOM_LIMITS[1]);
  const applied = zoom / camera.zoom;
  camera.pan[0] += (px - view.origin[0]) * (1 - applied);
  camera.pan[1] += (py - view.origin[1]) * (1 - applied);
  camera.zoom = zoom;
  redrawChart();
}

function panBy(dx, dy) {
  camera.pan[0] += dx;
  camera.pan[1] += dy;
  redrawChart();
}

// Pinch (or Ctrl + wheel) zooms; a two-finger swipe (plain wheel) pans
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.ctrlKey) zoomAround(...pointerPx(e), Math.exp(-e.deltaY * ZOOM_SPEED));
  else panBy(-e.deltaX, -e.deltaY);
}, { passive: false });

canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // the right button pans

canvas.addEventListener('pointerdown', (e) => {
  if (e.button === PAN_BUTTON) {
    panFrom = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button !== CIRCLE_BUTTON) return;
  if (erasing) {
    eraseAt(pointerPx(e));
    return;
  }
  if (sizing) {
    // Second click: fix the edge here
    sizing.edge = pointerWorld(e);
    sizing = null;
  } else {
    const center = pointerWorld(e);
    sizing = { center, edge: center, pressedAt: [e.clientX, e.clientY], dragged: false };
    circles.push(sizing);
    canvas.setPointerCapture(e.pointerId);
  }
  render();
});

canvas.addEventListener('pointermove', (e) => {
  if (panFrom) {
    panBy(e.clientX - panFrom[0], e.clientY - panFrom[1]);
    panFrom = [e.clientX, e.clientY];
  }
  if (!sizing) return;
  sizing.edge = pointerWorld(e);
  if (sizing.pressedAt && Math.hypot(e.clientX - sizing.pressedAt[0], e.clientY - sizing.pressedAt[1]) > DRAG_THRESHOLD) {
    sizing.dragged = true;
  }
  render();
});

canvas.addEventListener('pointerup', (e) => {
  if (e.button === PAN_BUTTON) {
    panFrom = null;
    return;
  }
  if (!sizing) return;
  // Released after dragging: that's the edge. Released in place: keep sizing until the second click.
  if (sizing.dragged) sizing = null;
  else sizing.pressedAt = null;
  render();
});

function clearCircles() {
  circles = [];
  sizing = null;
  render();
}

// The circle under the pointer: one whose outline is close, else the smallest one around the pointer
function circleAt([px, py]) {
  const measured = circles.map((circle) => {
    const [cx, cy] = view.toPx(...circle.center);
    const [ex, ey] = view.toPx(...circle.edge);
    const radius = Math.hypot(ex - cx, ey - cy);
    return { circle, radius, fromCentre: Math.hypot(px - cx, py - cy) };
  });
  const onOutline = measured.filter((m) => Math.abs(m.fromCentre - m.radius) <= ERASE_REACH);
  const pool = onOutline.length ? onOutline : measured.filter((m) => m.fromCentre <= m.radius);
  const distance = (m) => (onOutline.length ? Math.abs(m.fromCentre - m.radius) : m.radius);
  return pool.sort((a, b) => distance(a) - distance(b))[0]?.circle;
}

function eraseAt(px) {
  const circle = circleAt(px);
  if (!circle) return;
  circles = circles.filter((c) => c !== circle);
  render();
}

function setEraser(on) {
  erasing = on;
  if (on && sizing) {
    circles = circles.filter((c) => c !== sizing); // drop a circle that was still being drawn
    sizing = null;
  }
  eraserButton.classList.toggle('is-active', on);
  eraserButton.setAttribute('aria-pressed', String(on));
  canvas.classList.toggle('is-erasing', on);
  render();
}

function resetView() {
  Object.assign(camera, { zoom: 1, pan: [0, 0] });
  redrawChart();
}

el.querySelector('.js-clear-circles').addEventListener('click', clearCircles);
eraserButton.addEventListener('click', () => setEraser(!erasing));
el.querySelector('.js-reset-view').addEventListener('click', resetView);
el.querySelector('.js-zoom-in').addEventListener('click', () => zoomAround(size.width / 2, size.height / 2, ZOOM_STEP));
el.querySelector('.js-zoom-out').addEventListener('click', () => zoomAround(size.width / 2, size.height / 2, 1 / ZOOM_STEP));

new ResizeObserver(resize).observe(body);

// A new level draws its own chart and starts without circles
export function load(newLevel) {
  level = newLevel;
  circles = [];
  sizing = null;
  setEraser(false);
  Object.assign(camera, { zoom: 1, pan: [0, 0] });
  resize();
}
