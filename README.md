# Around the World in 80 Days

A calm navigation game in the cabin of a steerable hot air balloon above an endless sea of clouds: no altitude display, no position marker, only your instruments, a chart and your own calculations. Built with Three.js (`WebGPURenderer`, TSL and WGSL).

**Live demo:** https://alexanderjonckheere.github.io/Around_the_world_in_80_days/

Requires a browser with WebGPU (a recent Chrome or Edge; Safari 26+).

## Original shaders

| Shader | Author | Shadertoy | Licence | In this project |
| --- | --- | --- | --- | --- |
| **Clouds** | Inigo Quilez (iq) | https://www.shadertoy.com/view/XslGRr | CC BY-NC-SA 3.0 | The cloud sea and sky: `js/shaders/clouds/clouds.js` (TSL) |
| **Heartfelt** | Martijn Steinrucken (BigWings) | https://www.shadertoy.com/view/ltffzl | CC BY-NC-SA 3.0 | Rain drops on the windows in storms: `js/shaders/rain/fragment.wgsl` (WGSL via `wgslFn`) |

The cloud port is adapted so the camera flies above the cloud deck, uses procedural noise instead of a noise texture, and responds to the game: the balloon's altitude, heading and position, the burner glow, storms (darker clouds, a dimmed sun) and cloud collars around landmarks. It runs as a depth-aware pass after the scene, so clouds can hide landmarks.

## How to play

Fly from landmark to landmark and pass each one at the right height: between its top and 100 m above it, within 250 m. Too low and you crash, too high and it stays hidden under the clouds. The balloon sinks 2 m every second, and sinking into the clouds is a crash.

1. **Plan** on the chart: draw a circle from your position to the next landmark to read the distance and the east/north legs.
2. **Calculate** in the notebook: your height from the barometer, the compass heading, the travel time and the height you will lose.
3. **Fly**: turn onto the heading, time the leg with the stopwatch, manage your height with the burner and vent, and steer around the storms.

| Action | Keyboard | Mouse |
| --- | --- | --- |
| Steer left / right | Hold A / D (or ← / →) | Drag the rudder |
| Burner (climb) | Hold Space / ↑ | Pull the burner lever down |
| Vent (descend) | Hold V / ↓ | Pull the vent rope down |
| Speed up / slow down | Hold W / Q | Push the speed handle forward / back (snaps to the nearest 5 km/h when let go) |
| Stopwatch start / stop | S | Stopwatch buttons |
| Map / notebook | M / N | Click them on the table |
| Rules | | Click the rule sheets next to the map |
| Instruments | | Click the barometer, speedometer, compass or stopwatch |
| Fling the lantern | | Click it |
| Close panels | Esc | × |
| Map: draw a circle | | Click the centre, then drag or click the edge |
| Map: move / zoom | | Two-finger swipe / pinch (or right-drag / Ctrl + wheel), + / − buttons |

## Test URL parameters

- `?debug=1` skips the start screen and opens dev mode: the true altitude, pressure, heading, speed, position and target, teleport buttons per landmark and a 1×–5× speed slider. The same panel opens with the **Dev mode** button on the start screen.
- Keys in dev mode: PageUp / PageDown ±50 m, T teleport to the current target, F jump 1 km forward, H hide the cabin.

## Tech stack

- **Build:** Vite
- **Rendering:** Three.js `WebGPURenderer`, TSL, WGSL via `wgslFn`, `RenderPipeline` with a depth-aware cloud pass rendered at reduced resolution
- **Physics:** Rapier (`@dimforge/rapier3d-compat`, WASM): the lantern is a pendulum on a ball joint
- **3D:** Blender cabin with baked lighting and animations (needles, burner lever, vent rope, rudder), loaded with `GLTFLoader` and driven with `AnimationMixer`
- **2D UI:** HTML, CSS transitions, Canvas 2D, Pointer Events
- **Audio:** Web Audio API, all sound and music synthesised live
- **Hosting:** GitHub Pages via GitHub Actions

## Run locally

```bash
npm install
npm run dev     # http://localhost:5173/Around_the_world_in_80_days/
npm run build   # production build in dist/
```

## Project structure

```
index.html              canvas + 2D UI overlay markup
css/ui.css              overlay, panels, widgets, start screen, cues
js/
  script.js             entry: renderer, scene, camera, render loop
  constants/            rules.js (all game numbers), landmarks.js, routes.js, clickables.js, colors.js
  objects/              cabin (glb + baked materials), world, landmarks, lantern, speed handle, rule sheets
  systems/              flight, balloon, progress, instruments, interactions, input, camera rig,
                        physics, storms, sound, music, renderer, stopwatch
  shaders/clouds/       cloud sea and sky (port of iq's Clouds)
  shaders/rain/         rain drops on the windows (port of Heartfelt)
  ui/                   map, chart, notebook, rules, widgets, start screen, messages, dev panel, …
public/assets/          cabin.glb and baked textures
blender/                source .blend file (not deployed)
.github/workflows/      GitHub Pages deployment
DIARY.md                build diary
```

## Credits

- **Shaders:** "Clouds" by Inigo Quilez and "Heartfelt" by Martijn Steinrucken (BigWings), both CC BY-NC-SA 3.0 (see above).
- **Libraries:** [Three.js](https://threejs.org) (MIT), [Rapier](https://rapier.rs) (Apache-2.0), [Vite](https://vite.dev) (MIT).
- **3D model and baked textures:** the cabin, instruments and props, modelled and baked in Blender by Alexander Jonckheere.
- **Landmarks:** procedural silhouettes built in code.
- **Sound and music:** synthesised in the browser with the Web Audio API; no recorded audio.
