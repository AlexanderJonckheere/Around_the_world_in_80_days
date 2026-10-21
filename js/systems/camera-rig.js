import * as THREE from 'three/webgpu';

// CLAUDE.md §7.1: fixed seat, only a few degrees of look-around for depth, gentle constant sway.
const MAX_YAW = THREE.MathUtils.degToRad(5);
const MAX_PITCH = THREE.MathUtils.degToRad(3);
const LOOK_RESPONSE = 4; // 1/s

export class CameraRig {
  // restLookAt: where the navigator looks when the mouse is centred (look_main in cabin.glb)
  constructor(camera, seatPosition, restLookAt) {
    this.camera = camera;
    this.seat = seatPosition.clone();
    const d = restLookAt.clone().sub(this.seat);
    this.restYaw = Math.atan2(-d.x, -d.z);
    this.restPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.yaw = this.restYaw;
    this.pitch = this.restPitch;
    this.swayStrength = 1;
    this.time = 0;
  }

  update(dt, pointer) {
    this.time += dt;
    this.yaw = THREE.MathUtils.damp(this.yaw, this.restYaw - pointer.x * MAX_YAW, LOOK_RESPONSE, dt);
    this.pitch = THREE.MathUtils.damp(this.pitch, this.restPitch + pointer.y * MAX_PITCH, LOOK_RESPONSE, dt);

    this.camera.position.copy(this.seat);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    const s = this.swayStrength;
    const t = this.time;
    this.camera.position.x += Math.sin(t * 0.7) * 0.01 * s;
    this.camera.position.y += Math.sin(t * 0.9 + 1.3) * 0.008 * s;
    this.camera.rotateZ(Math.sin(t * 0.5) * 0.012 * s);
    this.camera.rotateX(Math.sin(t * 0.63 + 0.4) * 0.006 * s);
  }
}
