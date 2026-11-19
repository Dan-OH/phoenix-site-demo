// Site entry point, loaded on every page. Each component looks for its own
// markup and does nothing if the page doesn't have it.
//
// public/transitions.js is separate on purpose: it runs in <head>, before the
// page paints, to start the page-enter animation.

import { initButtonInk } from './components/button-ink.js';
import { initClientTicker } from './components/client-ticker.js';
import { initHeadlineInk } from './components/headline-ink.js';
import { initHeroReel } from './components/hero-reel.js';
import { initLetterRipple } from './components/letter-ripple.js';
import { initLogoMorph } from './components/logo-morph.js';
import { initMobileMenu } from './components/mobile-menu.js';
import { initNavUnderline } from './components/nav-underline.js';
import { initEnquiryForm, initOfficeMap, initProjectOverview } from './components/page-extras.js';
import { initPointerHover } from './components/pointer-hover.js';
import { initReveal } from './components/reveal.js';
import { initWorkCursor } from './components/work-cursor.js';
import { initWorkFilters } from './components/work-filters.js';
import { initWorkPreviews } from './components/work-previews.js';

// Header and site-wide
initPointerHover();
initMobileMenu();
initLetterRipple();
initLogoMorph();
initReveal();

// Interactive components
initHeadlineInk();
initButtonInk();
initWorkPreviews();
initWorkCursor();
initClientTicker();
initHeroReel();

// Page-specific
initWorkFilters();
initProjectOverview();
initEnquiryForm();
initOfficeMap();

// Concepts page
initNavUnderline();
