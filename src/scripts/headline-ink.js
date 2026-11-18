// Watercolor ink for headlines.
//
// While the pointer moves over a headline, it lays dark green ink where it is.
// Every drop then follows the same timeline, whatever the pointer does next:
// it bleeds outward, turns lime as it spreads, and fades away.
// Drops are painted as radial gradients on `.headline-ink`, which is clipped
// to the text, so the colour only ever shows inside the letters.
//
// Markup: <h1 class="page-headline">
//           <span class="headline-text">…</span>
//           <span class="headline-ink" aria-hidden="true">…</span>
//         </h1>

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const hoverPointer = matchMedia('(any-hover: hover)');

// Fresh ink → spread ink.
const RAMP = ['#06b69f', '#69ca6c', '#c3d529'].map(hex =>
  [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16))
);

const SETTINGS = {
  life: 3400,       // ms each drop stays visible
  bleed: 480,       // ms for a drop to reach most of its size
  dry: 900,         // ms for a drop to turn from dark green to mostly lime
  edge: .45,        // how much lighter a drop's outer edge is than its centre (0–1 of the ramp)
  spacing: .22,     // pointer travel between drops, as a fraction of drop size
  interval: 50,     // minimum ms between drops, so fast strokes can't flood the page
  follow: 55,       // ms for the brush to catch up with the pointer (smooths jittery input)
};

// The interval guarantees this many drops at most, so no drop is ever
// retired before the end of its life.
const MAX_DROPS = Math.ceil(SETTINGS.life / SETTINGS.interval) + 1;

// Colour at position `t` (0–1) along the ramp.
function pigment(t) {
  const steps = RAMP.length - 1;
  const f = Math.max(0, Math.min(1, t)) * steps;
  const i = Math.min(steps - 1, Math.floor(f));
  const k = f - i;
  return RAMP[i].map((v, n) => Math.round(v + (RAMP[i + 1][n] - v) * k));
}

const rgba = ([r, g, b], alpha) => `rgb(${r} ${g} ${b} / ${Math.max(0, alpha).toFixed(3)})`;
const random = (min, max) => min + Math.random() * (max - min);

// A watercolour drop: darker where the ink landed, lighter where it has
// bled out to, with a soft edge.
function wash(x, y, rx, ry, stage, alpha) {
  const centre = pigment(stage);
  const edge = pigment(stage + SETTINGS.edge);
  return `radial-gradient(ellipse ${Math.round(rx)}px ${Math.round(ry)}px at ${Math.round(x)}px ${Math.round(y)}px, `
    + `${rgba(centre, alpha * .9)} 0%, ${rgba(centre, alpha * .8)} 35%, `
    + `${rgba(edge, alpha * .85)} 65%, ${rgba(edge, alpha * .4)} 80%, transparent 93%)`;
}

function setupHeadlineInk(headline) {
  const ink = headline.querySelector('.headline-ink');
  if (!ink) return;

  let drops = [];
  let pointer = null;
  let brush = null;
  let lastDrop = null;
  let frame = 0;
  let lastTime = 0;
  let size = 160;

  function measure() {
    const fontSize = Number.parseFloat(getComputedStyle(ink).fontSize);
    size = Math.max(70, Math.min(230, fontSize * 1.35));
  }

  function toLocal(event) {
    const box = ink.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function addDrop(x, y, time) {
    drops.push({
      x, y,
      born: time,
      size: size * random(.8, 1.2),
      aspect: random(.55, .8),
      seed: random(0, Math.PI * 2),
      // Two offset lobes per drop give irregular, blotchy edges.
      lobes: [0, 1].map(() => ({ dx: random(-.25, .25), dy: random(-.18, .18), scale: random(.7, 1.05) })),
    });
    if (drops.length > MAX_DROPS) drops.shift();
    lastDrop = { x, y, time };
  }

  function start() {
    if (!frame) frame = requestAnimationFrame(paint);
  }

  function reset() {
    cancelAnimationFrame(frame);
    frame = lastTime = 0;
    drops = [];
    pointer = brush = lastDrop = null;
    ink.classList.remove('active');
    ink.style.removeProperty('background-image');
  }

  function paint(time) {
    const dt = lastTime ? Math.min(time - lastTime, 48) : 16;
    lastTime = time;

    // Lay new ink only while the brush is actually travelling.
    if (pointer && brush) {
      const ease = 1 - Math.exp(-dt / SETTINGS.follow);
      brush.x += (pointer.x - brush.x) * ease;
      brush.y += (pointer.y - brush.y) * ease;
      const travelled = lastDrop ? Math.hypot(brush.x - lastDrop.x, brush.y - lastDrop.y) : Infinity;
      const waited = lastDrop ? time - lastDrop.time : Infinity;
      if (travelled > size * SETTINGS.spacing && waited >= SETTINGS.interval) {
        addDrop(brush.x, brush.y, time);
      }
    }

    drops = drops.filter(d => time - d.born < SETTINGS.life);
    const layers = [];

    // Newest drops first: the first background layer is painted on top.
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      const age = time - d.born;
      const progress = age / SETTINGS.life;
      // A slight wander as the ink settles; it doesn't travel with the stroke.
      const x = d.x + Math.sin(d.seed + age * .0013) * progress * 18;
      const y = d.y + Math.cos(d.seed + age * .0011) * progress * 12;

      const radius = d.size * (.3 + .95 * (1 - Math.exp(-age / SETTINGS.bleed)));
      const alpha = Math.min(1, age / 140) * (1 - progress) ** 1.5;
      // 0 = just landed (dark green), 1 = fully spread (lime).
      const stage = 1 - Math.exp(-age / SETTINGS.dry);
      for (const lobe of d.lobes) {
        const rx = radius * lobe.scale;
        layers.push(wash(x + lobe.dx * radius, y + lobe.dy * radius, rx, rx * d.aspect, stage, alpha));
      }
    }

    if (!layers.length) {
      // All ink has dried. Go idle; the next pointer move starts things again.
      frame = lastTime = 0;
      ink.classList.remove('active');
      ink.style.removeProperty('background-image');
      return;
    }
    ink.style.backgroundImage = layers.join(',');
    ink.classList.add('active');
    frame = requestAnimationFrame(paint);
  }

  function move(event) {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    pointer = toLocal(event);
    brush ??= { ...pointer };
    start();
  }

  function leave() {
    pointer = brush = null;
    lastDrop = null;
  }

  measure();
  headline.addEventListener('pointerenter', move);
  headline.addEventListener('pointermove', move);
  headline.addEventListener('pointerleave', leave);
  headline.addEventListener('pointercancel', reset);
  reducedMotion.addEventListener('change', reset);
  hoverPointer.addEventListener('change', reset);
  window.addEventListener('resize', () => {
    reset();
    measure();
  });
}

for (const headline of document.querySelectorAll('.page-headline')) {
  setupHeadlineInk(headline);
}

// The home hero waits for its intro animation to finish before taking ink.
const hero = document.getElementById('headline');
const heroThinking = hero?.querySelector('.hero-thinking');
if (hero && (reducedMotion.matches || !heroThinking)) {
  setupHeadlineInk(hero);
} else if (hero) {
  let ready = false;
  const enable = () => {
    if (ready) return;
    ready = true;
    setupHeadlineInk(hero);
  };
  heroThinking.addEventListener('animationend', event => {
    if (event.animationName === 'thinking-opens') enable();
  });
  setTimeout(enable, 1650);
}
