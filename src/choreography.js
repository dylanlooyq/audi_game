// Intentionally independent from chart directions: animation consumers only receive named moves.
export class ChoreographyController {
  constructor(moves, element) { this.moves=moves; this.element=element; this.index=0; }
  performNext() { const move=this.moves[this.index++] || 'Freestyle'; this.element.className='dancer dancing'; this.element.querySelector('.dance-label').textContent=move; }
  idle() { this.element.className='dancer idle'; this.element.querySelector('.dance-label').textContent='IDLE'; }
}
