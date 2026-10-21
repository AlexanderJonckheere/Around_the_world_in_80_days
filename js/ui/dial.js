import { DIAL } from '../constants/colors.js';

// Canvas 2D dial drawing shared by all widgets. The static face is drawn once into an offscreen
// canvas; each frame only copies it and draws the moving parts on top.
const FONT = 'Georgia, "Times New Roman", serif';
const MAX_PIXEL_RATIO = 2;
const BEZEL = 0.09; // fraction of the dial size

export const deg = (d) => (d * Math.PI) / 180;

export function createDial(canvas, drawFace) {
  const size = Number(canvas.dataset.size);
  const ratio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
  canvas.width = canvas.height = size * ratio;
  canvas.style.width = canvas.style.height = `${size}px`;

  const face = document.createElement('canvas');
  face.width = face.height = size * ratio;
  const faceCtx = face.getContext('2d');
  faceCtx.scale(ratio, ratio);
  drawFace(faceCtx, size);

  const ctx = canvas.getContext('2d');
  return {
    // faceRotation turns the cached face (used by the compass card)
    draw(drawMoving, faceRotation = 0) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate(faceRotation);
      ctx.drawImage(face, -size / 2, -size / 2, size, size);
      ctx.restore();
      drawMoving(ctx, size);
    },
  };
}

export function drawBezel(ctx, size) {
  const c = size / 2;
  const ring = ctx.createLinearGradient(0, 0, size, size);
  ring.addColorStop(0, DIAL.brassLight);
  ring.addColorStop(1, DIAL.brassDark);
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();

  const paper = ctx.createRadialGradient(c, c, c * 0.2, c, c, c * (1 - BEZEL));
  paper.addColorStop(0, DIAL.face);
  paper.addColorStop(1, DIAL.faceShade);
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.arc(c, c, c * (1 - BEZEL), 0, Math.PI * 2);
  ctx.fill();
}

// Angle (radians, 0 = right, clockwise) of a value on a scale
export const angleOf = (value, s) => deg(s.from + ((value - s.min) / (s.max - s.min)) * (s.to - s.from));

// Ticks and numbers. scale: { min, max, from, to (degrees), fine, minor, major, label(v), skipLast, radial }
export function drawScale(ctx, size, scale) {
  const c = size / 2;
  const outer = c * (1 - BEZEL) - 3;
  const steps = Math.round((scale.max - scale.min) / scale.fine);
  const isMultiple = (v, step) => Math.abs(v / step - Math.round(v / step)) < 1e-6;

  ctx.strokeStyle = DIAL.ink;
  ctx.fillStyle = DIAL.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(size * 0.065)}px ${FONT}`;

  for (let i = 0; i <= steps - (scale.skipLast ? 1 : 0); i++) {
    const v = scale.min + i * scale.fine;
    const offset = v - scale.min;
    const major = isMultiple(offset, scale.major);
    const minor = major || isMultiple(offset, scale.minor);
    const length = major ? size * 0.07 : minor ? size * 0.045 : size * 0.025;
    const a = angleOf(v, scale);
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    ctx.lineWidth = major ? 1.6 : 0.8;
    ctx.beginPath();
    ctx.moveTo(c + cos * outer, c + sin * outer);
    ctx.lineTo(c + cos * (outer - length), c + sin * (outer - length));
    ctx.stroke();

    if (!major) continue;
    const r = outer - size * 0.13;
    ctx.save();
    ctx.translate(c + cos * r, c + sin * r);
    if (scale.radial) ctx.rotate(a + Math.PI / 2);
    ctx.fillText(scale.label ? scale.label(v) : String(v), 0, 0);
    ctx.restore();
  }
}

export function drawLabel(ctx, size, text, y, sizeFactor = 0.06) {
  ctx.fillStyle = DIAL.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic ${Math.round(size * sizeFactor)}px ${FONT}`;
  ctx.fillText(text, size / 2, y);
}

// Tapered needle from (cx, cy) at `angle`, with a short tail and a hub
export function drawNeedle(ctx, cx, cy, angle, length, { color = DIAL.needle, width = 3 } = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(length, 0);
  ctx.lineTo(-length * 0.18, width);
  ctx.lineTo(-length * 0.18, -width);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = DIAL.hub;
  ctx.beginPath();
  ctx.arc(0, 0, width + 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
