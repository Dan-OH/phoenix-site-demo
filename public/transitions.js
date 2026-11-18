(() => {
  const root = document.documentElement;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const pageURL = new URL(location.href);
  let pendingDestination = null;
  let navigationTimer = 0;

  function clearTransition() {
    root.classList.remove('page-entering', 'page-leaving');
  }

  if (pageURL.searchParams.get('_pg') === '1') {
    if (!motionPreference.matches) {
      root.style.setProperty('--page-intro-delay', '.16s');
      root.classList.add('page-entering');
    }
    for (const parameter of ['_pg', '_px', '_py'])
      pageURL.searchParams.delete(parameter);
    try {
      history.replaceState(history.state, '', pageURL.href);
    } catch {
      // The page still opens correctly when file-preview history changes are restricted.
    }
    setTimeout(() => root.classList.remove('page-entering'), 600);
  }

  function navigate() {
    clearTimeout(navigationTimer);
    if (!pendingDestination) return;
    const destination = pendingDestination;
    pendingDestination = null;
    location.assign(destination);
  }

  document.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = event.target.closest('a[href]');
    if (
      !link ||
      link.hasAttribute('download') ||
      (link.target && link.target !== '_self')
    )
      return;
    const destination = new URL(link.href, location.href);
    if (
      destination.origin !== location.origin ||
      destination.protocol !== location.protocol
    )
      return;
    if (!['http:', 'https:', 'file:'].includes(destination.protocol)) return;
    if (!destination.pathname.endsWith('.html')) return;
    const directory = location.pathname.slice(
      0,
      location.pathname.lastIndexOf('/') + 1,
    );
    if (
      destination.protocol === 'file:' &&
      !destination.pathname.startsWith(directory)
    )
      return;
    // In-page section links retain their normal scrolling behavior.
    if (
      destination.pathname === location.pathname &&
      destination.search === location.search
    )
      return;
    if (motionPreference.matches) return;

    event.preventDefault();
    if (root.classList.contains('page-leaving')) return;
    root.classList.remove('page-entering');
    root.classList.add('page-leaving');
    destination.searchParams.set('_pg', '1');
    pendingDestination = destination.href;
    navigationTimer = setTimeout(navigate, 560);
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      clearTimeout(navigationTimer);
      pendingDestination = null;
      clearTransition();
    }
  });

  motionPreference.addEventListener('change', () => {
    if (!motionPreference.matches) return;
    clearTransition();
    navigate();
  });
})();
