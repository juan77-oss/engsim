/* ============================================================
   platform.js — Shared navbar + footer injector
   engsim.app

   HOW IT WORKS:
   Each page has:
     <div id="nav-placeholder"></div>    ← navbar goes here
     <div id="footer-placeholder"></div> ← footer goes here

   This script detects the current page depth and builds
   correct relative paths automatically. No more broken links
   when you copy a simulator folder.

   TO UPDATE NAV OR FOOTER: edit this file only.
   Changes apply to every page instantly.
   ============================================================ */

(function () {
    'use strict';

    /* ── 1. Detect root path based on folder depth ───────────────
       Root = the folder containing index.html (home page).
       Depth 0 = root         → path = "./"
       Depth 1 = /simulators/ → path = "../"
       Depth 2 = /simulators/mohr/ → path = "../../"
    ──────────────────────────────────────────────────────────── */
    function getRootPath() {
        var parts = window.location.pathname.replace(/\/$/, '').split('/');
        // Count how many levels deep we are from the repo root.
        // GitHub Pages: /repo-name/simulators/mohr/ → parts = ['','repo-name','simulators','mohr']
        // We need to go up (parts.length - 2) levels from the file's directory.
        var depth = parts.length - 2; // -1 for empty string at start, -1 for filename/index
        if (depth < 1) depth = 0;
        var path = '';
        for (var i = 0; i < depth; i++) path += '../';
        return path || './';
    }

    var ROOT = getRootPath();

    /* ── 2. Detect active nav link ───────────────────────────── */
    function isActive(href) {
        var current = window.location.pathname;
        // "simulators" link is active for any simulator page
        if (href.includes('simulators') && current.includes('simulators')) return true;
        // Home is active only on root index
        if (href === ROOT + 'index.html' && (current === '/' || current.endsWith('index.html') && !current.includes('simulators'))) return true;
        return false;
    }

    /* ── 3. Build nav HTML ───────────────────────────────────── */
    var navHTML = [
        '<a class="skip-link" href="#main-content">Skip to content</a>',
        '<header class="nav" role="banner">',
        '  <div class="nav__inner">',

        '    <a href="' + ROOT + 'index.html" class="nav__brand" aria-label="EngSim — Home">',
        '      <div class="nav__brand-icon" aria-hidden="true">',
        '        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">',
        '          <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.67.07-1.08s-.03-.75-.07-1.08l2.32-1.81c.21-.16.27-.46.13-.7l-2.2-3.81a.55.55 0 0 0-.67-.23l-2.73 1.1c-.57-.44-1.18-.81-1.84-1.08L14 2.42C13.93 2.18 13.7 2 13.43 2h-2.86c-.27 0-.5.18-.57.42l-.41 2.47c-.66.27-1.27.64-1.84 1.08L4.75 4.87a.54.54 0 0 0-.67.23L1.88 8.91c-.14.25-.08.54.13.7l2.32 1.81C4.29 11.75 4.25 12.1 4.25 12.5s.04.75.08 1.08L2.01 15.39c-.21.17-.27.46-.13.7l2.2 3.81c.13.25.41.33.66.23l2.74-1.1c.57.44 1.17.81 1.83 1.08l.41 2.47c.07.24.3.42.57.42h2.86c.27 0 .5-.18.57-.42l.41-2.47c.66-.27 1.26-.64 1.83-1.08l2.74 1.1c.25.1.53.02.66-.23l2.2-3.81c.14-.24.08-.53-.13-.7l-2.32-1.81z"/>',
        '        </svg>',
        '      </div>',
        '      <div>',
        '        <span class="nav__brand-name">EngSim</span>',
        '        <span class="nav__brand-sub">Engineering Simulators</span>',
        '      </div>',
        '    </a>',

        '    <nav aria-label="Main navigation">',
        '      <ul class="nav__links" id="nav-links">',
        '        <li><a href="' + ROOT + 'index.html" class="nav__link' + (isActive(ROOT + 'index.html') ? ' is-active' : '') + '">Home</a></li>',
        '        <li><a href="' + ROOT + 'simulators/index.html" class="nav__link' + (isActive(ROOT + 'simulators/index.html') ? ' is-active' : '') + '">Simulators</a></li>',
        '        <li><a href="' + ROOT + 'pages/about.html" class="nav__link">About</a></li>',
        '      </ul>',
        '    </nav>',

        '    <div class="nav__actions">',
        '      <button id="theme-toggle" class="nav__icon-btn" aria-label="Toggle dark/light theme" title="Toggle dark / light mode">',
        '        <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
        '        <svg class="icon-sun"  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
        '      </button>',
        '      <button class="nav__icon-btn nav__hamburger" id="nav-hamburger" aria-label="Toggle navigation menu" aria-expanded="false">',
        '        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
        '      </button>',
        '    </div>',

        '  </div>',
        '</header>'
    ].join('\n');

    /* ── 4. Build footer HTML ────────────────────────────────── */
    var year = new Date().getFullYear();
    var footerHTML = [
        '<footer class="page-footer" role="contentinfo">',
        '  <div class="container">',
        '    <div class="page-footer__inner">',
        '      <span class="page-footer__brand">EngSim</span>',
        '      <nav aria-label="Footer navigation">',
        '        <ul class="page-footer__links">',
        '          <li><a href="' + ROOT + 'index.html">Home</a></li>',
        '          <li><a href="' + ROOT + 'simulators/index.html">Simulators</a></li>',
        '          <li><a href="' + ROOT + 'pages/about.html">About</a></li>',
        '          <li><a href="' + ROOT + 'pages/privacy-policy.html">Privacy Policy</a></li>',
        '          <li><a href="' + ROOT + 'pages/contact.html">Contact</a></li>',
        '        </ul>',
        '      </nav>',
        '      <span class="page-footer__legal">&copy; ' + year + ' EngSim. Free to use.</span>',
        '    </div>',
        '  </div>',
        '</footer>'
    ].join('\n');

    /* ── 5. Inject into placeholders ─────────────────────────── */
    var navEl = document.getElementById('nav-placeholder');
    var footerEl = document.getElementById('footer-placeholder');
    if (navEl) navEl.innerHTML = navHTML;
    if (footerEl) footerEl.innerHTML = footerHTML;

    /* ── 6. Wire up hamburger ────────────────────────────────── */
    var hamburger = document.getElementById('nav-hamburger');
    var navLinks = document.getElementById('nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            var open = navLinks.classList.toggle('is-open');
            hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    /* ── 7. Wire up theme toggle ─────────────────────────────── */
    var THEME_KEY = 'engsim-theme';

    function applyTheme(dark) {
        document.body.classList.toggle('dark', dark);
    }

    // Load saved theme or OS preference
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) {
        applyTheme(saved === 'dark');
    } else {
        applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    // Toggle button (injected, so we use event delegation)
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('#theme-toggle');
        if (!btn) return;
        var isDark = document.body.classList.toggle('dark');
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    });

})();