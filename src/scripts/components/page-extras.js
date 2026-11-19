// Small single-page behaviours.

import { reducedMotion } from '../lib/media-queries.js';

// Project pages: the "Project overview" accordion fades its content in.
export function initProjectOverview() {
  for (const overview of document.querySelectorAll('.project-overview')) {
    overview.addEventListener('toggle', () => {
      if (!overview.open || reducedMotion.matches) return;
      overview.querySelector('div').animate(
        [
          { opacity: 0, transform: 'translateY(-6px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 260, easing: 'ease-out' },
      );
    });
  }
}

// Contact page: the enquiry form opens a pre-filled draft in the visitor's email app.
export function initEnquiryForm() {
  const form = document.querySelector('form.enquiry-form');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const subject = `Website enquiry from ${fields.get('name')}`;
    const body =
      `Name: ${fields.get('name')}\nEmail: ${fields.get('email')}\n` +
      `Phone: ${fields.get('phone') || 'Not supplied'}\n\n${fields.get('project')}`;
    form.querySelector('.form-status').textContent = 'Your email app will open a draft. Review it and send it there.';
    location.href = `mailto:hello@thephoenixgroup.ca?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

// Contact page: keeps the map pin on the office as the cropped aerial photo resizes.
const OFFICE = { x: 927, y: 402 }; // office position in the photo, in image pixels
const PIN_ANCHOR = { x: 72, y: 44 }; // the pin's point, within the marker graphic

export function initOfficeMap() {
  const map = document.querySelector('.map-link');
  if (!map) return;
  const image = map.querySelector('img');
  const marker = map.querySelector('.map-marker');
  if (!image || !marker) return;

  function position() {
    if (!image.naturalWidth) return;
    const width = map.clientWidth;
    const height = map.clientHeight;
    // The photo uses object-fit: cover, so work out its scale and crop.
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const left = (width - image.naturalWidth * scale) / 2 + OFFICE.x * scale - PIN_ANCHOR.x;
    const top = (height - image.naturalHeight * scale) / 2 + OFFICE.y * scale - PIN_ANCHOR.y;
    marker.style.left = `${left}px`;
    marker.style.top = `${top}px`;
  }

  image.addEventListener('load', position);
  new ResizeObserver(position).observe(map);
  position();
}
