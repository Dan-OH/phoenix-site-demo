// Ink fill for .button.
//
// Fill: when the pointer enters, ink blooms from that point. A dark green
// centre spreads and grows with it, slowly settling into lime until the whole
// button is lime. A fill always plays to the end, even if the pointer leaves.
//
// Drain: once the button is full and the pointer has gone, the lime shrinks
// away toward the point where the pointer left.
//
// Keyboard focus fills and drains from the centre.

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const SETTINGS = {
  fill: 1100,     // ms for the whole fill, including the dark green turning lime
  spread: .45,    // share of the fill spent spreading; the rest is the colour settling
  darkCore: .7,   // how far the dark green reaches, as a share of the ink's radius
  drain: 450,     // ms for the lime to shrink away
};

const DARK = 'var(--teal)';
const LIGHT = 'var(--lime)';

const easeOut = t => 1 - (1 - t) ** 3;
const easeInOut = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

function setupButtonInk(button) {
  const fill = document.createElement('span');
  fill.className = 'button-fill';
  fill.setAttribute('aria-hidden', 'true');
  button.prepend(fill);

  // 'empty' → 'filling' → 'full' → 'draining' → 'empty'
  let state = 'empty';
  let progress = 0;         // position within the current fill or drain, 0–1
  let origin = { x: 0, y: 0 };
  let enterPoint = { x: 0, y: 0 };
  let exitPoint = { x: 0, y: 0 };
  let hovered = false;
  let focused = false;
  let frame = 0;
  let lastTime = 0;

  const wanted = () => hovered || focused;

  function pointFrom(event) {
    const box = button.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(box.width, event.clientX - box.left)),
      y: Math.max(0, Math.min(box.height, event.clientY - box.top)),
    };
  }

  function centre() {
    return { x: button.offsetWidth / 2, y: button.offsetHeight / 2 };
  }

  // Radius that reaches the farthest corner from the origin.
  function reach() {
    const width = button.offsetWidth;
    const height = button.offsetHeight;
    return Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y)) + 2;
  }

  function circle(radius, stops) {
    return `radial-gradient(circle at ${origin.x}px ${origin.y}px, ${stops}, `
      + `${LIGHT} ${Math.max(0, radius - 1).toFixed(1)}px, transparent ${radius.toFixed(1)}px)`;
  }

  function paint() {
    if (state === 'empty') {
      fill.style.removeProperty('background-image');
    } else if (state === 'full') {
      fill.style.backgroundImage = `linear-gradient(${LIGHT}, ${LIGHT})`;
    } else if (state === 'filling') {
      // The ink spreads over the first part of the fill, while the dark green
      // grows with it and settles into lime over the whole fill.
      const radius = reach() * easeOut(Math.min(1, progress / SETTINGS.spread));
      const darkness = Math.round((1 - easeInOut(progress)) * 100);
      const centreColour = `color-mix(in oklab, ${DARK} ${darkness}%, ${LIGHT})`;
      fill.style.backgroundImage = circle(radius, `${centreColour} 0px, ${LIGHT} ${(radius * SETTINGS.darkCore).toFixed(1)}px`);
    } else {
      // Draining: plain lime shrinking toward the exit point.
      const radius = reach() * easeInOut(progress);
      fill.style.backgroundImage = circle(radius, `${LIGHT} 0px`);
    }
  }

  // Decide what to do next once a fill or drain has settled.
  function settle() {
    if (state === 'full' && !wanted()) {
      state = 'draining';
      progress = 1;
      origin = exitPoint;
    } else if (state === 'empty' && wanted()) {
      state = 'filling';
      progress = 0;
      origin = enterPoint;
    }
  }

  function tick(time) {
    const elapsed = lastTime ? time - lastTime : 16;
    lastTime = time;

    if (state === 'filling') {
      progress = Math.min(1, progress + elapsed / SETTINGS.fill);
      if (progress === 1) state = 'full';
    } else if (state === 'draining') {
      // Coming back mid-drain grows the lime back out; otherwise keep shrinking.
      const direction = wanted() ? 1 : -1;
      progress = Math.max(0, Math.min(1, progress + direction * elapsed / SETTINGS.drain));
      if (progress === 0) state = 'empty';
      if (progress === 1) state = 'full';
    }
    settle();
    paint();

    if (state === 'filling' || state === 'draining') {
      frame = requestAnimationFrame(tick);
    } else {
      frame = lastTime = 0;
    }
  }

  function update() {
    if (reducedMotion.matches) {
      state = wanted() ? 'full' : 'empty';
      paint();
      return;
    }
    settle();
    if (!frame && (state === 'filling' || state === 'draining')) frame = requestAnimationFrame(tick);
  }

  button.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    enterPoint = pointFrom(event);
    update();
  });
  button.addEventListener('pointerleave', event => {
    if (!hovered) return;
    hovered = false;
    exitPoint = pointFrom(event);
    update();
  });
  button.addEventListener('focus', () => {
    if (!button.matches(':focus-visible')) return;
    focused = true;
    enterPoint = centre();
    update();
  });
  button.addEventListener('blur', () => {
    if (!focused) return;
    focused = false;
    exitPoint = centre();
    update();
  });
  // Coming back via the browser's back button: start empty.
  window.addEventListener('pageshow', () => {
    hovered = focused = false;
    cancelAnimationFrame(frame);
    frame = lastTime = 0;
    state = 'empty';
    progress = 0;
    paint();
  });
}

for (const button of document.querySelectorAll('.button')) {
  setupButtonInk(button);
}
