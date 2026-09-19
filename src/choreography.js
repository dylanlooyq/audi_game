import { Dancer3D } from './dancer3d.js';

// Drives the on-stage dancer. Renders a 3D cel-shaded character when WebGL is available and
// falls back to the old CSS placeholder otherwise, so the game never depends on the 3D layer.
export class ChoreographyController {
  constructor(element, { bpm, clock, isPaused } = {}) {
    this.element = element;
    this.dancer3d = null;
    try {
      this.dancer3d = new Dancer3D(element.parentElement, { bpm, clock, isPaused });
      this.dancer3d.loaded.catch(() => this.fallBack());
      element.classList.add('has-3d');
    } catch (err) {
      console.warn('3D dancer unavailable, using placeholder', err);
      this.dancer3d = null;
    }
  }

  fallBack() {
    this.dancer3d?.destroy();
    this.dancer3d = null;
    this.element.classList.remove('has-3d');
  }

  perform(move, judgment) {
    this.setState('dancing', move || 'Freestyle');
    this.dancer3d?.perform(move, judgment);
  }

  idle(label = 'MISS') {
    this.setState('idle', label);
    this.dancer3d?.stumble();
  }

  setState(state, label) {
    const has3d = this.element.classList.contains('has-3d');
    this.element.className = `dancer ${state}${has3d ? ' has-3d' : ''}`;
    this.element.querySelector('.dance-label').textContent = label;
  }

  destroy() {
    this.dancer3d?.destroy();
    this.dancer3d = null;
  }
}
