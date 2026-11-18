const menuToggle = document.querySelector('.menu-toggle');
const siteNavigation = document.getElementById('site-navigation');
const mobileMenuQuery = matchMedia('(max-width: 700px)');
const menuMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let menuCloseTimer;
function closeMenu(immediate = false) {
  clearTimeout(menuCloseTimer);
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open menu');
  siteNavigation.classList.remove('open');
  siteNavigation.inert = mobileMenuQuery.matches;
  const finish = () => document.body.classList.remove('menu-open', 'menu-visible');
  if (immediate || menuMotionPreference.matches) finish();
  else menuCloseTimer = setTimeout(finish, 600);
}
siteNavigation.inert = mobileMenuQuery.matches;
menuToggle.addEventListener('click', () => {
  if (menuToggle.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuToggle.focus();
    return;
  }
  clearTimeout(menuCloseTimer);
  const bounds = menuToggle.getBoundingClientRect();
  siteNavigation.style.setProperty('--menu-x', `${bounds.left + bounds.width / 2}px`);
  siteNavigation.style.setProperty('--menu-y', `${bounds.top + bounds.height / 2}px`);
  menuToggle.setAttribute('aria-expanded', 'true');
  menuToggle.setAttribute('aria-label', 'Close menu');
  siteNavigation.inert = false;
  siteNavigation.classList.add('open');
  document.body.classList.add('menu-open', 'menu-visible');
  if (typeof sizeNavGradients === "function") sizeNavGradients();
  siteNavigation.querySelector('a').focus({ preventScroll: true });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuToggle.focus();
  }
  if (event.key === 'Tab' && menuToggle.getAttribute('aria-expanded') === 'true') {
    const links = [...siteNavigation.querySelectorAll('a')];
    const first = links[0];
    const last = links.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      menuToggle.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      menuToggle.focus();
    } else if (document.activeElement === menuToggle) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
});
siteNavigation.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
mobileMenuQuery.addEventListener('change', () => closeMenu(true));

const filters = document.querySelector('.filters');
if (filters) {
  const cards = [...document.querySelectorAll('[data-project]')];
  const groups = ['service', 'type', 'industry'];
  const active = document.querySelector('[data-active-filters]');
  const clearAll = document.querySelector('.filter-tag-row [data-clear]');
  const grid = document.querySelector('.project-grid');
  const choices = name => [...filters.querySelectorAll(`input[name="${name}"]`)];
  const selected = name => choices(name).filter(input => input.checked);

  function applyFilters() {
    const values = Object.fromEntries(groups.map(name => [name, selected(name).map(input => input.value)]));
    let count = 0;
    for (const card of cards) {
      const visible = (!values.service.length || values.service.some(value => card.dataset.services.split('|').includes(value)))
        && (!values.type.length || values.type.includes(card.dataset.type))
        && (!values.industry.length || values.industry.includes(card.dataset.industry));
      card.hidden = !visible;
      if (visible) {
        count++;
        card.querySelectorAll('.pending').forEach(element => element.classList.remove('pending'));
      }
    }
    document.querySelector('[data-count]').textContent = `${count} ${count === 1 ? 'project' : 'projects'}`;
    document.querySelector('.empty-results').hidden = count > 0;
    const hasFilters = groups.some(name => values[name].length);
    grid.classList.toggle('filtered', hasFilters);
    document.querySelector('.work-end').hidden = hasFilters;
    clearAll.hidden = !hasFilters;
    active.replaceChildren();
    for (const name of groups) {
      const label = filters.querySelector(`[data-filter-label="${name}"]`);
      label.textContent = values[name].length ? `${values[name].length} selected` : label.dataset.defaultLabel;
      filters.querySelector(`[data-filter-all="${name}"]`).checked = !values[name].length;
      for (const input of selected(name)) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'filter-chip';
        chip.textContent = `${input.value} ×`;
        chip.setAttribute('aria-label', `Remove ${input.value} ${name} filter`);
        chip.addEventListener('click', () => {
          input.checked = false;
          applyFilters();
          document.getElementById(`filter-${name}`).focus();
        });
        active.append(chip);
      }
    }
    document.querySelector('.filter-tag-row').hidden = !hasFilters;
  }
  filters.addEventListener('submit', event => event.preventDefault());
  filters.addEventListener('change', event => {
    if (event.target.matches('[data-filter-all]')) {
      choices(event.target.dataset.filterAll).forEach(input => { input.checked = false; });
    }
    applyFilters();
  });
  document.querySelectorAll('[data-clear]').forEach(button => {
    button.addEventListener('click', () => {
      groups.forEach(name => choices(name).forEach(input => { input.checked = false; }));
      applyFilters();
      document.getElementById('filter-service').focus();
    });
  });
  const initialService = new URLSearchParams(location.search).get('service');
  const initial = choices('service').find(input => input.value === initialService);
  if (initial) initial.checked = true;
  document.addEventListener('click', event => {
    filters.querySelectorAll('details[open]').forEach(details => {
      if (!details.contains(event.target)) details.open = false;
    });
  });
  filters.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const details = event.target.closest('details');
    if (details) {
      details.open = false;
      details.querySelector('summary').focus();
    }
  });
  applyFilters();
}

for (const overview of document.querySelectorAll('.project-overview')) {
  overview.addEventListener('toggle', () => {
    if (overview.open && !reducedMotion.matches) {
      overview.querySelector('div').animate(
        [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 260, easing: 'ease-out' }
      );
    }
  });
}

const enquiryForm = document.querySelector('.enquiry-form');
if (enquiryForm) {
  enquiryForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!enquiryForm.reportValidity()) return;
    const fields = new FormData(enquiryForm);
    const subject = `Website enquiry from ${fields.get('name')}`;
    const body = `Name: ${fields.get('name')}\nEmail: ${fields.get('email')}\nPhone: ${fields.get('phone') || 'Not supplied'}\n\n${fields.get('project')}`;
    enquiryForm.querySelector('.form-status').textContent = 'Your email app will open a draft. Review it and send it there.';
    location.href = `mailto:hello@thephoenixgroup.ca?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

for (const link of document.querySelectorAll('.site-header .nav-link')) {
  const label = link.getAttribute('aria-label');
  const face = document.createElement('span');
  face.className = 'nav-ripple-face';
  face.setAttribute('aria-hidden', 'true');
  for (const character of label) {
    const letter = document.createElement('span');
    letter.className = 'nav-ripple-letter';
    letter.textContent = character === ' ' ? '\u00a0' : character;
    face.append(letter);
  }
  link.replaceChildren(face);
  const letters = [...face.children].map(letter => ({ letter, y: 0, velocity: 0, rotation: 0 }));
  let pointer = null;
  let frame = 0;
  let previousTime = 0;

  function reset() {
    cancelAnimationFrame(frame);
    frame = previousTime = 0;
    pointer = null;
    letters.forEach(state => {
      state.y = state.velocity = state.rotation = 0;
      state.letter.style.removeProperty('transform');
    });
  }

  function draw(time) {
    const step = previousTime ? Math.min(2, (time - previousTime) / 16.67) : 1;
    previousTime = time;
    let moving = false;
    for (const state of letters) {
      const box = state.letter.getBoundingClientRect();
      const distance = pointer ? (box.left + box.width / 2 - pointer.x) / 25 : 5;
      const influence = Math.max(0, 1 - Math.abs(distance));
      const target = pointer ? -influence * 3.5 : 0;
      state.velocity += (target - state.y) * .12 * step;
      state.velocity *= .72 ** step;
      state.y += state.velocity * step;
      state.rotation += ((pointer ? distance * influence * 7 : 0) - state.rotation) * .18 * step;
      state.letter.style.transform = `translateY(${state.y.toFixed(2)}px) rotate(${state.rotation.toFixed(2)}deg) scaleY(${(1 - state.y / 110).toFixed(3)})`;
      moving ||= Math.abs(state.y - target) > .04 || Math.abs(state.velocity) > .04 || Math.abs(state.rotation) > .04;
    }
    if (pointer || moving) frame = requestAnimationFrame(draw);
    else reset();
  }

  link.addEventListener('pointermove', event => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    pointer = { x: event.clientX };
    if (!frame) frame = requestAnimationFrame(draw);
  });
  link.addEventListener('pointerleave', () => { pointer = null; });
  link.addEventListener('pointercancel', () => { pointer = null; });
  reducedMotion.addEventListener('change', reset);
  window.addEventListener('blur', reset);
}

for (const photo of document.querySelectorAll('[data-loop-motion]')) {
  let inView = false;
  function updatePhotoLoop() {
    const play = inView && !document.hidden && !reducedMotion.matches;
    const desired = play ? photo.dataset.loopMotion : photo.dataset.loopPoster;
    if (photo.getAttribute('src') !== desired) photo.src = desired;
  }
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updatePhotoLoop();
  }).observe(photo);
  reducedMotion.addEventListener('change', updatePhotoLoop);
  document.addEventListener('visibilitychange', updatePhotoLoop);
}

const officeMap = document.querySelector('.map-link');
if (officeMap) {
  const image = officeMap.querySelector('img');
  const marker = officeMap.querySelector('.map-marker');
  function positionOfficeMarker() {
    if (!image.naturalWidth) return;
    const width = officeMap.clientWidth;
    const height = officeMap.clientHeight;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const left = (width - image.naturalWidth * scale) / 2 + 927 * scale - 72;
    const top = (height - image.naturalHeight * scale) / 2 + 402 * scale - 44;
    marker.style.left = `${left}px`;
    marker.style.top = `${top}px`;
  }
  image.addEventListener('load', positionOfficeMarker);
  new ResizeObserver(positionOfficeMarker).observe(officeMap);
  positionOfficeMarker();
}

if (document.querySelector('[data-error-ripple]')) {
const footerHeadline = document.querySelector('[data-error-ripple]');
const footerText = footerHeadline.textContent;
footerHeadline.setAttribute('aria-label', footerText);
const rippleLetters = [];
for (const character of footerText) {
  if (character === ' ') {
    rippleLetters.push(document.createTextNode(' '));
  } else {
    const letter = document.createElement('span');
    letter.className = 'footer-ripple-letter';
    letter.setAttribute('aria-hidden', 'true');
    letter.textContent = character;
    rippleLetters.push(letter);
  }
}
footerHeadline.replaceChildren(...rippleLetters);
let ripplePointer = null;
let rippleFrame = 0;
let rippleLastTime = 0;
const rippleState = [...footerHeadline.querySelectorAll('.footer-ripple-letter')].map(letter => ({
  letter, y: 0, velocity: 0, rotation: 0
}));
function animateFooterRipple(time) {
  const step = rippleLastTime ? Math.min((time - rippleLastTime) / 16.67, 2) : 1;
  rippleLastTime = time;
  let moving = false;
  const fontSize = Number.parseFloat(getComputedStyle(footerHeadline).fontSize);
  for (const state of rippleState) {
    const box = state.letter.getBoundingClientRect();
    const distance = ripplePointer ? (box.left + box.width / 2 - ripplePointer.x) / (fontSize * 1.1) : 5;
    const influence = Math.max(0, 1 - Math.abs(distance));
    const target = ripplePointer ? -influence * fontSize * .13 : 0;
    state.velocity += (target - state.y) * .12 * step;
    state.velocity *= .72 ** step;
    state.y += state.velocity * step;
    state.rotation += ((ripplePointer ? distance * influence * 7 : 0) - state.rotation) * .18 * step;
    state.letter.style.transform = `translateY(${state.y.toFixed(2)}px) rotate(${state.rotation.toFixed(2)}deg) scaleY(${(1 - state.y / (fontSize * 1.6)).toFixed(3)})`;
    moving ||= Math.abs(state.y - target) > .04 || Math.abs(state.velocity) > .04 || Math.abs(state.rotation) > .04;
  }
  if (ripplePointer || moving) {
    rippleFrame = requestAnimationFrame(animateFooterRipple);
  } else {
    rippleState.forEach(state => state.letter.style.removeProperty('transform'));
    rippleFrame = 0;
    rippleLastTime = 0;
  }
}
footerHeadline.addEventListener('pointermove', event => {
  if (reducedMotion.matches || event.pointerType === 'touch') return;
  ripplePointer = { x: event.clientX };
  if (!rippleFrame) rippleFrame = requestAnimationFrame(animateFooterRipple);
});
function releaseFooterRipple() { ripplePointer = null; }
footerHeadline.addEventListener('pointerleave', releaseFooterRipple);
footerHeadline.addEventListener('pointercancel', releaseFooterRipple);
window.addEventListener('blur', releaseFooterRipple);
reducedMotion.addEventListener('change', () => {
  if (!reducedMotion.matches) return;
  cancelAnimationFrame(rippleFrame);
  rippleFrame = 0;
  rippleLastTime = 0;
  ripplePointer = null;
  rippleState.forEach(state => {
    state.y = state.velocity = state.rotation = 0;
    state.letter.style.removeProperty('transform');
  });
});

}
