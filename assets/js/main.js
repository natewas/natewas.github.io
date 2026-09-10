// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const links = document.getElementById('navLinks');
toggle.addEventListener('click', () => links.classList.toggle('open'));
// Close menu after tapping a link (mobile)
links.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => links.classList.remove('open'))
);
// Auto year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Accordion (expandable outcome tabs) — harmless on pages without one
document.querySelectorAll('.accordion-head').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.accordion-item');
    const open = item.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
});

// Masonry gallery — full uncropped photos of any orientation, packed into rows.
// Progressive enhancement: without JS the .gallery stays a plain grid.
const galleries = document.querySelectorAll('.gallery');
if (galleries.length) {
  const ROW = 10; // px, must match .gallery.is-masonry grid-auto-rows
  const GAP = 22; // px, must match .gallery gap
  const layout = (gallery) => {
    gallery.classList.add('is-masonry');
    gallery.querySelectorAll('figure').forEach((fig) => {
      const h = fig.getBoundingClientRect().height;
      fig.style.gridRowEnd = 'span ' + Math.ceil((h + GAP) / (ROW + GAP));
    });
  };
  const layoutAll = () => galleries.forEach(layout);
  // Re-run as each image resolves its height (covers lazy-loaded and cached).
  galleries.forEach((gallery) =>
    gallery.querySelectorAll('img').forEach((img) => {
      if (img.complete) return;
      img.addEventListener('load', () => layout(gallery));
      img.addEventListener('error', () => layout(gallery));
    })
  );
  window.addEventListener('load', layoutAll);
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutAll, 150);
  });
  layoutAll();
}
