/**
 * Orchestrate Solutions — Remote Badge
 * <cup-powered-by> web component
 *
 * Usage: Add to any site footer:
 *   <script src="https://orchestrate.solutions/badge.js" defer></script>
 *   <cup-powered-by></cup-powered-by>
 *
 * Attributes:
 *   org  — display name (default: "Orchestrate")
 *   href — link target (default: "https://orchestrate.solutions")
 */
(function () {
  'use strict';

  if (customElements.get('cup-powered-by')) return;

  var IDLE = typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : function (cb) { setTimeout(cb, 1); };

  var STYLES = [
    'cup-powered-by { display: block; text-align: center; padding: 0.25rem 0; font-size: 0.8rem; opacity: 0; transition: opacity 0.3s ease; }',
    'cup-powered-by[data-ready] { opacity: 1; }',
    '.cup-powered-by__link { color: inherit; text-decoration: none; font-weight: 600; }',
    '.cup-powered-by__link:hover { text-decoration: underline; }'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('cup-badge-css')) return;
    var s = document.createElement('style');
    s.id = 'cup-badge-css';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  class CupPoweredBy extends HTMLElement {
    static get observedAttributes() { return ['org', 'href']; }

    connectedCallback() {
      var self = this;
      var go = function () {
        IDLE(function () { self._render(); });
      };
      if (document.readyState === 'complete') go();
      else window.addEventListener('load', go, { once: true });
    }

    attributeChangedCallback() {
      if (this.isConnected) this._render();
    }

    _render() {
      injectStyles();
      var org = this.getAttribute('org') || 'Orchestrate';
      var href = this.getAttribute('href') || 'https://orchestrate.solutions';

      this.innerHTML =
        '<span class="cup-powered-by">An ' +
        '<a href="' + href + '" target="_blank" rel="noopener" class="cup-powered-by__link">' +
        org + '</a> Solution</span>';

      this.setAttribute('data-ready', '');
    }
  }

  customElements.define('cup-powered-by', CupPoweredBy);
})();
