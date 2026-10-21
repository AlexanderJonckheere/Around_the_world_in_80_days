import * as map from './map.js';
import * as notebook from './notebook.js';
import * as rules from './rules.js';
import * as stopwatch from './stopwatch.js';
import * as barometer from './barometer.js';
import * as speedometer from './speedometer.js';
import * as compass from './compass.js';

// Panel and widget rules (CLAUDE.md §7.3).
// The notebook is for calculating with the instruments: it opens on its own (the map and rule pages
// close), the instrument widgets stay usable next to it, and the cabin stays clickable so more
// instruments can be opened. The map and rule pages may be open side by side and darken the cabin.
export const panels = { map, notebook, rules };
const CHART_PANELS = [map, rules];
export const widgets = { stopwatch, barometer, speedometer, compass };

const backdrop = document.querySelector('.backdrop');
const panelList = Object.values(panels);
const widgetList = Object.values(widgets);

// Panels that cover the cabin: while one is open, 3D hover and clicks are off
export const isPanelOpen = () => CHART_PANELS.some((p) => p.isOpen());
export const closePanels = () => panelList.forEach((p) => p.isOpen() && p.close());

// The notebook and the chart panels never share the screen
function keepNotebookAlone(el) {
  if (el === notebook.el) CHART_PANELS.forEach((p) => p.isOpen() && p.close());
  else if (CHART_PANELS.some((p) => p.el === el) && notebook.isOpen()) notebook.close();
}

// Body classes drive the CSS: darkened 3D view, room for the side panels, widgets beside the notebook
document.addEventListener('ui:change', ({ detail }) => {
  if (detail.opened) keepNotebookAlone(detail.el);
  document.body.classList.toggle('has-panel', isPanelOpen());
  document.body.classList.toggle('has-notebook', notebook.isOpen());
  document.body.classList.toggle('has-map', map.isOpen());
  document.body.classList.toggle('has-rules', rules.isOpen());
});

// Clicking the darkened 3D view counts as clicking outside the panels
backdrop.addEventListener('pointerdown', closePanels);

// Widgets keep showing live values while open
export function updateWidgets(readings, flightStopwatch) {
  widgetList.forEach((w) => w.isOpen() && w.update(readings, flightStopwatch));
}
