// Apple-style auto-advancing showcase carousel.
// Advancing is driven by the active segment's CSS fill animation: when it
// finishes (animationend), we move to the next slide. Pausing freezes the
// animation via a CSS class, which also stops advancing. Activates on any
// element with [data-showcase]; harmless on pages without one.
document.querySelectorAll('[data-showcase]').forEach((showcase) => {
  const slides = Array.from(showcase.querySelectorAll('.showcase-slide'));
  const segs = Array.from(showcase.querySelectorAll('.showcase-seg'));
  const playBtn = showcase.querySelector('.showcase-playpause');
  if (slides.length === 0) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let paused = false;

  function render() {
    slides.forEach((s, i) => s.classList.toggle('is-active', i === index));
    segs.forEach((seg, i) => {
      seg.classList.toggle('done', i < index);
      seg.classList.toggle('active', i === index);
    });
    // Restart the active segment's fill animation cleanly.
    const activeFill = segs[index] && segs[index].querySelector('.showcase-seg-fill');
    if (activeFill) {
      activeFill.style.animation = 'none';
      void activeFill.offsetWidth; // force reflow so the animation re-triggers
      activeFill.style.animation = '';
    }
  }

  function go(i) {
    index = (i + slides.length) % slides.length;
    render();
  }

  function setPaused(state) {
    paused = state;
    showcase.classList.toggle('is-paused', paused);
    if (playBtn) playBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
  }

  // When the active fill finishes, advance (unless paused).
  showcase.addEventListener('animationend', (e) => {
    if (e.animationName === 'showcase-fill' && !paused) go(index + 1);
  });

  // Click a segment to jump there (and resume playing).
  segs.forEach((seg, i) => seg.addEventListener('click', () => {
    setPaused(false);
    go(i);
  }));

  if (playBtn) playBtn.addEventListener('click', () => setPaused(!paused));

  // Respect reduced-motion: don't auto-advance; leave it on the first slide.
  if (reduceMotion) setPaused(true);

  render();
});
