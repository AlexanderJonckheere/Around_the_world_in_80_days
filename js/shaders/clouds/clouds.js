import {
  Fn, If, Loop, Break, uniform, uniformArray, float, vec2, vec3, vec4, mix, clamp, max, min, dot, pow, exp, normalize,
  smoothstep, select, positionWorldDirection, mx_noise_float, time, interleavedGradientNoise, screenCoordinate,
  screenUV, screenSize, colorSpaceToWorking, rtt,
} from 'three/tsl';
import * as THREE from 'three/webgpu';
import { CLOUD_TOP_ALTITUDE, STORM_EDGE } from '../../constants/rules.js';
import { LANDMARKS } from '../../constants/landmarks.js';
import { windowRain } from '../rain/rain.js';

// Volumetric cloud sea + sky.
// Port of "Clouds" by Inigo Quilez (https://www.shadertoy.com/view/XslGRr) to TSL, adapted so the
// camera flies *above* the deck: the cloud layer sits at a fixed altitude (a height reference),
// the ray starts at the balloon's true altitude, and the world is rotated by the heading.
// On top of the original: a rolling deck, towering cumulus in "weather regions" along the route,
// and a thin high cloud sheet overhead.
//
// Two parts: the sky is the scene background (createSkyNode); the cloud volume is drawn after the
// scene (createCloudPass), marching each ray only up to the nearest object in the depth buffer.
// That way clouds in front of a far landmark hide it, while the cabin stays in front of the clouds.
//
// Scene frame: the cabin sits at the origin facing -Z. World frame: x = east, z = south.
// All heights are absolute metres above sea level.

const DECK_SWELL = 25; // m, gentle rise and fall of the deck top
const TOWER_HEIGHT = 1100; // m, the tallest cumulus rises this far above the deck
const TOWER_TAPER = 0.75; // how much a tower narrows towards the top
const TOWER_DOME = 2.2; // >1: the narrowing speeds up with height, giving rounded domes, not cones
const LAYER_BASE = CLOUD_TOP_ALTITUDE - 380;
const LAYER_TOP = CLOUD_TOP_ALTITUDE + 40 + TOWER_HEIGHT;

// Scales of the noise features, in metres
const DETAIL_SCALE = vec3(1 / 420, 1 / 170, 1 / 420);
const SWELL_SCALE = 1 / 900;
const TOWER_SCALE = 1 / 1900; // wide, massive towers
const BILLOW_SCALE = 1 / 260; // round 'cauliflower' bulges on the towers
const BILLOW_STRENGTH = 0.45;
const WEATHER_SCALE = 1 / 6000; // calm stretches vs. stretches full of towers
const TOWER_WARP = 140; // m, the detail noise pushes tower edges around so they look fluffy, not boxy

// A small gap is kept around each landmark, so up close its top peeks out of the clouds;
// from further away, towers in between hide it.
const MAX_LANDMARKS = 16; // the whole shared world fits
const CLEAR_RADIUS = 200; // m, no towers this close to a landmark (fading back in by 2.5×)
const FAR_AWAY = 1e7;

// Each landmark stands in a collar of cloud that rises to just below its top, so only the tip pops
// out: easy to spot up close, gone in the haze from far away. The collar stays below the target
// window (the tip is at least PEEK.min high), so flying in at the right height is never a white-out.
// m: full height out to `inner` from the landmark, back down to the deck `fade` further out
const COLLAR = { inner: 250, fade: 450, soft: 60 };
const PEEK = { fraction: 0.3, min: 40, max: 150 }; // how much of a landmark sticks out of its collar

// Storms: dense, towering, dark clouds over each storm area. Same smooth edge as the flight model
// (storms.js), so what you see and what the balloon feels ease in together.
const MAX_STORMS = 6;
const DEPARTURE_CLEAR = { radius: 1200, fade: 500 }; // m: no towers here, so a flight never starts blind
const STORM_LOOK = {
  cover: 0.4, // tower coverage inside a storm (the rest varies with the tower noise, giving separate cells)
  darken: 0.7, // how much darker storm clouds are
  sunBlock: 0.65, // how much sunlight a storm swallows
  sky: [0.3, 0.33, 0.38], // the sky colour when you're inside one
  skyAmount: 0.6,
  sunDim: 0.85, // how much of the sun (disc, glow, glare) disappears inside a storm
};

// 1 in clear air, down to 1 - sunDim in the heart of a storm
const sunVisible = () => float(1).sub(skyUniforms.stormInside.mul(STORM_LOOK.sunDim));

const HIGH_LAYER_ALTITUDE = 2400; // m, thin sheet above the ceiling, seen when looking up
const HIGH_LAYER_SCALE = 1 / 2600;

export const skyUniforms = {
  balloonX: uniform(0),
  balloonZ: uniform(0),
  altitude: uniform(500), // true altitude: where the rays start, so climbing lifts you away from the deck
  heading: uniform(0), // radians
  burnerGlow: uniform(0), // 0..1
  // World frame: due east and low, so at the starting heading (north) it's directly right of the cabin
  sunDirection: uniform(new THREE.Vector3(1, 0.05, 0).normalize()),
  windSpeed: uniform(4), // m/s cloud drift, purely visual
  // x, z, collar top (altitude) and collar radius of every landmark
  landmarks: uniformArray(Array.from({ length: MAX_LANDMARKS }, () => new THREE.Vector4(FAR_AWAY, FAR_AWAY, 0, 0)), 'vec4'),
  // x, z, radius of every storm, and how deep in a storm the balloon is now (0..1)
  storms: uniformArray(Array.from({ length: MAX_STORMS }, () => new THREE.Vector3(FAR_AWAY, FAR_AWAY, 0)), 'vec3'),
  stormInside: uniform(0),
  departure: uniform(new THREE.Vector2(FAR_AWAY, FAR_AWAY)),
};

export function setCloudDeparture({ x, z }) {
  skyUniforms.departure.value.set(x, z);
}

export function setCloudStorms(storms) {
  skyUniforms.storms.array.forEach((slot, i) => {
    const s = storms[i];
    if (s) slot.set(s.x, s.z, s.radius);
    else slot.set(FAR_AWAY, FAR_AWAY, 0);
  });
}

// 0 outside every storm, rising smoothly to 1 over the outer STORM_EDGE metres
const stormAmount = (xz) => {
  let amount = float(0);
  for (let i = 0; i < MAX_STORMS; i++) {
    const s = skyUniforms.storms.element(i);
    amount = max(amount, smoothstep(s.z, s.z.sub(STORM_EDGE), xz.sub(s.xy).length()));
  }
  return amount;
};

// Tell the shader where the landmarks are ({ x, z } in world metres), so it keeps towers away from them
export function setCloudLandmarks(landmarks) {
  skyUniforms.landmarks.array.forEach((slot, i) => {
    const lm = landmarks[i];
    if (!lm) return slot.set(FAR_AWAY, FAR_AWAY, 0, 0);
    const { height } = LANDMARKS[lm.type];
    const peek = Math.min(Math.max(height * PEEK.fraction, PEEK.min), PEEK.max);
    slot.set(lm.x, lm.z, height - peek, COLLAR.inner);
  });
}

// iq's sky colour at the horizon, plus the lift he adds
const SKY_HORIZON = [0.6, 0.71, 0.75];
const SKY_LIFT = 0.075;
const CONTRAST = [0.15, 1.1]; // iq's final smoothstep

// The horizon as it ends up on screen, for the landmark fog (scene fog works in linear colour)
const smooth = (x) => {
  const t = Math.min(Math.max((x - CONTRAST[0]) / (CONTRAST[1] - CONTRAST[0]), 0), 1);
  return t * t * (3 - 2 * t);
};
export const HAZE_COLOR = new THREE.Color().setRGB(...SKY_HORIZON.map((c) => smooth(c + SKY_LIFT)), THREE.SRGBColorSpace);

// Like iq's MARCH(40, map5); MARCH(40, map4); ...: each stage carries on where the last one stopped,
// with fewer noise octaves. Steps grow with distance, so later stages are further away, where the
// fine detail can't be seen anyway.
const MARCH_STAGES = [
  { steps: 28, octaves: 4 },
  { steps: 24, octaves: 3 },
  { steps: 20, octaves: 2 },
];
// The light sample only needs the rough shape: fewer octaves, no billows, and the landmark clearance
// of the sample it belongs to
const LIGHT_OCTAVES = 2;
// Clouds are soft: computing them at half the CSS size (¼ of the pixels) is hardly visible.
// Measured in CSS pixels, so a retina screen doesn't make the clouds 2–4× more expensive.
const CLOUD_RESOLUTION = 0.5;
const UPSCALE_SPREAD = 0.75; // cloud texels between the four upscaling taps and the pixel
// Rain on the windows (storms): only where you look outside, i.e. past the cabin
const GLASS_DEPTH = 4; // m; anything rendered closer is the cabin itself and stays dry
const RAIN_MIST = { amount: 0.55, spread: 6 }; // misted glass between the drops: how much, and blur spread (cloud texels)
const RAIN_MIST_TINT = [0.62, 0.66, 0.72];
const OPAQUE = 0.97; // stop once the clouds in front cover this much; what's behind barely shows
const EMPTY_SKIP = 3; // step this many times further through air that can't hold cloud
const STEP_GROWTH = 0.07; // each step is this fraction of the distance travelled, so far clouds are reached too
const MIN_STEP = 10; // m
const MAX_DIST = 30000; // m; high up, the deck near the horizon is far away
const NEAR_CLEAR = 150; // m around the balloon kept free of cloud, so you can always see out
const SHADE_FROM_DENSITY = 0.4; // how much density darkens a cloud sample (1 = iq's original); low keeps the mass bright
const STEP_OPACITY = 0.5; // iq uses 0.4; a bit more makes the towers look solid and heavy
const LIGHT_SAMPLE = 90; // m towards the sun, for edge light and self-shadow
const SELF_SHADOW = 3.2; // how strongly a cloud shades itself
const SILVER_LINING = 0.6; // forward scattering, 0 = none

const fbm = (p, octaves) => {
  let f = float(0);
  let amp = 0.5;
  let q = p;
  for (let i = 0; i < octaves; i++) {
    f = f.add(mx_noise_float(q).mul(amp));
    q = q.mul(2.03);
    amp *= 0.5;
  }
  return f;
};

// 1 far from every landmark, 0 right next to one
// Per spot: `clear` keeps towers away from landmarks (1 far away, 0 right next to one), and
// `collarTop` is how high the collar around the nearest landmark reaches here (the deck elsewhere)
const landmarkInfluence = (xz) => {
  let clear = float(1);
  let collarTop = float(CLOUD_TOP_ALTITUDE);
  for (let i = 0; i < MAX_LANDMARKS; i++) {
    const lm = skyUniforms.landmarks.element(i);
    const d = xz.sub(lm.xy).length();
    clear = clear.mul(smoothstep(CLEAR_RADIUS, CLEAR_RADIUS * 2.5, d));
    collarTop = max(collarTop, mix(float(CLOUD_TOP_ALTITUDE), lm.z, smoothstep(lm.w.add(COLLAR.fade), lm.w, d)));
  }
  // The departure clearing only thins ordinary towers; storms are never erased by it
  const fromDeparture = xz.sub(skyUniforms.departure).length();
  const departureClear = smoothstep(DEPARTURE_CLEAR.radius, DEPARTURE_CLEAR.radius + DEPARTURE_CLEAR.fade, fromDeparture);
  return { clear, departureClear, collarTop, storm: stormAmount(xz) };
};

// Cheap, cautious test: can there be any cloud here? Below the deck top there always can; above it
// only where the raw tower or weather noise is close to (or past) the point where towers start.
// The margin covers the edge warp (TOWER_WARP), so tower edges are never skipped.
const DECK_MAX = CLOUD_TOP_ALTITUDE + 40 + DECK_SWELL;
const SKIP_MARGIN = 0.08;
const mayHoldCloud = (p) => {
  const drift = vec2(time.mul(skyUniforms.windSpeed), time.mul(skyUniforms.windSpeed).mul(0.3));
  const xz = vec2(p.x, p.z).add(drift);
  const towerNoise = mx_noise_float(xz.mul(TOWER_SCALE).add(5.1));
  const weatherNoise = mx_noise_float(xz.mul(WEATHER_SCALE).add(17.3));
  const towerHere = towerNoise.greaterThan(-0.25 - SKIP_MARGIN).and(weatherNoise.greaterThan(-0.5 - SKIP_MARGIN));
  // ...and inside a landmark's collar
  let collarHere = p.y.lessThan(-FAR_AWAY);
  for (let i = 0; i < MAX_LANDMARKS; i++) {
    const lm = skyUniforms.landmarks.element(i);
    collarHere = collarHere.or(xz.sub(lm.xy).length().lessThan(lm.w.add(COLLAR.fade)).and(p.y.lessThan(lm.z)));
  }
  // ...and inside a storm
  let stormHere = p.y.lessThan(-FAR_AWAY);
  for (let i = 0; i < MAX_STORMS; i++) {
    const s = skyUniforms.storms.element(i);
    stormHere = stormHere.or(xz.sub(s.xy).length().lessThan(s.z));
  }
  return p.y.lessThan(DECK_MAX).or(towerHere).or(collarHere).or(stormHere);
};

// 0 where the weather is calm, up to 1 in the middle of a cumulus tower
const towerAmount = (xz, { clear, departureClear, storm }) => {
  const weather = smoothstep(-0.5, 0.1, mx_noise_float(xz.mul(WEATHER_SCALE).add(17.3)));
  const towers = smoothstep(-0.25, 0.55, mx_noise_float(xz.mul(TOWER_SCALE).add(5.1))); // soft: domes, not blocks
  // In a storm the sky fills with towers, whatever the weather noise says
  const stormTowers = storm.mul(float(STORM_LOOK.cover).add(towers.mul(1 - STORM_LOOK.cover)));
  return max(towers.mul(weather).mul(departureClear), stormTowers).mul(clear);
};

// Density in [0, 1]; `p` is in world metres (y = altitude). Also returns a height fraction,
// used to shade cloud bases darker than their tops.
// options.influence: reuse an already computed landmarkInfluence (light samples, a few metres away)
// options.billows: false skips the bulges (light samples only need the rough shape)
const cloudDensity = (p, octaves, { influence = null, billows: withBillows = true } = {}) => {
  const drift = vec3(time.mul(skyUniforms.windSpeed), 0, time.mul(skyUniforms.windSpeed).mul(0.3));
  const q = p.add(drift);
  const xz = vec2(q.x, q.z);
  const detail = fbm(q.mul(DETAIL_SCALE), octaves);

  // The deck: iq's profile, thinning out towards a gently rolling top
  const deckTop = mx_noise_float(xz.mul(SWELL_SCALE)).mul(DECK_SWELL).add(CLOUD_TOP_ALTITUDE + 40);
  const h = p.y.sub(LAYER_BASE).div(deckTop.sub(LAYER_BASE)); // 0 at base, 1 at the deck top
  const deck = detail.mul(1.9).add(0.5).sub(h.mul(1.25));

  // Towers: a solid core rising out of the deck, ragged at the edges
  const towerXz = xz.add(detail.mul(TOWER_WARP));
  const landmarks = influence ?? landmarkInfluence(towerXz);
  const tower = towerAmount(towerXz, landmarks);
  // Tall columns: the higher up, the more of the tower's edge falls away, so only the core reaches the top
  const ht = p.y.sub(CLOUD_TOP_ALTITUDE).div(TOWER_HEIGHT); // 0 at the deck, 1 at the highest possible top
  // Billows: |noise| gives rounded bulges, like the cauliflower tops of storm clouds
  const billows = withBillows ? mx_noise_float(q.mul(BILLOW_SCALE)).abs().mul(BILLOW_STRENGTH) : float(0);
  const profile = tower.sub(pow(clamp(ht, 0, 1), TOWER_DOME).mul(TOWER_TAPER));
  const topFade = float(1).sub(smoothstep(0.85, 1.0, ht)); // always rounds off below the layer top
  const column = profile.mul(2.6).add(detail.mul(1.0)).add(billows).sub(0.25).mul(topFade);
  const towerDensity = select(tower.greaterThan(0.01), column, float(0)); // no towers where the weather is calm

  // Collars: solid below the collar top, thinning over COLLAR.soft metres, ragged like the rest
  const collar = landmarks.collarTop.sub(p.y).div(COLLAR.soft).add(detail.mul(0.8)).sub(0.15);
  const collarDensity = select(landmarks.collarTop.greaterThan(deckTop), clamp(collar, 0, 1), float(0));

  const density = clamp(max(max(deck, towerDensity), collarDensity), 0, 1);
  return { density, h: max(h, ht.mul(tower)), influence: landmarks };
};

// Scene-frame direction → world-frame direction (undo the heading rotation).
const toWorld = (d) => {
  const h = skyUniforms.heading;
  const c = h.cos();
  const s = h.sin();
  return vec3(d.x.mul(c).sub(d.z.mul(s)), d.y, d.x.mul(s).add(d.z.mul(c)));
};

// iq's sky: pale blue-grey, a little bluer upwards, a warm glow around the sun
// Inside a storm the whole sky turns grey
const stormSky = (col) => mix(col, vec3(...STORM_LOOK.sky), skyUniforms.stormInside.mul(STORM_LOOK.skyAmount));

const skyColor = Fn(([rd, sun]) => {
  const sunAmt = clamp(dot(sun, rd), 0, 1);
  const col = vec3(...SKY_HORIZON).sub(vec3(1.0, 0.5, 1.0).mul(rd.y.mul(0.2))).add(SKY_LIFT).toVar();
  col.addAssign(vec3(1.0, 0.6, 0.1).mul(pow(sunAmt, 8)).mul(0.2).mul(sunVisible()));
  col.addAssign(vec3(1.0, 0.9, 0.7).mul(pow(sunAmt, 800)).mul(2).mul(sunVisible())); // the sun disc (not in iq's shader)
  return col;
});

// iq's final contrast curve, then: Shadertoy colours are sRGB (CLAUDE.md §5 Shaders)
const finish = (col) => colorSpaceToWorking(vec4(smoothstep(...CONTRAST, col), 1), THREE.SRGBColorSpace).rgb;

// Thin high sheet: one flat layer, so a single noise lookup where the ray crosses it
const highLayer = Fn(([ro, rd, sun, sky]) => {
  const result = vec4(0).toVar();
  If(rd.y.greaterThan(0.01), () => {
    const t = float(HIGH_LAYER_ALTITUDE).sub(ro.y).div(rd.y);
    const xz = vec2(ro.x, ro.z).add(vec2(rd.x, rd.z).mul(t)).add(vec2(time.mul(skyUniforms.windSpeed).mul(2), 0));
    const streaks = fbm(vec2(xz.x.mul(HIGH_LAYER_SCALE), xz.y.mul(HIGH_LAYER_SCALE * 3)), 4);
    const cover = smoothstep(0.05, 0.45, streaks).mul(exp(t.mul(-0.00004))); // fades towards the horizon
    const lit = mix(vec3(0.85, 0.88, 0.95), vec3(1.0, 0.95, 0.85), pow(clamp(dot(sun, rd), 0, 1), 4));
    result.assign(vec4(mix(sky, lit, 0.9), cover.mul(0.7)));
  });
  return result;
});

// maxT: distance to the nearest object along the ray; clouds behind it are not drawn
const raymarchClouds = Fn(([ro, rd, sun, maxT, bg]) => {
  const sum = vec4(0).toVar();
  const below = ro.y.lessThan(LAYER_TOP);

  // Rays only touch the volume if they look down into it, or start inside it (e.g. among towers)
  If(rd.y.lessThan(-0.0005).or(below), () => {
    const tTop = float(LAYER_TOP).sub(ro.y).div(rd.y);
    // Inside the layer: start right after the cloud-free zone around the balloon
    const tEnter = select(below, float(NEAR_CLEAR), max(tTop, NEAR_CLEAR));
    const tBase = float(LAYER_BASE).sub(ro.y).div(rd.y);
    // Down: leave through the base. Up (only when starting inside): leave through the top.
    const tExit = min(select(rd.y.lessThan(0), tBase, tTop), maxT);
    // Jitter the start per pixel to break up step banding
    const jitter = interleavedGradientNoise(screenCoordinate.xy);
    const t = tEnter.add(jitter.mul(max(tEnter.mul(STEP_GROWTH), MIN_STEP))).toVar();

    for (const stage of MARCH_STAGES) Loop(stage.steps, () => {
      If(t.greaterThan(tExit).or(sum.a.greaterThan(OPAQUE)), () => {
        Break();
      });

      const pos = ro.add(rd.mul(t));
      // Cheap test first: in clear air between towers, skip the expensive density and step further
      const maybeCloud = mayHoldCloud(pos);
      If(maybeCloud, () => {
        const { density: cloud, h, influence } = cloudDensity(pos, stage.octaves);
        const den = cloud.mul(smoothstep(NEAR_CLEAR, NEAR_CLEAR * 2.5, t));

        If(den.greaterThan(0.01), () => {
          // One sample towards the sun: iq's soft edge lighting, and self-shadowing (Beer's law),
          // so cores and the far side of a tower fall into shade
          const toSun = cloudDensity(pos.add(sun.mul(LIGHT_SAMPLE)), LIGHT_OCTAVES, { influence, billows: false }).density;
          const dif = clamp(den.sub(toSun).div(0.6), 0, 1);
          const sunReach = exp(toSun.mul(-SELF_SHADOW));

          // Silver lining: clouds glow when you look towards the sun past them (Henyey–Greenstein)
          const g = SILVER_LINING;
          const hg = float(1 - g * g).div(pow(float(1 + g * g).sub(dot(rd, sun).mul(2 * g)), 1.5));
          const phase = hg.mul(0.12).add(0.6);

          // Sunlight: warm (iq's colour), shaded by the cloud itself
          const storm = influence.storm;
          const sunlight = vec3(1.0, 0.6, 0.3).mul(dif.mul(0.5).add(sunReach.mul(0.75))).mul(phase)
            .mul(float(1).sub(storm.mul(STORM_LOOK.sunBlock)));
          // Sky light: cool blue-lilac low in the cloud, warm white at the tops
          const skylight = mix(vec3(0.5, 0.55, 0.74), vec3(0.86, 0.89, 0.96), clamp(h, 0, 1));
          const lin = sunlight.add(skylight);

          // Shadows lean blue-lilac rather than grey, so the extra shading adds colour, not darkness
          const col = mix(vec3(1.0, 0.95, 0.82), vec3(0.42, 0.45, 0.6), den.mul(SHADE_FROM_DENSITY)).mul(lin).toVar();
          // Storm clouds: dark slate-grey bases under lighter, still sunlit tops, so the cells keep their shape
          const stormShade = storm.mul(STORM_LOOK.darken).mul(float(1).sub(clamp(h, 0, 1).mul(0.55)));
          col.assign(mix(col, col.mul(vec3(0.36, 0.38, 0.46)), stormShade));

          // Burner: warm light on the nearby cloud tops
          const glow = skyUniforms.burnerGlow.mul(exp(t.mul(-0.004)));
          col.addAssign(vec3(1.0, 0.45, 0.15).mul(glow).mul(0.5));

          // iq's fog: fade into the sky colour with distance
          col.assign(mix(col, bg, float(1).sub(exp(t.mul(-0.00015)))));

          const a = den.mul(STEP_OPACITY);
          sum.addAssign(vec4(col.mul(a), a).mul(float(1).sub(sum.a)));
        });
      });

      const step = max(t.mul(STEP_GROWTH), MIN_STEP);
      t.addAssign(select(maybeCloud, step, step.mul(EMPTY_SKIP)));
    });
  });

  return clamp(sum, 0, 1);
});

const balloonPosition = () => vec3(skyUniforms.balloonX, skyUniforms.altitude, skyUniforms.balloonZ);

// Scene background: sky, high cloud sheet, haze below the horizon and sun glare (no cloud volume)
export function createSkyNode() {
  return Fn(() => {
    const rd = toWorld(normalize(positionWorldDirection));
    const sun = normalize(skyUniforms.sunDirection);

    const sky = skyColor(rd, sun).toVar();
    const high = highLayer(balloonPosition(), rd, sun, sky);
    sky.assign(mix(sky, high.rgb, high.a));
    const col = stormSky(sky);

    // Sun glare (iq)
    const sunAmt = clamp(dot(sun, rd), 0, 1);
    return finish(col.add(vec3(0.2, 0.08, 0.04).mul(pow(sunAmt, 3)).mul(sunVisible())));
  })();
}

// After the scene: the cloud volume composited over the rendered image, stopping at the depth buffer.
// scenePass: a TSL pass(scene, camera) node; camera: that same scene camera; renderer: for the pixel ratio.
// The camera matrices are passed in on purpose: inside this full-screen pass, TSL's built-in camera
// nodes belong to the pass's own fixed camera, which would make the clouds turn with the view.
export function createCloudPass(scenePass, camera, renderer) {
  const projectionInverse = uniform(camera.projectionMatrixInverse);
  const cameraToWorld = uniform(camera.matrixWorld);
  const viewZ = scenePass.getViewZNode();

  // This pixel's ray in view space, and in the scene (cabin) frame
  const pixelRay = () => {
    const ndc = vec2(screenUV.x.mul(2).sub(1), screenUV.y.oneMinus().mul(2).sub(1));
    const viewRay = projectionInverse.mul(vec4(ndc, 1, 1));
    const viewDir = normalize(viewRay.xyz.div(viewRay.w));
    return { viewDir, sceneDir: normalize(cameraToWorld.mul(vec4(viewDir, 0)).xyz) };
  };

  // 1. The clouds, at reduced resolution (the raymarch is by far the most expensive part of a frame)
  const clouds = Fn(() => {
    const { viewDir, sceneDir } = pixelRay();
    const rd = toWorld(sceneDir);

    // Distance to whatever was rendered here; the sky (far plane) means "nothing in the way"
    const hitDistance = viewZ.div(viewDir.z);
    const maxT = select(viewZ.negate().greaterThan(MAX_DIST * 0.5), float(MAX_DIST), hitDistance);

    const sun = normalize(skyUniforms.sunDirection);
    const march = raymarchClouds(balloonPosition(), rd, sun, maxT, stormSky(skyColor(rd, sun)));
    // Same finish as the sky, on the clouds' own colour; stored premultiplied so upscaling blends cleanly
    const cloudColor = finish(march.rgb.div(max(march.a, 0.001)));
    return vec4(cloudColor.mul(march.a), march.a);
  })();
  const layerScale = CLOUD_RESOLUTION / renderer.getPixelRatio();
  const cloudLayer = rtt(clouds, null, null, { resolutionScale: layerScale });

  // 2. At full resolution: lay the clouds over the sharp scene. Nothing closer than NEAR_CLEAR can be
  // behind a cloud, so the cabin never picks up a soft cloud edge from the upscaled layer.
  const cloudTexel = vec2(1).div(screenSize.mul(layerScale));

  // Four taps around a point (`spread` cloud texels away): smooths the upscaled jitter, or blurs
  const sampleClouds = (uv, spread) => {
    const o = cloudTexel.mul(spread);
    return cloudLayer.sample(uv.add(o.mul(vec2(1, 1))))
      .add(cloudLayer.sample(uv.add(o.mul(vec2(-1, 1)))))
      .add(cloudLayer.sample(uv.add(o.mul(vec2(1, -1)))))
      .add(cloudLayer.sample(uv.add(o.mul(vec2(-1, -1)))))
      .mul(0.25);
  };

  // 2. At full resolution: lay the clouds over the sharp scene. Nothing closer than NEAR_CLEAR can be
  // behind a cloud, so the cabin never picks up a soft cloud edge from the upscaled layer.
  // In a storm, Heartfelt's drops run down the windows and bend the view outside.
  return Fn(() => {
    const outside = viewZ.negate().greaterThan(GLASS_DEPTH);
    const rain = windowRain(pixelRay().sceneDir, skyUniforms.stormInside);
    const uv = select(outside, screenUV.add(rain.xy), screenUV);

    const color = scenePass.getTextureNode('output').sample(uv);
    const layer = sampleClouds(uv, UPSCALE_SPREAD);
    const coverage = select(viewZ.negate().lessThan(NEAR_CLEAR), float(0), layer.a);
    const cloudRgb = select(viewZ.negate().lessThan(NEAR_CLEAR), vec3(0), layer.rgb);
    const view = color.rgb.mul(float(1).sub(coverage)).add(cloudRgb).toVar();

    // Between the drops the glass is misted: a blurred, grey-tinted view. Through a drop it's clear.
    const blurred = sampleClouds(uv, RAIN_MIST.spread);
    const misty = mix(view, blurred.rgb.add(vec3(...RAIN_MIST_TINT).mul(float(1).sub(blurred.a))), 0.6);
    const mist = skyUniforms.stormInside.mul(RAIN_MIST.amount).mul(smoothstep(0.2, 0.1, rain.z));
    view.assign(select(outside, mix(view, misty, mist), view));
    return vec4(view, 1);
  })();
}
