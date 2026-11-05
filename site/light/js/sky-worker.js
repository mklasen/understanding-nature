// Renders computed skies off the main thread (one worker per scene).
import { Sky } from './sky.js';
const sky = new Sky();
self.onmessage = (ev) => {
  const { id, air, w, h, view } = ev.data;
  sky.set(air);
  const buf = sky.renderLinear(w, h, view);
  self.postMessage({ id, w, h, buf }, [buf.buffer]);
};
