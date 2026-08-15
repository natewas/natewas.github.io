// Lightweight, dependency-free image carousel.
// Activates on any element with [data-carousel]; safe to include on pages
// that don't have one (it simply does nothing).
document.querySelectorAll('[data-carousel]').forEach((carousel) => {
  const track = carousel.querySelector('.carousel-track');
  const slides = Array.from(carousel.querySelectorAll('.carousel-slide'));
  const prev = carousel.querySelector('.carousel-btn.prev');
  const next = carousel.querySelector('.carousel-btn.next');
  const dotsWrap = carousel.querySelector('.carousel-dots');
  if (!track || slides.length === 0) return;

  // Single image: nothing to navigate. Flag it so CSS hides the controls.
  if (slides.length < 2) {
    carousel.setAttribute('data-single', '');
    return;
  }

  let index = 0;

  // Build one dot per slide.
  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Go to image ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsWrap && dotsWrap.appendChild(dot);
    return dot;
  });

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, di) => d.classList.toggle('active', di === index));
  }

  prev && prev.addEventListener('click', () => goTo(index - 1));
  next && next.addEventListener('click', () => goTo(index + 1));

  // Arrow-key navigation when the carousel is focused/hovered.
  carousel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(index - 1);
    if (e.key === 'ArrowRight') goTo(index + 1);
  });
});
