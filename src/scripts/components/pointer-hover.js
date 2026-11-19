// Adds .pointer-over to links while a mouse or pen is over them (not touch).
// CSS pairs it with :hover so hover styles don't stick after a tap on touch
// screens, and are cleared reliably when the window loses focus.

export function initPointerHover() {
  for (const link of document.querySelectorAll('a')) {
    const clear = () => link.classList.remove('pointer-over');
    link.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') link.classList.add('pointer-over');
    });
    link.addEventListener('pointerleave', clear);
    link.addEventListener('pointercancel', clear);
    window.addEventListener('blur', clear);
  }
}
