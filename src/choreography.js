export class ChoreographyController {
  constructor(element) { this.element = element; }
  perform(move) {
    this.element.className = 'dancer dancing';
    this.element.querySelector('.dance-label').textContent = move || 'Freestyle';
  }
  idle(label = 'MISS') {
    this.element.className = 'dancer idle';
    this.element.querySelector('.dance-label').textContent = label;
  }
}
