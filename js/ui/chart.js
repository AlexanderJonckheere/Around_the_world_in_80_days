import { LANDMARKS } from '../constants/landmarks.js';

// The chart (CLAUDE.md §8.1), drawn with Canvas 2D for both the map panel and the 3D map on the table.
// North is up: world −z is up on the chart, +x is right. 1 grid square = 1 km.
// It shows every landmark of the world; the ones on this level's route carry their order number.
// It never shows the balloon's live position, only where the leg departs from.
const GRID = 1000; // m
// The departure sits low on the chart, centred, so there's room above where most routes head
const DEPARTURE_AT = { x: 0.5, y: 0.7 }; // fraction of the chart width / height
const MARGIN = 0.08; // fraction of the chart kept free at every edge (compass rose, scale bar)
const LABEL_ROOM = 0.16; // fraction of the width kept free right of a landmark, for its name
const MIN_SPAN = 12000; // m shown across at least, so a short leg isn't zoomed in too far
const MIN_GRID_PX = 12; // when zoomed out, grid squares grow (1 → 5 → 25 km) to stay at least this big

export const CHART_COLORS = {
  paper: '#ece0c0',
  grid: 'rgba(80, 100, 140, 0.25)',
  ink: '#2b2118',
  safeArea: 'rgba(150, 60, 40, 0.12)',
  safeEdge: 'rgba(150, 60, 40, 0.6)',
  storm: 'rgba(70, 70, 95, 0.22)',
  stormEdge: 'rgba(60, 55, 90, 0.75)',
};
const STORM_HATCH = 1.1; // hatch spacing, in chart units
const FONT = 'Georgia, "Times New Roman", serif';

// The level's points of interest: departure + landmarks, in world metres
const departureOf = (level) => ({ x: level.start.x ?? 0, z: level.start.z ?? 0 });

// World ↔ chart pixels for a chart of this size. The departure is pinned at DEPARTURE_AT and the
// scale is the largest that still fits this level's route (with labels); other landmarks show where
// they fall. The map panel can zoom and pan on top of that.
// camera: the map panel's zoom (× the fitted scale) and pan (px); the 3D map uses the fitted view.
export function createView(level, width, height, camera = { zoom: 1, pan: [0, 0] }) {
  const departure = departureOf(level);
  const anchor = [width * DEPARTURE_AT.x, height * DEPARTURE_AT.y];
  const room = {
    left: anchor[0] - width * MARGIN,
    right: width * (1 - MARGIN - LABEL_ROOM) - anchor[0],
    up: anchor[1] - height * MARGIN,
    down: height * (1 - MARGIN) - anchor[1],
  };

  // Fit this level's route: for each of its landmarks, how many px per metre keep it in the free room
  let fitted = width / MIN_SPAN;
  for (const { x, z } of level.route) {
    const dx = x - departure.x;
    const dz = z - departure.z;
    if (dx > 0) fitted = Math.min(fitted, room.right / dx);
    if (dx < 0) fitted = Math.min(fitted, room.left / -dx);
    if (dz < 0) fitted = Math.min(fitted, room.up / -dz);
    if (dz > 0) fitted = Math.min(fitted, room.down / dz);
  }
  const pxPerMetre = fitted * camera.zoom;
  const origin = [anchor[0] + camera.pan[0], anchor[1] + camera.pan[1]];

  return {
    pxPerMetre,
    origin, // where the departure is on the chart, in px
    toPx: (x, z) => [origin[0] + (x - departure.x) * pxPerMetre, origin[1] + (z - departure.z) * pxPerMetre],
    toWorld: (px, py) => [departure.x + (px - origin[0]) / pxPerMetre, departure.z + (py - origin[1]) / pxPerMetre],
  };
}

// Small ink symbols per landmark type, centred on (0, 0), about `s` px tall
const SYMBOLS = {
  radio: (ctx, s) => {
    ctx.moveTo(-s * 0.3, s * 0.5);
    ctx.lineTo(0, -s * 0.4);
    ctx.lineTo(s * 0.3, s * 0.5);
    ctx.moveTo(s * 0.12, -s * 0.5);
    ctx.arc(0, -s * 0.5, s * 0.12, 0, Math.PI * 2);
  },
  church: (ctx, s) => {
    ctx.moveTo(0, -s * 0.5);
    ctx.lineTo(0, s * 0.5);
    ctx.moveTo(-s * 0.3, -s * 0.15);
    ctx.lineTo(s * 0.3, -s * 0.15);
  },
  lighthouse: (ctx, s) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2);
      ctx.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
    }
  },
  windmill: (ctx, s) => {
    ctx.moveTo(-s * 0.4, -s * 0.4);
    ctx.lineTo(s * 0.4, s * 0.4);
    ctx.moveTo(s * 0.4, -s * 0.4);
    ctx.lineTo(-s * 0.4, s * 0.4);
  },
  castle: (ctx, s) => {
    const h = s * 0.4;
    ctx.moveTo(-h, h);
    ctx.lineTo(-h, -h);
    for (let i = 0; i < 3; i++) {
      const x = -h + (i * 2 * h) / 2.5;
      ctx.lineTo(x + h * 0.4, -h);
      ctx.lineTo(x + h * 0.4, -h * 0.6);
      ctx.lineTo(x + h * 0.8, -h * 0.6);
      ctx.lineTo(x + h * 0.8, -h);
    }
    ctx.lineTo(h, -h);
    ctx.lineTo(h, h);
    ctx.closePath();
  },
};

// 1 km, or 5 / 25 km when zoomed far out, so the grid never turns into a grey blur
const gridStep = (view) => {
  let step = GRID;
  while (step * view.pxPerMetre < MIN_GRID_PX) step *= 5;
  return step;
};

function drawGrid(ctx, width, height, view) {
  const step = gridStep(view);
  const [west, north] = view.toWorld(0, 0);
  const [east, south] = view.toWorld(width, height);
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.ceil(west / step) * step; x <= east; x += step) {
    const [px] = view.toPx(x, 0);
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
  }
  for (let z = Math.ceil(north / step) * step; z <= south; z += step) {
    const [, py] = view.toPx(0, z);
    ctx.moveTo(0, py);
    ctx.lineTo(width, py);
  }
  ctx.stroke();
}

// Regions: { x, z, w, h, altitude } with x, z the north-west corner, sizes in metres
function drawSafeAltitudes(ctx, level, view, unit) {
  for (const r of level.minSafeAltitude) {
    const [px, py] = view.toPx(r.x, r.z);
    const w = r.w * view.pxPerMetre;
    const h = r.h * view.pxPerMetre;
    ctx.fillStyle = CHART_COLORS.safeArea;
    ctx.fillRect(px, py, w, h);
    ctx.strokeStyle = CHART_COLORS.safeEdge;
    ctx.setLineDash([unit * 0.5, unit * 0.3]);
    ctx.strokeRect(px, py, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = CHART_COLORS.safeEdge;
    ctx.font = `italic ${unit * 1.1}px ${FONT}`;
    ctx.fillText(`min ${r.altitude} m`, px + unit * 0.5, py + unit * 1.5);
  }
}

// Storm areas: a shaded, hatched circle with a dashed rim, to plan around
function drawStorms(ctx, level, view, unit) {
  for (const s of level.storms ?? []) {
    const [cx, cy] = view.toPx(s.x, s.z);
    const r = s.radius * view.pxPerMetre;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = CHART_COLORS.storm;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = CHART_COLORS.stormEdge;
    ctx.lineWidth = Math.max(0.5, unit * 0.06);
    ctx.beginPath();
    for (let d = -r * 2; d < r * 2; d += unit * STORM_HATCH) {
      ctx.moveTo(cx + d - r, cy - r);
      ctx.lineTo(cx + d + r, cy + r);
    }
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = CHART_COLORS.stormEdge;
    ctx.lineWidth = Math.max(1, unit * 0.15);
    ctx.setLineDash([unit * 0.6, unit * 0.4]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = CHART_COLORS.stormEdge;
    ctx.font = `bold italic ${unit * 1.2}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Storm', cx, cy);
    ctx.textAlign = 'left';
  }
}

function drawLandmarks(ctx, level, view, unit) {
  ctx.strokeStyle = CHART_COLORS.ink;
  ctx.fillStyle = CHART_COLORS.ink;
  ctx.lineWidth = Math.max(1, unit * 0.15);
  ctx.font = `${unit * 1.2}px ${FONT}`;
  ctx.textBaseline = 'middle';
  const landmarks = level.route;
  const symbolSize = unit * 2;

  // Symbols first, so the labels can be placed around all of them
  const placed = landmarks.map((lm) => {
    const [px, py] = view.toPx(lm.x, lm.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.beginPath();
    SYMBOLS[lm.type](ctx, symbolSize);
    ctx.stroke();
    ctx.restore();
    return { x: px - symbolSize / 2, y: py - symbolSize / 2, w: symbolSize, h: symbolSize };
  });

  for (const lm of landmarks) {
    const [px, py] = view.toPx(lm.x, lm.z);
    const { name, height } = LANDMARKS[lm.type];
    const order = level.route.indexOf(lm);
    const label = `${order >= 0 ? `${order + 1}. ` : ''}${name} · ${height.toLocaleString('en-GB')} m`;
    ctx.font = `${order >= 0 ? 'bold ' : ''}${unit * 1.2}px ${FONT}`;
    const [x, y] = placeLabel(ctx, label, px, py, unit, placed);
    ctx.fillText(label, x, y);
  }
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Right of the symbol if there's room, otherwise left, above or below, so nearby names don't overlap
function placeLabel(ctx, text, px, py, unit, placed) {
  const w = ctx.measureText(text).width;
  const h = unit * 1.4;
  const gap = unit * 1.6;
  const options = [
    [px + gap, py],
    [px - gap - w, py],
    [px - w / 2, py - gap],
    [px - w / 2, py + gap],
  ];
  const rectAt = ([x, y]) => ({ x, y: y - h / 2, w, h });
  const [x, y] = options.find((o) => !placed.some((r) => overlaps(r, rectAt(o)))) ?? options[0];
  placed.push(rectAt([x, y]));
  return [x, y];
}

function drawDeparture(ctx, level, view, unit) {
  const { x, z } = departureOf(level);
  const [px, py] = view.toPx(x, z);
  ctx.strokeStyle = CHART_COLORS.ink;
  ctx.lineWidth = Math.max(1, unit * 0.15);
  ctx.beginPath();
  ctx.arc(px, py, unit * 0.7, 0, Math.PI * 2);
  ctx.moveTo(px - unit * 1.1, py);
  ctx.lineTo(px + unit * 1.1, py);
  ctx.moveTo(px, py - unit * 1.1);
  ctx.lineTo(px, py + unit * 1.1);
  ctx.stroke();
  ctx.font = `italic ${unit * 1.1}px ${FONT}`;
  ctx.fillText('Departure', px + unit * 1.6, py + unit * 1.4);
}

function drawCompassRose(ctx, width, unit) {
  const cx = width - unit * 5;
  const cy = unit * 5;
  const r = unit * 3;
  ctx.fillStyle = CHART_COLORS.ink;
  ctx.strokeStyle = CHART_COLORS.ink;
  ctx.lineWidth = Math.max(1, unit * 0.1);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.18, 0);
    ctx.lineTo(-r * 0.18, 0);
    ctx.closePath();
    if (i === 0) ctx.fill();
    else ctx.stroke();
    ctx.restore();
  }
  ctx.font = `bold ${unit * 1.3}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - r - unit * 1.1);
  ctx.textAlign = 'left';
}

// Bottom centre: the corners are where the instrument widgets sit when the map is open
function drawScaleBar(ctx, width, height, view, unit) {
  const step = gridStep(view);
  const length = step * view.pxPerMetre;
  const x = width / 2 - length / 2;
  const y = height - unit * 2.5;
  ctx.strokeStyle = CHART_COLORS.ink;
  ctx.fillStyle = CHART_COLORS.ink;
  ctx.lineWidth = Math.max(1, unit * 0.2);
  ctx.beginPath();
  ctx.moveTo(x, y - unit * 0.5);
  ctx.lineTo(x, y);
  ctx.lineTo(x + length, y);
  ctx.lineTo(x + length, y - unit * 0.5);
  ctx.stroke();
  ctx.font = `${unit * 1.1}px ${FONT}`;
  ctx.fillText(`${step / 1000} km`, x + length + unit * 0.6, y - unit * 0.2);
}

// Draws the whole chart; `unit` scales line widths and text with the chart size
export function drawChart(ctx, width, height, level, view) {
  const unit = Math.min(width, height) / 60;
  ctx.fillStyle = CHART_COLORS.paper;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, view);
  drawSafeAltitudes(ctx, level, view, unit);
  drawStorms(ctx, level, view, unit);
  drawLandmarks(ctx, level, view, unit);
  drawDeparture(ctx, level, view, unit);
  drawCompassRose(ctx, width, unit);
  drawScaleBar(ctx, width, height, view, unit);
}
