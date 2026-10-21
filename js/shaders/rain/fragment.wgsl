// Rain drops on the window glass.
// Port of "Heartfelt" by Martijn Steinrucken / BigWings (https://www.shadertoy.com/view/ltffzl),
// CC BY-NC-SA 3.0. Only the drops part: it returns how the glass bends the view, and the game blurs
// and refracts the world itself (rain.js). Main function first: wgslFn reads the first function.
//
// uv: position on the glass, y up, about 1 per screen height (like Shadertoy's centred uv)
// t: time (Shadertoy uses iTime * .2); amount: rain amount 0..1
// fallScale: extra scale for the running drops only (> 1 makes them smaller than Heartfelt's)
// Returns vec3(refraction offset x, y, how much of the pixel is covered by a drop).
fn rainDrops(uv: vec2f, t: f32, amount: f32, fallScale: f32) -> vec3f {
  if (amount < 0.01) {
    return vec3f(0.0);
  }
  let staticDrops = S(-0.5, 1.0, amount) * 2.0;
  let layer1 = S(0.25, 0.75, amount);
  let layer2 = S(0.0, 0.5, amount);

  let c = Drops(uv, t, staticDrops, layer1, layer2, fallScale);
  let e = vec2f(0.001, 0.0);
  let cx = Drops(uv + e, t, staticDrops, layer1, layer2, fallScale).x;
  let cy = Drops(uv + e.yx, t, staticDrops, layer1, layer2, fallScale).x;
  let n = vec2f(cx - c.x, cy - c.x);
  return vec3f(n, c.x);
}

// Shadertoy's smoothstep, written out: WGSL leaves smoothstep with a > b undefined
fn S(a: f32, b: f32, t: f32) -> f32 {
  let x = clamp((t - a) / (b - a), 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}

fn N13(p: f32) -> vec3f {
  var p3 = fract(vec3f(p) * vec3f(0.1031, 0.11369, 0.13787));
  p3 = p3 + dot(p3, p3.yzx + 19.19);
  return fract(vec3f((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

fn N(t: f32) -> f32 {
  return fract(sin(t * 12345.564) * 7658.76);
}

fn Saw(b: f32, t: f32) -> f32 {
  return S(0.0, b, t) * S(1.0, b, t);
}

// Big drops running down the glass, each leaving a trail of small droplets
fn DropLayer2(uvIn: vec2f, t: f32) -> vec2f {
  let UV = uvIn;
  var uv = uvIn;
  uv.y = uv.y + t * 0.75;
  let a = vec2f(6.0, 1.0);
  let grid = a * 2.0;
  var id = floor(uv * grid);

  let colShift = N(id.x);
  uv.y = uv.y + colShift;

  id = floor(uv * grid);
  let n = N13(id.x * 35.2 + id.y * 2376.1);
  let st = fract(uv * grid) - vec2f(0.5, 0.0);

  var x = n.x - 0.5;
  var y = UV.y * 20.0;
  let wiggle = sin(y + sin(y));
  x = x + wiggle * (0.5 - abs(x)) * (n.z - 0.5);
  x = x * 0.7;
  let ti = fract(t + n.z);
  y = (Saw(0.85, ti) - 0.5) * 0.9 + 0.5;
  let p = vec2f(x, y);

  let d = length((st - p) * a.yx);
  let mainDrop = S(0.4, 0.0, d);

  let r = sqrt(S(1.0, y, st.y));
  let cd = abs(st.x - x);
  var trail = S(0.23 * r, 0.15 * r * r, cd);
  let trailFront = S(-0.02, 0.02, st.y - y);
  trail = trail * trailFront * r * r;

  y = fract(UV.y * 10.0) + (st.y - 0.5);
  let dd = length(st - vec2f(x, y));
  let droplets = S(0.3, 0.0, dd);
  let m = mainDrop + droplets * r * trailFront;

  return vec2f(m, trail);
}

// Small drops that land on the glass and slowly fade
fn StaticDrops(uvIn: vec2f, t: f32) -> f32 {
  var uv = uvIn * 40.0;
  let id = floor(uv);
  uv = fract(uv) - 0.5;
  let n = N13(id.x * 107.45 + id.y * 3543.654);
  let p = (n.xy - 0.5) * 0.7;
  let d = length(uv - p);
  let fade = Saw(0.025, fract(t + n.z));
  return S(0.3, 0.0, d) * fract(n.z * 10.0) * fade;
}

fn Drops(uv: vec2f, t: f32, l0: f32, l1: f32, l2: f32, fallScale: f32) -> vec2f {
  let s = StaticDrops(uv, t) * l0;
  let m1 = DropLayer2(uv * fallScale, t) * l1;
  let m2 = DropLayer2(uv * 1.85 * fallScale, t) * l2;
  var c = s + m1.x + m2.x;
  c = S(0.3, 1.0, c);
  return vec2f(c, max(m1.y * l0, m2.y * l1));
}
