// Services list number highlight: one lime circle marks the hovered or focused
// row's number. Moving to another row, a second circle slides out to the new
// number while the first holds on to the old one. Then the old circle shrinks
// toward the band's width and, partway through, sets off after it. The two are
// joined by a narrower, even-width band that meets each circle in a rounded
// corner, so the shape stays smooth and geometric throughout.
//
// A move always finishes before the next starts. Rows passed over in the
// meantime are skipped: the pill then goes straight to the latest one.
//
// The shape is one SVG path layered under the numbers. Rows under it get
// .blob-covered to flip the number's colour.

import { reducedMotion } from '../lib/media-queries.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 18; // the 30px number plus 3px each side
const BAND = 0.6; // half the band's width, as a share of the radius
const FILLET = 1.2; // radius of the rounded corners where band meets circle, likewise

// Timings in ms.
const HEAD_DURATION = 400; // front end to the new number
// The old circle holds, then shrinks, then travels.
const TAIL_DELAY = 200; // holds at full size
const TAIL_SHRINK = 280; // narrows to the band's width
const TAIL_LEAVE = 0.5; // share of the shrink done before it sets off
const TAIL_DURATION = 400; // travels to the new number
const SIZE_DURATION = 260; // growing in and shrinking away

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;

// A move from `from` toward the current goal, over `duration` after `delay`.
function tween(from, duration, delay = 0, ease = easeInOut) {
  return { from, start: performance.now() + delay, duration, ease };
}

function progress({ start, duration, ease }, now) {
  return ease(Math.min(1, Math.max(0, (now - start) / duration)));
}

// The outline of a tail circle of radius rt at (0, 0) and a head circle of
// radius rh at (d, 0), joined by a band of half-width w with fillets of radius
// f where it meets each circle. Each fillet touches its circle and the band
// edge; a circle no wider than the band just rounds off the band's end. When
// the ends are too close for a straight stretch of band, the fillets from both
// ends meet in the middle and the neck widens, until the tail is swallowed by
// the head and only the head circle is left.
function shapePath(d, rt, rh, w, f) {
  const n = (value) => value.toFixed(2);
  if (rh < 0.01) return '';
  if (d + rt <= rh + 0.01) {
    return `M${n(d - rh)} 0A${n(rh)} ${n(rh)} 0 1 0 ${n(d + rh)} 0A${n(rh)} ${n(rh)} 0 1 0 ${n(d - rh)} 0Z`;
  }
  // Fillet centres sit at (at, y) from the tail and (d - ah, y) from the head.
  const reachT = rt + f; // circle centre to fillet centre
  const reachH = rh + f;
  const straightT = Math.sqrt(Math.max(0, reachT ** 2 - (w + f) ** 2));
  const straightH = Math.sqrt(Math.max(0, reachH ** 2 - (w + f) ** 2));
  let at = straightT;
  let ah = straightH;
  let y = w + f;
  const meet = at + ah > d;
  if (meet) {
    // One fillet circle touching both circles, with no band between.
    at = (d * d + reachT ** 2 - reachH ** 2) / (2 * d);
    ah = d - at;
    y = Math.sqrt(Math.max(0, reachT ** 2 - at ** 2));
  }
  const neck = y - f;
  const kt = rt / reachT; // where the fillet touches the circle, along that line
  const kh = rh / reachH;
  const RT = n(rt);
  const RH = n(rh);
  const F = n(f);
  // Fillet from the tail circle to the head circle on one side (s = 1 or -1):
  // via the band, or as one arc when the fillets meet.
  const bridge = (s) =>
    meet
      ? `A${F} ${F} 0 0 1 ${n(d - ah * kh)} ${n(s * y * kh)}`
      : `A${F} ${F} 0 0 1 ${n(at)} ${n(s * neck)}` +
        `L${n(d - ah)} ${n(s * neck)}` +
        `A${F} ${F} 0 0 1 ${n(d - ah * kh)} ${n(s * y * kh)}`;
  const back = (s) =>
    meet
      ? `A${F} ${F} 0 0 1 ${n(at * kt)} ${n(s * y * kt)}`
      : `A${F} ${F} 0 0 1 ${n(d - ah)} ${n(s * neck)}` +
        `L${n(at)} ${n(s * neck)}` +
        `A${F} ${F} 0 0 1 ${n(at * kt)} ${n(s * y * kt)}`;
  return [
    `M${n(-rt)} 0`,
    `A${RT} ${RT} 0 0 0 ${n(at * kt)} ${n(y * kt)}`, // tail circle, back to top
    bridge(1), // over to the head
    `A${RH} ${RH} 0 ${ah > 0 ? 1 : 0} 0 ${n(d - ah * kh)} ${n(-y * kh)}`, // head, round the front
    back(-1), // back to the tail
    `A${RT} ${RT} 0 0 0 ${n(-rt)} 0Z`, // tail circle, round the back
  ].join('');
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
  let tailShrink = 0; // 0 = full circle, 1 = as narrow as the band
  let target = null; // the row the pill is heading to
  let wanted = null; // the row it should end up on, once the current move is done
  let headMove = null;
  let tailMove = null;
  let sizeMove = null;
  let frame = 0;

  function centre(row) {
    const listBox = list.getBoundingClientRect();
    const box = row
      .querySelector('a > span:first-child')
      .getBoundingClientRect();
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
    const t = length
      ? Math.min(
          1,
          Math.max(0, ((p.x - tail.x) * dx + (p.y - tail.y) * dy) / length),
        )
      : 0;
    return Math.hypot(p.x - (tail.x + dx * t), p.y - (tail.y + dy * t));
  }

  function draw() {
    const radius = RADIUS * size;
    const dx = head.x - tail.x;
    const dy = head.y - tail.y;
    // Drawn along the x-axis from the tail, then turned to point at the head.
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const band = radius * BAND;
    const tailRadius = radius + (band - radius) * tailShrink;
    pill.setAttribute(
      'd',
      shapePath(Math.hypot(dx, dy), tailRadius, radius, band, radius * FILLET),
    );
    pill.setAttribute(
      'transform',
      `translate(${tail.x.toFixed(2)} ${tail.y.toFixed(2)}) rotate(${angle.toFixed(2)})`,
    );

    for (const row of rows) {
      const c = centre(row);
      row.classList.toggle(
        'blob-covered',
        size > 0.5 && distanceToPill(c) < radius * 0.6,
      );
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
    // The tail narrows as it leaves; once it has caught up it's a full circle again.
    const tailDone = !tailMove || progress(tailMove, now) >= 1;
    tailShrink = tailDone
      ? 0
      : progress(
          {
            ...tailMove,
            start: tailMove.start - TAIL_SHRINK * TAIL_LEAVE,
            duration: TAIL_SHRINK,
          },
          now,
        );
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
        tailMove = tween(
          { ...tail },
          TAIL_DURATION,
          TAIL_DELAY + TAIL_SHRINK * TAIL_LEAVE,
        );
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
    if (!list.contains(event.relatedTarget) && !list.matches(':hover'))
      moveTo(null);
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
