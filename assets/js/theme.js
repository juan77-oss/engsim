/**
 * theme.js — Dark / light mode toggle
 * engsim.app
 *
 * NOTE: If you load platform.js, theme is already handled there.
 * This file exists only for pages or simulators that need
 * theme toggling WITHOUT loading the full platform.js.
 *
 * In most cases you do NOT need this file separately —
 * just load platform.js and it handles everything.
 */

(function () {
    'use strict';

    var THEME_KEY = 'engsim-theme';

    function applyTheme(dark) {
        document.body.classList.toggle('dark', dark);
    }

    // Apply on load — before paint to avoid flash
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) {
        applyTheme(saved === 'dark');
    } else {
        applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    // Wire toggle button if present
    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;
        btn.addEventListener('click', function () {
            var isDark = document.body.classList.toggle('dark');
            localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        });
    });

})();