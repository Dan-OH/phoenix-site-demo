// Mobile menu (below 700px): the toggle opens the nav full screen, growing
// from the button. Escape closes it, and Tab cycles between the toggle and the
// links while it's open. Outside the mobile layout the nav is always shown.

import { mobileLayout, reducedMotion } from '../lib/media-queries.js';

const CLOSE_ANIMATION_MS = 600;

export function initMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-navigation');
  if (!toggle || !nav) return;

  let closeTimer = 0;
  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  function open() {
    clearTimeout(closeTimer);
    const bounds = toggle.getBoundingClientRect();
    nav.style.setProperty('--menu-x', `${bounds.left + bounds.width / 2}px`);
    nav.style.setProperty('--menu-y', `${bounds.top + bounds.height / 2}px`);
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    nav.inert = false;
    nav.classList.add('open');
    document.body.classList.add('menu-open', 'menu-visible');
    nav.querySelector('a').focus({ preventScroll: true });
  }

  function close(immediate = false) {
    clearTimeout(closeTimer);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    nav.classList.remove('open');
    nav.inert = mobileLayout.matches;
    const finish = () => document.body.classList.remove('menu-open', 'menu-visible');
    if (immediate || reducedMotion.matches) finish();
    else closeTimer = setTimeout(finish, CLOSE_ANIMATION_MS);
  }

  nav.inert = mobileLayout.matches;

  toggle.addEventListener('click', () => {
    if (isOpen()) {
      close();
      toggle.focus();
    } else {
      open();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      close();
      toggle.focus();
      return;
    }
    if (event.key !== 'Tab') return;
    // Keep focus inside the open menu: toggle → links → toggle.
    const links = [...nav.querySelectorAll('a')];
    const first = links[0];
    const last = links.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      toggle.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      toggle.focus();
    } else if (document.activeElement === toggle) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });
  mobileLayout.addEventListener('change', () => close(true));
}
