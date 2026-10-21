// The route (CLAUDE.md §10). Landmark positions in metres, x = east, z = south.
// Headings and distances vary per leg (picked by hand, not random); every turn is a multiple of 3°,
// so the rudder hold is a whole number of seconds.
export const LEVEL = {
  id: 'the-route',
  name: 'The route',
  referencePressure: 1013,
  start: { heading: 0, altitude: 500, speed: 60, x: 1271, z: -5895 },
  route: [
    { type: 'lighthouse', x: 708, z: -9450 }, // 351°, 3.6 km
    { type: 'windmill', x: -965, z: -11308 }, // 318°, 2.5 km
    { type: 'radio', x: 1779, z: -14355 }, // 042°, 4.1 km
    { type: 'church', x: 2295, z: -17615 }, // 009°, 3.3 km
  ],
  minSafeAltitude: [], // regions: { x, z, w, h, altitude }
  // Each storm sits on one leg, so the straight line runs through it: fly around it.
  // The first leg (to the lighthouse) is kept clear, to learn the controls first.
  storms: [
    { x: 300, z: -12900, radius: 750 }, // on the leg to the radio tower
    { x: 2300, z: -16000, radius: 600 }, // on the leg to the church spire
  ],
};
