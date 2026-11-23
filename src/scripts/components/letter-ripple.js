// Letter ripple: letters near the pointer lift, tilt and stretch like a wave
// passing through, then spring back. Used on the footer's "Let's talk." and
// the 404 headline.
//
// The element's text is split into letter spans (hidden from screen readers),
// and the element gets an aria-label with the original text.

import { reducedMotion } from '../lib/media-queries.js';

// Sizes in px, scaled with the headline's font size.
const SIZES = {
  reach: (fontSize) => fontSize * 1.1,
  lift: (fontSize) => fontSize * 0.13,
  stretch: (fontSize) => fontSize * 1.6,
};

const SPRING = 0.12; // pull toward the target position
const DAMPING = 0.72; // velocity kept each frame
const TILT = 7; // degrees at the edge of the ripple
const TILT_EASE = 0.18;
const REST = 0.04; // below this, a letter counts as settled

function splitLetters(element) {
  const text = element.textContent.trim().replace(/\s+/g, ' ');
  if (!element.hasAttribute('aria-label')) element.setAttribute('aria-label', text);
  const wrapper = document.createElement('span');
  wrapper.className = 'ripple-text';
  wrapper.setAttribute('aria-hidden', 'true');
  for (const character of text) {
    if (character === ' ') {
      wrapper.append(' ');
      continue;
    }
    const letter = document.createElement('span');
    letter.className = 'ripple-letter';
    letter.textContent = character;
    wrapper.append(letter);
  }
  element.replaceChildren(wrapper);
  return [...wrapper.querySelectorAll('.ripple-letter')];
}

function setupLetterRipple(element, { reach, lift, stretch }) {
  const letters = splitLetters(element).map((letter) => ({ letter, y: 0, velocity: 0, rotation: 0 }));
  let pointer = null;
  let frame = 0;
  let lastTime = 0;
  let size = { reach: 1, lift: 0, stretch: 1 };

  function measure() {
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    size = { reach: reach(fontSize), lift: lift(fontSize), stretch: stretch(fontSize) };
  }

  function reset() {
    cancelAnimationFrame(frame);
    frame = lastTime = 0;
    pointer = null;
    for (const state of letters) {
      state.y = state.velocity = state.rotation = 0;
      state.letter.style.removeProperty('transform');
    }
  }

  function draw(time) {
    const step = lastTime ? Math.min(2, (time - lastTime) / 16.67) : 1;
    lastTime = time;
    let moving = false;
    for (const state of letters) {
      const box = state.letter.getBoundingClientRect();
      // -1…1 across the ripple, 0 directly under the pointer.
      const distance = pointer ? (box.left + box.width / 2 - pointer.x) / size.reach : 5;
      const influence = Math.max(0, 1 - Math.abs(distance));
      const target = pointer ? -influence * size.lift : 0;
      state.velocity += (target - state.y) * SPRING * step;
      state.velocity *= DAMPING ** step;
      state.y += state.velocity * step;
      state.rotation += ((pointer ? distance * influence * TILT : 0) - state.rotation) * TILT_EASE * step;
      state.letter.style.transform =
        `translateY(${state.y.toFixed(2)}px) rotate(${state.rotation.toFixed(2)}deg) ` +
        `scaleY(${(1 - state.y / size.stretch).toFixed(3)})`;
      moving ||=
        Math.abs(state.y - target) > REST || Math.abs(state.velocity) > REST || Math.abs(state.rotation) > REST;
    }
    if (pointer || moving) frame = requestAnimationFrame(draw);
    else reset();
  }

  const release = () => {
    pointer = null;
  };

  element.addEventListener('pointermove', (event) => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    pointer = { x: event.clientX };
    if (!frame) {
      measure();
      frame = requestAnimationFrame(draw);
    }
  });
  element.addEventListener('pointerleave', release);
  element.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) reset();
  });
}

export function initLetterRipple() {
  for (const headline of document.querySelectorAll('.footer-cta h2, [data-error-ripple]')) {
    setupLetterRipple(headline, SIZES);
  }
}
