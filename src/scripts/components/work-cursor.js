// Cursor icon over work cards (mouse only). It follows the pointer, sitting
// below and to the right of the native cursor, which stays visible. One stable
// layer avoids the icon resetting while GIFs play underneath it.

import { finePointer } from '../lib/media-queries.js';

const CURSOR_OFFSET = 10; // px down and right of the pointer, clear of the native cursor

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
  }

  document.addEventListener(
    'pointermove',
    (event) => {
      if (
        !finePointer.matches ||
        event.pointerType !== 'mouse' ||
        !event.target.closest('a.work-card')
      ) {
        hide();
        return;
      }
      x = event.clientX;
      y = event.clientY;
      cursor.style.transform = `translate3d(${x + CURSOR_OFFSET}px, ${y + CURSOR_OFFSET}px, 0)`;
      cursor.classList.add('active');
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
