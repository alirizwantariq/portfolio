/* Ali Rizwan Tariq — portfolio
   Small, dependency-free enhancements. The site works fully without this file. */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme toggle ---------- */
  (function theme() {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

    function current() {
      var set = document.documentElement.getAttribute('data-theme');
      if (set === 'light' || set === 'dark') return set;
      return systemDark.matches ? 'dark' : 'light';
    }

    function label() {
      var next = current() === 'dark' ? 'light' : 'dark';
      toggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      toggle.setAttribute('title', 'Switch to ' + next + ' theme');
    }

    toggle.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      label();
    });

    // Follow the OS if the user never made an explicit choice.
    systemDark.addEventListener('change', function () {
      var stored = null;
      try { stored = localStorage.getItem('theme'); } catch (e) {}
      if (stored !== 'light' && stored !== 'dark') label();
    });

    label();
  })();

  /* ---------- Header border once scrolled ---------- */
  (function stickyHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    var ticking = false;
    function update() {
      header.classList.toggle('is-stuck', window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* ---------- Reveal on scroll ---------- */
  (function reveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    items.forEach(function (el) { observer.observe(el); });

    // Safety net: nothing stays invisible if the observer never fires.
    window.setTimeout(function () {
      items.forEach(function (el) { el.classList.add('is-visible'); });
    }, 3000);
  })();

  /* ---------- Current section in the nav ---------- */
  (function activeNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.site-nav a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var sections = [];

    links.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (section) { map[id] = link; sections.push(section); }
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = map[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach(function (l) { l.removeAttribute('aria-current'); });
          link.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });

    sections.forEach(function (s) { observer.observe(s); });
  })();

  /* ---------- Copy email ---------- */
  (function copyEmail() {
    var button = document.getElementById('copy-email');
    var status = document.getElementById('copy-status');
    if (!button || !status) return;

    var timer;

    function say(message) {
      status.textContent = message;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { status.textContent = ''; }, 2600);
    }

    button.addEventListener('click', function () {
      var email = button.getAttribute('data-email') || '';

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(email).then(
          function () { say('Copied ' + email + ' to your clipboard.'); },
          function () { say('Copy failed — the address is ' + email); }
        );
        return;
      }

      // Fallback for non-secure contexts (e.g. plain http).
      var field = document.createElement('textarea');
      field.value = email;
      field.setAttribute('readonly', '');
      field.style.position = 'absolute';
      field.style.left = '-9999px';
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand('copy');
        say('Copied ' + email + ' to your clipboard.');
      } catch (e) {
        say('Copy failed — the address is ' + email);
      }
      document.body.removeChild(field);
    });
  })();
})();
