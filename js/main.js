/* ======================================
   Orchestrate Solutions — Main Script
   ====================================== */

(function () {
  'use strict';

  // --- Nav scroll effect ---
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('nav--scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  // --- Mobile nav toggle ---
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('active');
    });

    // Close menu on link click
    links.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        links.classList.remove('active');
      });
    });
  }

  // --- Scroll-reveal for sections ---
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.section, .card, .timeline__item, .feature').forEach(function (el) {
    el.classList.add('reveal');
    observer.observe(el);
  });

  // --- Inject reveal CSS ---
  var style = document.createElement('style');
  style.textContent = [
    '.reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }',
    '.revealed { opacity: 1; transform: translateY(0); }'
  ].join('\n');
  document.head.appendChild(style);
})();
