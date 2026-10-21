import * as THREE from 'three/webgpu';
import { physics } from '../systems/physics.js';
import { TURN_RATE } from '../constants/rules.js';

// The hanging lantern as a Rapier pendulum: a fixed point where the chain meets the ceiling, a
// dynamic body for the lantern, and a ball joint between them. Clicking it flings it; gravity and
// damping swing it back to rest. The Blender lantern's origin is that ceiling point.
// The cabin's motion moves it too: turning swings it outwards, it rocks gently all the time, and a
// storm shakes it. All of these are forces on the Rapier body, so the swing stays physical.
const MASS = 1.2; // kg
const CHAIN_LENGTH = 0.55; // m from the ceiling point to the lantern's centre of mass
const BODY_RADIUS = 0.07; // m
const DAMPING = 0.6; // how quickly the swing dies down (settles in roughly 8 s)
const FLING_IMPULSE = 1.6; // N·s per click, sideways in the direction you look
const TURN_FORCE = 4.5; // N at full rudder: swings the lantern about 20° outwards in a turn
const ROCK = { force: 0.6, rateX: 0.11, rateZ: 0.07 }; // N, rocks per second: the gentle, constant sway
const STORM_GUST = { force: 3, rate: 0.35 }; // N, gusts per second: the storm shakes it about

export function createLantern(model) {
  const mesh = model.getObjectByName('lantern');
  const restQuat = mesh.quaternion.clone();
  const pivot = mesh.getWorldPosition(new THREE.Vector3());
  const { world, RAPIER } = physics;

  const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pivot.x, pivot.y, pivot.z));
  // The body's origin sits on the pivot; its collider (and so its mass) hangs below it
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(pivot.x, pivot.y, pivot.z).setAngularDamping(DAMPING).setLinearDamping(DAMPING),
  );
  world.createCollider(RAPIER.ColliderDesc.ball(BODY_RADIUS).setTranslation(0, -CHAIN_LENGTH, 0).setMass(MASS), body);
  world.createImpulseJoint(RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), anchor, body, true);

  const bodyQuat = new THREE.Quaternion();
  const push = new THREE.Vector3();
  const force = { x: 0, y: 0, z: 0 };
  let time = 0;

  return {
    mesh,

    // point: where the click hit the lantern; direction: the click ray
    fling(point, direction) {
      push.set(direction.x, 0, direction.z).normalize().multiplyScalar(FLING_IMPULSE);
      body.applyImpulseAtPoint(push, point, true);
    },

    // Back to hanging still (a new flight)
    reset() {
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    },

    // turnRate: how fast the balloon is turning (°/s, + = right); storm: 0..1
    applyCabinMotion(dt, turnRate, storm) {
      time += dt;
      const wave = (rate, phase = 0) => Math.sin((time * rate + phase) * Math.PI * 2);
      // Turning right makes the lantern lag and swing out to the left (−x), and the other way round
      force.x = -(turnRate / TURN_RATE) * TURN_FORCE + ROCK.force * wave(ROCK.rateX) + storm * STORM_GUST.force * wave(STORM_GUST.rate);
      force.z = ROCK.force * wave(ROCK.rateZ, 0.25) + storm * STORM_GUST.force * wave(STORM_GUST.rate * 1.3, 0.6);
      body.resetForces(true);
      body.addForce(force, true);
    },

    animate() {
      const r = body.rotation();
      bodyQuat.set(r.x, r.y, r.z, r.w);
      mesh.quaternion.copy(bodyQuat).multiply(restQuat);
    },
  };
}
