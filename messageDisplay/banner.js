/**
 * Thundy AV message display script.
 *
 * Registered by background.js through the documented Manifest V3 API
 * (`browser.scripting.messageDisplay.registerScripts`). It renders every
 * in-message UI element: threat banner, sender-verified badge, per-message
 * opt-in banner (scan once / scan sender permanently) and the Time-of-Click
 * link markers.
 *
 * All state comes from the background script - the script itself never talks to
 * an analysis provider, so no data can leave the device from here.
 */

const THUNDY_FALLBACKS = {
  bannerScanOnce: 'Scan this message once',
  bannerScanSender: 'Always scan this sender',
  bannerTitleOptIn: 'Thundy AV: real-time scanning is not enabled for this message.',
  bannerNoteOptIn: 'Scanning transmits data to external analysis services, but only if you enabled it in the add-on settings and only after you gave your consent. See the add-on options.',
  bannerScanRunning: 'Scanning…',
  bannerScanDone: 'Scan finished',
  bannerScanFailed: 'Scan failed',
  bannerPermissionDenied: 'Required host permission was denied',
  bannerConsentMissing: 'External analysis is disabled in the options – nothing was transmitted.',
  bannerThreatTitle: 'Thundy AV warning',
  bannerThreatScore: 'Risk score: $SCORE$ of 100',
  bannerAuthPass: 'Sender verified (SPF/DKIM/DMARC passed)',
  bannerOpenOptions: 'Open options',
  bannerSenderOptIn: 'This sender is now scanned automatically.'
};

function thundyText(key, fallback, subs) {
  let text = fallback;
  try {
    const localized = browser.i18n.getMessage(key, subs);
    if (localized) text = localized;
  } catch (e) { /* use the fallback */ }
  return spinPlaceholders(text, subs);
}

function spinPlaceholders(text, subs) {
  const values = Array.isArray(subs) ? subs.slice() : (subs === undefined ? [] : [subs]);
  return text.replace(/\$(SCORE|URL|JOBID|ERROR)\$/g, () => (values.length ? String(values.shift()) : ''));
}

function thundyRemove(id) {
  const node = document.getElementById(id);
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

function thundyRenderThreat(state) {
  const threat = state.threat || {};
  const score = typeof threat.score === 'number' ? threat.score : 0;

  if (score >= 50) {
    thundyRemove('thundy-auth-badge');
    let banner = document.getElementById('thundy-threat-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'thundy-threat-banner';
      document.body.prepend(banner);
    }
    banner.textContent = '';

    const title = document.createElement('div');
    title.className = 'thundy-banner-title';
    title.textContent = '🔴 ⚠️ ' + thundyText('bannerThreatTitle', THUNDY_FALLBACKS.bannerThreatTitle) +
      ' (' + thundyText('bannerThreatScore', THUNDY_FALLBACKS.bannerThreatScore, [String(score)]) + ')';
    banner.appendChild(title);

    const reasons = Array.isArray(threat.reasons) ? threat.reasons : [];
    if (reasons.length > 0) {
      const list = document.createElement('ul');
      list.className = 'thundy-banner-reasons';
      for (const reason of reasons) {
        const item = document.createElement('li');
        item.textContent = String(reason);
        list.appendChild(item);
      }
      banner.appendChild(list);
    }
    return;
  }

  thundyRemove('thundy-threat-banner');

  if (threat.authStatus === 'pass') {
    let badge = document.getElementById('thundy-auth-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'thundy-auth-badge';
      document.body.prepend(badge);
    }
    badge.textContent = '🟢 🛡️ ' + thundyText('bannerAuthPass', THUNDY_FALLBACKS.bannerAuthPass);
    return;
  }

  thundyRemove('thundy-auth-badge');
}

function thundyRenderOptIn(state, actions) {
  if (!state.showOptIn) {
    thundyRemove('thundy-optin-banner');
    return;
  }

  let banner = document.getElementById('thundy-optin-banner');
  if (banner) return;

  banner = document.createElement('div');
  banner.id = 'thundy-optin-banner';

  const title = document.createElement('span');
  title.textContent = thundyText('bannerTitleOptIn', THUNDY_FALLBACKS.bannerTitleOptIn);
  banner.appendChild(title);

  const actionsRow = document.createElement('span');
  actionsRow.className = 'thundy-banner-actions';
  banner.appendChild(actionsRow);

  const note = document.createElement('div');
  note.className = 'thundy-banner-note';
  note.textContent = state.consent
    ? thundyText('bannerNoteOptIn', THUNDY_FALLBACKS.bannerNoteOptIn)
    : thundyText('bannerConsentMissing', THUNDY_FALLBACKS.bannerConsentMissing);
  banner.appendChild(note);

  function showOptionsButton() {
    if (banner.querySelector('#thundy-open-options')) return;
    const optionsButton = document.createElement('button');
    optionsButton.id = 'thundy-open-options';
    optionsButton.type = 'button';
    optionsButton.textContent = thundyText('bannerOpenOptions', THUNDY_FALLBACKS.bannerOpenOptions);
    optionsButton.addEventListener('click', () => browser.runtime.openOptionsPage());
    note.appendChild(optionsButton);
  }

  function createButton(label, persist) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', async () => {
      const all = actionsRow.querySelectorAll('button');
      all.forEach(b => { b.disabled = true; b.setAttribute('aria-busy', 'true'); });
      button.textContent = thundyText('bannerScanRunning', THUNDY_FALLBACKS.bannerScanRunning);
      try {
        const response = await actions.requestScan({ persist });
        if (response && response.success) {
          button.textContent = thundyText('bannerScanDone', THUNDY_FALLBACKS.bannerScanDone);
          button.removeAttribute('aria-busy');
          all.forEach(b => { b.disabled = false; });
          if (persist) note.textContent = thundyText('bannerSenderOptIn', THUNDY_FALLBACKS.bannerSenderOptIn);
        } else if (response && response.error === 'permission_required') {
          note.textContent = thundyText('bannerPermissionDenied', THUNDY_FALLBACKS.bannerPermissionDenied);
          showOptionsButton();
          all.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
          button.textContent = label;
        } else if (response && response.error === 'EXTERNAL_ANALYSIS_DISABLED') {
          note.textContent = thundyText('bannerConsentMissing', THUNDY_FALLBACKS.bannerConsentMissing);
          showOptionsButton();
          all.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
          button.textContent = label;
        } else {
          button.textContent = thundyText('bannerScanFailed', THUNDY_FALLBACKS.bannerScanFailed);
          all.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
        }
      } catch (e) {
        button.textContent = thundyText('bannerScanFailed', THUNDY_FALLBACKS.bannerScanFailed);
        all.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
      }
    });
    actionsRow.appendChild(button);
  }

  createButton(thundyText('bannerScanOnce', THUNDY_FALLBACKS.bannerScanOnce), false);
  createButton(thundyText('bannerScanSender', THUNDY_FALLBACKS.bannerScanSender), true);

  if (!state.consent) showOptionsButton();

  document.body.prepend(banner);
}

function thundyRenderTimeOfClick(state) {
  if (!state.timeOfClickProtection) return;
  const urls = Array.isArray(state.urls) ? state.urls : [];
  if (urls.length === 0) return;

  const links = document.querySelectorAll('a');
  links.forEach(link => {
    if (link.href && link.href.startsWith('http')) {
      link.title = 'Protected by Thundy Time-of-Click';
      link.classList.add('thundy-toc-link');
    }
  });
}

/** Renders the complete banner state. Exposed for unit tests. */
function thundyRenderDisplayState(state) {
  if (!state || state.mode !== 'ready' || !document.body) return;
  thundyRenderThreat(state);
  thundyRenderOptIn(state, {
    requestScan: ({ persist }) => browser.runtime.sendMessage({
      action: 'requestScan',
      messageId: state.messageId,
      senderEmail: state.senderEmail,
      persist
    })
  });
  thundyRenderTimeOfClick(state);
}

(async function thundyBannerMain() {
  let attempts = 0;
  const maxAttempts = 8;

  async function refresh() {
    try {
      const state = await browser.runtime.sendMessage({ action: 'getDisplayState' });
      if (state && state.mode === 'ready') {
        thundyRenderDisplayState(state);
        return;
      }
      if (attempts++ < maxAttempts) {
        setTimeout(refresh, 400);
      }
    } catch (e) {
      /* background not reachable yet - the next message display will retry */
    }
  }

  try {
    browser.runtime.onMessage.addListener((message) => {
      if (message && message.action === 'updateDisplayState') {
        attempts = maxAttempts;
        thundyRenderDisplayState(message.state);
      }
    });
  } catch (e) { /* ignore */ }

  await refresh();
})();
