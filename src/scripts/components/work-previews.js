// Animated GIF previews on work images.
//
// <img class="work-preview" src="poster.png" data-motion="clip.gif" data-work>
//   Plays the GIF while its .work-card (or .media) is hovered or focused.
// Add data-autoplay to play it whenever it's on screen instead.
//
// <img data-loop-poster="still.jpg" data-loop-motion="loop.gif">
//   Photos that loop a GIF while on screen (About page).

import { reducedMotion } from '../lib/media-queries.js';

function onVisibility(element, callback) {
  new IntersectionObserver(([entry]) => callback(entry.isIntersecting)).observe(element);
}

function setupHoverPreview(preview) {
  const card = preview.closest('.work-card') || preview.closest('.media');
  const poster = preview.getAttribute('src');
  const motion = preview.dataset.motion;
  new Image().src = motion; // preload, so playback starts immediately
  let playing = false;

  function stop() {
    playing = false;
    preview.src = poster;
  }

  function play(event) {
    if (reducedMotion.matches || event?.pointerType === 'touch' || playing) return;
    playing = true;
    preview.src = motion;
  }

  if (preview.hasAttribute('data-autoplay')) {
    let inView = false;
    const sync = () => {
      if (inView && !document.hidden && !reducedMotion.matches) play();
      else stop();
    };
    onVisibility(preview, (visible) => {
      inView = visible;
      sync();
    });
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', sync);
    return;
  }

  card.addEventListener('pointerenter', play);
  card.addEventListener('pointermove', play);
  card.addEventListener('pointerleave', stop);
  card.addEventListener('pointercancel', stop);
  card.addEventListener('focus', play);
  card.addEventListener('blur', stop);
  reducedMotion.addEventListener('change', stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
}

function setupLoopPhoto(photo) {
  let inView = false;
  const update = () => {
    const play = inView && !document.hidden && !reducedMotion.matches;
    const desired = play ? photo.dataset.loopMotion : photo.dataset.loopPoster;
    if (photo.getAttribute('src') !== desired) photo.src = desired;
  };
  onVisibility(photo, (visible) => {
    inView = visible;
    update();
  });
  reducedMotion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
}

export function initWorkPreviews() {
  document.querySelectorAll('[data-work]').forEach(setupHoverPreview);
  document.querySelectorAll('[data-loop-motion]').forEach(setupLoopPhoto);
}
