import * as THREE from 'three/webgpu';
import { texture, uv, uniform, vec2, vec3, mix, float } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BAROMETER_RANGE, SPEEDOMETER_RANGE } from '../constants/rules.js';
import { controls } from '../systems/interactions.js';
import { createRulesTexture } from './rules-sheets.js';
import { createView, drawChart } from '../ui/chart.js';

const MODEL_URL = 'assets/cabin.glb';
const CABIN_ATLAS_URL = 'assets/cabin_baked.jpg';
const PROPS_ATLAS_URL = 'assets/props_baked.jpg';

// Objects baked into cabin_baked.jpg; everything else uses props_baked.jpg.
const CABIN_ATLAS_NODES = new Set([
  'ceiling', 'floor', 'notebook', 'seat', 'table', 'table_top', 'wall_back', 'window_frame',
]);
// Not baked: these have their own 0–1 UV for a drawn texture. The notebook pages stay plain paper
// until the writing pages are built; the map gets the chart (showChart).
const PAPER_NODES = /^(map|notebook_pages)/;
const CHART_SIZE = { width: 1024, height: 768 }; // px, same 4:3 shape as the map on the table
// The rule sheets get the printed rules (rules-sheets.js)
const RULE_SHEET_NODES = /^game_instructions/;
// Not baked either: keep the glTF material and let the scene's sun light it.
const KEEP_MATERIAL_NODES = new Set(['balloon']);

// Clips that loop on their own
// (The lantern isn't animated: Rapier swings it, see lantern.js)
const AMBIENT_CLIPS = ['VentSway'];
// Clips scrubbed to a value (needles, rudder)
const SCRUB_CLIPS = ['BarometerNeedle', 'SpeedometerNeedle', 'RudderTurn'];

// Pull clips, scrubbed from how far the burner/vent is open (by drag or keyboard)
const PULL_CLIPS = { burner: 'BurnerPull', vent: 'VentPull' };

const HOVER_BRIGHTEN = 0.35;
const PULL_RESPONSE = 12; // 1/s, the lever/rope eases to its position and springs back after letting go
const TILLER_RESPONSE = 8; // 1/s, the tiller eases to the rudder input instead of snapping

// Shared glow uniform: the burner briefly lights the cabin orange
export const cabinGlow = uniform(0);
// 0..1 how deep in a storm the balloon is: the cabin darkens with it
const cabinStorm = uniform(0);
const STORM_DIM = 0.5; // how much darker the cabin gets in the heart of a storm
const noHover = uniform(0);

function loadTexture(loader, url) {
  const tex = loader.load(url);
  tex.flipY = false; // glTF UV convention
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Lighting is baked, so the materials are unlit: texture × burner glow × hover highlight.
function bakedMaterial(map, hover) {
  const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  const glow = mix(vec3(1), vec3(1.6, 1.05, 0.7), cabinGlow);
  const stormDim = float(1).sub(cabinStorm.mul(STORM_DIM));
  mat.colorNode = texture(map, uv()).rgb.mul(glow).mul(hover.mul(HOVER_BRIGHTEN).add(1)).mul(stormDim);
  return mat;
}

const glassMaterial = new THREE.MeshBasicMaterial({ color: 0xd8e6f2, transparent: true, opacity: 0.06, depthWrite: false });
const paperMaterial = new THREE.MeshBasicMaterial({ color: 0xd9ccaa, side: THREE.DoubleSide });

const toUnit = (value, [min, max]) => (value - min) / (max - min);

// Time of the keyframe furthest from the rest pose: the fully pulled position of a pull clip
function peakTime(clip) {
  const track = clip.tracks[0];
  const n = track.getValueSize();
  let best = 0;
  let bestDistance = -1;
  for (let i = 0; i < track.times.length; i++) {
    let d = 0;
    for (let k = 0; k < n; k++) d += (track.values[i * n + k] - track.values[k]) ** 2;
    if (d > bestDistance) [best, bestDistance] = [i, d];
  }
  return track.times[best];
}

export class Cabin {
  constructor(gltf, textures, hoverFor) {
    this.model = gltf.scene;

    // Camera markers placed in Blender
    this.seat = this.model.getObjectByName('cam_main').getWorldPosition(new THREE.Vector3());
    this.restLookAt = this.model.getObjectByName('look_main').getWorldPosition(new THREE.Vector3());

    this.stopwatchHand = this.model.getObjectByName('stopwatch_hand');
    this.tiller = 0;
    this.createCompassPivot();

    this.hoverFor = hoverFor;
    this.applyMaterials(textures, hoverFor);
    this.applyRuleSheets(hoverFor);
    this.setupAnimations(gltf.animations);

    this.pulls = {};
    for (const [control, clipName] of Object.entries(PULL_CLIPS)) {
      const action = this.actions[clipName];
      action.play();
      action.paused = true;
      this.pulls[control] = { action, shown: 0, peak: peakTime(action.getClip()) };
    }
  }

  static async load(scene, hoverFor) {
    const texLoader = new THREE.TextureLoader();
    const textures = { cabin: loadTexture(texLoader, CABIN_ATLAS_URL), props: loadTexture(texLoader, PROPS_ATLAS_URL) };
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    const cabin = new Cabin(gltf, textures, hoverFor);
    scene.add(cabin.model);
    return cabin;
  }

  // The card's origin in the model isn't at its centre, so card and needle turn together in a pivot
  // placed on the needle (which is centred). Like a real compass card, it keeps pointing north.
  createCompassPivot() {
    const needle = this.model.getObjectByName('compass_needle');
    const card = this.model.getObjectByName('compass_card');
    this.compassPivot = new THREE.Group();
    this.compassPivot.position.copy(needle.position);
    this.compassPivot.quaternion.copy(needle.quaternion);
    this.model.add(this.compassPivot);
    this.model.updateMatrixWorld(true); // attach() needs up-to-date world matrices
    this.compassPivot.attach(card);
    this.compassPivot.attach(needle);
    this.compassRest = this.compassPivot.quaternion.clone();
  }

  applyMaterials(textures, hoverFor) {
    const cache = new Map(); // one material per atlas × hover group, so each object can highlight on its own

    const topNode = (obj) => {
      while (obj.parent && obj.parent !== this.model && obj.parent !== this.compassPivot) obj = obj.parent;
      return obj;
    };

    this.model.traverse((obj) => {
      if (!obj.isMesh) return;
      const name = topNode(obj).name;

      if (/glass/.test(obj.name) || /glass/.test(name)) {
        obj.material = glassMaterial;
        obj.renderOrder = 1;
        return;
      }
      if (KEEP_MATERIAL_NODES.has(name) || RULE_SHEET_NODES.test(name)) return;
      if (PAPER_NODES.test(name)) {
        obj.material = paperMaterial;
        return;
      }

      const atlas = CABIN_ATLAS_NODES.has(name) ? 'cabin' : 'props';
      const hover = hoverFor(name) ?? noHover;
      const key = `${atlas}:${hover.id}`;
      if (!cache.has(key)) cache.set(key, bakedMaterial(textures[atlas], hover));
      obj.material = cache.get(key);
    });
  }

  // Left sheet shows the left half of the printed spread, right sheet the right half
  applyRuleSheets(hoverFor) {
    const rulesTexture = createRulesTexture();
    const worldX = (o) => o.getWorldPosition(new THREE.Vector3()).x;
    const sheets = this.model.children.filter((o) => RULE_SHEET_NODES.test(o.name)).sort((a, b) => worldX(a) - worldX(b));

    sheets.forEach((sheet, half) => {
      const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
      const hover = hoverFor(sheet.name) ?? noHover;
      // The sheets' UVs run bottom-to-top compared to the canvas, so flip v
      const spreadUv = vec2(uv().x.mul(0.5).add(half * 0.5), uv().y.oneMinus());
      mat.colorNode = texture(rulesTexture, spreadUv).rgb.mul(hover.mul(HOVER_BRIGHTEN).add(1));
      sheet.traverse((m) => m.isMesh && (m.material = mat));
    });
  }

  // Print the level's chart on the map lying on the table (no pencil marks: those are only in the panel)
  showChart(level) {
    const canvas = document.createElement('canvas');
    canvas.width = CHART_SIZE.width;
    canvas.height = CHART_SIZE.height;
    drawChart(canvas.getContext('2d'), canvas.width, canvas.height, level, createView(level, canvas.width, canvas.height));

    this.chartTexture?.dispose();
    this.chartTexture = new THREE.CanvasTexture(canvas);
    this.chartTexture.colorSpace = THREE.SRGBColorSpace;
    this.chartTexture.anisotropy = 8;

    const map = this.model.getObjectByName('map');
    const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
    const hover = this.hoverFor('map') ?? noHover;
    // Same UV direction as the rule sheets: flip v so the chart isn't upside down
    mat.colorNode = texture(this.chartTexture, vec2(uv().x, uv().y.oneMinus())).rgb.mul(hover.mul(HOVER_BRIGHTEN).add(1));
    map.traverse((m) => m.isMesh && (m.material = mat));
  }

  setupAnimations(clips) {
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      this.actions[clip.name] = action;
      if (AMBIENT_CLIPS.includes(clip.name)) action.play();
      if (SCRUB_CLIPS.includes(clip.name)) {
        action.play();
        action.paused = true;
      }
    }
    this.scrub('RudderTurn', 0.5);
  }

  // Set a scrubbed clip to a position in [0, 1]
  scrub(name, t) {
    const action = this.actions[name];
    if (!action) return;
    // Stay just short of the end: a repeating action wraps back to 0 at its duration
    action.time = THREE.MathUtils.clamp(t, 0, 0.999) * action.getClip().duration;
  }

  animate(dt, readings, state, stopwatch) {
    // Lever and rope sit where the control is: 0 = rest pose, 1 = the clip's fully pulled keyframe
    for (const [control, pull] of Object.entries(this.pulls)) {
      pull.shown = THREE.MathUtils.damp(pull.shown, state[control], PULL_RESPONSE, dt);
      pull.action.time = pull.shown * pull.peak;
    }

    cabinGlow.value = state.burnerHeat;
    cabinStorm.value = state.storm;

    this.scrub('BarometerNeedle', toUnit(readings.pressure, BAROMETER_RANGE));
    this.scrub('SpeedometerNeedle', toUnit(readings.speed, SPEEDOMETER_RANGE));

    this.tiller = THREE.MathUtils.damp(this.tiller, controls.tiller ?? state.rudder, TILLER_RESPONSE, dt);
    this.scrub('RudderTurn', (this.tiller + 1) / 2);

    // One revolution per minute, clockwise seen from the front
    this.stopwatchHand.rotation.z = -(stopwatch.elapsed / 60) * Math.PI * 2;

    // The world turns by +heading around the cabin, so north does too
    this.compassPivot.quaternion.copy(this.compassRest);
    this.compassPivot.rotateY(THREE.MathUtils.degToRad(readings.heading));

    this.mixer.update(dt);
  }
}
