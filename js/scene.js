/** Scene shell — Three.js removed, model viewer is now iframe-based.
 *  Kept as a module so existing imports don't break. */

let animCallbacks = [];
let running = false;

export function initScene() {
  // No Three.js setup needed — center panel uses model-viewer iframe.
  // Still run animation callbacks for gauge/UI updates.
  running = true;
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    for (const cb of animCallbacks) cb();
  }
  tick();
  console.log('Scene shell initialized (iframe model viewer)');
}

export function getScene() { return null; }
export function getCamera() { return null; }
export function getRenderer() { return null; }

export function onAnimate(cb) { animCallbacks.push(cb); }
