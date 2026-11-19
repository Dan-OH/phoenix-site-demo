// Logo ticker (.client-track): an endless strip that scrolls on its own,
// slows down on hover or keyboard focus, can be dragged, and steps with the
// arrow keys. It pauses while off screen, on hidden tabs and for reduced motion.

import { reducedMotion } from '../lib/media-queries.js';

const SECONDS_PER_LOOP = 32;
const HOVER_SPEED = 0.24; // fraction of normal speed while hovered or focused
const SPEED_EASE_MS = 180;

function setupClientTicker(track) {
  const originals = track.firstElementChild;
  const duplicate = originals.cloneNode(true);
  duplicate.setAttribute('aria-hidden', 'true');
  track.append(duplicate);

  let phase = 0; // 0–1 through one full loop
  let rowWidth = 0;
  let frame = 0;
  let lastTime = null;
  let visible = false;
  let hovered = false;
  let rate = 1;
  let drag = null;

  function render() {
    const translation = `translateX(${-phase * rowWidth}px)`;
    originals.style.transform = translation;
    duplicate.style.transform = translation;
  }

  function shift(pixels) {
    if (!rowWidth) return;
    phase = (((phase + pixels / rowWidth) % 1) + 1) % 1;
    render();
  }

  function tick(time) {
    const elapsed = lastTime === null ? 0 : Math.min(50, time - lastTime);
    lastTime = time;
    const targetRate = hovered || track.matches(':focus-visible') ? HOVER_SPEED : 1;
    rate += (targetRate - rate) * (1 - Math.exp(-elapsed / SPEED_EASE_MS));
    shift((rowWidth * rate * elapsed) / (SECONDS_PER_LOOP * 1000));
    frame = requestAnimationFrame(tick);
  }

  function syncPlayback() {
    const shouldPlay = visible && !drag && !reducedMotion.matches && !document.hidden;
    if (shouldPlay && !frame) frame = requestAnimationFrame(tick);
    if (!shouldPlay && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = null;
    }
  }

  function resize() {
    rowWidth = originals.getBoundingClientRect().width;
    render();
  }

  function finishDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    track.classList.remove('dragging');
    syncPlayback();
  }

  track.addEventListener('pointerenter', (event) => {
    hovered = event.pointerType === 'mouse';
  });
  track.addEventListener('pointerleave', () => {
    hovered = false;
  });
  track.addEventListener('pointerdown', (event) => {
    if (drag || !event.isPrimary || event.button !== 0) return;
    track.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX };
    track.classList.add('dragging');
    syncPlayback();
  });
  track.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    shift(drag.x - event.clientX);
    drag.x = event.clientX;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    track.addEventListener(type, finishDrag);
  }
  track.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    shift((direction * rowWidth) / originals.childElementCount);
  });

  resize();
  new ResizeObserver(resize).observe(track);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncPlayback();
  }).observe(track);
  reducedMotion.addEventListener('change', syncPlayback);
  document.addEventListener('visibilitychange', syncPlayback);
}

export function initClientTicker() {
  document.querySelectorAll('.client-track').forEach(setupClientTicker);
}
