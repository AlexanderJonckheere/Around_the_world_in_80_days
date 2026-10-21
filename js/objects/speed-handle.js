import * as THREE from 'three/webgpu';
import { color } from 'three/tsl';
import { CLICKABLES } from '../constants/clickables.js';
import { controls } from '../systems/interactions.js';

// The speed handle: a brass lever in a slotted base on the table, right of the notebook. Built in
// code (the Blender cabin has no throttle); it stands on the table surface, found with a raycast.
// Pushed forward = speed up, back = slow down; it springs back to neutral (upright) when let go.
const SPOT = { x: 0.76, z: -0.86 }; // m, on the table: right of the notebook, beside the stopwatch
const SWEEP = THREE.MathUtils.degToRad(35); // lever angle either side of the middle
const RESPONSE = 10; // 1/s, how quickly the lever follows the setting
const SIZE = { base: [0.07, 0.025, 0.16], arm: 0.15, armRadius: 0.007, knob: 0.02 }; // m
const HOVER_GLOW = 0.35;
const [BASE_NAME, LEVER_NAME] = CLICKABLES.find((c) => c.id === 'speed').nodes;

// hoverFor: the hover glow uniform for a clickable object (from the interactions system)
export function createSpeedHandle(model, hoverFor) {
  const hover = hoverFor(BASE_NAME);
  const glowing = (hex, params) => {
    const mat = new THREE.MeshStandardNodeMaterial(params);
    mat.colorNode = color(hex);
    mat.emissiveNode = color(0xffd9a0).mul(hover.mul(HOVER_GLOW));
    return mat;
  };
  const brass = glowing(0xc9a25a, { metalness: 0.6, roughness: 0.35 });
  const wood = glowing(0x3a2414, { roughness: 0.6 });
  const knobMat = glowing(0x141010, { roughness: 0.4 });

  // Stand on the table: cast straight down at SPOT and follow the surface's slope
  const table = model.getObjectByName('table_top');
  model.updateMatrixWorld(true);
  const hit = new THREE.Raycaster(new THREE.Vector3(SPOT.x, 3, SPOT.z), new THREE.Vector3(0, -1, 0)).intersectObject(table, true)[0];
  const group = new THREE.Group();
  group.position.copy(hit.point);
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

  const base = new THREE.Mesh(new THREE.BoxGeometry(...SIZE.base), wood);
  base.name = BASE_NAME;
  base.position.y = SIZE.base[1] / 2;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(SIZE.base[0] * 0.6, 0.004, SIZE.base[2] * 0.85), brass);
  plate.position.y = SIZE.base[1] / 2 + 0.002; // on top of the base
  base.add(plate);

  // The lever pivots at the top of the base; its arm and knob hang off the pivot
  const pivot = new THREE.Group();
  pivot.position.y = SIZE.base[1];
  const lever = new THREE.Group();
  lever.name = LEVER_NAME;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(SIZE.armRadius, SIZE.armRadius, SIZE.arm, 10), brass);
  arm.position.y = SIZE.arm / 2;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(SIZE.knob, 16, 12), knobMat);
  knob.position.y = SIZE.arm;
  lever.add(arm, knob);
  pivot.add(lever);
  group.add(base, pivot);
  model.add(group);

  let angle = 0;
  return {
    // throttle: -1 slowing … 0 neutral … +1 speeding up. Forward (−z, away from the seat) is faster.
    // While dragged it follows the mouse, dead zone included, so it feels like you're holding it.
    animate(dt, throttle) {
      const target = -(controls.lever ?? throttle) * SWEEP;
      angle = THREE.MathUtils.damp(angle, target, RESPONSE, dt);
      pivot.rotation.x = angle;
    },
  };
}
