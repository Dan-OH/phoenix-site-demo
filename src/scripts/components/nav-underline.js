// Sliding underline for navigation links (concept, shown on concepts.html).
//
// One lime underline is shared by all links in the nav. Hovering or focusing
// a link slides it there, resizing to fit. If a link is marked as the current
// page (aria-current="page"), the underline rests there and slides back when
// the pointer leaves; otherwise it fades out where it is.
//
// Markup: <nav class="nav-underline">
//           <a href="…">…</a> …
//         </nav>

function setupNavUnderline(nav) {
  const links = [...nav.querySelectorAll('a')];
  const bar = document.createElement('span');
  bar.className = 'nav-underline-bar';
  bar.setAttribute('aria-hidden', 'true');
  nav.append(bar);

  const current = links.find(link => link.getAttribute('aria-current') === 'page');
  let target = null;

  function place(link, { animate = true } = {}) {
    if (!link) {
      bar.classList.remove('visible');
      return;
    }
    const navBox = nav.getBoundingClientRect();
    const box = link.getBoundingClientRect();
    if (!animate) bar.classList.add('instant');
    bar.style.setProperty('--x', `${box.left - navBox.left}px`);
    bar.style.setProperty('--y', `${box.bottom - navBox.top}px`);
    bar.style.setProperty('--w', `${box.width}px`);
    bar.classList.add('visible');
    if (!animate) {
      bar.getBoundingClientRect(); // apply the jump before re-enabling transitions
      bar.classList.remove('instant');
    }
  }

  function show(link) {
    // Coming from nothing, appear under the link instead of sliding in from elsewhere.
    place(link, { animate: bar.classList.contains('visible') });
    target = link;
  }

  function rest() {
    target = null;
    place(current);
  }

  for (const link of links) {
    link.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') show(link);
    });
    link.addEventListener('focus', () => show(link));
    link.addEventListener('blur', () => {
      if (!nav.contains(document.activeElement) && !nav.matches(':hover')) rest();
    });
  }
  nav.addEventListener('pointerleave', () => {
    if (!nav.contains(document.activeElement)) rest();
  });

  const reposition = () => place(target || current, { animate: false });
  new ResizeObserver(reposition).observe(nav);
  document.fonts?.ready.then(reposition);
  place(current, { animate: false });
}

export function initNavUnderline() {
  for (const nav of document.querySelectorAll('.nav-underline')) {
    setupNavUnderline(nav);
  }
}
