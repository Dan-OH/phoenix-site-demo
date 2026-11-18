const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const hoverPointer = matchMedia('(any-hover: hover)');

function showFrame(element, index) {
  const column = index % 6;
  const row = Math.floor(index / 6);
  element.style.backgroundPosition = `${column * 20}% ${row * 25}%`;
}

const reveals = [...document.querySelectorAll('[data-reveal]')];
const revealObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.remove('pending');
      revealObserver.unobserve(entry.target);
    }
  }
}, { rootMargin: '0px 0px -48px 0px', threshold: 0 });

if (!reducedMotion.matches) {
  for (const element of reveals) {
    if (element.getBoundingClientRect().top >= innerHeight) {
      element.classList.add('pending');
      revealObserver.observe(element);
    }
  }
}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    revealObserver.disconnect();
    reveals.forEach(element => element.classList.remove('pending'));
  }
});

for (const preview of document.querySelectorAll('[data-work]')) {
  const card = preview.closest('.work-card') || preview.closest('.media');
  const poster = preview.getAttribute('src');
  const motion = preview.dataset.motion;
  const preload = new Image();
  preload.src = motion;
  let playing = false;
  const automatic = preview.hasAttribute("data-autoplay");
  let inView = false;

  function stop() {
    playing = false;
    preview.src = poster;
  }

  function play(event) {
    if (reducedMotion.matches || event.pointerType === 'touch' || playing) return;
    playing = true;
    preview.src = motion;
  }

  if (automatic) {
    const sync = () => {
      if (inView && !document.hidden && !reducedMotion.matches) play({pointerType:'mouse'});
      else stop();
    };
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }).observe(preview);
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', sync);
    continue;
  }
  card.addEventListener('pointerenter', play);
  card.addEventListener('pointermove', play);
  card.addEventListener('pointerleave', stop);
  card.addEventListener('pointercancel', stop);
  card.addEventListener('focus', play);
  card.addEventListener('blur', stop);
  reducedMotion.addEventListener('change', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
}

if (document.querySelector('[data-hero]')) {
const hero = document.querySelector('[data-hero]');
const clips = [1, 2, 3].map(number => `/assets/WhpClip${number}.png`);
let heroTimer = 0;
let heroVisible = false;
let heroFrame = 0;
let clipsReady = false;

function updateHero() {
  clearInterval(heroTimer);
  heroTimer = 0;
  if (!clipsReady || reducedMotion.matches) {
    hero.style.removeProperty('--sheet');
    return;
  }
  if (!heroVisible || document.hidden) return;
  const draw = () => {
    const segment = Math.floor(heroFrame / 30);
    hero.style.setProperty('--sheet', `url("${clips[segment]}")`);
    showFrame(hero, heroFrame % 30);
    heroFrame = (heroFrame + 1) % 90;
  };
  draw();
  heroTimer = setInterval(draw, 100);
}

new IntersectionObserver(([entry]) => {
  heroVisible = entry.isIntersecting;
  updateHero();
}).observe(hero);
reducedMotion.addEventListener('change', () => {
  prepareHero();
  updateHero();
});
document.addEventListener('visibilitychange', updateHero);

let loadingClips = false;
async function prepareHero() {
  if (loadingClips || reducedMotion.matches) return;
  loadingClips = true;
  const images = clips.map(src => Object.assign(new Image(), { src }));
  try {
    await Promise.all(images.map(image => image.decode()));
    clipsReady = true;
    updateHero();
  } catch {
    // The still image remains visible if a sprite sheet fails to load.
  }
}
prepareHero();


}

function setupClientTicker(track) {
  const originals = track.firstElementChild;
  const duplicate = originals.cloneNode(true);
  duplicate.setAttribute('aria-hidden', 'true');
  track.append(duplicate);

  let phase = 0;
  let rowWidth = 0;
  let frame = 0;
  let lastTime = null;
  let visible = false;
  let hovered = false;
  let rate = 1;
  let drag = null;

  function render() {
    const translation = `translateX(${-phase * rowWidth}px)`;
    originals.style.transform = translation;
    duplicate.style.transform = translation;
  }

  function shift(delta) {
    if (!rowWidth) return;
    phase = ((phase + delta / rowWidth) % 1 + 1) % 1;
    render();
  }

  function tick(time) {
    const elapsed = lastTime === null ? 0 : Math.min(50, time - lastTime);
    lastTime = time;
    const targetRate = hovered || track.matches(':focus-visible') ? .24 : 1;
    rate += (targetRate - rate) * (1 - Math.exp(-elapsed / 180));
    shift(rowWidth * rate * elapsed / 32000);
    frame = requestAnimationFrame(tick);
  }

  function syncPlayback() {
    const shouldPlay = visible && !drag && !reducedMotion.matches && !document.hidden;
    if (shouldPlay && !frame) frame = requestAnimationFrame(tick);
    if (!shouldPlay && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = null;
    }
  }

  function resize() {
    rowWidth = originals.getBoundingClientRect().width;
    render();
  }

  function finishDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    track.classList.remove('dragging');
    syncPlayback();
  }

  track.addEventListener('pointerenter', event => { hovered = event.pointerType === 'mouse'; });
  track.addEventListener('pointerleave', () => { hovered = false; });
  track.addEventListener('pointerdown', event => {
    if (drag || !event.isPrimary || event.button !== 0) return;
    track.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX };
    track.classList.add('dragging');
    syncPlayback();
  });
  track.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    shift(drag.x - event.clientX);
    drag.x = event.clientX;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    track.addEventListener(event, finishDrag);
  }
  track.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    shift((event.key === 'ArrowRight' ? 1 : -1) * rowWidth / originals.childElementCount);
  });

  resize();
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(resize).observe(track);
  } else {
    window.addEventListener('resize', resize);
  }
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncPlayback();
  }).observe(track);
  reducedMotion.addEventListener('change', syncPlayback);
  document.addEventListener('visibilitychange', syncPlayback);
}

const track = document.querySelector('.client-track');
if (track) setupClientTicker(track);

async function setupLogoMorph(logo) {
  const canvas = logo.querySelector('canvas');
  const wordmark = logo.querySelector('.logo-motion img');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;

  const image = new Image();
  image.src = logoFlameSource;
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
  const radius = 62;
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
    if (age >= 640) {
      reset();
      return;
    }
    const strength = impulse.strength * (1 - age / 640) ** 2;
    target.set(pixels);
    for (let y = Math.max(0, Math.floor(impulse.y - radius)); y < Math.min(height, impulse.y + radius); y++) {
      for (let x = Math.max(0, Math.floor(impulse.x - radius)); x < Math.min(width, impulse.x + radius); x++) {
        const distance = Math.hypot(x - impulse.x, y - impulse.y);
        if (distance >= radius) continue;
        const falloff = (1 - distance / radius) ** 2;
        const wave = Math.sin(distance * .14 - age * .019 + 1.1) * strength * falloff;
        const sx = Math.round(x - impulse.dx * strength * falloff * .45 + wave * .42);
        const sy = Math.round(y - impulse.dy * strength * falloff * .45 + wave);
        target[y * width + x] = sx >= 0 && sx < width && sy >= 0 && sy < height
          ? pixels[sy * width + sx]
          : 0;
      }
    }
    context.putImageData(output, 0, 0);
    logo.classList.add('morphing');
    animation = requestAnimationFrame(draw);
  }

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
    const x = Math.round((event.clientX - bounds.left) * width / bounds.width);
    const y = Math.round((event.clientY - bounds.top) * height / bounds.height);
    const dx = previous ? x - previous.x : 0;
    const dy = previous ? y - previous.y : 0;
    previous = { x, y };
    if (x < 0 || x >= width || y < 0 || y >= height || !isNearFlame(x, y)) return;
    const motion = Math.hypot(dx, dy);
    impulse = {
      x, y,
      dx: motion ? dx / motion : 0,
      dy: motion ? dy / motion : 0,
      strength: Math.min(19, 10 + motion * .55),
      time: performance.now()
    };
    if (!animation) animation = requestAnimationFrame(draw);
  }

  logo.addEventListener('pointerenter', move);
  logo.addEventListener('pointermove', move);
  logo.addEventListener('pointerleave', () => { previous = null; });
  logo.addEventListener('pointercancel', reset);
  reducedMotion.addEventListener('change', reset);
  hoverPointer.addEventListener('change', reset);
}

const phoenixLogo = document.querySelector('.site-header .logo');
if (phoenixLogo && typeof logoFlameSource === 'string') setupLogoMorph(phoenixLogo);

for (const link of document.querySelectorAll('a')) {
  link.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') link.classList.add('pointer-over');
  });
  const clearHover = () => link.classList.remove('pointer-over');
  link.addEventListener('pointerleave', clearHover);
  link.addEventListener('pointercancel', clearHover);
  window.addEventListener('blur', clearHover);
}


for (const button of document.querySelectorAll('.button')) {
  const fill = document.createElement('span');
  fill.className = 'button-fill';
  fill.setAttribute('aria-hidden', 'true');
  button.prepend(fill);

  function setOrigin(x, y, width, height) {
    const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
    button.style.setProperty('--fill-x', `${x}px`);
    button.style.setProperty('--fill-y', `${y}px`);
    button.style.setProperty('--fill-radius', `${Math.ceil(radius) + 2}px`);
  }

  button.addEventListener('pointerenter', event => {
    const bounds = button.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
    setOrigin(x, y, bounds.width, bounds.height);
  });
  button.addEventListener('focus', () => {
    if (!button.matches(':focus-visible')) return;
    const bounds = button.getBoundingClientRect();
    setOrigin(bounds.width / 2, bounds.height / 2, bounds.width, bounds.height);
  });
}

function sizeNavGradients() {
  for (const link of document.querySelectorAll('.site-header .nav-link')) {
    const row = link.querySelector('.nav-text-repeat');
    if (!row) continue;
    const width = row.getBoundingClientRect().width;
    for (const letter of row.children) {
      letter.dataset.letter = letter.textContent;
      letter.style.setProperty('--nav-gradient-width', `${width}px`);
      letter.style.setProperty('--nav-gradient-offset', `${-letter.offsetLeft}px`);
    }
  }
}
sizeNavGradients();
document.fonts.ready.then(sizeNavGradients);
window.addEventListener('resize', sizeNavGradients);

if (document.querySelector('.footer-cta h2')) {
const footerHeadline = document.querySelector('.footer-cta h2');
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


// One stable cursor layer avoids native image-cursor resets over playing GIFs.
(() => {
  const workLinks = document.querySelectorAll('a.work-card');
  if (!workLinks.length) return;
  workLinks.forEach(link => { link.draggable = false; });
  const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const cursor = document.createElement('div');
  cursor.className = 'work-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.append(cursor);
  let frame = 0;
  let x = 0;
  let y = 0;
  function hide() {
    cursor.classList.remove('active');
    document.documentElement.classList.remove('work-cursor-active');
  }
  document.addEventListener('pointermove', event => {
    if (!finePointer.matches || event.pointerType !== 'mouse' || !event.target.closest('a.work-card')) {
      hide();
      return;
    }
    x = event.clientX;
    y = event.clientY;
    cursor.style.transform = `translate3d(${x - 24}px, ${y - 24}px, 0)`;
    cursor.classList.add('active');
    document.documentElement.classList.add('work-cursor-active');
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) hide();
  });
  document.addEventListener('pointercancel', hide);
  document.addEventListener('visibilitychange', hide);
  window.addEventListener('blur', hide);
  finePointer.addEventListener('change', hide);
  window.addEventListener('scroll', () => {
    if (!cursor.classList.contains('active') || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!document.elementFromPoint(x, y)?.closest('a.work-card')) hide();
    });
  }, { passive: true });
})();
