/*
 * Message display UI for Thundy AV.
 *
 * This script is registered once by background.js through
 * browser.scripting.messageDisplay.registerScripts() and then executed by
 * Thunderbird in the document of every displayed message (about:message).
 * It renders the opt-in banner, the threat/auth banner and implements the
 * time-of-click protection for links.
 *
 * All code is bundled with the add-on: nothing is fetched, evaluated or loaded
 * from a remote location.
 */
(() => {
  'use strict';

  const BANNER_ID = 'thundy-banner';
  const LINK_WARNING_ID = 'thundy-link-warning';
  const CHECK_TIMEOUT_MS = 6000;
  // Schemes that cannot be verified by the analysis providers and are therefore
  // allowed without a check (everything else is blocked unless the user confirms).
  const SAFE_SCHEMES = new Set(['mailto', 'tel', 'news', 'nntp']);

  // Verified URLs of this session (in memory only: security state must never
  // live in the DOM, where the message itself could tamper with it).
  const verifiedLinks = new Set();
  const maliciousLinks = new Map();

  let tabId = null;
  let timeOfClickEnabled = true;
  let renderedStateKey = null;

  function uiText(key, fallback, subs) {
    try {
      const value = browser.i18n.getMessage(key, subs);
      if (value) return value;
    } catch (e) { /* fall through to the bundled fallback */ }
    const values = Array.isArray(subs) ? subs.slice() : (subs === undefined ? [] : [subs]);
    return String(fallback).replace(/\$(SCHEME|SCORE|URL)\$/g, () => (values.length ? String(values.shift()) : ''));
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function removeNode(id) {
    const node = byId(id);
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function insertOnTop(node) {
    if (!document.body) return;
    document.body.insertBefore(node, document.body.firstChild);
  }

  // Design tokens of the popup/options theme (theme.css). The message view is a
  // separate content document, so the values are applied inline instead of
  // pulling in the stylesheet - they stay in sync with the 2026 redesign.
  const TONES = {
    warn: { bg: '#fff4e0', border: '#e2b269', fg: '#8a4b00' },
    danger: { bg: '#fdeceb', border: '#e5a19c', fg: '#a71d1d' },
    ok: { bg: '#e8f6ed', border: '#9ecfae', fg: '#1a6b3c' },
    neutral: { bg: '#eef0f4', border: '#d8dce3', fg: '#16181d' }
  };
  const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  function applyTone(node, tone) {
    const colors = TONES[tone] || TONES.neutral;
    node.style.backgroundColor = colors.bg;
    node.style.border = '1px solid ' + colors.border;
    node.style.color = colors.fg;
    return node;
  }

  function baseStyle(node) {
    node.style.padding = '12px';
    node.style.margin = '12px 8px';
    node.style.borderRadius = '10px';
    node.style.fontFamily = FONT_STACK;
    node.style.fontSize = '13px';
    node.style.lineHeight = '1.5';
    node.style.boxShadow = '0 2px 8px rgba(16, 20, 28, 0.10)';
    node.style.zIndex = '9999';
    return node;
  }

  function button(label) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.style.marginLeft = '8px';
    element.style.marginTop = '4px';
    element.style.padding = '6px 12px';
    element.style.borderRadius = '999px';
    element.style.border = '1px solid currentColor';
    element.style.background = 'transparent';
    element.style.color = 'inherit';
    element.style.font = 'inherit';
    element.style.cursor = 'pointer';
    return element;
  }

  function setNote(banner, text) {
    let note = banner.querySelector('.thundy-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'thundy-note';
      note.setAttribute('role', 'status');
      note.style.marginTop = '6px';
      banner.appendChild(note);
    }
    note.textContent = text;
  }

  async function sendToBackground(message) {
    try {
      return await browser.runtime.sendMessage(message);
    } catch (e) {
      return null;
    }
  }

  function requestInitialState() {
    return sendToBackground({ action: 'getMessageUiState' });
  }

  function renderBanner(state) {
    removeNode(BANNER_ID);
    const banner = baseStyle(document.createElement('div'));
    banner.id = BANNER_ID;

    const threat = state.threat || null;
    const score = threat && typeof threat.score === 'number' ? threat.score : 0;

    if (score >= 50) {
      applyTone(banner, 'danger');
      banner.style.fontWeight = '600';
      const title = document.createElement('div');
      title.textContent = '\u{1F534} \u26A0\uFE0F ' + uiText('bannerThreatTitle', 'Thundy AV warning') +
        ' (' + uiText('bannerThreatScore', 'Risk score: $SCORE$ of 100', [String(score)]) + ')';
      banner.appendChild(title);
      const list = document.createElement('ul');
      list.style.margin = '0';
      list.style.paddingLeft = '20px';
      list.style.fontWeight = 'normal';
      for (const reason of (threat.reasons || [])) {
        const item = document.createElement('li');
        item.textContent = reason;
        list.appendChild(item);
      }
      banner.appendChild(list);
    } else if (threat && threat.authStatus === 'pass') {
      applyTone(banner, 'ok');
      banner.textContent = '\u{1F7E2} \u{1F6E1}\uFE0F ' + uiText('bannerAuthPass', 'Sender verified (SPF/DKIM/DMARC passed)');
    } else if (state.optInNeeded) {
      applyTone(banner, 'warn');
      const text = document.createElement('span');
      text.textContent = state.consentGiven
        ? uiText('bannerTitleOptIn', 'Thundy AV: real-time scanning is not enabled for this message.')
        : uiText('bannerConsentMissing', 'External analysis is disabled in the options \u2013 nothing was transmitted.');
      banner.appendChild(text);

      const choices = [
        { label: uiText('bannerScanOnce', 'Scan this message once'), persist: false },
        { label: uiText('bannerScanSender', 'Always scan this sender'), persist: true }
      ];
      for (const choice of choices) {
        const element = button(choice.label);
        element.addEventListener('click', async () => {
          const buttons = banner.querySelectorAll('button');
          buttons.forEach((entry) => { entry.disabled = true; entry.setAttribute('aria-busy', 'true'); });
          element.textContent = uiText('bannerScanRunning', 'Scanning\u2026');
          const response = await sendToBackground({
            action: 'requestScan',
            messageId: state.messageId,
            senderEmail: state.senderEmail,
            persist: choice.persist
          });
          buttons.forEach((entry) => { entry.disabled = false; entry.removeAttribute('aria-busy'); });

          if (response && response.success) {
            element.textContent = uiText('bannerScanDone', 'Scan finished');
            if (choice.persist) {
              setNote(banner, uiText('bannerSenderOptIn', 'This sender is now scanned automatically.'));
            }
          } else if (response && response.error === 'permission_denied') {
            element.textContent = uiText('bannerPermissionDenied', 'Required host permission was denied');
          } else if (response && (response.error === 'EXTERNAL_ANALYSIS_DISABLED' || response.code === 'EXTERNAL_ANALYSIS_DISABLED')) {
            setNote(banner, uiText('bannerConsentMissing', 'External analysis is disabled in the options \u2013 nothing was transmitted.'));
          } else {
            element.textContent = uiText('bannerScanFailed', 'Scan failed');
          }
        });
        banner.appendChild(element);
      }

      const optionsButton = button(uiText('bannerOpenOptions', 'Open options'));
      optionsButton.addEventListener('click', () => {
        try { browser.runtime.openOptionsPage(); } catch (e) { /* ignore */ }
      });
      banner.appendChild(optionsButton);
    } else {
      return;
    }

    insertOnTop(banner);
  }


  function stateKey(state) {
    return [
      state.messageId,
      state.optInNeeded ? 'optin' : 'scan',
      state.threat ? state.threat.score : '',
      state.threat ? state.threat.authStatus : ''
    ].join('|');
  }

  // Visual marker for links in the message text (this is what the option
  // "Time-of-Click protection" switches on); the check itself happens on click.
  function markLinks() {
    if (!document.body) return;
    const links = document.body.querySelectorAll('a[href]');
    links.forEach((link) => {
      if (link.href && link.href.startsWith('http') && link.dataset.thundyMarked !== '1') {
        link.dataset.thundyMarked = '1';
        link.style.borderBottom = '1px dashed #b26a00';
        try {
          link.title = uiText('tocLinkMarked', 'Protected by Thundy AV time-of-click protection');
        } catch (e) { /* ignore */ }
      }
    });
  }

  function showLinkWarning(url, reasons, allowOpen) {
    removeNode(LINK_WARNING_ID);
    const warning = baseStyle(document.createElement('div'));
    warning.id = LINK_WARNING_ID;
    applyTone(warning, 'danger');
    warning.style.position = 'fixed';
    warning.style.left = '10px';
    warning.style.right = '10px';
    warning.style.bottom = '10px';

    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.textContent = uiText('tocWarningTitle', 'Thundy AV blocked this link');
    warning.appendChild(title);

    const list = document.createElement('ul');
    list.style.margin = '4px 0';
    list.style.paddingLeft = '20px';
    const entries = (reasons && reasons.length) ? reasons : [uiText('tocBlocked', 'The link could not be verified.')];
    for (const reason of entries) {
      const item = document.createElement('li');
      item.textContent = reason;
      list.appendChild(item);
    }
    warning.appendChild(list);

    const target = document.createElement('div');
    target.style.wordBreak = 'break-all';
    target.textContent = String(url);
    warning.appendChild(target);

    if (allowOpen) {
      const openButton = button(uiText('tocOpenAnyway', 'Open the link anyway'));
      openButton.addEventListener('click', () => {
        verifiedLinks.add(url);
        removeNode(LINK_WARNING_ID);
        openUrl(url);
      });
      warning.appendChild(openButton);
    }

    const closeButton = button(uiText('tocClose', 'Dismiss'));
    closeButton.addEventListener('click', () => removeNode(LINK_WARNING_ID));
    warning.appendChild(closeButton);

    insertOnTop(warning);
  }

  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') return CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  // Opens a verified URL by dispatching the click again, so Thunderbird's own
  // handler (and the user's "open links in" preference) stays in charge.
  function openUrl(url) {
    const link = document.querySelector('a[href="' + cssEscape(url) + '"]');
    if (link) {
      link.click();
      return;
    }
    sendToBackground({ action: 'openVerifiedLink', url });
  }

  function applyState(state) {
    if (!state) return;
    if (typeof state.tabId === 'number' || typeof state.tabId === 'string') tabId = state.tabId;
    timeOfClickEnabled = state.timeOfClickProtection !== false;
    const key = stateKey(state);
    if (key !== renderedStateKey) {
      renderedStateKey = key;
      renderBanner(state);
    }
    markLinks();
  }


  async function checkLink(url) {
    if (maliciousLinks.has(url)) {
      return { status: 'MALICIOUS', reasons: maliciousLinks.get(url) };
    }
    const state = await sendToBackground({ action: 'checkLinkState', url });
    if (state && (state.status === 'MALICIOUS' || state.status === 'MALICIOUS_VISUAL')) {
      maliciousLinks.set(url, state.reasons || []);
      return { status: state.status, reasons: state.reasons || [] };
    }
    return state || { status: 'ERROR', reasons: [] };
  }

  async function onLinkClick(event) {
    if (!timeOfClickEnabled) return;
    if (!event || !event.target || typeof event.target.closest !== 'function') return;
    const link = event.target.closest('a[href]');
    if (!link) return;
    const url = link.href;
    if (!url || verifiedLinks.has(url)) return;

    if (maliciousLinks.has(url)) {
      event.preventDefault();
      event.stopPropagation();
      showLinkWarning(url, maliciousLinks.get(url), true);
      return;
    }

    let scheme = '';
    try {
      scheme = new URL(url).protocol.replace(':', '').toLowerCase();
    } catch (e) {
      return;
    }
    if (SAFE_SCHEMES.has(scheme)) return;
    if (scheme !== 'http' && scheme !== 'https') {
      // Fail closed: schemes the analysis providers cannot verify are blocked
      // unless the user confirms explicitly.
      event.preventDefault();
      event.stopPropagation();
      showLinkWarning(url, [uiText('tocBlockedScheme', 'This link uses the scheme "$SCHEME$", which Thundy AV cannot verify.', [scheme])], true);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const spinner = baseStyle(document.createElement('div'));
    spinner.id = LINK_WARNING_ID;
    applyTone(spinner, 'warn');
    spinner.style.position = 'fixed';
    spinner.style.left = '10px';
    spinner.style.right = '10px';
    spinner.style.bottom = '10px';
    spinner.textContent = uiText('tocChecking', 'Thundy AV is checking this link before it is opened\u2026');
    insertOnTop(spinner);

    const result = await Promise.race([
      checkLink(url),
      new Promise((resolve) => setTimeout(() => resolve({ status: 'TIMEOUT', reasons: [] }), CHECK_TIMEOUT_MS))
    ]);

    removeNode(LINK_WARNING_ID);

    const status = result && result.status;
    // Nothing known against the link (CLEAN/UNKNOWN without any configured
    // provider) means the link may be opened; anything else stays blocked.
    if (status === 'CLEAN' || status === 'UNKNOWN') {
      verifiedLinks.add(url);
      openUrl(url);
      return;
    }

    // MALICIOUS, MALICIOUS_VISUAL, TIMEOUT or ERROR: the link stays blocked,
    // the reason is shown and the user keeps the last word.
    const reasons = (result && result.reasons && result.reasons.length)
      ? result.reasons
      : [uiText('tocBlocked', 'The link could not be verified.')];
    showLinkWarning(url, reasons, true);
  }

  document.addEventListener('click', onLinkClick, true);
  // Middle click (and other auxiliary clicks) must not bypass the check.
  document.addEventListener('auxclick', onLinkClick, true);

  try {
    browser.runtime.onMessage.addListener((message) => {
      if (!message || message.type !== 'thundy:messageState' || !message.state) return;
      // The state is rendered for exactly one tab. Until the own tab id is known
      // (the initial getMessageUiState answer carries it) broadcasts are ignored:
      // acting on a foreign state would show the wrong banner.
      if (tabId === null) return;
      if (message.tabId !== undefined && String(message.tabId) !== String(tabId)) return;
      applyState(message.state);
    });
  } catch (e) { /* ignore */ }

  async function init() {
    const state = await requestInitialState();
    applyState(state);
    if (!state || state.pending) {
      // The evaluation may still be running in the background: poll a few times
      // so the banner appears even if the broadcast has been missed.
      let attempts = 0;
      const timer = setInterval(async () => {
        attempts += 1;
        const next = await requestInitialState();
        if (next && !next.pending) {
          clearInterval(timer);
          applyState(next);
        } else if (attempts >= 10) {
          clearInterval(timer);
        }
      }, 600);
    }
  }

  init();
})();

