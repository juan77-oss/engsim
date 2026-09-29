/* ============================================================
   cookie-consent.js — Cookie consent banner + preferences modal
   Google Consent Mode v2 compatible (GA4 + AdSense via GTM)
   engsimapp.com

   Public API (attached to window.EngSimConsent):
     .openPreferences()   — open the modal from any page element
     .getConsent()        — returns current consent object

   Storage key: 'engsim-consent-v1' (JSON in localStorage)
   Consent object schema:
     { version: 1, analytics: bool, advertising: bool, ts: ISO8601 }
   ============================================================ */

(function () {
    'use strict';

    /* ── Constants ──────────────────────────────────────────── */
    var STORAGE_KEY = 'engsim-consent-v1';
    var CONSENT_VERSION = 1;

    /* ── Helpers ─────────────────────────────────────────────── */

    /**
     * Fire a gtag('consent', 'update', ...) call.
     * Guards against gtag not being defined (e.g. before GTM loads).
     * @param {boolean} analytics
     * @param {boolean} advertising
     */
    function sendConsentToGtag(analytics, advertising) {
        if (typeof window.gtag !== 'function') return;
        window.gtag('consent', 'update', {
            'analytics_storage':    analytics    ? 'granted' : 'denied',
            'ad_storage':           advertising  ? 'granted' : 'denied',
            'ad_user_data':         advertising  ? 'granted' : 'denied',
            'ad_personalization':   advertising  ? 'granted' : 'denied'
        });
    }

    /**
     * Read saved consent from localStorage.
     * Returns null if no valid consent has been saved yet.
     * @returns {{ version: number, analytics: boolean, advertising: boolean, ts: string }|null}
     */
    function loadConsent() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var obj = JSON.parse(raw);
            if (obj && obj.version === CONSENT_VERSION) return obj;
        } catch (e) {
            /* localStorage blocked (private mode, etc.) — treat as no consent */
        }
        return null;
    }

    /**
     * Persist consent decision to localStorage.
     * @param {boolean} analytics
     * @param {boolean} advertising
     */
    function saveConsent(analytics, advertising) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                version: CONSENT_VERSION,
                analytics: analytics,
                advertising: advertising,
                ts: new Date().toISOString()
            }));
        } catch (e) { /* silent — storage may be full or blocked */ }
    }

    /* ── Build DOM ───────────────────────────────────────────── */

    /**
     * Inject the consent banner HTML into the document body.
     * Called once on DOMContentLoaded.
     */
    function buildBanner() {
        var banner = document.createElement('div');
        banner.id = 'engsim-consent-banner';
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'Cookie consent');
        banner.innerHTML = [
            '<div class="consent-banner__text">',
            '  <p class="consent-banner__title">We use cookies</p>',
            '  <p class="consent-banner__body">',
            '    We use cookies to analyze traffic and serve relevant ads. You can accept all,',
            '    reject optional cookies, or customize your preferences.',
            '    See our <a href="../../pages/privacy-policy.html">Privacy Policy</a> for details.',
            '  </p>',
            '</div>',
            '<div class="consent-banner__actions">',
            '  <button id="consent-btn-customize" class="consent-btn" type="button" aria-haspopup="dialog">Customize</button>',
            '  <button id="consent-btn-reject"    class="consent-btn" type="button">Reject optional</button>',
            '  <button id="consent-btn-accept-all" class="consent-btn" type="button">Accept all</button>',
            '</div>'
        ].join('\n');
        document.body.appendChild(banner);
    }

    /**
     * Inject the preferences modal HTML into the document body.
     * Called once on DOMContentLoaded.
     */
    function buildModal() {
        var modal = document.createElement('div');
        modal.id = 'engsim-consent-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'consent-modal-title');
        modal.innerHTML = [
            '<div class="consent-modal__backdrop" id="consent-modal-backdrop"></div>',
            '<div class="consent-modal__dialog">',

            '  <div class="consent-modal__header">',
            '    <span class="consent-modal__title" id="consent-modal-title">Cookie preferences</span>',
            '    <button class="consent-modal__close" id="consent-modal-close" type="button" aria-label="Close preferences dialog">',
            '      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"',
            '           fill="none" stroke="currentColor" stroke-width="2"',
            '           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
            '        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
            '      </svg>',
            '    </button>',
            '  </div>',

            '  <div class="consent-modal__body">',

            /* ── Category 1: Necessary (always on, disabled) ── */
            '    <div class="consent-category">',
            '      <div class="consent-category__info">',
            '        <div class="consent-category__name">Necessary cookies</div>',
            '        <div class="consent-category__desc">',
            '          Required for the site to function (theme preference, session state).',
            '          Cannot be disabled.',
            '        </div>',
            '      </div>',
            '      <label class="consent-toggle" aria-label="Necessary cookies — always on">',
            '        <input type="checkbox" id="consent-toggle-necessary" checked disabled',
            '               aria-checked="true" aria-disabled="true">',
            '        <span class="consent-toggle__track"></span>',
            '      </label>',
            '      <span class="consent-required-badge">Required</span>',
            '    </div>',

            /* ── Category 2: Analytics ── */
            '    <div class="consent-category">',
            '      <div class="consent-category__info">',
            '        <div class="consent-category__name">Analytics cookies</div>',
            '        <div class="consent-category__desc">',
            '          Help us understand how visitors interact with the site (Google Analytics).',
            '          Data is aggregated and anonymized.',
            '        </div>',
            '      </div>',
            '      <label class="consent-toggle" aria-label="Analytics cookies">',
            '        <input type="checkbox" id="consent-toggle-analytics" aria-checked="false">',
            '        <span class="consent-toggle__track"></span>',
            '      </label>',
            '    </div>',

            /* ── Category 3: Advertising ── */
            '    <div class="consent-category">',
            '      <div class="consent-category__info">',
            '        <div class="consent-category__name">Advertising cookies</div>',
            '        <div class="consent-category__desc">',
            '          Used to show relevant ads (Google AdSense). Enables ad personalization',
            '          based on browsing behavior.',
            '        </div>',
            '      </div>',
            '      <label class="consent-toggle" aria-label="Advertising cookies">',
            '        <input type="checkbox" id="consent-toggle-advertising" aria-checked="false">',
            '        <span class="consent-toggle__track"></span>',
            '      </label>',
            '    </div>',

            '  </div>', /* /.consent-modal__body */

            '  <div class="consent-modal__footer">',
            '    <button id="consent-modal-btn-reject" class="consent-btn" type="button">Reject all optional</button>',
            '    <button id="consent-modal-btn-save"   class="consent-btn" type="button">Save preferences</button>',
            '  </div>',

            '</div>' /* /.consent-modal__dialog */
        ].join('\n');
        document.body.appendChild(modal);
    }

    /* ── Banner visibility ───────────────────────────────────── */

    function showBanner() {
        var banner = document.getElementById('engsim-consent-banner');
        if (!banner) return;
        banner.classList.remove('consent-banner--hidden');
        /* rAF to trigger CSS transition after display */
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                banner.classList.add('consent-banner--visible');
            });
        });
    }

    function hideBanner() {
        var banner = document.getElementById('engsim-consent-banner');
        if (!banner) return;
        banner.classList.remove('consent-banner--visible');
        banner.classList.add('consent-banner--hidden');
    }

    /* ── Modal open / close ──────────────────────────────────── */

    /** Populate toggle states from a saved consent object before opening. */
    function syncTogglesToConsent(consent) {
        var analyticsToggle    = document.getElementById('consent-toggle-analytics');
        var advertisingToggle  = document.getElementById('consent-toggle-advertising');
        if (analyticsToggle)   { analyticsToggle.checked   = !!consent.analytics; }
        if (advertisingToggle) { advertisingToggle.checked = !!consent.advertising; }
    }

    var _previouslyFocused = null;

    function openModal() {
        var modal = document.getElementById('engsim-consent-modal');
        if (!modal) return;
        /* Sync toggles to last saved state (or defaults) */
        var saved = loadConsent();
        syncTogglesToConsent(saved || { analytics: false, advertising: false });
        /* Remember focus origin for restoration on close */
        _previouslyFocused = document.activeElement;
        modal.classList.add('consent-modal--open');
        /* Move focus inside the dialog */
        var closeBtn = document.getElementById('consent-modal-close');
        if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
        var modal = document.getElementById('engsim-consent-modal');
        if (!modal) return;
        modal.classList.remove('consent-modal--open');
        /* Restore focus */
        if (_previouslyFocused && typeof _previouslyFocused.focus === 'function') {
            _previouslyFocused.focus();
        }
    }

    /* ── Accept / Reject / Save actions ─────────────────────── */

    function applyConsent(analytics, advertising) {
        saveConsent(analytics, advertising);
        sendConsentToGtag(analytics, advertising);
        hideBanner();
        closeModal();
    }

    function acceptAll() {
        applyConsent(true, true);
    }

    function rejectAll() {
        applyConsent(false, false);
    }

    function saveFromModal() {
        var analyticsToggle    = document.getElementById('consent-toggle-analytics');
        var advertisingToggle  = document.getElementById('consent-toggle-advertising');
        var analytics   = analyticsToggle    ? analyticsToggle.checked    : false;
        var advertising = advertisingToggle  ? advertisingToggle.checked  : false;
        applyConsent(analytics, advertising);
    }

    /* ── Keyboard trap inside modal ──────────────────────────── */

    function trapFocus(e) {
        var modal = document.getElementById('engsim-consent-modal');
        if (!modal || !modal.classList.contains('consent-modal--open')) return;
        if (e.key !== 'Tab') return;

        var focusable = modal.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        var first = focusable[0];
        var last  = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    function handleEscape(e) {
        if (e.key === 'Escape') {
            var modal = document.getElementById('engsim-consent-modal');
            if (modal && modal.classList.contains('consent-modal--open')) {
                closeModal();
            }
        }
    }

    /* ── Wire up all event listeners ────────────────────────── */

    function wireEvents() {
        /* Banner buttons */
        var btnAcceptAll = document.getElementById('consent-btn-accept-all');
        var btnReject    = document.getElementById('consent-btn-reject');
        var btnCustomize = document.getElementById('consent-btn-customize');
        if (btnAcceptAll) btnAcceptAll.addEventListener('click', acceptAll);
        if (btnReject)    btnReject.addEventListener('click', rejectAll);
        if (btnCustomize) btnCustomize.addEventListener('click', openModal);

        /* Modal buttons */
        var modalClose     = document.getElementById('consent-modal-close');
        var modalBackdrop  = document.getElementById('consent-modal-backdrop');
        var modalReject    = document.getElementById('consent-modal-btn-reject');
        var modalSave      = document.getElementById('consent-modal-btn-save');
        if (modalClose)    modalClose.addEventListener('click', closeModal);
        if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
        if (modalReject)   modalReject.addEventListener('click', rejectAll);
        if (modalSave)     modalSave.addEventListener('click', saveFromModal);

        /* Keyboard */
        document.addEventListener('keydown', trapFocus);
        document.addEventListener('keydown', handleEscape);
    }

    /* ── Public API ──────────────────────────────────────────── */

    window.EngSimConsent = {
        /**
         * Programmatically open the preferences modal.
         * Called from the footer "Cookie preferences" link.
         */
        openPreferences: function () {
            openModal();
        },
        /**
         * Returns the current saved consent object, or null if not yet decided.
         */
        getConsent: function () {
            return loadConsent();
        }
    };

    /* ── Init ────────────────────────────────────────────────── */

    function init() {
        buildBanner();
        buildModal();
        wireEvents();

        var saved = loadConsent();
        if (saved) {
            /* Consent already given — restore Consent Mode state silently */
            sendConsentToGtag(saved.analytics, saved.advertising);
            /* Banner stays hidden (never shown) */
        } else {
            /* First visit — show banner */
            showBanner();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        /* DOMContentLoaded already fired (e.g. script loaded with defer) */
        init();
    }

})();
