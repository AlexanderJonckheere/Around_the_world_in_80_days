import * as THREE from 'three/webgpu';
import { fog, rangeFogFactor, color } from 'three/tsl';
import { createSkyNode, skyUniforms, HAZE_COLOR, setCloudLandmarks, setCloudStorms, setCloudDeparture } from '../shaders/clouds/clouds.js';
import { createLandmark } from './landmarks.js';

const LANDMARK_HAZE = { start: 1200, end: 4500 }; // m
const SUN_INTENSITY = 2.2;
const STORM_SUN_DIM = 0.85; // same as the sky: the sun on the landmarks fades in a storm

// Everything outside the cabin. The cabin stays at the origin facing -Z; the world moves and
// rotates around it:  scene = Ry(heading) * (worldPos - balloonPos) - (0, altitude, 0)
export class World {
  constructor(scene) {
    this.scene = scene;
    scene.backgroundNode = createSkyNode();
    // Landmarks fade into the haze with distance: only clearly visible within a couple of km
    scene.fogNode = fog(color(HAZE_COLOR), rangeFogFactor(LANDMARK_HAZE.start, LANDMARK_HAZE.end));

    this.headingPivot = new THREE.Group(); // rotation + altitude
    this.origin = new THREE.Group(); // balloon position offset
    this.headingPivot.add(this.origin);
    scene.add(this.headingPivot);

    this.sun = new THREE.DirectionalLight(0xfff1dd, SUN_INTENSITY);
    scene.add(this.sun, this.sun.target);
    this.ambient = new THREE.HemisphereLight(0xdfe8ff, 0xd8cfc0, 1.8);
    scene.add(this.ambient);

    this.landmarks = [];
    this._sun = new THREE.Vector3();
  }

  // landmarks: [{ type, x, z }], everything that is out there while flying this level
  loadStorms(storms) {
    setCloudStorms(storms);
  }

  setDeparture(departure) {
    setCloudDeparture(departure);
  }

  loadLandmarks(landmarks) {
    this.landmarks.forEach((l) => this.origin.remove(l));
    this.landmarks = landmarks.map(({ type, x, z }) => {
      const lm = createLandmark(type);
      lm.position.set(x, 0, z);
      this.origin.add(lm);
      return lm;
    });

    setCloudLandmarks(landmarks);
  }

  update(dt, balloon) {
    const heading = THREE.MathUtils.degToRad(balloon.heading);

    this.headingPivot.rotation.y = heading;
    this.headingPivot.position.y = -balloon.altitude;
    this.origin.position.set(-balloon.x, 0, -balloon.z);

    skyUniforms.balloonX.value = balloon.x;
    skyUniforms.balloonZ.value = balloon.z;
    skyUniforms.altitude.value = balloon.altitude;
    skyUniforms.stormInside.value = balloon.storm;
    this.sun.intensity = SUN_INTENSITY * (1 - balloon.storm * STORM_SUN_DIM);
    skyUniforms.heading.value = heading;

    // Sun is fixed in the world, so it swings around the cabin as the balloon turns
    this._sun.copy(skyUniforms.sunDirection.value).applyAxisAngle(THREE.Object3D.DEFAULT_UP, heading);
    this.sun.position.copy(this._sun).multiplyScalar(10);

    this.landmarks.forEach((l) => l.userData.update?.(dt));
  }
}
