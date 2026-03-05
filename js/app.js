// Smooth scroll for all anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Close mobile nav if open
      const navLinks = document.getElementById('nav-links');
      const menuToggle = document.getElementById('menu-toggle');
      if (navLinks && navLinks.classList.contains('nav-open')) {
        navLinks.classList.remove('nav-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    }
  });
});

// Sticky nav shadow on scroll
const header = document.getElementById('site-header');
if (header) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      header.classList.add('nav-scrolled');
    } else {
      header.classList.remove('nav-scrolled');
    }
  }, { passive: true });
}

// Mobile nav toggle
const menuToggle = document.getElementById('menu-toggle');
const navLinks = document.getElementById('nav-links');
if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('nav-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
}
