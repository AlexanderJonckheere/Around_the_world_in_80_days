# Cloudline Navigator

A calm navigation game in the cabin of a steerable hot air balloon above an endless sea of clouds. Built with Three.js (`WebGPURenderer` + TSL).

## Shadertoy source

The cloud sea and sky are a TSL (WebGPU) port of:

- **"Clouds" by Inigo Quilez**: https://www.shadertoy.com/view/XslGRr

Adapted so the camera flies above the cloud deck, with procedural noise instead of a noise texture, and driven by the game state (balloon position, altitude, heading, burner glow). See `js/shaders/clouds/clouds.js`.

Rain on the windows during storms is a WGSL port (via `wgslFn`) of the drops from:

- **"Heartfelt" by Martijn Steinrucken (BigWings)**: https://www.shadertoy.com/view/ltffzl, licence CC BY-NC-SA 3.0. See `js/shaders/rain/fragment.wgsl`.

## Running locally

```bash
npm install
npm run dev
```

Requires a browser with WebGPU support (recent Chrome / Edge / Safari).

### Dev mode

- **Dev mode** button on the start screen, or `?debug=1` (also skips the start screen): shows the true altitude, pressure, heading, position and target, teleport buttons per landmark and a 1×–5× speed slider.
- Keys in dev mode: PageUp/PageDown ±50 m, T teleport to the current target, F jump 1 km forward, H hide the cabin.

## Build & deploy

```bash
npm run build   # output in dist/
```

## Project structure

```
index.html          canvas + 2D UI overlay markup
css/ui.css          overlay, panels, widgets
js/
  script.js         entry: renderer, scene, camera, render loop
  constants/        rules.js (all game numbers), landmarks.js, routes.js
  objects/          cabin (glb + baked materials), world, landmarks
  systems/          balloon, stopwatch, input, camera rig, renderer, audio
  shaders/clouds/   cloud sea + sky (port of iq's Clouds)
  ui/               debug panel, area tabs
public/assets/      cabin.glb, baked textures, audio
blender/            source .blend files (not deployed)
```
