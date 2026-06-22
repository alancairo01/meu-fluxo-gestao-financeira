import { byId } from '../core/dom.js';

export class ToastUI {
  constructor() {
    this.timer = null;
  }

  show(message) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => toast.classList.remove('show'), 3000);
  }
}
