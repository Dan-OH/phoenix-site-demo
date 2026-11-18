// WebGL watercolour ink for headlines (.page-headline and the home #headline).
//
// Markup: <h1 class="page-headline"><span class="headline-text">…</span></h1>
//
// A canvas sits over the headline's real text, which stays in the page for
// screen readers, selection and SEO. Each frame:
//   1. The pointer's path since the last frame lays fresh ink (only while it moves).
//   2. A simulation step spreads the ink outward with a soft, wet front, lets it
//      drift on a slow flow field, and dries it over time.
//   3. The ink is drawn through a stencil of the letters, so it only shows inside them.
//
// The simulation runs at a fixed rate, so ink always spreads, changes colour and
// fades at the same speed, however fast the pointer moves or the page renders.
//
// Ink is stored per pixel as: r = amount of pigment, g = how much of it is still fresh.
// Fresh ink is dark green; as it dries and thins out it turns lime.

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const hoverPointer = matchMedia('(any-hover: hover)');

const SETTINGS = {
  simScale: 0.5, // simulation pixels per CSS pixel
  stepRate: 120, // simulation steps per second
  maxSteps: 8, // per frame; beyond this the sim slows rather than stalls the page
  follow: 55, // ms for the brush to catch up with the pointer (smooths jitter)
  radius: 0.3, // brush radius, × the headline's font size
  deposit: 0.9, // ink laid per pass of the brush
  reach: 3, // spread sample distance in sim pixels (higher = spreads further)
  spread: 0.2, // spread rate per step (must stay below .25)
  flow: 10, // drift speed of the flow field, CSS px per second
  flowSize: 1.2, // size of flow eddies, × font size
  life: 1.4, // seconds: how quickly pigment fades
  floor: 0.08, // pigment removed per second, so ink fully disappears
  dry: 0.7, // seconds: how quickly fresh dark green turns lime
  fadeOut: 4.5, // seconds after the last stroke before the sim stops
  edge: 6, // strength of the tide line where wet ink meets dry paper
};

const RAMP = { dark: '#06b69f', mid: '#69ca6c', light: '#c3d529' };

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * .5 + .5;
  gl_Position = vec4(aPos, 0., 1.);
}`;

const NOISE = `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}`;

const STEP = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outState;
uniform sampler2D uState;
uniform vec2 uSize;
uniform float uDt, uTime;
uniform vec4 uSegment;
uniform float uRadius, uDeposit, uReach, uSpread, uFlow, uFlowScale, uLife, uDry, uFloor;
${NOISE}
vec2 curl(vec2 p, float t) {
  float e = .15;
  float a = vnoise(p + vec2(0., e) + t), b = vnoise(p - vec2(0., e) + t);
  float c = vnoise(p + vec2(e, 0.) - t), d = vnoise(p - vec2(e, 0.) - t);
  return vec2(a - b, -(c - d)) / (2. * e);
}
// Wet ink spreads readily; thin ink barely moves. This gives watercolour's soft-but-defined front.
float mobility(vec4 n, vec4 c) {
  return uSpread * (.15 + .85 * clamp(.5 * (n.r + c.r), 0., 1.));
}
void main() {
  vec2 texel = 1. / uSize;
  vec2 p = vUv * uSize;
  vec2 uv = vUv - curl(p * uFlowScale, uTime * .05) * uFlow * uDt * texel;
  vec4 c = texture(uState, uv);
  vec2 d = uReach * texel;
  vec4 n, sum = vec4(0.);
  n = texture(uState, uv + vec2(d.x, 0.)); sum += mobility(n, c) * (n - c);
  n = texture(uState, uv - vec2(d.x, 0.)); sum += mobility(n, c) * (n - c);
  n = texture(uState, uv + vec2(0., d.y)); sum += mobility(n, c) * (n - c);
  n = texture(uState, uv - vec2(0., d.y)); sum += mobility(n, c) * (n - c);
  c += sum;

  c.r = max(0., c.r * exp(-uDt / uLife) - uFloor * uDt);
  c.g = min(c.r, c.g * exp(-uDt / uDry) * exp(-uDt / uLife));

  vec2 a = uSegment.xy, ab = uSegment.zw - uSegment.xy;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0., 1.);
  float dist = length(p - a - ab * h);
  float add = uDeposit * exp(-dist * dist / (uRadius * uRadius));
  c.r = min(c.r + add, 1.6);
  c.g = min(c.g + add, c.r);
  outState = vec4(c.rg, 0., 1.);
}`;

const DISPLAY = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState, uStencil;
uniform vec2 uSimSize;
uniform float uDpr, uEdge;
uniform vec3 uDark, uMid, uLight;
${NOISE}
void main() {
  vec4 s = texture(uState, vUv);
  float ink = s.r;
  float fresh = ink > 1e-4 ? clamp(s.g / ink, 0., 1.) : 0.;
  float thin = 1. - smoothstep(.05, .7, ink);
  float tone = clamp(fresh - thin * .35, 0., 1.);   // 1 = fresh dark green, 0 = lime
  vec3 colour = tone > .5 ? mix(uMid, uDark, (tone - .5) * 2.) : mix(uLight, uMid, tone * 2.);

  vec2 t = 1. / uSimSize;
  vec2 grad = vec2(texture(uState, vUv + vec2(t.x, 0.)).r - texture(uState, vUv - vec2(t.x, 0.)).r,
                   texture(uState, vUv + vec2(0., t.y)).r - texture(uState, vUv - vec2(0., t.y)).r);
  float tide = clamp(length(grad) * uEdge, 0., 1.);

  vec2 paper = gl_FragCoord.xy / uDpr;
  float grain = vnoise(paper / 3.) * .6 + vnoise(paper / 11.) * .4;

  float alpha = smoothstep(.02, .4, ink);
  alpha = clamp(alpha * (.78 + .22 * grain) + tide * .25 * alpha, 0., 1.) * .95;
  alpha *= texture(uStencil, vUv).a;
  outColor = vec4(colour * alpha, alpha);
}`;

const hexToVec = (hex) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);

function compile(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertexSource],
    [gl.FRAGMENT_SHADER, fragmentSource],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program));
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const { name } = gl.getActiveUniform(program, i);
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

function createTarget(gl, width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA16F,
    width,
    height,
    0,
    gl.RGBA,
    gl.HALF_FLOAT,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { texture, framebuffer };
}

// Draws the headline's letters, at the exact positions the browser laid them
// out, into a 2D canvas used as the ink's stencil.
function drawStencil(context, source, box, dpr) {
  const { width, height } = context.canvas;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = '#fff';
  context.textBaseline = 'alphabetic';
  const range = document.createRange();
  const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const style = getComputedStyle(node.parentElement);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = node.data;
    for (let i = 0; i < text.length; i++) {
      const size = text.codePointAt(i) > 0xffff ? 2 : 1;
      const character = text.slice(i, i + size);
      if (!/\s/.test(character)) {
        range.setStart(node, i);
        range.setEnd(node, i + size);
        const rect = range.getClientRects()[0];
        if (rect) {
          const metrics = context.measureText(character);
          context.fillText(
            character,
            rect.left - box.left,
            rect.bottom - box.top - metrics.fontBoundingBoxDescent,
          );
        }
      }
      i += size - 1;
    }
  }
}

/**
 * Adds watercolour ink to a headline. Without WebGL 2 (or float render
 * targets) it does nothing and the headline stays plain text.
 */
function setupHeadlineInk(headline) {
  const source = headline.querySelector('.headline-text');
  if (!source) return false;

  const canvas = document.createElement('canvas');
  canvas.className = 'headline-ink-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: true,
    antialias: false,
  });
  if (
    !gl ||
    !(
      gl.getExtension('EXT_color_buffer_float') ||
      gl.getExtension('EXT_color_buffer_half_float')
    )
  ) {
    return false;
  }

  let step, display;
  try {
    step = compile(gl, VERTEX, STEP);
    display = compile(gl, VERTEX, DISPLAY);
  } catch (error) {
    console.warn('Headline ink: WebGL shaders failed to compile.', error);
    return false;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const stencilCanvas = document.createElement('canvas');
  const stencilContext = stencilCanvas.getContext('2d');
  const stencilTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, stencilTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  headline.classList.add('has-ink');
  headline.append(canvas);

  let targets = [];
  let simWidth = 0;
  let simHeight = 0;
  let dpr = 1;
  let fontSize = 16;
  let pointer = null;
  let brush = null;
  let previous = null;
  let frame = 0;
  let lastTime = 0;
  let pending = 0;
  let clock = 0;
  let lastStroke = -Infinity;
  let running = false;

  function updateStencil() {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    drawStencil(stencilContext, source, box, dpr);
    gl.bindTexture(gl.TEXTURE_2D, stencilTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      stencilCanvas,
    );
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    fontSize = Number.parseFloat(getComputedStyle(source).fontSize);
    canvas.width = stencilCanvas.width = Math.max(
      1,
      Math.round(box.width * dpr),
    );
    canvas.height = stencilCanvas.height = Math.max(
      1,
      Math.round(box.height * dpr),
    );
    simWidth = Math.max(1, Math.round(box.width * SETTINGS.simScale));
    simHeight = Math.max(1, Math.round(box.height * SETTINGS.simScale));
    for (const target of targets) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.framebuffer);
    }
    targets = [
      createTarget(gl, simWidth, simHeight),
      createTarget(gl, simWidth, simHeight),
    ];
    updateStencil();
    stop();
  }

  // Pointer position in simulation pixels (origin bottom-left, as in GL).
  function toSim(event) {
    const box = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) * SETTINGS.simScale,
      y: (box.height - (event.clientY - box.top)) * SETTINGS.simScale,
    };
  }

  function simulate(segment, deposit, dt) {
    const radius = fontSize * SETTINGS.radius * SETTINGS.simScale;
    const u = step.uniforms;
    gl.useProgram(step.program);
    gl.viewport(0, 0, simWidth, simHeight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[0].texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1].framebuffer);
    gl.uniform1i(u.uState, 0);
    gl.uniform2f(u.uSize, simWidth, simHeight);
    gl.uniform1f(u.uDt, dt);
    gl.uniform1f(u.uTime, clock);
    gl.uniform4f(u.uSegment, ...segment);
    gl.uniform1f(u.uRadius, radius);
    gl.uniform1f(u.uDeposit, deposit);
    gl.uniform1f(u.uReach, SETTINGS.reach);
    gl.uniform1f(u.uSpread, SETTINGS.spread);
    gl.uniform1f(u.uFlow, SETTINGS.flow * SETTINGS.simScale);
    gl.uniform1f(
      u.uFlowScale,
      1 / (fontSize * SETTINGS.flowSize * SETTINGS.simScale),
    );
    gl.uniform1f(u.uLife, SETTINGS.life);
    gl.uniform1f(u.uDry, SETTINGS.dry);
    gl.uniform1f(u.uFloor, SETTINGS.floor);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    targets.reverse();
  }

  function render() {
    const u = display.uniforms;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(display.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[0].texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, stencilTexture);
    gl.uniform1i(u.uState, 0);
    gl.uniform1i(u.uStencil, 1);
    gl.uniform2f(u.uSimSize, simWidth, simHeight);
    gl.uniform1f(u.uDpr, dpr);
    gl.uniform1f(u.uEdge, SETTINGS.edge);
    gl.uniform3f(u.uDark, ...hexToVec(RAMP.dark));
    gl.uniform3f(u.uMid, ...hexToVec(RAMP.mid));
    gl.uniform3f(u.uLight, ...hexToVec(RAMP.light));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(time) {
    const elapsed = lastTime ? Math.min(time - lastTime, 100) : 16;
    lastTime = time;

    // Brush path for this frame, from where it was to where it is now.
    let segment = [0, 0, 0, 0];
    let deposit = 0;
    if (pointer && brush) {
      const ease = 1 - Math.exp(-elapsed / SETTINGS.follow);
      brush.x += (pointer.x - brush.x) * ease;
      brush.y += (pointer.y - brush.y) * ease;
      const from = previous || brush;
      const length = Math.hypot(brush.x - from.x, brush.y - from.y);
      const radius = fontSize * SETTINGS.radius * SETTINGS.simScale;
      if (length > 0.3 || !previous) {
        // Scaled by distance so slow and fast strokes lay the same amount of ink per area.
        deposit =
          SETTINGS.deposit *
          Math.min(1, Math.max(length, 0.3 * radius) / radius);
        segment = [from.x, from.y, brush.x, brush.y];
        lastStroke = clock;
      }
      previous = { ...brush };
    }

    const stepDt = 1 / SETTINGS.stepRate;
    pending = Math.min(pending + elapsed / 1000, SETTINGS.maxSteps * stepDt);
    let first = true;
    while (pending >= stepDt) {
      simulate(segment, first ? deposit : 0, stepDt);
      first = false;
      pending -= stepDt;
      clock += stepDt;
    }
    render();

    if (!pointer && clock - lastStroke > SETTINGS.fadeOut) {
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    running = false;
    frame = 0;
    pending = 0;
    for (const target of targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function move(event) {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    pointer = toSim(event);
    brush ??= { ...pointer };
    start();
  }

  function enter(event) {
    // Letters can shift after load (fonts, intro animations), so re-trace them on entry.
    updateStencil();
    move(event);
  }

  function leave() {
    pointer = brush = previous = null;
  }

  function reset() {
    leave();
    stop();
  }

  headline.addEventListener('pointerenter', enter);
  headline.addEventListener('pointermove', move);
  headline.addEventListener('pointerleave', leave);
  headline.addEventListener('pointercancel', reset);
  reducedMotion.addEventListener('change', reset);
  hoverPointer.addEventListener('change', reset);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    reset();
  });
  new ResizeObserver(resize).observe(headline);
  document.fonts?.ready.then(updateStencil);
  resize();
  return true;
}

for (const headline of document.querySelectorAll('.page-headline')) {
  setupHeadlineInk(headline);
}

// The home hero waits for its intro animation to finish, so the letters are
// traced in their final positions.
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
  heroThinking.addEventListener('animationend', (event) => {
    if (event.animationName === 'thinking-opens') enable();
  });
  setTimeout(enable, 1650);
}
