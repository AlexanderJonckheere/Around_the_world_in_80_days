import RAPIER from '@dimforge/rapier3d-compat';

// Rapier physics (CLAUDE.md §12), in the cabin's frame: metres, y up. A fixed step keeps the
// simulation the same at any frame rate.
const GRAVITY = { x: 0, y: -9.81, z: 0 };
const STEP = 1 / 60; // s
const MAX_STEPS = 5; // per frame, so a slow frame can't snowball

let world = null;
let accumulator = 0;

export async function initPhysics() {
  await RAPIER.init();
  world = new RAPIER.World(GRAVITY);
  world.timestep = STEP;
}

export const physics = {
  get world() {
    return world;
  },
  get RAPIER() {
    return RAPIER;
  },

  step(dt) {
    accumulator = Math.min(accumulator + dt, STEP * MAX_STEPS);
    while (accumulator >= STEP) {
      world.step();
      accumulator -= STEP;
    }
  },
};
