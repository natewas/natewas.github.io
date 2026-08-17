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
