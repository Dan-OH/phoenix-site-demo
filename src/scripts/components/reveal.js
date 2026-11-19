// Reveal on scroll: elements with [data-reveal] that start below the fold are
// hidden (.pending) and fade up into place the first time they scroll into view.
// The animation itself is CSS (see [data-reveal] in site.scss).

import { reducedMotion } from '../lib/media-queries.js';

export function initReveal() {
  const reveals = [...document.querySelectorAll('[data-reveal]')];
  if (!reveals.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('pending');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -48px 0px', threshold: 0 },
  );

  if (!reducedMotion.matches) {
    for (const element of reveals) {
      // Anything already on screen stays visible, so nothing flashes on load.
      if (element.getBoundingClientRect().top >= innerHeight) {
        element.classList.add('pending');
        observer.observe(element);
      }
    }
  }

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    observer.disconnect();
    reveals.forEach((element) => element.classList.remove('pending'));
  });
}
