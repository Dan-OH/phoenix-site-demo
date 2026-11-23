// Header logo: hovering the logo sets the whole flame flickering. The flame
// layer (/assets/logo-flame.png) is drawn into a canvas and every pixel is
// displaced by a few drifting waves, evenly across the whole flame, so the
// strands sway like a flame. The flicker eases in on hover and settles back to
// the still logo when the pointer leaves.

import { hoverPointer, reducedMotion } from '../lib/media-queries.js';

const FLAME_SRC = '/assets/logo-flame.png';
const SWAY = 3; // canvas pixels the flame moves at most, side to side
const LICK = 3; // likewise, up and down
const EASE_IN = 260; // ms to reach full flicker
const EASE_OUT = 420; // ms to settle when the pointer leaves
// Transparent margin around the flame so it can sway without being cut off at
// the canvas edge. The canvas overhangs its box by this much, so the logo's
// layout doesn't change.
const PAD = Math.ceil(Math.max(SWAY, LICK)) + 1;

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

  const { width: baseWidth, height: baseHeight } = canvas;
  canvas.width = baseWidth + PAD * 2;
  canvas.height = baseHeight + PAD * 2;
  Object.assign(canvas.style, {
    inset: 'auto',
    left: `${(-PAD / baseWidth) * 100}%`,
    top: `${(-PAD / baseHeight) * 100}%`,
    width: `${(canvas.width / baseWidth) * 100}%`,
    height: `${(canvas.height / baseHeight) * 100}%`,
  });
  const { width, height } = canvas;
  context.drawImage(image, PAD, PAD);
  const source = context.getImageData(0, 0, width, height).data;
  const output = context.createImageData(width, height);
  const target = output.data;

  // Blend the four pixels around (fx, fy), weighting colour by alpha so the
  // transparent surroundings don't darken the edges. Keeps thin strands
  // smooth instead of stepping a whole pixel at a time.
  function sample(fx, fy, out) {
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const ax = fx - x0;
    const ay = fy - y0;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let j = 0; j < 4; j++) {
      const x = x0 + (j & 1);
      const y = y0 + (j >> 1);
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const k = (y * width + x) * 4;
      const share =
        (j & 1 ? ax : 1 - ax) * (j >> 1 ? ay : 1 - ay) * source[k + 3];
      r += source[k] * share;
      g += source[k + 1] * share;
      b += source[k + 2] * share;
      a += share;
    }
    if (a > 0) {
      target[out] = r / a;
      target[out + 1] = g / a;
      target[out + 2] = b / a;
    }
    target[out + 3] = a;
  }

  let animation = 0;
  let hovering = false;
  let level = 0; // 0 = still, 1 = full flicker
  let last = 0;

  function stop() {
    cancelAnimationFrame(animation);
    animation = 0;
    level = 0;
    logo.classList.remove('morphing');
  }

  function draw(time) {
    const step = last ? time - last : 16;
    last = time;
    level = hovering
      ? Math.min(1, level + step / EASE_IN)
      : Math.max(0, level - step / EASE_OUT);
    if (!hovering && level === 0) {
      stop();
      return;
    }
    const strength = level * level * (3 - 2 * level); // smoothstep
    const t = time / 1000;

    // Sideways sway depends on the row and up-down licks on the column, so
    // waves travel along the strands. Two frequencies keep it from looking
    // regular.
    const sway = new Float32Array(height);
    for (let y = 0; y < height; y++) {
      sway[y] =
        SWAY *
        strength *
        (0.65 * Math.sin(y * 0.075 - t * 5.2) +
          0.35 * Math.sin(y * 0.11 - t * 7.3 + 1.7));
    }
    const lick = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      lick[x] =
        LICK *
        strength *
        (0.6 * Math.sin(x * 0.06 + t * 4.4) +
          0.4 * Math.sin(x * 0.095 + t * 6.3 + 0.6));
    }

    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i++) {
        sample(x - sway[y], y - lick[x], i * 4);
      }
    }
    context.putImageData(output, 0, 0);
    logo.classList.add('morphing');
    animation = requestAnimationFrame(draw);
  }

  logo.addEventListener('pointerenter', (event) => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    hovering = true;
    if (!animation) {
      last = 0;
      animation = requestAnimationFrame(draw);
    }
  });
  logo.addEventListener('pointerleave', () => {
    hovering = false;
  });
  logo.addEventListener('pointercancel', () => {
    hovering = false;
  });
  const reset = () => {
    hovering = false;
    stop();
  };
  reducedMotion.addEventListener('change', reset);
  hoverPointer.addEventListener('change', reset);
}

export function initLogoMorph() {
  const logo = document.querySelector('.site-header .logo');
  if (logo) setupLogoMorph(logo);
}
