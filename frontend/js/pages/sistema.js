// Navegación interactiva del Hilo del Sistema
const links = [...document.querySelectorAll('.sis-index a[data-target]')];
const items = links
  .map((link) => document.getElementById(link.dataset.target))
  .filter(Boolean);

function setActive(id) {
  links.forEach((link) => {
    const active = link.dataset.target === id;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
}

if ('IntersectionObserver' in window && items.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    },
    { rootMargin: '-20% 0px -65% 0px' }
  );
  items.forEach((item) => observer.observe(item));
}

setActive(location.hash ? location.hash.slice(1) : items[0]?.id);
