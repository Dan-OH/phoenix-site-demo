// Services list number highlight: one lime pill marks the hovered or focused
// row's number. Moving to another row, its front end slides to the new number
// while the back end holds on to the old one, then the back end follows, so
// the circle stretches into an even-width capsule and draws back into a circle.
//
// A move always finishes before the next starts. Rows passed over in the
// meantime are skipped: the pill then goes straight to the latest one.
//
// The pill is a single round-capped stroke in an SVG layered under the numbers.
// Rows under it get .blob-covered to flip the number's colour.

import { reducedMotion } from '../lib/media-queries.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 18; // the 30px number plus 3px each side

// Timings in ms.
const HEAD_DURATION = 300; // front end to the new number
const TAIL_DELAY = 140; // back end holds on this long before following
const TAIL_DURATION = 300;
const SIZE_DURATION = 220; // growing in and shrinking away

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;

// A move from `from` toward the current goal, over `duration` after `delay`.
function tween(from, duration, delay = 0, ease = easeInOut) {
  return { from, start: performance.now() + delay, duration, ease };
}

function progress({ start, duration, ease }, now) {
  return ease(Math.min(1, Math.max(0, (now - start) / duration)));
}

function setupServicesBlob(list) {
  const rows = [...list.querySelectorAll(':scope > li')];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('services-blob');
  svg.setAttribute('aria-hidden', 'true');
  const pill = document.createElementNS(SVG_NS, 'path');
  svg.append(pill);
  list.append(svg);

  const head = { x: 0, y: 0 };
  const tail = { x: 0, y: 0 };
  let size = 0;
  let target = null; // the row the pill is heading to
  let wanted = null; // the row it should end up on, once the current move is done
  let headMove = null;
  let tailMove = null;
  let sizeMove = null;
  let frame = 0;

  function centre(row) {
    const listBox = list.getBoundingClientRect();
    const box = row.querySelector('a > span:first-child').getBoundingClientRect();
    return {
      x: box.left + box.width / 2 - listBox.left,
      y: box.top + box.height / 2 - listBox.top,
    };
  }

  // Distance from a point to the pill's centre line.
  function distanceToPill(p) {
    const dx = head.x - tail.x;
    const dy = head.y - tail.y;
    const length = dx * dx + dy * dy;
    const t = length ? Math.min(1, Math.max(0, ((p.x - tail.x) * dx + (p.y - tail.y) * dy) / length)) : 0;
    return Math.hypot(p.x - (tail.x + dx * t), p.y - (tail.y + dy * t));
  }

  function draw() {
    const radius = RADIUS * size;
    // A hair of length keeps the round caps drawn when both ends meet.
    const f = (n) => n.toFixed(2);
    pill.setAttribute('d', `M${f(tail.x)} ${f(tail.y)}L${f(head.x)} ${f(head.y + 0.01)}`);
    pill.setAttribute('stroke-width', f(radius * 2));

    for (const row of rows) {
      const c = centre(row);
      row.classList.toggle('blob-covered', size > 0.5 && distanceToPill(c) < radius * 0.6);
    }
  }

  function tick(now) {
    const goal = target && centre(target);
    let moving = false;

    for (const [point, move] of [
      [head, headMove],
      [tail, tailMove],
    ]) {
      if (!move || !goal) continue;
      const t = progress(move, now);
      point.x = move.from.x + (goal.x - move.from.x) * t;
      point.y = move.from.y + (goal.y - move.from.y) * t;
      moving ||= t < 1;
    }
    if (sizeMove) {
      const t = progress(sizeMove, now);
      size = sizeMove.from + ((target ? 1 : 0) - sizeMove.from) * t;
      moving ||= t < 1;
    }

    draw();

    if (moving) {
      frame = requestAnimationFrame(tick);
    } else {
      frame = 0;
      if (!target) svg.classList.remove('visible');
      if (wanted !== target) start(wanted);
    }
  }

  function place(goal) {
    Object.assign(head, goal);
    Object.assign(tail, goal);
    headMove = tailMove = null;
  }

  function moveTo(row) {
    wanted = row;
    if (!frame) start(row); // otherwise tick() starts it when the current move ends
  }

  function start(row) {
    if (row === target) return;
    target = row;

    if (reducedMotion.matches) {
      cancelAnimationFrame(frame);
      frame = 0;
      if (row) place(centre(row));
      size = row ? 1 : 0;
      sizeMove = null;
      svg.classList.toggle('visible', Boolean(row));
      draw();
      return;
    }

    if (row) {
      if (size < 0.2) {
        // Appearing from nothing: grow in place on the new number.
        place(centre(row));
      } else {
        // Stretch from wherever the pill is now.
        headMove = tween({ ...head }, HEAD_DURATION);
        tailMove = tween({ ...tail }, TAIL_DURATION, TAIL_DELAY);
      }
      svg.classList.add('visible');
    }
    sizeMove = tween(size, SIZE_DURATION, 0, easeOut);
    if (!frame) frame = requestAnimationFrame(tick);
  }

  for (const row of rows) {
    row.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') moveTo(row);
    });
    row.addEventListener('focusin', () => moveTo(row));
  }
  list.addEventListener('pointerleave', () => {
    if (!list.contains(document.activeElement)) moveTo(null);
  });
  list.addEventListener('focusout', (event) => {
    if (!list.contains(event.relatedTarget) && !list.matches(':hover')) moveTo(null);
  });
  window.addEventListener('blur', () => {
    if (!list.contains(document.activeElement)) moveTo(null);
  });
  new ResizeObserver(() => {
    if (!target || frame) return;
    place(centre(target));
    draw();
  }).observe(list);
}

export function initServicesBlob() {
  for (const list of document.querySelectorAll('ol.services')) {
    setupServicesBlob(list);
  }
}
