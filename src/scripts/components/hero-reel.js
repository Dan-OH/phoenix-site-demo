// Home hero reel: plays three sprite sheets (6 × 5 frames each) at 10fps
// while the hero is on screen. The still poster shows until they've loaded,
// and stays if motion is reduced or a sheet fails to load.

import { reducedMotion } from '../lib/media-queries.js';

const CLIPS = [1, 2, 3].map((number) => `/assets/WhpClip${number}.png`);
const FRAMES_PER_CLIP = 30;
const COLUMNS = 6;
const FRAME_MS = 100;

function showFrame(element, index) {
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  element.style.backgroundPosition = `${column * 20}% ${row * 25}%`;
}

export function initHeroReel() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  let timer = 0;
  let visible = false;
  let frame = 0;
  let ready = false;
  let loading = false;

  function update() {
    clearInterval(timer);
    timer = 0;
    if (!ready || reducedMotion.matches) {
      hero.style.removeProperty('--sheet');
      return;
    }
    if (!visible || document.hidden) return;
    const draw = () => {
      hero.style.setProperty('--sheet', `url("${CLIPS[Math.floor(frame / FRAMES_PER_CLIP)]}")`);
      showFrame(hero, frame % FRAMES_PER_CLIP);
      frame = (frame + 1) % (FRAMES_PER_CLIP * CLIPS.length);
    };
    draw();
    timer = setInterval(draw, FRAME_MS);
  }

  async function load() {
    if (loading || reducedMotion.matches) return;
    loading = true;
    const images = CLIPS.map((src) => Object.assign(new Image(), { src }));
    try {
      await Promise.all(images.map((image) => image.decode()));
      ready = true;
      update();
    } catch {
      // The still poster remains visible.
    }
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(hero);
  reducedMotion.addEventListener('change', () => {
    load();
    update();
  });
  document.addEventListener('visibilitychange', update);
  load();
}
