import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { CLICKABLES } from '../constants/clickables.js';
import { flight } from './flight.js';
import { panels, widgets, isPanelOpen } from '../ui/overlay.js';

// One shared raycaster for hover, clicks and drags on cabin objects, matched by Blender name (CLAUDE.md §7.2).
const HOVER_RESPONSE = 12; // 1/s, how fast the hover glow fades in and out
const SEE_THROUGH = new Set(['window_glass']); // never blocks a click on something behind it
const HIT_PADDING = 0.03; // m around each clickable, so small things like the stopwatch are easy to hit
const PULL_DISTANCE = 120; // px of downward drag to fully open the burner/vent
const STEER_DISTANCE = 120; // px sideways for full tiller deflection (full turn rate)
const LEVER_DISTANCE = 90; // px of vertical drag for a full push on the speed handle
const LEVER_DEAD_ZONE = 0.15; // of a full push: around neutral, so the speed holds even with a wobbly hand
const STEER_DEAD_ZONE = 15; // px before the rudder starts turning, so a wobbly hand doesn't steer

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// The tiller and the speed handle follow the mouse even inside their dead zones (null = not being dragged)
export const controls = { tiller: null, lever: null };

const sanitize = THREE.PropertyBinding.sanitizeNodeName;

export function createInteractions() {
  const hover = new Map(CLICKABLES.map((c) => [c.id, uniform(0)]));
  const byNode = new Map(CLICKABLES.flatMap((c) => c.nodes.map((n) => [sanitize(n), c])));
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitMaterial = new THREE.MeshBasicMaterial();
  const meshes = [];
  const hitBoxes = [];
  let hovered = null;
  let drag = null; // { clickable, x, y }
  let camera, input, dom, onFling;

  // Names of a mesh and its ancestors: multi-material Blender objects are split into child meshes,
  // and some objects are regrouped (e.g. the compass pivot)
  function* lineage(obj, model) {
    for (let o = obj; o && o !== model; o = o.parent) yield o.name;
  }

  // Real meshes win; the padded boxes only help when the pointer is just next to a small object
  // The clickable under the pointer, and the hit itself (point, ray) for physics pushes
  function pickHit() {
    ndc.set(input.pointer.x, input.pointer.y);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (hit?.object.userData.clickable) return { clickable: hit.object.userData.clickable, hit };
    const near = raycaster.intersectObjects(hitBoxes, false)[0];
    return near && (!hit || near.distance < hit.distance) ? { clickable: near.object.userData.clickable, hit: near } : null;
  }

  const pick = () => pickHit()?.clickable ?? null;

  function press(e) {
    if (isPanelOpen()) return;
    const picked = pickHit();
    if (!picked) return;
    const c = picked.clickable;
    if (c.fling) onFling?.(c.id, picked.hit.point, raycaster.ray.direction);
    else if (c.panel) panels[c.panel].toggle();
    else if (c.widget) widgets[c.widget].toggle();
    else if (c.drag) drag = { clickable: c, x: e.clientX, y: e.clientY };
  }

  function move(e) {
    if (!drag) return;
    const { clickable } = drag;

    // Speed handle: up = speed up, down = slow down, harder the further you push (past the dead zone)
    if (clickable.drag === 'lever') {
      const push = clamp((drag.y - e.clientY) / LEVER_DISTANCE, -1, 1);
      const beyond = clamp((Math.abs(push) - LEVER_DEAD_ZONE) / (1 - LEVER_DEAD_ZONE), 0, 1);
      controls.lever = push;
      flight.setInput('throttle', 'drag', Math.sign(push) * beyond);
      return;
    }

    if (clickable.drag === 'pull') {
      flight.setInput(clickable.control, 'drag', clamp((e.clientY - drag.y) / PULL_DISTANCE, 0, 1));
      return;
    }

    // Steer: the further the tiller is pushed (past the dead zone), the faster the balloon turns
    const dx = e.clientX - drag.x;
    const deflection = clamp((Math.abs(dx) - STEER_DEAD_ZONE) / (STEER_DISTANCE - STEER_DEAD_ZONE), 0, 1);
    controls.tiller = clamp(dx / STEER_DISTANCE, -1, 1);
    flight.setInput('rudder', 'drag', Math.sign(dx) * deflection);
  }

  function release() {
    if (!drag) return;
    // Every control springs back when you let go: burner, vent, rudder and the speed handle
    flight.setInput(drag.clickable.control, 'drag', 0);
    if (drag.clickable.control === 'rudder') controls.tiller = null;
    if (drag.clickable.control === 'throttle') controls.lever = null;
    drag = null;
  }

  return {
    // Hover uniform for the baked material of this Blender object, or null if it isn't clickable
    hoverFor: (nodeName) => hover.get(byNode.get(nodeName)?.id) ?? null,

    // fling(id, point, direction): called when a 'fling' clickable is clicked
    attach(model, cam, inp, canvas, fling) {
      onFling = fling;
      camera = cam;
      input = inp;
      dom = canvas;

      const boxes = new Map(CLICKABLES.map((c) => [c, new THREE.Box3()]));
      model.traverse((obj) => {
        if (!obj.isMesh) return;
        const names = [...lineage(obj, model)];
        if (names.some((n) => SEE_THROUGH.has(n))) return;
        const clickable = byNode.get(names.find((n) => byNode.has(n))) ?? null;
        obj.userData.clickable = clickable;
        if (clickable) boxes.get(clickable).expandByObject(obj);
        meshes.push(obj); // non-clickables too, so walls and the table block what's behind them
      });

      // Invisible padded box per clickable: the raycaster still hits objects that aren't visible
      for (const [clickable, box] of boxes) {
        if (box.isEmpty() || clickable.padded === false) continue;
        box.expandByScalar(HIT_PADDING);
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray()), hitMaterial);
        box.getCenter(hitBox.position);
        hitBox.visible = false;
        hitBox.userData.clickable = clickable;
        model.add(hitBox);
        hitBoxes.push(hitBox);
      }

      input.on('pointerdown', press);
      input.on('pointermove', move);
      input.on('pointerup', release);
    },

    update(dt) {
      hovered = drag?.clickable ?? (isPanelOpen() ? null : pick());
      dom.style.cursor = drag ? 'grabbing' : hovered?.drag ? 'grab' : hovered ? 'pointer' : 'default';
      for (const [id, u] of hover) {
        u.value = THREE.MathUtils.damp(u.value, hovered?.id === id ? 1 : 0, HOVER_RESPONSE, dt);
      }
    },
  };
}
