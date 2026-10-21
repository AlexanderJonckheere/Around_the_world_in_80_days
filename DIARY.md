# Build diary

Drafts per step, in build order. Rewrite them in your own words, add dates and a screenshot per step
in `diary/` (not `docs/`: that folder is the deployed build and is cleared on every build).

Each entry: **What** · **Decisions** · **Problems** · **Learned** · **Still open**.

---

## 1. Project setup

- **What:** Vite + Three.js (WebGPURenderer, TSL) project with a basic file structure, a placeholder cabin and a first flight model (turning, sinking, burner, vent).
- **Decisions:** Vite for the build; all game numbers in one constants file from the start.
- **Problems:** Opening `index.html` with Live Server fails: bare imports like `three/webgpu` only work through Vite (`npm run dev`, or the built `dist/`).
- **Learned:** A bundler resolves package imports; the browser alone can't.
- **Still open:** Git repo and GitHub Pages deployment.

## 2. 3D environment

- **What:** First cloud sea and sky (TSL adaptation of iq's "Clouds"), procedural landmark silhouettes, the world moving and turning around the fixed cabin, a dev panel.
- **Decisions:** The cabin stays at the origin; the world is shifted and rotated by the balloon's position and heading.
- **Problems:** Tone mapping and the colours needed several rounds of tuning.
- **Learned:** Moving the world instead of the camera keeps the cabin and its instruments simple.
- **Still open:** A real Blender cabin.

## 3. Blender cabin

- **What:** `cabin.glb` loaded with its two baked atlases and its animations (needles, burner, vent, rudder, rope sway).
- **Decisions:** Unlit baked materials; which object uses which atlas was found by sampling the atlases at each object's UVs; the paper sheets get their own drawn textures later.
- **Problems:** The GLB has no textures embedded; every material in the .blend pointed at the same atlas.
- **Learned:** Scrubbing an animation clip (setting its time from a value) turns a Blender animation into a gauge needle.
- **Still open:** Camera markers per area; the balloon envelope isn't baked.

## 4. Folder migration

- **What:** Moved all code from `src/` into the structure from CLAUDE.md (`js/constants`, `objects`, `systems`, `shaders`, `ui`, `css/ui.css`, `public/assets`). Set the Vite base to `/cloudline-navigator/`.
- **Decisions:** Moving only, no behaviour changes, so any bug after this commit comes from the move. Lowercase file names. Landmark heights split into their own constants file.
- **Problems:** All asset URLs and imports had to be updated by hand; the dev URL now includes the base path.
- **Learned:** Vite's `base` changes the dev URL too, not only the build. Relative asset paths keep working on GitHub Pages.
- **Still open:** Replace the zoom areas with name-based interactions; build the UI.

## 5. Clickable objects, UI overlay and widgets

- **What:** Removed the zoom areas and top navigation. Clicking a cabin object now opens a widget or panel, or does an action. Built the overlay base and four dial widgets.
- **Decisions:** One flight module as the source of truth; shared instrument readings for 3D and 2D; a turning compass card, like a real compass; padded invisible hit boxes for small objects; no GSAP, `damp` is enough.
- **Problems:** The stopwatch was too small to click. The burner's long pipe made its hit box cover the barometer, so real meshes are now tested first.
- **Learned:** The raycaster still hits invisible meshes. Caching the static dial face makes Canvas widgets cheap to redraw.
- **Still open:** Map and notebook content; the fuel limit; the gauge ranges.

## 6. Cloud deck as a height reference

- **What:** The cloud deck stays at 60 m altitude as a height reference; the shader rays start at the true altitude. Arrow Up/Down for burner/vent.
- **Decisions:** Cloud height in the rules constants, below the lowest landmark top. Removed the old shape-change trick.
- **Problems:** High up, the deck near the horizon was further than the old 9 km limit, so the limit went up.
- **Learned:** Using a fixed world height instead of one relative to the camera makes the altitude something the player can see.
- **Still open:** The "too high = missed" rule now needs its own check.

## 7. Altitude limits

- **What:** The balloon can't climb above 1,500 m or sink below the cloud deck (60 m).
- **Decisions:** Ceiling just above the highest target window; the floor equals the cloud top; lift past a limit is lost, not saved.
- **Learned:** Clamping in one place in the flight model keeps the rules simple and the same for keyboard, clicks and debug keys.
- **Still open:** The barometer scale doesn't reach the ceiling.

## 8. Click-and-drag controls

- **What:** The burner lever, vent rope and rudder are dragged instead of clicked; the 3D props follow the mouse.
- **Decisions:** One pull per drag; a dead zone on the rudder; the turn rate stays fixed so the hold-time formula still works; the pulled position comes from the clip's keyframes.
- **Learned:** A one-shot `AnimationAction` disables itself when it finishes, so it has to be re-enabled before you can scrub it. Window-level pointer events keep drags working outside the canvas.
- **Still open:** The look-around moves the view during a drag.

## 9. Barometric formula and rules page

- **What:** Height from pressure now uses h = 44330 × (1 − (P/P₀)^0.1903) in the game and the notebook. A rules page in the notebook is generated from the constants.
- **Decisions:** The game uses the exact inverse for the barometer, so the formula gives the true height. Examples are calculated, not typed, so they can't go out of date.
- **Problems:** The old ×8 rule and the real formula differ by tens of metres; showing one and using the other would make correct maths fail.
- **Learned:** One source of truth for formulas: the same function drives the gameplay and the page.
- **Still open:** Players now need a calculator; ground crew note; blank pages.

## 10. No fuel limit, proportional controls

- **What:** No more fuel limit. Burner and vent lift depend on how far the lever or rope is pulled; the rudder turn rate depends on how far the tiller is pushed.
- **Decisions:** A pull counts once, at its furthest point, when you let go; tiny pulls are ignored; the keyboard always gives full values; the notebook explains partial inputs.
- **Learned:** Scaling one input value (0–1) keeps the rules simple: full input = the rule value.
- **Still open:** Partial inputs make exact timing harder.

## 11. Continuous burner and vent; varied clouds

- **What:** The burner and vent work at a rate while held (burner later raised to 20 m/s, vent 10 m/s). The cloud shader got a rolling deck, cumulus towers in weather regions, and a high cloud sheet.
- **Decisions:** One general input system (keys + drag add up); towers kept away from landmarks.
- **Problems:** At first the towers were just faint fog; they needed their own solid density term. Sharp mask edges looked boxy, so the edges are pushed around by the noise.
- **Learned:** `uniformArray` passes the landmark positions into the shader; a background shader is always behind every mesh.
- **Still open:** Performance on weaker laptops.

## 12. Rule sheets and rules panel

- **What:** The rules now live on the two sheets next to the map (printed as a texture) and in a rules panel that opens from the left; the notebook is free for its own pages.
- **Decisions:** The two sheets form one document and both open the same panel; one content module feeds both the HTML and the canvas.
- **Problems:** The text on the sheets was upside down and mirrored; the cause was only a vertical flip in the sheets' UVs.
- **Learned:** A vertical flip alone makes text look upside down *and* mirrored. One data source for two renderers keeps them in sync.
- **Still open:** A keyboard shortcut for the rules.

## 13. Notebook calculations

- **What:** The notebook has fill-in formulas that calculate the result: height from pressure, arrival pressure, travel time, height fall-off and compass heading (tan⁻¹ east ÷ north). The rule sheets lost the turning and sandbag entries.
- **Decisions:** Fixed numbers printed in, measured values as blanks; P₀ pre-filled but editable; Space/Enter moves to the next blank; the results use the game's own formulas; shortcuts paused while typing.
- **Learned:** Ignoring key events from text fields at the input level keeps typing and game controls apart; `atan2` gives the right compass quadrant where a plain tan⁻¹ can't.
- **Still open:** Should the blanks clear per level? Free handwriting pages.

## 14. The map

- **What:** Map panel with a generated chart (landmarks with heights, departure, grid, compass rose, scale bar, safe areas) and circle dividers that show the radius in km and the east/north legs. The same chart is printed on the 3D map. Several circles, an eraser for single circles, zoom and pan (also trackpad: swipe and pinch).
- **Decisions:** One drawing function for both the panel and the texture. Circles are stored in world metres so they survive resizing and zooming. Both drag and click–click work. A departure mark instead of the balloon's position.
- **Learned:** Caching the chart in an offscreen canvas means only the circles are redrawn while dragging. Browsers report a pinch as a wheel event with Ctrl held.
- **Still open:** Protractor and pencil (maybe not needed); safe-altitude areas in the route.

## 15. Routes and the shared world

- **What:** The landmarks form one voyage northward, with hand-picked headings and distances per leg; every landmark is on the chart and in 3D, the current route numbered. Later reduced to a single route ("The route").
- **Decisions:** Legs with turns that are multiples of 3°, so rudder holds are whole seconds. Labels on the chart avoid symbols and each other.
- **Problems:** Landmarks of other levels were never loaded; two landmarks were too close; labels overlapped.
- **Learned:** Reserve the symbol positions first, then place the labels around them.
- **Still open:** More routes or levels.

## 16. Clouds that hide landmarks

- **What:** The cloud volume is now a pass after the scene that stops at the depth buffer, so clouds really hide landmarks. More and taller towers, closer haze, a clear zone around the balloon. Later: cloud collars, so landmarks only poke their tops out. The mountain was removed: only man-made landmarks.
- **Decisions:** Sky stays the background, clouds become a pipeline pass; logarithmic depth off for correct depth reading.
- **Problems:** A background can never cover a mesh; `getViewZNode` doesn't support logarithmic depth. The clouds turned with the camera, because inside a pipeline pass TSL's camera nodes belong to the pass's own camera.
- **Learned:** `RenderPipeline` + `pass()` lets a shader combine the rendered image with the depth buffer; `PostProcessing` is deprecated since r183. Pass the scene camera's matrices in as uniforms.
- **Still open:** —

## 17. iq's look, more volume and colour

- **What:** The clouds and sky use iq's original colours, lighting, fog and contrast curve. Tall, massive, billowing cumulus; self-shadowing, a silver lining and coloured sky light; the sun due east.
- **Decisions:** Shadertoy output treated as sRGB (`colorSpaceToWorking`); tone mapping off so the shader and the bake both show their own colours.
- **Problems:** ACES tone mapping made the colours dark blue; the old haze colour made a purple band at the horizon.
- **Learned:** `colorSpaceToWorking` always returns a vec4. Display-ready shader output shouldn't be tone mapped twice.
- **Still open:** —

## 18. Performance

- **What:** The clouds are computed into a half-resolution texture and laid over the sharp scene; detail drops with distance; cheaper light samples; empty air is skipped; fewer steps.
- **Decisions:** Resolution in CSS pixels so retina isn't extra expensive; the cabin never gets cloud (nothing can be within 150 m), so no blurry edges; 4 taps when upscaling against the jitter pattern.
- **Problems:** Measured that the clouds were ~99% of the frame; skipping empty air and lowering the resolution gave the most.
- **Learned:** Measure before optimising: the first ideas (fewer noise layers) helped little; `rtt()` with `resolutionScale` renders a TSL node at lower resolution.
- **Still open:** Test on your own laptop and on the live URL.

## 19. UI fixes around panels and widgets

- **What:** The notebook opens alone among panels but next to the instrument widgets; widgets move aside for the map header and the side panels; closed widgets are really hidden.
- **Problems:** Widgets covered the map's buttons; closed widgets slid back as invisible "ghosts" that blocked clicks.
- **Learned:** `visibility: hidden` after the slide-out transition makes a closed element unclickable without breaking the animation.
- **Still open:** —

## 20. Game structure: start screen, crashes and landmarks

- **What:** A start screen with the explanation and controls; a crash floor at the cloud deck with a red LOW warning light; "passed", "missed" and "crash" messages; "Restart level"; the stopwatch running from take-off.
- **Decisions:** Pass within 250 m inside the target window; too high or flown past = missed; one route only.
- **Learned:** Keeping progress (target, pass/miss/crash) in its own system keeps the flight model and the UI separate.
- **Still open:** Scoring and the flight log.

## 21. Dev mode

- **What:** A dev panel (start screen button or `?debug=1`) with the true values, teleport buttons per landmark and a 1×–5× speed boost; a close button that undoes everything.
- **Decisions:** The speed boost scales the whole flight and the stopwatch, so all calculations still hold.
- **Still open:** Should players get a fast-forward too?

## 22. Storms

- **What:** Storm areas on the chart; inside you sink faster and the wind turns the balloon in gusts; dark storm clouds, a grey sky and a dimmed sun; a STORM lamp and a darker cabin. The first leg is kept storm-free.
- **Decisions:** One smoothstep over the outer 350 m drives both the flight model and the look, so entering a storm is gradual. The storm spin stays well below the rudder rate so you can always counter-steer.
- **Problems:** The departure clearing also erased storm clouds; the first storm spin was faster than the rudder.
- **Learned:** Sharing one 0–1 strength between gameplay and visuals keeps them in sync.
- **Still open:** —

## 23. Rain on the windows (Heartfelt)

- **What:** A WGSL port (via `wgslFn`) of the drops from "Heartfelt" by BigWings, applied after the clouds and only on the windows, refracting the view; smaller drops; locked to the cabin.
- **Decisions:** "Outside" pixels are the ones whose depth is further than the cabin, so the cabin stays dry. The drop position comes from the viewing direction in the cabin, not the screen.
- **Problems:** At first the clouds were drawn over the glass, hiding the drops; screen-space drops turned with the camera.
- **Learned:** A post-process can mask itself with the depth buffer instead of a separate render pass.
- **Still open:** Compare with the original demo.

## 24. Lantern physics (Rapier)

- **What:** Rapier physics added; the lantern is a pendulum (fixed anchor + dynamic body + ball joint) that you can fling by clicking it; it swings out in turns, rocks gently and shakes in storms.
- **Decisions:** Rapier as in the rubric; a fixed physics step; the impulse at the exact hit point; the Blender sway clip turned off so it doesn't fight the physics.
- **Problems:** On spawn the heading jumps, which looked like an enormous turn and threw the lantern around; the measured turn rate is now capped.
- **Learned:** Placing the body's origin on the pivot and hanging the collider below it makes a pendulum with one joint.
- **Still open:** Sandbags and loose table objects with Rapier (CLAUDE.md §12).

## 25. Sound and music

- **What:** All sound synthesised with the Web Audio API: wind, burner, vent, rain, thunder, stopwatch ticks, UI sounds, game cues, and a generated lo-fi music loop; Sound and Music buttons.
- **Decisions:** No audio files needed; looping sounds follow the controls smoothly; music scheduled ahead on the audio clock.
- **Problems:** Passing a GainNode where an AudioParam was needed threw inside the render loop and broke every frame.
- **Learned:** Measuring the output with an analyser proves the sound is really there, not just error-free.
- **Still open:** PositionalAudio; recorded music.

## 26. Speed handle

- **What:** A brass speed handle on the table (built in code); drag it up/down or press W/Q to set 30–90 km/h in notches of 10; the balloon eases to the new speed at 5 km/h per second.
- **Decisions:** Notches keep travel times easy to calculate; the handle stays where you leave it; the speedometer shows the real, easing speed; the handle stands on the slanted table via a raycast.
- **Problems:** Dragging the handle grabbed the rudder: the rudder's enlarged click box (tiller + tall stand) covered half the table. Big objects now get no padded box.
- **Learned:** Map the hover target over a grid to find overlapping click areas; the look-around shifts objects on screen, so tests must wait for the view to settle.
- **Still open:** A Blender model for the handle.

## 27. Speed handle as a spring-back throttle

- **What:** The speed handle now works like a throttle: push forward to speed up, back to slow down (at most 2 km/h per second), let go and it springs back to neutral while the speed holds. W / Q do the same while held.
- **Decisions:** A dead zone around neutral so the speed holds with a wobbly hand; slower acceleration; no notches any more, the speedometer shows the exact speed.
- **Learned:** A control that springs back is easier to "hold" than one you have to put back in the middle yourself.
- **Still open:** —
