# CLAUDE.md

## Project

**Cloudline Navigator**: a navigation game in the cabin of a steerable hot air balloon, flying above an endless sea of clouds. The player has no altitude display and no position marker: only a map, a compass, dividers, a barometer, a speedometer, a stopwatch and a notebook. With their own calculations they fly from landmark to landmark, arriving at the right place at the right height.

A school assignment for Creative Development (Three.js with WebGPU).

- This file contains the full concept, the rules, the conventions and the build order. Read the relevant section before starting a new step.
- The 3D cabin model is specified in detail in **`CABIN_MODEL.md`**. Follow it when building or loading the model.
- We build **step by step**, following the build order in section 13. One step at a time; never jump ahead.
- The project must always work online (GitHub Pages). **Not online = no marks.**

---

## 1. The assignment

> Find a fragment shader you like on Shadertoy.com and port it to WebGPU. Embed it in a Three.js environment with the WebGPURenderer and make sure the shader responds to user interaction.
> Submit a URL where we can see your working experiment, and your source code, in separate assignments. Mention the original shader URL in a README.md at the root of your project. Do not submit node_modules.

Extra marks for:

- Interaction that is more than just looking around
- Integration of physics
- Integration of multiple shaders
- Integration of additional WebGPU libraries
- Integration of your own Blender models, including baking
- Controlling animations from a Blender model

The project must be fully functional online. Deploy early and often. Use Git and GitHub throughout for backups.

### How this project meets it

| Requirement                           | How it's met                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Port a Shadertoy fragment shader      | A volumetric cloud shader, ported 1:1 to WGSL first, then used as the cloud sea and sky outside the window                                                         |
| Three.js with WebGPURenderer          | The whole game                                                                                                                                                     |
| Shader responds to interaction        | Altitude moves the view through the cloud layer; heading rotates the sky; the burner lights the clouds warm orange; the time of day changes the sun                |
| Working URL online                    | GitHub Pages via GitHub Actions, from step 1                                                                                                                       |
| README with original shader URL       | At the root, from the first commit                                                                                                                                 |
| No node_modules                       | `.gitignore` from the first commit                                                                                                                                 |
| **Extra:** interaction beyond looking | Clickable 3D instruments and controls; 2D tool panels for measuring on the map and calculating in the notebook; a full navigation game loop                        |
| **Extra:** physics                    | Rapier: sandbags pushed off the ledge fall away; loose dividers and pencil slide on the table when the cabin jolts. Own flight model for sinking, lift and turning |
| **Extra:** multiple shaders           | Clouds and sky (port), burner glow, window glass, landmark beacon lights, bloom                                                                                    |
| **Extra:** additional WebGPU library  | Rapier (WASM) for physics; TypeGPU compute (optional, see scope)                                                                                                   |
| **Extra:** Blender models + baking    | The cabin, table, instruments and props, with baked lighting                                                                                                       |
| **Extra:** Blender animation control  | Burner lever, vent pull, rudder wheel, gauge needles (scrubbed from values), vent rope sway, all triggered from code                                               |

---

## 2. How we work together

### Always ask first

- **Never implement, add or change anything I did not directly ask for**, or anything outside the current step or the scope in this file, without asking first. This includes: new features, new libraries or dependencies, refactors of working code, renaming files, changing game rules or numbers, and changing the folder structure.
- If you think something outside the step is needed or would be better, **propose it and wait for my answer**.
- When in doubt whether something is in scope: ask.

### Before writing code

- Explain what you're about to do and why.
- Break it down into steps I can follow.
- Wait for my OK before proceeding.

### After writing code

- Explain what each part does.
- Tell me what I should see now (a **"Check"**), like in the course guide.
- Suggest a short commit message. I commit myself.
- Draft a `DIARY.md` entry for the step (what, decisions, problems, learned, still open). I edit it into my own words.

### General rules

- Treat every session as a teaching opportunity.
- If something can be done in a simpler way, or if my idea has a problem, say so before building it.
- When I make a mistake, explain why it's wrong instead of only fixing it.

### Up-to-date resources

Three.js (especially WebGPU and TSL) changes almost every month. Don't rely on memory for APIs:

- Check the **installed version** in `package.json` and `node_modules/three` before using an API.
- Prefer the official sources:
  - Three.js docs: https://threejs.org/docs/
  - Three.js WebGPU examples: https://threejs.org/examples/?q=webgpu
  - TSL wiki: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
  - WGSL spec: https://www.w3.org/TR/WGSL/
  - Vite static deploy (GitHub Pages): https://vite.dev/guide/static-deploy
  - Rapier (JS): https://rapier.rs/docs/user_guides/javascript/getting_started_js
  - TypeGPU: https://docs.swmansion.com/TypeGPU/
  - GSAP: https://gsap.com/docs/v3/
  - MDN (Canvas 2D, Pointer Events, CSS transitions): https://developer.mozilla.org/
  - Blender glTF exporter: https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
- If an API is deprecated or changed, say so and use the current way.

---

## 3. Git: hands off

- **NEVER commit, push, or change git history.** No `git add`, `git commit`, `git push`, `git reset`, `git rebase`, `git checkout`/`git restore` on files, `git stash`, `git tag`, `git merge`, or creating branches.
- Read-only commands (`git status`, `git diff`, `git log`) are fine.
- When a step is done, tell me it's ready to commit and suggest the message.

---

## 4. Code quality: think like a senior developer

- Look for the best approach first, then the shortest and most optimised code that does it.
- **Don't repeat yourself.** When code appears twice, make it a function or module.
- One responsibility per file and per function. Small, clearly named functions.
- When "shortest" and "clearest" conflict, choose clearest: I need to understand and explain this code.
- No unused code, no leftover console logs, no dead files.
- Performance matters: only render what's visible, reuse geometries, materials and render targets, cap the pixel ratio, avoid allocations inside the render loop.
- Comments explain _why_, not _what_. Comments in English.
- Vanilla JavaScript (ES modules). No frameworks, no TypeScript.
- **No magic numbers.** All game rules (sink rate, turn rate, burner lift, landmark heights…) live in one constants file. The rules page in the notebook is generated from the same constants, so the rules shown and the rules used can never differ.
- **One source of truth for the flight state** (position, heading, altitude, fuel, sandbags). Instruments and UI panels only _read_ it; controls only _change_ it through the flight system.

---

## 5. Class conventions

Follow the methods from the course (READMEs and the step-by-step guide). Don't introduce other patterns unless there's a clear reason, and explain that reason first.

### Project setup

- Vite. Scripts: `"dev": "vite"`, `"build": "vite build"`.
- `vite.config.js` with `export default { base: '/cloudline-navigator/' };` (must match the GitHub repo name).
- `.gitignore`: `node_modules`, `dist`.
- Deploy with the GitHub Actions workflow for GitHub Pages from the Vite docs. Pages source is set to "GitHub Actions".

### Structure

```
index.html               canvas + the 2D UI overlay markup
vite.config.js
README.md                assignment README: shader URL, credits, how to play
CLAUDE.md                this file
CABIN_MODEL.md           3D cabin specification for Blender
DIARY.md                 build diary, one entry per step
docs/diary/              one screenshot per step (not deployed)
css/
  ui.css                 overlay, panels, widgets, slide transitions
js/
  script.js              entry: renderer, scene, camera, render loop
  constants/             rules.js (all game numbers), landmarks.js, routes.js, colors.js
  objects/               one 3D object per file, returns { mesh } (and e.g. animate)
  systems/               flight, interactions (raycast + hover), physics, sound, levels
  ui/                    one 2D panel or widget per file: map, notebook, stopwatch, compass…
  shaders/<name>/        fragment.wgsl (and buffer.wgsl for extra passes)
public/
  assets/                .glb models, baked textures, audio
```

### Three.js

- Import from `'three/webgpu'` and `'three/tsl'`, never from plain `'three'`.
- `new THREE.WebGPURenderer({ canvas, alpha: false })`. It falls back to WebGL2 automatically; show a small label with the active backend.
- Use `renderer.setAnimationLoop(draw)`, no own `requestAnimationFrame` loop. For a single render: `await renderer.init()` first.
- Keep the canvas sharp with `resizeRendererToDisplaySize`.
- Each object lives in its own file in `js/objects/` and returns `{ mesh }`, plus an `animate` function when it moves.
- Smooth value changes in 3D (hover glow, sway, needle easing) with **GSAP**, animating a properties object: `gsap.to(properties, { ... })`.
- Clicks and hover on 3D objects with **one shared `THREE.Raycaster`** in `systems/interactions.js`, matching objects **by name** from the Blender file.

### 2D UI (panels and widgets)

- Plain HTML elements in `index.html`, styled in `css/ui.css`, on top of the canvas.
- Each panel or widget is one file in `js/ui/` exporting `{ open, close, toggle }` (and `update` when it shows live values).
- **Slide-in and slide-out with CSS transitions**, triggered by toggling a class (for example `is-open`). Reason: for DOM elements this is simpler and smoother than JavaScript animation. GSAP stays for 3D values.
- Drawing (map tools, notebook writing) uses a **Canvas 2D** element with **Pointer Events**, so mouse, pen and touch work the same.
- UI files never change game state directly; they call the flight system (for example `flight.toggleStopwatch()`), and read from the flight state to display values.

### Shaders

- Shaders live in `js/shaders/<name>/fragment.wgsl` and are imported with Vite's `?raw`.
- Use them via `wgslFn`. The **main function goes at the top** of the file, helper functions below it (wgslFn reads the first function).
- Everything the function needs comes in as **parameters**; no `@fragment`, `@binding` or uniform structs in Three.js.
- Uniforms are TSL `uniform(...)` objects in a `uniforms` object; change them with `.value` in `draw()`.
- Shadertoy's `fragCoord` is `uv().mul(uniforms.iResolution)`.
- Textures: pass the same `texture(...)` node twice, as `iChannel0: texture_2d<f32>` and `iChannel0Sampler: sampler`.
- Render a shader or scene into a texture with `THREE.RenderTarget` plus a mini-scene with an `OrthographicCamera(-1, 1, 1, -1, 0, 1)` showing a 2×2 plane. In `draw()`: `setRenderTarget(renderTarget)`, render, `setRenderTarget(null)`, then the main render.
- Colours: this scene mixes shaders with a baked model, so **don't** change `renderer.outputColorSpace`. Wrap Shadertoy output in `colorSpaceToWorking(..., THREE.SRGBColorSpace)`.

### Porting from Shadertoy (method from class)

1. Read `mainImage` and the Shader Inputs. List which inputs are really used (`iResolution`, `iTime`, `iMouse`, `iChannel0`…).
2. **First set up the inputs**, with a temporary function that only shows uv or the texture. Check that it runs.
3. **Then translate line by line**, testing often. Use the GLSL → WGSL table from the course:
   - `vec2/3/4`, `float` → `vec2f/3f/4f`, `f32`. `mat4` → `mat4x4f`.
   - `let` for constants, `var` when the value changes.
   - `fragColor = c;` → `return c;`
   - `texture(iChannel0, uv)` → `textureSample(iChannel0, iChannel0Sampler, uv)`; `textureLod` → `textureSampleLevel`.
   - `#define` macros with parameters become functions; `#if`/`#else`: keep one branch.
   - `mod(x, y)` → own function `x - y * floor(x / y)` (WGSL's `%` differs for negative numbers).
   - `atan(y, x)` → `atan2(y, x)`. `a ? b : c` → `select(c, b, a)`.
   - `.s/.t` → `.x/.y`. No `color.rgb *= …`: build a new vector. Braces are required on `if`.
   - Global `const` outside functions → `const`, or `let` inside the function.
4. Without a texture, the image can be upside down: use `vec2f(fragCoord.x, iResolution.y - fragCoord.y)`.
5. Shaders with multiple tabs (Buffer A…) need one render target per buffer.
6. **Every ported shader is credited in the README** with its Shadertoy URL, author and licence.

### Blender

- Baked lighting: `MeshBasicMaterial({ map: bakedTexture })`, with `bakedTexture.flipY = false` and `bakedTexture.colorSpace = THREE.SRGBColorSpace`.
- Load with `GLTFLoader` and assign materials with `gltf.scene.traverse(...)`, **by object name**. Objects that need a shader or interaction get a clear name in Blender (see `CABIN_MODEL.md`).
- Animations: `THREE.AnimationMixer`, `THREE.AnimationClip.findByName(gltf.animations, 'Name')`, `mixer.clipAction(clip)`, and `mixer.update(delta)` in the render loop.
- Gauge needles and the rudder wheel can be **scrubbed**: set the action's time from a value (for example pressure → needle angle) instead of playing it.
- The **main camera position is an empty in Blender** (`cam_main`, looking at `look_main`), so the view that shows everything is set up visually.
- Files go in `public/assets/`.

### Debugging

- WGSL errors appear in the DevTools console. Line numbers count from the start of the shader string.
- You can't log inside a shader: output the value as a colour (e.g. `return vec4f(uv, 0.0, 1.0);`).
- Test in Chrome first, then Safari, and on the live URL in a private window.
- Test at different window sizes: **every instrument must stay visible** in the main view.
- Test URL parameters (development only, never shown to players by default):
  - `?level=3` starts at a level.
  - `?debug=1` shows the true altitude, position and heading in a small panel.

---

## 6. Core idea (game design)

The player is the navigator of a small steerable hot air balloon that flies permanently above an endless sea of clouds. The ground is never visible.

The goal is to fly from landmark to landmark. Each landmark (a radio tower, a church spire, a mountain peak, a lighthouse) rises just above the clouds. To reach it, the player must:

1. work out the heading and distance from the map,
2. turn the balloon onto that heading by timing how long they hold the rudder,
3. work out how long the flight will take from the speedometer reading,
4. manage altitude, because the balloon slowly and constantly loses height.

Altitude is **never shown directly**. The player reads air pressure from a barometer and converts it to height with a formula printed in the notebook. The notebook also lists the landmark heights and the formulas for turning and travel time, and the player can calculate on its blank pages.

The challenge is arriving at the right place at the right height:

- **Too low:** the balloon crashes into the terrain or the landmark.
- **Too high:** the landmark passes unseen beneath the cloud deck and you miss it.
- **Off course:** you never find it at all.

It is a thinking game: calm, precise and satisfying. No enemies, no shooting, no time pressure beyond the balloon's own slow sink.

---

## 7. Camera and interaction

### 7.1 The main view

- The player is **seated in a fixed position**, facing forward. **No walking, no turning around, no zooming.**
- **Everything is visible from the main view**: the window, the table with map, compass, notebook and stopwatch, the instruments on the walls and all controls. Nothing requires looking around.
- **Minimal look-around:** moving the mouse shifts the view only a few degrees (about ±5° left/right, ±3° up/down) for a subtle sense of depth.
- A **gentle, constant sway**, as if the cabin hangs from the balloon. Calming, never nauseating; slightly stronger during turns and burner use.
- The camera's field of view adapts to the screen shape so all objects stay in view: about 70° vertical on 16:9; on narrower screens the vertical FOV increases so the horizontal view stays at least about 100°.
- Clickable objects **highlight subtly on hover** (a soft glow or outline) and the cursor changes to a pointer.

### 7.2 What happens on click

Every clickable object does one of three things.

**Panels** (large, for working; one open at a time)
| Object | Panel | Slides in from | Size |
|---|---|---|---|
| Map | Map view with dividers, protractor and pencil | **Bottom** | Almost the whole screen |
| Notebook | Rules pages and blank pages to write on | **Right** | About 40% of the width, full height |

**Widgets** (small, live readouts; toggle on and off; several can be open at once)
| Object | Widget | Position |
|---|---|---|
| Stopwatch | Large stopwatch with start/stop and reset | **Top-right corner** |
| Speedometer | Large, sharp speedometer dial | Right edge, below the stopwatch |
| Barometer | Large, sharp barometer dial | **Top-left corner** |
| Compass | Large compass card with settling needle | **Bottom-left corner** |

Each widget appears near the side where its object sits in the cabin.

**Direct actions** (no popup)
| Object | Action |
|---|---|
| Burner lever | Click: one burner pull (plays `BurnerPull`, roar, orange glow) |
| Vent handle | Click: one vent pull (plays `VentPull`) |
| Sandbag | Click: that bag is pushed off the ledge and falls (Rapier) |
| Rudder wheel | Press and **hold** the left or right half to turn; release to stop |

### 7.3 Panel and widget rules

- Clicking the same object again, pressing **Esc**, the panel's **close button** or (for panels) clicking outside it closes it.
- Opening one panel closes the other.
- **Widgets stay on top of panels**, so the stopwatch, compass and barometer stay usable while measuring on the map or writing in the notebook.
- **The world keeps running** while panels are open: the balloon keeps sinking and moving. Planning costs time.
- While a panel is open, the 3D view behind it is slightly darkened, and hover and clicks on 3D objects are disabled (except through the global shortcuts).

### 7.4 Global keyboard shortcuts (work at any time)

| Action                 | Key                        |
| ---------------------- | -------------------------- |
| Steer left / right     | Hold A / D (or arrow keys) |
| Burner                 | Space                      |
| Vent                   | V                          |
| Start / stop stopwatch | S                          |
| Toggle map / notebook  | M / N                      |
| Close panel            | Esc                        |

---

## 8. The cabin

The full 3D specification (sizes, positions, Blender names, baking, animations) is in **`CABIN_MODEL.md`**. Summary of what the player sees from the seat:

- **In front:** a slanted chart table under a large **half-octagon window** (wide at the top, narrowing to the bottom). Through it: the sky and the cloud sea.
- **On the table:** the **map** in the middle, the **compass** to its left, the **notebook** to its right, the **stopwatch** on a small stand at the back-right corner, and loose **dividers** and a **pencil**.
- **Left of the table:** the **vent handle** hanging from the ceiling on a rope.
- **Left wall:** the **barometer** (high) and the **burner lever** (low).
- **Front wall, right of the window:** the **speedometer**.
- **Right wall, front corner:** the **rudder wheel**.
- **Outside the window, on a ledge:** three **sandbags**.

### 8.1 The 2D panels in detail

**Map panel** (from the bottom)

- A large, flat view of the chart: landmarks with name and symbol, compass rose (north up), scale bar (1 grid square = 1 km) and the **minimum safe altitude** per region. It does **not** show the balloon's position.
- **Dividers:** drag the two points onto the map, then drag the opened dividers onto the scale bar to read the distance.
- **Protractor:** drag and rotate it on the map to measure the bearing between landmarks.
- **Pencil:** draw course lines; an eraser removes them.
- Drawings on the map are kept until the level ends.

**Notebook panel** (from the right)

- A small leather notebook with page tabs.
- **Rules pages** (printed, read-only): all formulas, the sink rate, burner, vent and sandbag effects, and the landmark height table. Generated from `constants/rules.js` and `constants/landmarks.js`.
- **Ground crew note** (per level): a note clipped into the notebook with the current reference pressure and any wind information. It changes when the weather changes.
- **Blank pages:** write and calculate with the mouse in pencil, with an eraser and a "clear page" button. Several pages, kept until the level ends.

**Widgets**

- **Stopwatch:** big dial and digital-looking second hand, start/stop and reset buttons, keeps ticking when closed.
- **Barometer, speedometer, compass:** large, sharp versions of the 3D dials, driven by the same flight state. The compass needle swings and settles with damping; the player has to wait for it.

---

## 9. Rules and formulas

All numbers are game values chosen to be calculable by hand. They live in `js/constants/rules.js` and are printed in the notebook.

| Rule                 | Formula                                                             | Example                  |
| -------------------- | ------------------------------------------------------------------- | ------------------------ |
| Height from pressure | Height (m) = (Reference pressure − Barometer) × 8                   | (1013 − 950) × 8 = 504 m |
| Turning              | 3° per second while the rudder is held. Hold time (s) = degrees ÷ 3 | 040° → 112° = 72° → 24 s |
| Travel time          | Time (s) = Distance (km) ÷ Speed (km/h) × 3600                      | 3 km at 60 km/h = 180 s  |
| Sink rate            | −2 m per second, constantly                                         | 180 s → −360 m           |
| Burner               | +50 m per pull                                                      |                          |
| Sandbag              | +150 m per bag                                                      |                          |
| Vent                 | −50 m per pull                                                      |                          |

Default reference pressure: **1013 hPa**.

### Landmarks and target windows

Pass a landmark **at or above its height, but no more than 100 m above it**. Below: collision. Above: hidden under the cloud deck, missed. Horizontally the balloon must pass within a set radius.

| Landmark      | Height  | Target window |
| ------------- | ------- | ------------- |
| Windmill      | 90 m    | 90–190 m      |
| Lighthouse    | 140 m   | 140–240 m     |
| Church spire  | 180 m   | 180–280 m     |
| Radio tower   | 320 m   | 320–420 m     |
| Castle tower  | 450 m   | 450–550 m     |
| Mountain peak | 1,250 m | 1,250–1,350 m |

### Minimum safe altitude

Each map region has a minimum safe altitude. Sinking below it anywhere means crashing into hidden terrain.

### Game feel vs. rules

Height changes from the burner, vent and sandbags are applied **smoothly over a few seconds** (inertia), but always add up to exactly the stated amount, so the math stays correct.

---

## 10. Gameplay loop, win and lose

### Loop

1. **Start of a leg:** the balloon passes a landmark; the player knows their position.
2. **Plan:** open the map and measure distance and bearing; open the compass, barometer and speedometer widgets; calculate turn time, travel time, current and arrival height in the notebook; decide how many burner pulls or sandbags are needed and when.
3. **Execute:** start the stopwatch, hold the rudder for the calculated time, check the compass, restart the stopwatch for the travel time, manage height along the way.
4. **Arrive:** when the timer runs out, look out of the window. The landmark should rise into view.
5. **Result:** success → next leg. Crash → white-out, dull thud, retry the leg. Miss → correct and search, or retry.

### Win and lose

- **Win a route:** pass every landmark in order within the target windows.
- **Crash:** below a landmark's height when passing it, or below the minimum safe altitude anywhere.
- **Miss:** passing too high, or too far to the side.
- **Out of resources (optional):** no fuel or sandbags left while still sinking.

### Scoring

- Accuracy: horizontal distance to the landmark and how close to the ideal height.
- Time: total route time.
- Resources: unused fuel and sandbags.
- **Flight log** at the end: planned vs. actual heading, time and arrival height per leg, and a final grade.

### Levels

1. **First flight:** one leg, straight ahead. Teaches the barometer and sink rate.
2. **The turn:** one leg with a turn. Teaches the rudder and stopwatch.
3. **The route:** three or four legs with different headings and distances.
4. **Heights:** very different landmark heights (a windmill after a mountain).
5. **Weather front:** the reference pressure changes mid-route (e.g. 1005 hPa). A new ground crew note appears in the notebook; the player has to notice.
6. **Crosswind:** a constant wind pushes the balloon sideways; the ground crew note gives a correction rule.
7. **Night flight:** dark sky and stars, landmarks shown only by a blinking light, the cabin lit by a lantern.

---

## 11. World, shaders and look

### World

- An **endless, rolling cloud sea** below, to the horizon, and a sky with a sun. This is the ported Shadertoy shader and the main visual, seen through the window.
- **Landmarks** are the only objects poking through the clouds: simple, recognisable silhouettes. Visible only when close enough horizontally **and** within the height window.
- No ground, no cities, no roads. Very few assets.
- The balloon does not need a huge world: the flight system keeps a position on the map; the cloud shader scrolls with that position and rotates with the heading; landmarks are placed relative to the balloon.

### Shaders

| #   | Shader                               | Where                                                             | Source                                   |
| --- | ------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------- |
| 1   | **Volumetric clouds and sky**        | Outside the window                                                | **Shadertoy (required port)**            |
| 2   | Burner glow                          | Orange light on the clouds and through the window top when firing | Own, uniform in shader 1 plus a TSL glow |
| 3   | Window glass                         | Faint reflection and edge tint on the glass                       | Own, TSL                                 |
| 4   | Landmark beacon lights               | Night flight                                                      | Own, small                               |
| 5   | Bloom on the burner glow and beacons | Post-processing                                                   | Three.js bloom node                      |
| 6   | Wind streaks (optional)              | Outside                                                           | Own, TypeGPU compute                     |

### Candidate shaders for the port (verify the URL, inputs and licence before choosing)

- "Clouds" by Inigo Quilez (iq): https://www.shadertoy.com/view/XslGRr. Uses a noise texture in `iChannel0`.
- "Protean clouds" by nimitz: https://www.shadertoy.com/view/3l23Rh.
- Prefer a **single-pass** shader (no Buffer A/B tabs). Most Shadertoy shaders are CC BY-NC-SA 3.0; check each one and put it in the README.

**The agent must ask me which shader to port before starting step 2.**

### How the shader responds to interaction

- **Altitude:** the camera ray's height in the cloud layer follows the true altitude. Lower means denser clouds closer to the window.
- **Heading:** the sky and clouds rotate as the balloon turns.
- **Position:** the clouds scroll as the balloon moves.
- **Burner:** a warm orange light on the nearby clouds while it fires.
- **Time of day:** the sun position and colour per level (dawn, midday, sunset, night).

### Look and sound

- **Visual style:** clean, warm, slightly stylised. Brass, wood, leather and paper in the cabin; baked lighting. The 2D panels match: paper textures, ink lines, brass dials.
- **Sound** (Three.js `PositionalAudio`): soft constant wind, creaking wood and rope, the burner's roar, a ticking stopwatch, pencil scratching, paper rustle and the click of the dividers, needle clicks, a calm background score. A mute button is always available.
- **Feeling:** quiet concentration, like a 1920s navigator alone with their charts.

---

## 12. Physics

- **Rapier** (`@dimforge/rapier3d-compat`, WASM):
  - **Sandbags:** three dynamic bodies resting on the ledge outside the window. Clicking one gives it a push; it tips off the ledge and falls away into the clouds, then is removed.
  - **Loose objects on the table:** the dividers and pencil are dynamic bodies. The table top and its raised lip are static colliders. Turning and burner jolts apply a small impulse, so they slide and bump against the lip.
- **Own flight model** (not Rapier): sinking, burner lift, vent, sandbag lift, turning and speed are simple formulas in `systems/flight.js`, so the notebook math is always exact.
- **Own small spring models:** the cabin sway and the damped compass needle.
- Note: the dividers in the 2D map panel are a separate UI tool; the 3D dividers on the table are decoration with physics.

---

## 13. Build order

**Deploy after every step.** Every step ends with a Check, a commit message suggestion and a diary draft.

### Phase 1: foundation

1. **Setup:** Vite, WebGPURenderer, repo, GitHub Pages workflow, README (with assignment info), `.gitignore`, `DIARY.md`. A live URL showing a coloured screen and the backend label.
2. **Shadertoy port 1:1:** the chosen cloud shader on a fullscreen quad, exactly like the original. Separate commit. Shader URL in the README.
3. **Shader responds to input:** add uniforms for altitude, heading, position and burner glow; drive them temporarily with keys to prove it works.

### Phase 2: the core game (passes the assignment on its own)

4. **Cabin blockout:** simple placeholder boxes for the cabin, window and every object at the positions in `CABIN_MODEL.md`; the clouds visible through the window.
5. **Main camera:** fixed seat, adaptive FOV so everything is visible, minimal look-around, sway.
6. **Interactions:** raycaster, hover highlight, click dispatch to panel / widget / direct action.
7. **Flight system:** the flight state and rules from `constants/rules.js`: sinking, burner, vent, sandbags, rudder turning, speed, position. Connected to the cloud shader. `?debug=1` panel. Global keyboard shortcuts.
8. **Widgets:** stopwatch, barometer, speedometer and compass, reading the flight state; the matching 3D needles move too.
9. **Landmarks and win/lose:** landmark silhouettes, visibility window, pass, crash and miss detection, retry.

### Phase 3: the 2D tools

10. **UI overlay base:** panel and widget system, slide transitions, Esc and close rules, darkening the 3D view.
11. **Map panel:** the chart from `constants/landmarks.js` and `routes.js`, with scale bar, compass rose and minimum safe altitudes; dividers, protractor, pencil and eraser.
12. **Notebook panel:** rules pages generated from the constants, ground crew note, blank pages with pencil and eraser.

### Phase 4: Blender and physics

13. **Blender cabin:** model, bake and export following `CABIN_MODEL.md`; replace the blockout; baked materials by object name.
14. **Blender animations:** `BurnerPull`, `VentPull`, rudder wheel and needles scrubbed from values, rope sway.
15. **Rapier:** sandbags falling, dividers and pencil sliding on the table.

### Phase 5: game structure and extra shaders

16. **Levels 1–4:** routes, the level system, `?level=`, flight log and scoring.
17. **Extra shaders:** burner glow, window glass, bloom.
18. **Levels 5–7:** weather front, crosswind, night flight with beacon lights.

### Phase 6: polish

19. Sound design.
20. Start screen ("Click to begin", which also unlocks audio), short tutorial in level 1, end screen with the flight log.
21. Performance, testing on weaker laptops, a WebGPU-not-available message, README with a GIF and full credits.
22. Optional: TypeGPU wind streaks.

---

## 14. Scope

- **Must:** Phases 1 and 2. A playable, online game with the ported shader responding to interaction.
- **Should:** Phases 3 and 4 (map and notebook tools, Blender with baking and animations, Rapier physics) and levels 1–4.
- **Could:** extra shaders, levels 5–7, sound polish, TypeGPU.

### Out of scope

- No walking, turning around or camera zooming; always seated, facing forward, with everything in view.
- No direct altitude display or position marker (except `?debug=1`).
- No enemies or combat.
- No visible ground below the clouds.
- No autopilot or heading assist.
- No chalkboard; all notes and rules are in the notebook.

Anything not described in this file is out of scope until I say otherwise. **Ask first.**

---

## 15. README requirements

The `README.md` at the root must always contain:

- Project name and a one-line description.
- **Live demo URL.**
- **Original shader:** name, author, Shadertoy URL, licence, and where the port lives in the code.
- How to play (controls table).
- Test URL parameters.
- Tech stack and folder structure.
- Run locally: `npm install`, `npm run dev`.
- Credits: every shader, library (with licence), model, texture and sound.

---

## 16. Tech stack

- **Build:** Vite
- **Rendering:** Three.js WebGPURenderer, TSL and WGSL via `wgslFn`
- **2D UI:** HTML, CSS transitions, Canvas 2D, Pointer Events
- **Animation:** GSAP for 3D value changes, `AnimationMixer` for Blender clips
- **Physics:** Rapier (`@dimforge/rapier3d-compat`, WASM)
- **WebGPU library (optional):** TypeGPU
- **3D:** Blender → glTF/GLB with baked textures and animations
- **Audio:** Web Audio API via Three.js `PositionalAudio`
- **Hosting:** GitHub + GitHub Pages via GitHub Actions

---

## 17. Open items

- [ ] Choose the Shadertoy cloud shader and ignore the licence:use this one https://www.shadertoy.com/view/XslGRr.
- [ ] Final game name is around the world in 80 days
- [ ] Design the first route (landmark positions, distances, headings) and check it on paper
- [ ] the burner fuel isnt limited
- [ ] Map and notebook open at the same time (side by side)? still to be decided
- [ ] Choose the background music and sounds arial sounds for example wind,... steampunk lo-fi esc music in the background.

webgpu
https://github.com/devinekask/creative-development-f26/tree/main/webgpu

three.js
https://github.com/devinekask/creative-development-f26/tree/main/threejs
