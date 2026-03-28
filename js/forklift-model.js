/** Fork height control via forklift-model-viewer.html iframe */

const MAX_FORK_INCHES = 240;
let viewerFrame = null;

export function loadForkliftModel() {
  viewerFrame = document.getElementById('model-viewer-frame');
  if (viewerFrame) {
    console.log('Model viewer iframe ready');
  } else {
    console.warn('model-viewer-frame not found in DOM');
  }
}

/** Set fork height 0-240 inches via LindeModel API in iframe */
export function setForkHeight(inches) {
  if (!viewerFrame || !viewerFrame.contentWindow) return;
  const clamped = Math.max(0, Math.min(MAX_FORK_INCHES, inches));
  try {
    if (viewerFrame.contentWindow.LindeModel) {
      viewerFrame.contentWindow.LindeModel.setForkHeight(clamped);
    }
  } catch (e) {
    // Cross-origin or not loaded yet — ignore
  }
}
