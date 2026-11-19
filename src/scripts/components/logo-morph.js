// Header logo: moving the pointer over the flame sends a ripple through it.
// The flame layer (/assets/logo-flame.png) is drawn into a canvas, and pixels
// near the pointer are displaced by a decaying wave for 640ms.

import { hoverPointer, reducedMotion } from '../lib/media-queries.js';

const FLAME_SRC = '/assets/logo-flame.png';
const RADIUS = 62; // canvas pixels affected around the pointer
const DURATION = 640; // ms for a ripple to die out

async function setupLogoMorph(logo) {
  const canvas = logo.querySelector('canvas');
  const wordmark = logo.querySelector('.logo-motion img');
  const context = canvas?.getContext('2d', { willReadFrequently: true });
  if (!context || !wordmark) return;

  const image = new Image();
  image.src = FLAME_SRC;
  try {
    await Promise.all([image.decode(), wordmark.decode()]);
  } catch {
    return;
  }

  const { width, height } = canvas;
  context.drawImage(image, 0, 0);
  const source = context.getImageData(0, 0, width, height).data;
  const output = context.createImageData(width, height);
  const target = new Uint32Array(output.data.buffer);
  const pixels = new Uint32Array(source.buffer);
  let impulse = null;
  let animation = 0;
  let previous = null;

  function reset() {
    cancelAnimationFrame(animation);
    animation = 0;
    impulse = null;
    previous = null;
    logo.classList.remove('morphing');
  }

  function draw(time) {
    const age = Math.max(0, time - impulse.time);
    if (age >= DURATION) {
      reset();
      return;
    }
    const strength = impulse.strength * (1 - age / DURATION) ** 2;
    target.set(pixels);
    const top = Math.max(0, Math.floor(impulse.y - RADIUS));
    const bottom = Math.min(height, impulse.y + RADIUS);
    const left = Math.max(0, Math.floor(impulse.x - RADIUS));
    const right = Math.min(width, impulse.x + RADIUS);
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const distance = Math.hypot(x - impulse.x, y - impulse.y);
        if (distance >= RADIUS) continue;
        const falloff = (1 - distance / RADIUS) ** 2;
        const wave = Math.sin(distance * 0.14 - age * 0.019 + 1.1) * strength * falloff;
        const sx = Math.round(x - impulse.dx * strength * falloff * 0.45 + wave * 0.42);
        const sy = Math.round(y - impulse.dy * strength * falloff * 0.45 + wave);
        target[y * width + x] =
          sx >= 0 && sx < width && sy >= 0 && sy < height ? pixels[sy * width + sx] : 0;
      }
    }
    context.putImageData(output, 0, 0);
    logo.classList.add('morphing');
    animation = requestAnimationFrame(draw);
  }

  // Only react when the pointer is actually over the flame, not empty space.
  function isNearFlame(x, y) {
    for (let sy = Math.max(0, y - 8); sy <= Math.min(height - 1, y + 8); sy += 2) {
      for (let sx = Math.max(0, x - 8); sx <= Math.min(width - 1, x + 8); sx += 2) {
        if (source[(sy * width + sx) * 4 + 3] > 48) return true;
      }
    }
    return false;
  }

  function move(event) {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.round(((event.clientX - bounds.left) * width) / bounds.width);
    const y = Math.round(((event.clientY - bounds.top) * height) / bounds.height);
    const dx = previous ? x - previous.x : 0;
    const dy = previous ? y - previous.y : 0;
    previous = { x, y };
    if (x < 0 || x >= width || y < 0 || y >= height || !isNearFlame(x, y)) return;
    const motion = Math.hypot(dx, dy);
    impulse = {
      x,
      y,
      dx: motion ? dx / motion : 0,
      dy: motion ? dy / motion : 0,
      strength: Math.min(19, 10 + motion * 0.55),
      time: performance.now(),
    };
    if (!animation) animation = requestAnimationFrame(draw);
  }

  logo.addEventListener('pointerenter', move);
  logo.addEventListener('pointermove', move);
  logo.addEventListener('pointerleave', () => {
    previous = null;
  });
  logo.addEventListener('pointercancel', reset);
  reducedMotion.addEventListener('change', reset);
  hoverPointer.addEventListener('change', reset);
}

export function initLogoMorph() {
  const logo = document.querySelector('.site-header .logo');
  if (logo) setupLogoMorph(logo);
}
