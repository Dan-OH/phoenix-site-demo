// Work page filters: three multi-select dropdowns (service, type, industry)
// that show and hide project cards, with removable chips for active filters.
// ?service=Strategy in the URL preselects a service.

const GROUPS = ['service', 'type', 'industry'];

function matches(card, values) {
  const services = card.dataset.services.split('|');
  return (
    (!values.service.length || values.service.some((value) => services.includes(value))) &&
    (!values.type.length || values.type.includes(card.dataset.type)) &&
    (!values.industry.length || values.industry.includes(card.dataset.industry))
  );
}

export function initWorkFilters() {
  const filters = document.querySelector('.filters');
  if (!filters) return;

  const cards = [...document.querySelectorAll('[data-project]')];
  const active = document.querySelector('[data-active-filters]');
  const clearAll = document.querySelector('.filter-tag-row [data-clear]');
  const grid = document.querySelector('.project-grid');
  const choices = (name) => [...filters.querySelectorAll(`input[name="${name}"]`)];
  const selected = (name) => choices(name).filter((input) => input.checked);

  function chip(input, name) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-chip';
    button.textContent = `${input.value} ×`;
    button.setAttribute('aria-label', `Remove ${input.value} ${name} filter`);
    button.addEventListener('click', () => {
      input.checked = false;
      apply();
      document.getElementById(`filter-${name}`).focus();
    });
    return button;
  }

  function apply() {
    const values = Object.fromEntries(GROUPS.map((name) => [name, selected(name).map((input) => input.value)]));
    let count = 0;
    for (const card of cards) {
      const visible = matches(card, values);
      card.hidden = !visible;
      if (!visible) continue;
      count++;
      // Cards revealed by filtering shouldn't wait for a scroll to appear.
      card.querySelectorAll('.pending').forEach((element) => element.classList.remove('pending'));
    }

    const hasFilters = GROUPS.some((name) => values[name].length);
    document.querySelector('[data-count]').textContent = `${count} ${count === 1 ? 'project' : 'projects'}`;
    document.querySelector('.empty-results').hidden = count > 0;
    document.querySelector('.work-end').hidden = hasFilters;
    document.querySelector('.filter-tag-row').hidden = !hasFilters;
    grid.classList.toggle('filtered', hasFilters);
    clearAll.hidden = !hasFilters;

    active.replaceChildren();
    for (const name of GROUPS) {
      const label = filters.querySelector(`[data-filter-label="${name}"]`);
      label.textContent = values[name].length ? `${values[name].length} selected` : label.dataset.defaultLabel;
      filters.querySelector(`[data-filter-all="${name}"]`).checked = !values[name].length;
      for (const input of selected(name)) active.append(chip(input, name));
    }
  }

  filters.addEventListener('submit', (event) => event.preventDefault());
  filters.addEventListener('change', (event) => {
    // Ticking "All …" clears that group's other choices.
    if (event.target.matches('[data-filter-all]')) {
      choices(event.target.dataset.filterAll).forEach((input) => {
        input.checked = false;
      });
    }
    apply();
  });
  document.querySelectorAll('[data-clear]').forEach((button) => {
    button.addEventListener('click', () => {
      GROUPS.forEach((name) =>
        choices(name).forEach((input) => {
          input.checked = false;
        }),
      );
      apply();
      document.getElementById('filter-service').focus();
    });
  });

  // Dropdowns close on an outside click or Escape.
  document.addEventListener('click', (event) => {
    filters.querySelectorAll('details[open]').forEach((details) => {
      if (!details.contains(event.target)) details.open = false;
    });
  });
  filters.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const details = event.target.closest('details');
    if (!details) return;
    details.open = false;
    details.querySelector('summary').focus();
  });

  const initialService = new URLSearchParams(location.search).get('service');
  const initial = choices('service').find((input) => input.value === initialService);
  if (initial) initial.checked = true;
  apply();
}
