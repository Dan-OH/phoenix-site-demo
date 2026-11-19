// Custom cursor over work cards (mouse only). One stable cursor layer avoids
// the native image cursor resetting while GIFs play underneath it.

import { finePointer } from '../lib/media-queries.js';

const CURSOR_OFFSET = 24; // half the cursor's size, so it's centred on the pointer

export function initWorkCursor() {
  const cards = document.querySelectorAll('a.work-card');
  if (!cards.length) return;
  cards.forEach((card) => {
    card.draggable = false;
  });

  const cursor = document.createElement('div');
  cursor.className = 'work-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.append(cursor);
  let frame = 0;
  let x = 0;
  let y = 0;

  function hide() {
    cursor.classList.remove('active');
    document.documentElement.classList.remove('work-cursor-active');
  }

  document.addEventListener(
    'pointermove',
    (event) => {
      if (!finePointer.matches || event.pointerType !== 'mouse' || !event.target.closest('a.work-card')) {
        hide();
        return;
      }
      x = event.clientX;
      y = event.clientY;
      cursor.style.transform = `translate3d(${x - CURSOR_OFFSET}px, ${y - CURSOR_OFFSET}px, 0)`;
      cursor.classList.add('active');
      document.documentElement.classList.add('work-cursor-active');
    },
    { passive: true },
  );
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) hide();
  });
  document.addEventListener('pointercancel', hide);
  document.addEventListener('visibilitychange', hide);
  window.addEventListener('blur', hide);
  finePointer.addEventListener('change', hide);
  // Scrolling can move a card out from under a still pointer.
  window.addEventListener(
    'scroll',
    () => {
      if (!cursor.classList.contains('active') || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!document.elementFromPoint(x, y)?.closest('a.work-card')) hide();
      });
    },
    { passive: true },
  );
}
