// What each clickable object in cabin.glb does (CLAUDE.md §7.2), matched by Blender object name.
// panel / widget: a click toggles that UI element.
// drag 'pull': drag down to open the burner/vent; it works while held, harder the further you pull.
// drag 'steer': drag left/right to turn while held, faster the further you push.
// drag 'lever': drag up to speed up, down to slow down; it springs back to neutral (the speed handle).
// fling: a click gives it a physics push (Rapier).
// padded: false — no enlarged click box (for big objects, whose box would cover their neighbours).
export const CLICKABLES = [
  { id: 'map', nodes: ['map', 'map_clips'], panel: 'map' },
  { id: 'notebook', nodes: ['notebook', 'notebook_pages'], panel: 'notebook' },
  // The two rule sheets left of the map are one document: both open the same panel
  { id: 'rules', nodes: ['game instructions', 'game instructions '], panel: 'rules' },
  { id: 'stopwatch', nodes: ['stopwatch', 'stopwatch_button', 'stopwatch_glass', 'stopwatch_hand', 'stopwatch_stand'], widget: 'stopwatch' },
  { id: 'speedometer', nodes: ['speedometer', 'speedometer_glass', 'speedometer_needle'], widget: 'speedometer' },
  { id: 'barometer', nodes: ['barometer', 'barometer_glass', 'barometer_needle'], widget: 'barometer' },
  { id: 'compass', nodes: ['compass', 'compass_card', 'compass_needle'], widget: 'compass' },
  { id: 'burner', nodes: ['burner_lever', 'burner_lever_base'], drag: 'pull', control: 'burner' },
  { id: 'vent', nodes: ['vent_rope', 'vent_handle'], drag: 'pull', control: 'vent' },
  // The rudder's box (tiller + tall stand) covered half the table, so it's only hit on its own meshes
  { id: 'rudder', nodes: ['rudder_tiller', 'rudder_mount'], drag: 'steer', control: 'rudder', padded: false },
  { id: 'speed', nodes: ['speed_handle_base', 'speed_handle_lever'], drag: 'lever', control: 'throttle' },
  { id: 'lantern', nodes: ['lantern', 'lantern_glass'], fling: true },
];
