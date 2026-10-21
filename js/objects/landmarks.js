import * as THREE from 'three/webgpu';
import { positionWorld, positionLocal, smoothstep, time, step, fract, mix, color, float } from 'three/tsl';
import { skyUniforms } from '../shaders/clouds/clouds.js';
import { CLOUD_TOP_ALTITUDE } from '../constants/rules.js';
import { LANDMARKS } from '../constants/landmarks.js';

// Procedural placeholder silhouettes (CLAUDE.md §11). Swap for Blender models from public/assets/ later;
// keep using landmarkMaterial() so they still sink into the cloud deck.
// Local origin = sea level, +y up, heights in metres.

// Everything below the cloud tops is hidden; a short soft band makes it look like it rises out of the mist.
// The scene is shifted down by the altitude, so add it back to get the absolute height.
const cloudFade = smoothstep(CLOUD_TOP_ALTITUDE - 25, CLOUD_TOP_ALTITUDE + 15, positionWorld.y.add(skyUniforms.altitude));

function landmarkMaterial(params, colorNode) {
  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, ...params });
  if (colorNode) mat.colorNode = colorNode;
  mat.opacityNode = cloudFade;
  mat.transparent = true;
  return mat;
}

// Blinking beacon (radio tower, lighthouse lamp)
function beaconMaterial(hex, rate, duty = 0.5) {
  const blink = step(float(1 - duty), fract(time.mul(rate)));
  const mat = new THREE.MeshBasicNodeMaterial();
  mat.colorNode = color(hex).mul(blink.mul(3).add(0.15));
  mat.opacityNode = cloudFade;
  mat.transparent = true;
  return mat;
}

const stone = () => landmarkMaterial({ color: 0x8a8278 });
const darkWood = () => landmarkMaterial({ color: 0x4a3626 });
const slate = () => landmarkMaterial({ color: 0x3d4450 });

function radioTower(h) {
  const g = new THREE.Group();
  const bands = mix(color(0xd23a2a), color(0xf2f0ea), step(0.5, fract(positionLocal.y.div(h / 7))));
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.5, h, 6), landmarkMaterial({ metalness: 0.4 }, bands));
  mast.position.y = h / 2;
  g.add(mast);

  for (let y = 30; y < h; y += 40) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5 - (y / h) * 1.7 + 0.6, 0.25, 4, 6), stone());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), beaconMaterial(0xff3020, 0.8, 0.35));
  beacon.position.y = h + 1.5;
  g.add(beacon);
  return g;
}

function churchSpire(h) {
  const g = new THREE.Group();
  const towerH = h * 0.55;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(14, towerH, 14), stone());
  tower.position.y = towerH / 2;
  g.add(tower);

  const spireH = h * 0.42;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(9, spireH, 8), slate());
  spire.position.y = towerH + spireH / 2;
  g.add(spire);

  const cross = new THREE.Group();
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), darkWood());
  const hz = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.6, 0.6), darkWood());
  hz.position.y = 1;
  cross.add(v, hz);
  cross.position.y = h - 3;
  g.add(cross);
  return g;
}

function lighthouse(h) {
  const g = new THREE.Group();
  const bodyH = h * 0.84;
  const stripes = mix(color(0xf4f1ea), color(0xc8322a), step(0.5, fract(positionLocal.y.div(bodyH / 5).add(0.5))));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(6, 9.5, bodyH, 24), landmarkMaterial({}, stripes));
  body.position.y = bodyH / 2;
  g.add(body);

  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1, 24), slate());
  gallery.position.y = bodyH;
  g.add(gallery);

  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, h * 0.09, 16), beaconMaterial(0xfff1b0, 0.25, 0.2));
  lamp.position.y = bodyH + h * 0.045;
  g.add(lamp);

  const domeH = h - bodyH - h * 0.09;
  const dome = new THREE.Mesh(new THREE.ConeGeometry(5.5, domeH, 16), slate());
  dome.position.y = h - domeH / 2;
  g.add(dome);
  return g;
}

function windmill(h) {
  const g = new THREE.Group();
  const towerH = h * 0.72;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 8.5, towerH, 8), landmarkMaterial({ color: 0xd8d0c0 }));
  tower.position.y = towerH / 2;
  g.add(tower);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(6.5, h * 0.12, 8), darkWood());
  cap.position.y = towerH + h * 0.06;
  g.add(cap);

  // Sails face the balloon's approach (+z); spun in update()
  const sails = new THREE.Group();
  const sailLen = h - towerH + h * 0.15;
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    const sail = new THREE.Mesh(new THREE.BoxGeometry(3.8, sailLen, 0.4), darkWood());
    sail.position.y = sailLen / 2;
    arm.add(sail);
    arm.rotation.z = (i * Math.PI) / 2;
    sails.add(arm);
  }
  sails.position.set(0, towerH, 6.5);
  g.add(sails);
  g.userData.update = (dt) => { sails.rotation.z += dt * 0.6; };
  return g;
}

function castleTower(h) {
  const g = new THREE.Group();
  const bodyH = h * 0.95;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(30, 36, bodyH, 24), stone());
  body.position.y = bodyH / 2;
  g.add(body);

  const merlonH = h - bodyH;
  const count = 16;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(7, merlonH, 4), stone());
    m.position.set(Math.cos(a) * 28, bodyH + merlonH / 2, Math.sin(a) * 28);
    m.rotation.y = -a;
    g.add(m);
  }
  return g;
}

const BUILDERS = {
  radio: radioTower,
  church: churchSpire,
  lighthouse,
  windmill,
  castle: castleTower,
};

export function createLandmark(type) {
  const def = LANDMARKS[type];
  const obj = BUILDERS[type](def.height);
  obj.userData.type = type;
  obj.userData.height = def.height;
  obj.name = def.name;
  return obj;
}
